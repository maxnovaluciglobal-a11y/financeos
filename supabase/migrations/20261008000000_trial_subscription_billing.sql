-- T10 · Prueba de Pro por 14 días CON tarjeta (fase 4 · Billing, 2026-10-08).
-- NO APLICADA. Aplicar ANTES de desplegar la versión nueva de stripe-webhook
-- (docs/billing-trial-runbook.md, paso 4). Todo es aditivo o compatible hacia
-- atrás: el webhook actual (sin desplegar) sigue funcionando con esto aplicado.
--
-- Antes de aplicar, verificar contra producción (regla del repo, ver
-- supabase/migrations/README.md) que issue_license / extend_license_expiry
-- siguen siendo las de 20260912010312_add_subscription_support.sql:
--   select oid::regprocedure, pg_get_functiondef(oid) from pg_proc
--    where proname in ('issue_license','extend_license_expiry','revoke_license');
--
-- Qué cambia:
-- 1. licenses.stripe_subscription_id: ya existe desde 20260912010312. Se repite
--    el "add column if not exists" solo para que esta migración no dependa del
--    orden; no hace nada si ya está.
-- 2. subscription_expiry_pending (tabla nueva): resuelve la carrera "invoice
--    antes que checkout". Stripe no garantiza el orden de los eventos; con la
--    prueba, la invoice de $0 sale junto con el checkout. Antes, si
--    invoice.payment_succeeded llegaba primero, extend_license_expiry
--    actualizaba 0 filas, el checkout emitía con expires_at NULL y la licencia
--    quedaba Pro para siempre. Ahora extend guarda el vencimiento acá y
--    issue_license lo toma al emitir.
-- 3. webhook_events_processed (tabla nueva): idempotencia por event id para el
--    aviso de fin de prueba (customer.subscription.trial_will_end), para no
--    mandar dos veces el mismo email si Stripe reentrega el evento.
-- 4. issue_license: parámetro nuevo opcional p_expires_at (default null). Se
--    hace DROP de la firma de 6 argumentos y se crea la de 7: si convivieran,
--    PostgREST no podría elegir entre las dos con una llamada de 6 argumentos
--    con nombre (PGRST203). Quien llame con 6 argumentos sigue funcionando por
--    el default.
-- 5. extend_license_expiry: ahora devuelve jsonb {ok, updated, pending} (antes
--    void, por eso DROP + CREATE: create or replace no puede cambiar el tipo de
--    retorno), solo mueve expires_at hacia adelante (greatest) y, si no hay
--    licencia, deja el vencimiento en subscription_expiry_pending.
-- 6. revoke_license_by_subscription (nueva): para customer.subscription.deleted.
--    Mismo modelo que revoke_license (supabase-license-revoke.sql): SECURITY
--    DEFINER, solo service_role, y solo cambia status a 'revoked' — nunca
--    borra filas ni datos personales.
-- 7. Permisos: 20260912010312 creó issue_license (6 args) y
--    extend_license_expiry sin "revoke ... from anon". Con los default
--    privileges de Supabase eso puede dejarlas ejecutables por anon vía
--    PostgREST (security definer). No se verificó en producción. Acá se
--    recrean y se fija explícitamente: solo service_role.

alter table public.licenses
  add column if not exists stripe_subscription_id text;

-- ── 2. Vencimientos que llegaron antes que la licencia ─────────────────────
create table if not exists public.subscription_expiry_pending (
  stripe_subscription_id text primary key,
  expires_at             timestamptz not null,
  received_at            timestamptz not null default now()
);
comment on table public.subscription_expiry_pending is
  'T10: vencimiento de una invoice de suscripción que llegó antes que checkout.session.completed. issue_license lo consume. Solo ids de Stripe y fechas, sin datos personales. Se purga a los 30 días.';
alter table public.subscription_expiry_pending enable row level security;
revoke all on table public.subscription_expiry_pending from public, anon, authenticated;
grant select, insert, update, delete on table public.subscription_expiry_pending to service_role;

-- ── 3. Idempotencia de eventos de Stripe ───────────────────────────────────
create table if not exists public.webhook_events_processed (
  event_id     text primary key,
  event_type   text,
  processed_at timestamptz not null default now()
);
comment on table public.webhook_events_processed is
  'T10: event ids de Stripe ya procesados por stripe-webhook (hoy: customer.subscription.trial_will_end). Evita mandar dos veces el mismo email.';
