-- Cancelación online propia (reemplaza el Formspree de de/kuendigen.html)
-- y desistimiento online (reemplaza el Formspree de de/widerrufen.html).
--
-- Propósito
-- ---------
-- § 312k BGB ("Kündigungsbutton") y las leyes de renovación automática de
-- EE. UU. (California Bus. & Prof. Code § 17602, entre otras) exigen que el
-- cliente pueda cancelar online, sin iniciar sesión, y que reciba de
-- inmediato una confirmación en forma de texto con el contenido de su
-- declaración y la fecha/hora en que la hizo. Esta migración guarda esa
-- declaración server-side (antes solo existía como un envío a Formspree).
--
-- Desistimiento (kind = 'withdrawal'): § 356a BGB ("Widerrufsbutton", en
-- vigor desde el 19-jun-2026) pide lo mismo para el derecho de desistimiento
-- de 14 días: botón "Vertrag widerrufen" → página con nombre, identificación
-- del contrato y medio para la confirmación → botón "Widerruf bestätigen", y
-- (Abs. 4) confirmación inmediata en forma de texto con el contenido y la
-- fecha/hora de recepción. Usa la misma tabla, RPC y Edge Function: el
-- correo al cliente cambia de texto y el aviso interno sale marcado URGENTE
-- (hay 14 días para reembolsar, § 357 Abs. 1 BGB). En un desistimiento no
-- hay motivo ni fecha de fin: la RPC guarda reason y requested_date en null
-- aunque lleguen.
--
-- Flujo (mismo patrón "lead → email" que diagnostico.html):
--   1. La landing (cancelar.html, en/cancel.html, de/kuendigen.html,
--      de/widerrufen.html vía /cancel-form.js) llama a la RPC pública submit_cancellation_request
--      con la anon/publishable key. Devuelve {ok, id, created_at}.
--   2. Con ese id llama a la Edge Function send-cancellation-confirmation,
--      que lee la fila con service role y manda (a) la confirmación al
--      cliente en su idioma y (b) el aviso interno. Los flags
--      customer_email_sent_at / internal_email_sent_at la hacen idempotente.
--
-- Seguridad
-- ---------
-- - RLS activada SIN policies para anon/authenticated: nadie puede leer ni
--   escribir la tabla vía REST salvo service role. Además se revocan los
--   grants de tabla que Supabase da por defecto a anon/authenticated.
-- - Lectura para los dos correos admin del CRM (mismo criterio que
--   diagnostico_leads_admin_select), para poder verlas desde ?admin=crm o
--   el SQL Editor con sesión.
-- - submit_cancellation_request es SECURITY DEFINER con search_path fijo,
--   revoke de public/anon/authenticated y grant explícito solo a anon (la
--   landing no tiene sesión) y service_role.
-- - Rate limit en la RPC: la función es pública y cada fila dispara un
--   correo a la dirección que se ingresó, así que sin tope cualquiera podría
--   usarla para mandar correos a terceros desde nuestro dominio. Tope: 5
--   declaraciones por email en 24 h y 300 en total por hora. Al pasarlo la
--   RPC devuelve {ok:false, error:'rate_limited'} y la página ofrece el
--   mailto de respaldo a support@moyiq.app (la cancelación nunca queda
--   bloqueada, solo cambia de canal).
--
-- Columnas además de las pedidas: `plan` (qué contrato: el formulario alemán
-- ya lo preguntaba y sin eso soporte no sabe si es Pro mensual/anual o una
-- cuenta Starter) y los dos timestamps de envío para idempotencia.
-- requested_date null = "en la próxima fecha posible".
--
-- No toca ninguna tabla existente. Idempotente (if not exists / or replace;
-- el check de kind se recrea por nombre para que re-aplicar el archivo deje
-- siempre la lista vigente, también si la tabla ya existía).

create table if not exists public.cancellation_requests (
  id                     uuid primary key default gen_random_uuid(),
  created_at             timestamptz not null default now(),
  lang                   text check (lang is null or lang in ('es', 'en', 'pt', 'de')),
  name                   text,
  email                  text not null,
  plan                   text check (plan is null or plan in ('pro_monthly', 'pro_yearly', 'starter', 'unsure')),
  contract_ref           text,
  kind                   text not null default 'ordinary',
  reason                 text,
  requested_date         date,
  user_agent             text,
  status                 text not null default 'received' check (status in ('received', 'processing', 'done', 'rejected')),
  processed_at           timestamptz,
  customer_email_sent_at timestamptz,
  internal_email_sent_at timestamptz
);

alter table public.cancellation_requests drop constraint if exists cancellation_requests_kind_check;
alter table public.cancellation_requests add constraint cancellation_requests_kind_check
  check (kind in ('ordinary', 'extraordinary', 'withdrawal'));

