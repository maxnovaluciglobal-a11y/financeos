-- 20261020030000_trial_activation_emails.sql
-- Auditoría 360, C-35 / COM-10: secuencia de activación durante la prueba de
-- 14 días de Pro (correos de los días 1, 3 y 10).
--
-- 1. licenses gana is_trial y trial_ends_at: stripe-webhook marca la licencia
--    como prueba al emitirla (RPC mark_license_trial).
-- 2. trial_activation_emails: una fila por prueba, con el estado de cada correo
--    y la baja. Solo la lee y escribe service_role (la función
--    send-trial-activation-email y el webhook); nada para anon/authenticated.
-- 3. trial_activation_due(now): filas que tienen un correo pendiente HOY. La
--    prueba tiene que seguir activa (licencia activa, sin vencer) y sin baja.
-- 4. unsubscribe_trial_activation(id): baja con un clic (List-Unsubscribe) y
--    desde el enlace del pie (página de baja de la app).
-- 5. Cron diario 14:47 UTC (11:47 Chile), mismo patrón que los nurtures.
--
-- Aditiva e idempotente.

alter table public.licenses add column if not exists is_trial boolean not null default false;
alter table public.licenses add column if not exists trial_ends_at timestamptz;

create table if not exists public.trial_activation_emails (
  id               uuid primary key default gen_random_uuid(),
  -- Borrar la licencia (delete_account_data) borra también esta fila y su email.
  key_hash         text not null unique references public.licenses(key_hash) on delete cascade,
  email            text not null,
  lang             text,
  trial_started_at timestamptz not null default now(),
  trial_ends_at    timestamptz not null,
  day1_sent_at     timestamptz,
  day3_sent_at     timestamptz,
  day10_sent_at    timestamptz,
  unsubscribed_at  timestamptz,
  created_at       timestamptz not null default now()
);

alter table public.trial_activation_emails enable row level security;
revoke all on public.trial_activation_emails from public, anon, authenticated;
grant all on public.trial_activation_emails to service_role;

-- La marca la hace stripe-webhook con la clave recién emitida (nunca viaja al
-- cliente). Idempotente: un reintento de Stripe no duplica la fila.
create or replace function public.mark_license_trial(p_key text, p_trial_ends_at timestamptz, p_email text, p_lang text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text := public.fnos_resolve_hash(p_key);
  v_id uuid;
begin
  if v_hash is null or p_trial_ends_at is null then return jsonb_build_object('ok', false, 'error', 'invalid_args'); end if;
  update public.licenses set is_trial = true, trial_ends_at = p_trial_ends_at where key_hash = v_hash;
  if not found then return jsonb_build_object('ok', false, 'error', 'license_not_found'); end if;
  if coalesce(trim(p_email), '') <> '' then
    insert into public.trial_activation_emails (key_hash, email, lang, trial_ends_at)
    values (v_hash, lower(trim(p_email)), nullif(p_lang, ''), p_trial_ends_at)
    on conflict (key_hash) do nothing
    returning id into v_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end; $$;

revoke all on function public.mark_license_trial(text, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.mark_license_trial(text, timestamptz, text, text) to service_role;

-- Pendientes: la función elige qué correo toca (dueStep en trialActivationLogic.ts).
-- Acá solo se filtra lo que nunca debe recibir nada: baja, licencia no activa,
-- prueba vencida o la secuencia completa.
create or replace function public.trial_activation_due(p_now timestamptz default now())
returns table (id uuid, email text, lang text, trial_started_at timestamptz, trial_ends_at timestamptz,
               day1_sent_at timestamptz, day3_sent_at timestamptz, day10_sent_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.email, t.lang, t.trial_started_at, t.trial_ends_at, t.day1_sent_at, t.day3_sent_at, t.day10_sent_at
    from public.trial_activation_emails t
    join public.licenses l on l.key_hash = t.key_hash
   where t.unsubscribed_at is null
     and t.day10_sent_at is null
     and l.status = 'active'
     and l.is_trial
     and t.trial_ends_at > p_now
     and t.trial_started_at <= p_now - interval '1 day'
   order by t.trial_started_at
   limit 200
$$;

revoke all on function public.trial_activation_due(timestamptz) from public, anon, authenticated;
grant execute on function public.trial_activation_due(timestamptz) to service_role;

create or replace function public.mark_trial_activation_sent(p_id uuid, p_step text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_step = 'day1' then update public.trial_activation_emails set day1_sent_at = now() where id = p_id and day1_sent_at is null;
  elsif p_step = 'day3' then update public.trial_activation_emails set day3_sent_at = now() where id = p_id and day3_sent_at is null;
  elsif p_step = 'day10' then update public.trial_activation_emails set day10_sent_at = now() where id = p_id and day10_sent_at is null;
  else raise exception 'invalid_step';
  end if;
end; $$;

revoke all on function public.mark_trial_activation_sent(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_trial_activation_sent(uuid, text) to service_role;

-- Baja: el id (uuid aleatorio, solo viaja en el correo) es la credencial, igual
-- que unsubscribe_starter_lead. No devuelve el email.
create or replace function public.unsubscribe_trial_activation(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.trial_activation_emails set unsubscribed_at = coalesce(unsubscribed_at, now()) where id = p_id;
  return jsonb_build_object('ok', found);
end; $$;

revoke all on function public.unsubscribe_trial_activation(uuid) from public;
grant execute on function public.unsubscribe_trial_activation(uuid) to anon, authenticated, service_role;

-- Cron diario. Reemplaza el job si ya existía.
do $$ begin
  perform cron.unschedule('trial-activation-daily');
exception when others then null; end $$;

select cron.schedule(
  'trial-activation-daily',
  '47 14 * * *',
  $$
  select net.http_post(
    url := 'https://nelwgbcddwiaimzbcuas.supabase.co/functions/v1/send-trial-activation-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(private.get_secret('cron_secret'), '')
    ),
    body := jsonb_build_object('mode', 'cron'),
    timeout_milliseconds := 30000
  );
  $$
);