alter table public.webhook_events_processed enable row level security;
revoke all on table public.webhook_events_processed from public, anon, authenticated;
grant select, insert, delete on table public.webhook_events_processed to service_role;

-- ── 4. issue_license con p_expires_at ──────────────────────────────────────
drop function if exists public.issue_license(text, text, text, text, text, text);

create or replace function public.issue_license(
  p_key            text,
  p_plan           text,
  p_email          text default null,
  p_session        text default null,
  p_payment_intent text default null,
  p_subscription   text default null,
  p_expires_at     timestamptz default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_pending timestamptz;
  v_expires timestamptz := p_expires_at;
begin
  if p_subscription is not null then
    delete from public.subscription_expiry_pending
     where stripe_subscription_id = p_subscription
    returning expires_at into v_pending;
    if v_pending is not null then
      v_expires := greatest(coalesce(v_expires, v_pending), v_pending);
    end if;
  end if;

  insert into public.licenses (key_hash, plan, email, stripe_session_id, payment_intent_id, stripe_subscription_id, expires_at)
  values (encode(digest(upper(trim(p_key)), 'sha256'), 'hex'),
          coalesce(p_plan, 'personal'), p_email, p_session, p_payment_intent, p_subscription, v_expires)
  on conflict (key_hash) do nothing;
end;
$function$;

revoke all on function public.issue_license(text, text, text, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.issue_license(text, text, text, text, text, text, timestamptz) to service_role;

-- ── 5. extend_license_expiry: solo hacia adelante + pending ────────────────
drop function if exists public.extend_license_expiry(text, timestamptz);

create function public.extend_license_expiry(
  p_subscription text,
  p_expires_at   timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_count int;
begin
  if p_subscription is null or p_expires_at is null then
    return jsonb_build_object('ok', false, 'error', 'bad_args');
  end if;

  -- greatest: una reentrega vieja de Stripe (o una invoice de $0 que llega
  -- después del vencimiento provisional) nunca acorta el acceso. Una fila con
  -- expires_at NULL (licencia de suscripción emitida antes de esta migración)
  -- queda con la fecha de la invoice.
  update public.licenses
     set expires_at = greatest(coalesce(expires_at, p_expires_at), p_expires_at)
   where stripe_subscription_id = p_subscription;
  get diagnostics v_count = row_count;

  if v_count > 0 then
    return jsonb_build_object('ok', true, 'updated', v_count);
  end if;

  -- 0 filas: la licencia todavía no existe (invoice antes que checkout) o es
  -- una suscripción de otro producto de la cuenta de Stripe. Se guarda igual;
  -- las ajenas se purgan solas.
  insert into public.subscription_expiry_pending as p (stripe_subscription_id, expires_at)
  values (p_subscription, p_expires_at)
  on conflict (stripe_subscription_id) do update
     set expires_at  = greatest(p.expires_at, excluded.expires_at),
         received_at = now();

  delete from public.subscription_expiry_pending
   where received_at < now() - interval '30 days';

  return jsonb_build_object('ok', true, 'updated', 0, 'pending', true);
end;
$function$;

revoke all on function public.extend_license_expiry(text, timestamptz) from public, anon, authenticated;
grant execute on function public.extend_license_expiry(text, timestamptz) to service_role;

-- ── 6. revoke_license_by_subscription ──────────────────────────────────────
create or replace function public.revoke_license_by_subscription(p_subscription_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare v_count int;
begin
  if p_subscription_id is null then
    return jsonb_build_object('ok', false, 'error', 'bad_args');
  end if;
  update public.licenses
     set status = 'revoked'
   where stripe_subscription_id = p_subscription_id
     and status = 'active';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    return jsonb_build_object('ok', false, 'error', 'not_found_or_already_revoked');
  end if;
  return jsonb_build_object('ok', true, 'revoked', v_count);
end;
$function$;

revoke all on function public.revoke_license_by_subscription(text) from public, anon, authenticated;
grant execute on function public.revoke_license_by_subscription(text) to service_role;