create index if not exists cancellation_requests_email_created_idx
  on public.cancellation_requests (lower(email), created_at desc);
create index if not exists cancellation_requests_created_idx
  on public.cancellation_requests (created_at desc);

alter table public.cancellation_requests enable row level security;

revoke all on table public.cancellation_requests from anon, authenticated;
grant select on table public.cancellation_requests to authenticated;

drop policy if exists "cancellation_requests_admin_select" on public.cancellation_requests;
create policy "cancellation_requests_admin_select"
  on public.cancellation_requests for select
  to authenticated
  using (auth.jwt() ->> 'email' in ('walterlamadriz@gmail.com', 'maxnovaluciglobal@gmail.com'));

create or replace function public.submit_cancellation_request(
  p_email          text,
  p_name           text default null,
  p_plan           text default null,
  p_contract_ref   text default null,
  p_kind           text default 'ordinary',
  p_reason         text default null,
  p_requested_date date default null,
  p_lang           text default null,
  p_user_agent     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text;
  v_name  text;
  v_lang  text;
  v_kind  text;
  v_plan  text;
  v_id    uuid;
  v_at    timestamptz;
begin
  v_email := trim(p_email);
  if v_email is null or v_email = '' or length(v_email) > 254
     or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;

  v_name := nullif(trim(coalesce(p_name, '')), '');
  if v_name is null or length(v_name) > 200 then
    return jsonb_build_object('ok', false, 'error', 'invalid_name');
  end if;

  v_kind := coalesce(nullif(trim(p_kind), ''), 'ordinary');
  if v_kind not in ('ordinary', 'extraordinary', 'withdrawal') then
    return jsonb_build_object('ok', false, 'error', 'invalid_kind');
  end if;

  -- Desistimiento: sin motivo ni fecha de fin (ver cabecera).
  if v_kind = 'withdrawal' then
    p_reason := null;
    p_requested_date := null;
  end if;

  v_plan := nullif(trim(coalesce(p_plan, '')), '');
  if v_plan is not null and v_plan not in ('pro_monthly', 'pro_yearly', 'starter', 'unsure') then
    v_plan := 'unsure';
  end if;

  if length(coalesce(p_contract_ref, '')) > 300 or length(coalesce(p_reason, '')) > 2000 then
    return jsonb_build_object('ok', false, 'error', 'too_long');
  end if;

  -- Fecha deseada: no antes de ayer (husos horarios) ni más de 5 años adelante.
  if p_requested_date is not null
     and (p_requested_date < current_date - 1 or p_requested_date > current_date + 1826) then
    return jsonb_build_object('ok', false, 'error', 'invalid_date');
  end if;

  v_lang := split_part(replace(lower(trim(p_lang)), '_', '-'), '-', 1);
  if v_lang is null or v_lang not in ('es', 'en', 'pt', 'de') then
    v_lang := null;
  end if;

  if (select count(*) from public.cancellation_requests
       where lower(email) = lower(v_email) and created_at > now() - interval '24 hours') >= 5
     or (select count(*) from public.cancellation_requests
       where created_at > now() - interval '1 hour') >= 300 then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;

  insert into public.cancellation_requests
    (lang, name, email, plan, contract_ref, kind, reason, requested_date, user_agent)
  values (
    v_lang,
    v_name,
    v_email,
    v_plan,
    nullif(trim(coalesce(p_contract_ref, '')), ''),
    v_kind,
    nullif(trim(coalesce(p_reason, '')), ''),
    p_requested_date,
    nullif(left(coalesce(p_user_agent, ''), 400), '')
  )
  returning id, created_at into v_id, v_at;

  return jsonb_build_object('ok', true, 'id', v_id, 'created_at', v_at);
end;
$$;

revoke all on function public.submit_cancellation_request(text, text, text, text, text, text, date, text, text) from public, anon, authenticated;
grant  execute on function public.submit_cancellation_request(text, text, text, text, text, text, date, text, text) to anon, service_role;

notify pgrst, 'reload schema';

-- Verificación después de aplicar:
-- select has_function_privilege('anon', 'public.submit_cancellation_request(text,text,text,text,text,text,date,text,text)', 'execute');  -- true
-- select has_function_privilege('authenticated', 'public.submit_cancellation_request(text,text,text,text,text,text,date,text,text)', 'execute'); -- false
-- select has_table_privilege('anon', 'public.cancellation_requests', 'select'); -- false
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'cancellation_requests_kind_check';
--   -- CHECK ((kind = ANY (ARRAY['ordinary'::text, 'extraordinary'::text, 'withdrawal'::text])))
