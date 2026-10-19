-- Auditoría 360 (19-oct-2026): C-16 parte servidor (MKT-4) y C-35 (COM-7).
-- Aditiva e idempotente.
--
-- Problema: el doble opt-in confirmaba el consentimiento (consent_confirmed_at)
-- pero nadie pasaba esa dirección a la lista del newsletter (segmentos de
-- Resend vía moyiq-newsletter-proxy /api/subscribe). La lista no crecía sola.
--
-- 1. newsletter_synced_at en las 4 tablas de leads: cuándo se agregó la
--    dirección confirmada al segmento del newsletter.
-- 2. invest_leads gana lang, consent_token y optin_email_sent_at (como las
--    otras tablas), y register_invest_lead genera el token si hay
--    consentimiento: así Invest puede mandar el correo de confirmación (COM-7).
-- 3. newsletter_signups: altas que vienen solo de un formulario de newsletter
--    (blog, Diagnóstico, Invest), con register_newsletter_signup (pública, con
--    el mismo límite por IP que el resto de register_*).
-- 4. confirm_marketing_consent también confirma invest_leads y
--    newsletter_signups.
-- 5. Job newsletter-sync cada 10 minutos: llama a la Edge Function
--    newsletter-sync, que suscribe las direcciones confirmadas y sin baja y
--    marca newsletter_synced_at. Sin trigger: si el proxy está caído, la
--    próxima corrida lo reintenta.

-- === 1 y 2. Columnas ========================================================

alter table public.starter_leads     add column if not exists newsletter_synced_at timestamptz;
alter table public.diagnostico_leads add column if not exists newsletter_synced_at timestamptz;
alter table public.demo_leads        add column if not exists newsletter_synced_at timestamptz;
alter table public.invest_leads      add column if not exists newsletter_synced_at timestamptz;
alter table public.invest_leads      add column if not exists lang text;
alter table public.invest_leads      add column if not exists consent_token uuid;
alter table public.invest_leads      add column if not exists optin_email_sent_at timestamptz;
create unique index if not exists invest_leads_consent_token_key on public.invest_leads (consent_token);

create or replace function public.register_invest_lead(p_email text, p_perfil text default null, p_score integer default null,
  p_fuente text default null, p_consent_marketing boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_email text; v_perfil text; v_id uuid; v_score integer := p_score; v_consent boolean;
begin
  v_email := lower(btrim(p_email));
  if v_email is null or v_email = '' or length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false);
  end if;
  if not private.lead_rate_ok('invest') then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  v_perfil := nullif(left(coalesce(p_perfil, ''), 20), '');
  if v_perfil is not null and v_perfil not in ('conservador', 'moderado', 'agresivo') then v_perfil := null; end if;
  if v_score is not null and (v_score < 0 or v_score > 100) then v_score := null; end if;
  v_consent := coalesce(p_consent_marketing, false);

  perform pg_advisory_xact_lock(hashtextextended('invest_leads:' || v_email, 0));
  select id into v_id from public.invest_leads where lower(email) = v_email order by created_at limit 1;
  if v_id is not null then
    update public.invest_leads
       set perfil = coalesce(v_perfil, perfil), score = coalesce(v_score, score)
     where id = v_id;
    if v_consent then
      update public.invest_leads
         set consent_marketing = true, consent_token = coalesce(consent_token, gen_random_uuid())
       where id = v_id and consent_confirmed_at is null and unsubscribed_at is null;
    end if;
    return jsonb_build_object('ok', true, 'id', v_id, 'existing', true);
  end if;

  insert into public.invest_leads (email, perfil, score, fuente, consent_marketing, consent_token, consent_confirmed_at)
  values (v_email, v_perfil, v_score, nullif(left(coalesce(p_fuente, ''), 60), ''), v_consent,
          case when v_consent then gen_random_uuid() end, null)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;
revoke all on function public.register_invest_lead(text, text, integer, text, boolean) from public;
grant execute on function public.register_invest_lead(text, text, integer, text, boolean) to anon, authenticated;

-- === 3. newsletter_signups ===================================================

create table if not exists public.newsletter_signups (
  id                   uuid primary key default gen_random_uuid(),
  email                text not null,
  product              text not null,
  lang                 text,
  source               text,
  consent_marketing    boolean not null default true,
  consent_token        uuid not null default gen_random_uuid(),
  consent_confirmed_at timestamptz,
  optin_email_sent_at  timestamptz,
  unsubscribed_at      timestamptz,
  newsletter_synced_at timestamptz,
  created_at           timestamptz not null default now(),
  constraint newsletter_signups_product_check check (product in ('moyiq', 'invest')),
  constraint newsletter_signups_email_check check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254)
);
comment on table public.newsletter_signups is
  'C-16: altas desde formularios de newsletter (blog, Diagnóstico, Invest) con doble opt-in. Una fila por (email, producto). newsletter-sync la pasa al segmento de Resend al confirmar.';
create unique index if not exists newsletter_signups_email_product_key on public.newsletter_signups (lower(email), product);
create unique index if not exists newsletter_signups_consent_token_key on public.newsletter_signups (consent_token);
alter table public.newsletter_signups enable row level security;
revoke all on public.newsletter_signups from public, anon, authenticated;
grant select on public.newsletter_signups to authenticated;
grant select, insert, update, delete on public.newsletter_signups to service_role;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'newsletter_signups'
                 and policyname = 'newsletter_signups_admin_select') then
    create policy newsletter_signups_admin_select on public.newsletter_signups
      for select to authenticated
      using (((select auth.jwt()) ->> 'email') = 'maxnovaluciglobal@gmail.com');
  end if;
end
$$;

create or replace function public.register_newsletter_signup(p_email text, p_product text default 'moyiq',
  p_lang text default null, p_source text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_email text; v_product text; v_lang text; v_id uuid; v_confirmed timestamptz; v_unsub timestamptz;
begin
  v_email := lower(btrim(p_email));
  if v_email is null or v_email = '' or length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;
  v_product := lower(btrim(coalesce(p_product, 'moyiq')));
  if v_product not in ('moyiq', 'invest') then
    return jsonb_build_object('ok', false, 'error', 'invalid_product');
  end if;
  if not private.lead_rate_ok('newsletter') then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  v_lang := split_part(replace(lower(btrim(p_lang)), '_', '-'), '-', 1);
  if v_lang is null or v_lang not in ('es', 'en', 'pt', 'de') then v_lang := null; end if;

  perform pg_advisory_xact_lock(hashtextextended('newsletter_signups:' || v_product || ':' || v_email, 0));
  select id, consent_confirmed_at, unsubscribed_at into v_id, v_confirmed, v_unsub
    from public.newsletter_signups where lower(email) = v_email and product = v_product;
  if v_id is not null then
    if v_unsub is not null and v_confirmed is null then
      update public.newsletter_signups set unsubscribed_at = null where id = v_id;
    end if;
    return jsonb_build_object('ok', true, 'id', v_id, 'existing', true, 'confirmed', v_confirmed is not null);
  end if;

  insert into public.newsletter_signups (email, product, lang, source)
  values (v_email, v_product, v_lang, nullif(left(btrim(coalesce(p_source, '')), 60), ''))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;
revoke all on function public.register_newsletter_signup(text, text, text, text) from public;
grant execute on function public.register_newsletter_signup(text, text, text, text) to anon, authenticated;

-- === 4. confirm_marketing_consent: + invest_leads y newsletter_signups =======

create or replace function public.confirm_marketing_consent(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_created timestamptz;
  v_table   text;
begin
  if p_token is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  foreach v_table in array array['starter_leads', 'diagnostico_leads', 'demo_leads', 'invest_leads', 'newsletter_signups'] loop
    execute format('select created_at from public.%I where consent_token = $1 and consent_marketing', v_table)
       into v_created using p_token;
    if v_created is not null then
      if v_created < now() - interval '30 days' then
        return jsonb_build_object('ok', false, 'error', 'expired');
      end if;
      execute format('update public.%I set consent_confirmed_at = coalesce(consent_confirmed_at, now()) where consent_token = $1', v_table)
        using p_token;
      return jsonb_build_object('ok', true);
    end if;
  end loop;

  return jsonb_build_object('ok', false, 'error', 'invalid_token');
end;
$function$;

-- === 5. Job newsletter-sync ==================================================

do $$
begin
  if exists (select 1 from cron.job where jobname = 'newsletter-sync') then
    perform cron.unschedule('newsletter-sync');
  end if;
end
$$;

select cron.schedule(
  'newsletter-sync',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://nelwgbcddwiaimzbcuas.supabase.co/functions/v1/newsletter-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(private.get_secret('cron_secret'), '')
    ),
    body := jsonb_build_object('mode', 'cron'),
    timeout_milliseconds := 30000
  );
  $$
);
