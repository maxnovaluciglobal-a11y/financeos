-- Auditoría 360 (19-oct-2026): C-19 (SEG-1) y C-23 (SEG-11, SEG-12, SEG-15,
-- DAT-11, DAT-12, INV-N5). Aditiva e idempotente.
--
-- C-19 · Leads sin límite
--   a) anon/authenticated ya no insertan directo en las tablas de leads: toda
--      alta pasa por register_* (SECURITY DEFINER), que fija consent_confirmed_at
--      en null. Antes anon podía insertar la fila con el consentimiento ya
--      "confirmado" y saltarse el doble opt-in.
--   b) Un correo = una fila por tabla: register_* normaliza a minúsculas y, si
--      el correo ya existe, devuelve la fila existente (no crea otra, así la
--      bienvenida no se repite). Límite por IP (hash, sin guardar la IP) y
--      global por tabla y por hora en private.lead_rate_events.
-- C-23 · Endurecimiento
--   grants sobrantes (incluido TRUNCATE, que no pasa por RLS) y privilegios por
--   defecto del esquema public; search_path fijo en las 3 funciones que no lo
--   tenían; set_license_email ya no pisa el email de otra licencia;
--   (select auth.uid()) en las políticas; CHECK de formato de email; vista de
--   candidatos a retención (sin borrado automático: D-18 sigue en borrador).

-- === C-19 a) sin INSERT directo =============================================

drop policy if exists starter_leads_insert_anon on public.starter_leads;
drop policy if exists diagnostico_leads_insert_anon on public.diagnostico_leads;
drop policy if exists invest_leads_insert_anon on public.invest_leads;
drop policy if exists demo_leads_insert_anon on public.demo_leads;
drop policy if exists tax_calculator_leads_insert_anon on public.tax_calculator_leads;

revoke all on public.starter_leads, public.diagnostico_leads, public.invest_leads,
              public.demo_leads, public.tax_calculator_leads
  from anon, authenticated;
-- El CRM (?admin=crm) lee los leads con la sesión de la cuenta de empresa; la
-- política *_admin_select limita las filas.
grant select on public.starter_leads, public.diagnostico_leads, public.invest_leads,
                public.demo_leads, public.tax_calculator_leads
  to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tax_calculator_leads'
                 and policyname = 'tax_calculator_leads_admin_select') then
    create policy tax_calculator_leads_admin_select on public.tax_calculator_leads
      for select to authenticated
      using (((select auth.jwt()) ->> 'email') = 'maxnovaluciglobal@gmail.com');
  end if;
end
$$;

-- === C-19 b) límite por correo, por IP y global =============================

create index if not exists starter_leads_email_lower_idx on public.starter_leads (lower(email));
create index if not exists diagnostico_leads_email_lower_idx on public.diagnostico_leads (lower(email));
create index if not exists invest_leads_email_lower_idx on public.invest_leads (lower(email));
create index if not exists demo_leads_email_lower_idx on public.demo_leads (lower(email));
create index if not exists tax_calculator_leads_email_lower_idx on public.tax_calculator_leads (lower(email));

create table if not exists private.lead_rate_events (
  id         bigserial primary key,
  bucket     text not null,
  ip_hash    text,
  created_at timestamptz not null default now()
);
create index if not exists lead_rate_events_bucket_idx on private.lead_rate_events (bucket, created_at desc);
alter table private.lead_rate_events enable row level security;
revoke all on private.lead_rate_events from public, anon, authenticated;
comment on table private.lead_rate_events is
  'Llamadas a register_* para el límite de altas (C-19). Solo el hash SHA-256 de la IP, nunca la IP. Se purga a las 24 h.';

-- Límites: por IP 6 altas por hora y por tabla; global 120 por hora y por tabla.
create or replace function private.lead_rate_ok(p_bucket text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_headers jsonb;
  v_ip text;
  v_hash text;
  v_per_ip int;
  v_total int;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;
  v_ip := nullif(btrim(coalesce(
            v_headers ->> 'cf-connecting-ip',
            split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1),
            v_headers ->> 'x-real-ip', '')), '');
  if v_ip is not null then
    v_hash := encode(extensions.digest(v_ip, 'sha256'), 'hex');
  end if;

  delete from private.lead_rate_events where created_at < now() - interval '24 hours';

  select count(*) into v_total from private.lead_rate_events
   where bucket = p_bucket and created_at > now() - interval '1 hour';
  if v_total >= 120 then
    return false;
  end if;
  if v_hash is not null then
    select count(*) into v_per_ip from private.lead_rate_events
     where bucket = p_bucket and ip_hash = v_hash and created_at > now() - interval '1 hour';
    if v_per_ip >= 6 then
      return false;
    end if;
  end if;

  insert into private.lead_rate_events (bucket, ip_hash) values (p_bucket, v_hash);
  return true;
end;
$$;
revoke all on function private.lead_rate_ok(text) from public, anon, authenticated;

create or replace function public.register_starter_lead(p_email text, p_lang text default null, p_consent_marketing boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_email text; v_id uuid; v_lang text; v_consent boolean;
begin
  v_email := lower(btrim(p_email));
  if v_email is null or v_email = '' or length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false);
  end if;
  if not private.lead_rate_ok('starter') then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  v_lang := split_part(replace(lower(btrim(p_lang)), '_', '-'), '-', 1);
  if v_lang is null or v_lang not in ('es', 'en', 'pt', 'de') then v_lang := null; end if;
  v_consent := coalesce(p_consent_marketing, false);

  perform pg_advisory_xact_lock(hashtextextended('starter_leads:' || v_email, 0));
  select id into v_id from public.starter_leads where lower(email) = v_email order by created_at limit 1;
  if v_id is not null then
    if v_consent then
      update public.starter_leads
         set consent_marketing = true, consent_token = coalesce(consent_token, gen_random_uuid())
       where id = v_id and not consent_marketing and consent_confirmed_at is null and unsubscribed_at is null;
    end if;
    return jsonb_build_object('ok', true, 'id', v_id, 'existing', true);
  end if;

  insert into public.starter_leads (email, lang, consent_marketing, consent_token, consent_confirmed_at)
  values (v_email, v_lang, v_consent, case when v_consent then gen_random_uuid() end, null)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.register_demo_lead(p_email text, p_nombre text, p_consent_marketing boolean default false, p_lang text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_email text; v_nombre text; v_id uuid; v_lang text; v_consent boolean;
begin
  v_email  := lower(btrim(p_email));
  v_nombre := left(btrim(p_nombre), 120);
  if v_email is null or v_email = '' or length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false);
  end if;
  if v_nombre is null or v_nombre = '' then
    return jsonb_build_object('ok', false);
  end if;
  if not private.lead_rate_ok('demo') then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  v_lang := split_part(replace(lower(btrim(p_lang)), '_', '-'), '-', 1);
  if v_lang is null or v_lang not in ('es', 'en', 'pt', 'de') then v_lang := null; end if;
  v_consent := coalesce(p_consent_marketing, false);

  perform pg_advisory_xact_lock(hashtextextended('demo_leads:' || v_email, 0));
  select id into v_id from public.demo_leads where lower(email) = v_email order by created_at limit 1;
  if v_id is not null then
    if v_consent then
      update public.demo_leads
         set consent_marketing = true, consent_token = coalesce(consent_token, gen_random_uuid())
       where id = v_id and not consent_marketing and consent_confirmed_at is null and unsubscribed_at is null;
    end if;
    return jsonb_build_object('ok', true, 'id', v_id, 'existing', true);
  end if;

  insert into public.demo_leads (email, nombre, consent_marketing, lang, consent_token, consent_confirmed_at)
  values (v_email, v_nombre, v_consent, v_lang, case when v_consent then gen_random_uuid() end, null)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.register_diagnostico_lead(p_email text, p_score integer default null, p_label text default null,
  p_consent_marketing boolean default false, p_fuente text default null, p_lang text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_email text; v_id uuid; v_lang text; v_consent boolean; v_score integer := p_score;
begin
  v_email := lower(btrim(p_email));
  if v_email is null or v_email = '' or length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false);
  end if;
  if not private.lead_rate_ok('diagnostico') then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  if v_score is not null and (v_score < 0 or v_score > 100) then v_score := null; end if;
  v_lang := split_part(replace(lower(btrim(p_lang)), '_', '-'), '-', 1);
  if v_lang is null or v_lang not in ('es', 'en', 'pt', 'de') then v_lang := null; end if;
  v_consent := coalesce(p_consent_marketing, false);

  perform pg_advisory_xact_lock(hashtextextended('diagnostico_leads:' || v_email, 0));
  select id into v_id from public.diagnostico_leads where lower(email) = v_email order by created_at limit 1;
  if v_id is not null then
    update public.diagnostico_leads
       set score = coalesce(v_score, score),
           label = coalesce(nullif(left(coalesce(p_label, ''), 40), ''), label)
     where id = v_id;
    if v_consent then
      update public.diagnostico_leads
         set consent_marketing = true, consent_token = coalesce(consent_token, gen_random_uuid())
       where id = v_id and not consent_marketing and consent_confirmed_at is null and unsubscribed_at is null;
    end if;
    return jsonb_build_object('ok', true, 'id', v_id, 'existing', true);
  end if;

  insert into public.diagnostico_leads (email, score, label, consent_marketing, fuente, lang, consent_token, consent_confirmed_at)
  values (v_email, v_score, nullif(left(coalesce(p_label, ''), 40), ''), v_consent, nullif(left(coalesce(p_fuente, ''), 120), ''), v_lang,
          case when v_consent then gen_random_uuid() end, null)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.register_invest_lead(p_email text, p_perfil text default null, p_score integer default null,
  p_fuente text default null, p_consent_marketing boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_email text; v_perfil text; v_id uuid; v_score integer := p_score;
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

  perform pg_advisory_xact_lock(hashtextextended('invest_leads:' || v_email, 0));
  select id into v_id from public.invest_leads where lower(email) = v_email order by created_at limit 1;
  if v_id is not null then
    update public.invest_leads
       set perfil = coalesce(v_perfil, perfil), score = coalesce(v_score, score)
     where id = v_id;
    if coalesce(p_consent_marketing, false) then
      update public.invest_leads set consent_marketing = true
       where id = v_id and not consent_marketing and consent_confirmed_at is null and unsubscribed_at is null;
    end if;
    return jsonb_build_object('ok', true, 'id', v_id, 'existing', true);
  end if;

  insert into public.invest_leads (email, perfil, score, fuente, consent_marketing, consent_confirmed_at)
  values (v_email, v_perfil, v_score, nullif(left(coalesce(p_fuente, ''), 60), ''), coalesce(p_consent_marketing, false), null)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create or replace function public.register_tax_calculator_lead(p_email text, p_country text default 'CL',
  p_renta_anual numeric default null, p_impuesto numeric default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_email text;
begin
  v_email := lower(btrim(p_email));
  if v_email is null or v_email = '' or length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false);
  end if;
  if not private.lead_rate_ok('tax_calculator') then
    return jsonb_build_object('ok', false, 'error', 'rate_limited');
  end if;
  perform pg_advisory_xact_lock(hashtextextended('tax_calculator_leads:' || v_email, 0));
  if exists (select 1 from public.tax_calculator_leads where lower(email) = v_email) then
    return jsonb_build_object('ok', true, 'existing', true);
  end if;
  insert into public.tax_calculator_leads (email, country, renta_anual, impuesto)
  values (v_email, coalesce(nullif(left(btrim(p_country), 8), ''), 'CL'), p_renta_anual, p_impuesto);
  return jsonb_build_object('ok', true);
end;
$$;

-- Mismos grants que antes (create or replace los conserva; se repiten por si la
-- función no existía en una base nueva).
revoke all on function public.register_starter_lead(text, text, boolean) from public;
revoke all on function public.register_demo_lead(text, text, boolean, text) from public;
revoke all on function public.register_diagnostico_lead(text, integer, text, boolean, text, text) from public;
revoke all on function public.register_invest_lead(text, text, integer, text, boolean) from public;
revoke all on function public.register_tax_calculator_lead(text, text, numeric, numeric) from public;
grant execute on function public.register_starter_lead(text, text, boolean) to anon, authenticated, service_role;
grant execute on function public.register_demo_lead(text, text, boolean, text) to anon, authenticated, service_role;
grant execute on function public.register_diagnostico_lead(text, integer, text, boolean, text, text) to anon, authenticated, service_role;
grant execute on function public.register_invest_lead(text, text, integer, text, boolean) to anon, authenticated, service_role;
grant execute on function public.register_tax_calculator_lead(text, text, numeric, numeric) to anon, authenticated, service_role;

-- === C-23 · Grants sobrantes (SEG-11, INV-N5) ===============================

-- Sin políticas (RLS lo niega todo): nadie fuera de service_role los usa.
revoke all on public.licenses, public.trial_emails, public.webhook_events,
              public.push_subscriptions, public.synced_data
  from anon, authenticated;
do $$
begin
  if to_regclass('public.trial_emails_id_seq') is not null then
    revoke all on sequence public.trial_emails_id_seq from anon, authenticated;
  end if;
  if to_regclass('public.portfolio_holdings_id_seq') is not null then
    revoke all on sequence public.portfolio_holdings_id_seq from anon;
  end if;
  if to_regclass('public.watchlist_id_seq') is not null then
    revoke all on sequence public.watchlist_id_seq from anon;
  end if;
end
$$;

-- anon no tiene políticas en estas tablas de usuario/CRM.
revoke all on public.crm_contacts, public.cloud_backups from anon;

-- TRUNCATE, REFERENCES y TRIGGER no pasan por RLS: fuera de anon y authenticated
-- en todas las tablas del esquema public (service_role conserva todo).
do $$
declare t record;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind in ('r', 'p') loop
    execute format('revoke truncate, references, trigger on public.%I from anon, authenticated', t.relname);
  end loop;
end
$$;
revoke insert, update, delete, truncate, references, trigger on public.crm_funnel from anon, authenticated;

-- Privilegios por defecto: una tabla, función o secuencia nueva en public ya no
-- nace abierta para anon/authenticated; cada migración da los grants que
-- necesita (como ya hacen las de este repo).
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
do $$
begin
  execute 'alter default privileges for role supabase_admin in schema public revoke all on tables from anon, authenticated';
  execute 'alter default privileges for role supabase_admin in schema public revoke all on sequences from anon, authenticated';
  execute 'alter default privileges for role supabase_admin in schema public revoke all on functions from anon, authenticated';
exception when insufficient_privilege then
  raise notice 'sin permiso para cambiar los privilegios por defecto de supabase_admin (los de postgres sí se cambiaron)';
end
$$;

-- === C-23 · search_path (SEG-11) ============================================

alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.protect_trial_reuse() set search_path = public, pg_temp;
alter function public.set_updated_at() set search_path = public, pg_temp;

-- === C-23 · set_license_email (SEG-12) ======================================
-- Antes: cualquiera con la clave (o su hash) reescribía el email de la
-- licencia, que es el que usan los avisos de Stripe y el soporte. Ahora:
-- la cuenta dueña (sesión con el entitlement de esa licencia) puede fijar su
-- propio email de la sesión; sin sesión de dueño solo se completa un email que
-- falta, nunca se pisa uno existente.
create or replace function public.set_license_email(p_key text, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash  text;
  v_email text;
  v_jwt_email text;
begin
  v_email := lower(btrim(p_email));
  if v_email is null or v_email = '' or length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false);
  end if;
  v_hash := public.fnos_resolve_hash(p_key);
  v_jwt_email := lower(btrim((select auth.jwt()) ->> 'email'));

  if public.fnos_caller_owns_license(v_hash) and v_jwt_email is not null then
    update public.licenses set email = v_jwt_email where key_hash = v_hash and status = 'active';
    return jsonb_build_object('ok', found);
  end if;

  update public.licenses set email = v_email
   where key_hash = v_hash and status = 'active' and (email is null or btrim(email) = '');
  return jsonb_build_object('ok', found);
end;
$$;

-- === C-23 · (select auth.uid()) en las políticas (SEG-15) ===================

do $$
declare
  p record;
  v_qual text;
  v_check text;
  v_sql text;
begin
  for p in select schemaname, tablename, policyname, qual, with_check
             from pg_policies
            where schemaname = 'public'
              and (coalesce(qual, '') ~ '(?<!SELECT )auth\.(uid|jwt)\(\)'
                   or coalesce(with_check, '') ~ '(?<!SELECT )auth\.(uid|jwt)\(\)') loop
    v_qual  := regexp_replace(p.qual, '(?<!SELECT )auth\.(uid|jwt)\(\)', '(select auth.\1())', 'g');
    v_check := regexp_replace(p.with_check, '(?<!SELECT )auth\.(uid|jwt)\(\)', '(select auth.\1())', 'g');
    v_sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if v_qual is not null then v_sql := v_sql || format(' using (%s)', v_qual); end if;
    if v_check is not null then v_sql := v_sql || format(' with check (%s)', v_check); end if;
    execute v_sql;
  end loop;
end
$$;

-- === C-23 · CHECK de formato de email (DAT-11) ==============================

do $$
declare
  t text;
  c text;
begin
  foreach t in array array['starter_leads', 'diagnostico_leads', 'invest_leads', 'demo_leads', 'tax_calculator_leads'] loop
    c := t || '_email_format_check';
    if not exists (select 1 from pg_constraint where conname = c and conrelid = ('public.' || t)::regclass) then
      execute format($f$alter table public.%I add constraint %I check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254) not valid$f$, t, c);
    end if;
    begin
      execute format('alter table public.%I validate constraint %I', t, c);
    exception when check_violation then
      raise notice '% tiene filas viejas con email inválido: el CHECK queda NOT VALID (rige para filas nuevas)', t;
    end;
  end loop;
end
$$;

-- === C-23 · Retención (DAT-12, D-18 en borrador) ============================
-- Solo una vista: NO hay borrado automático. Activar el borrado requiere el OK
-- de Walter (y del abogado). Procedimiento: docs/retencion-datos.md.
create or replace view public.leads_retention_candidates as
  select 'starter_leads'::text as tabla, id, created_at, unsubscribed_at,
         case when unsubscribed_at is not null and unsubscribed_at < now() - interval '30 days' then 'baja_mas_de_30_dias'
              else 'sin_confirmar_mas_de_12_meses' end as motivo
    from public.starter_leads
   where (unsubscribed_at is not null and unsubscribed_at < now() - interval '30 days')
      or (consent_confirmed_at is null and account_created_at is null and created_at < now() - interval '12 months')
  union all
  select 'diagnostico_leads', id, created_at, unsubscribed_at,
         case when unsubscribed_at is not null and unsubscribed_at < now() - interval '30 days' then 'baja_mas_de_30_dias'
              else 'sin_confirmar_mas_de_12_meses' end
    from public.diagnostico_leads
   where (unsubscribed_at is not null and unsubscribed_at < now() - interval '30 days')
      or (consent_confirmed_at is null and account_created_at is null and created_at < now() - interval '12 months')
  union all
  select 'invest_leads', id, created_at, unsubscribed_at,
         case when unsubscribed_at is not null and unsubscribed_at < now() - interval '30 days' then 'baja_mas_de_30_dias'
              else 'sin_confirmar_mas_de_12_meses' end
    from public.invest_leads
   where (unsubscribed_at is not null and unsubscribed_at < now() - interval '30 days')
      or (consent_confirmed_at is null and account_created_at is null and created_at < now() - interval '12 months')
  union all
  select 'demo_leads', id, created_at, unsubscribed_at,
         case when unsubscribed_at is not null and unsubscribed_at < now() - interval '30 days' then 'baja_mas_de_30_dias'
              else 'sin_confirmar_mas_de_12_meses' end
    from public.demo_leads
   where (unsubscribed_at is not null and unsubscribed_at < now() - interval '30 days')
      or (consent_confirmed_at is null and created_at < now() - interval '12 months')
  union all
  select 'tax_calculator_leads', id, created_at, null::timestamptz, 'sin_confirmar_mas_de_12_meses'
    from public.tax_calculator_leads
   where created_at < now() - interval '12 months';
comment on view public.leads_retention_candidates is
  'Leads que la política de retención en borrador (D-18) marcaría para borrar: sin confirmar con más de 12 meses o dados de baja hace más de 30 días. Solo lectura, sin borrado automático. Ver docs/retencion-datos.md.';
revoke all on public.leads_retention_candidates from public, anon, authenticated;
grant select on public.leads_retention_candidates to service_role;

-- === C-45 · send-push exige x-cron-secret ===================================
-- send-push ahora solo acepta POST con x-cron-secret (antes un OPTIONS sin
-- clave ejecutaba el lote). Se agrega el header al job existente sin tocar el
-- resto del comando (que lleva su Authorization). Correr ANTES de desplegar la
-- versión nueva de send-push.
do $$
declare
  v_job bigint;
  v_cmd text;
  v_new text;
begin
  if to_regclass('cron.job') is null then return; end if;
  select jobid, command into v_job, v_cmd from cron.job where jobname = 'fnos-push-trial-reminders';
  if v_job is null or v_cmd ~ 'x-cron-secret' then return; end if;
  v_new := regexp_replace(v_cmd, '''Content-Type''\s*,\s*''application/json''\s*,',
             '''Content-Type'', ''application/json'', ''x-cron-secret'', coalesce(private.get_secret(''cron_secret''), ''''),');
  if v_new = v_cmd then
    raise exception 'no se pudo agregar x-cron-secret al job fnos-push-trial-reminders (comando con otra forma)';
  end if;
  perform cron.alter_job(job_id := v_job, command := v_new);
end
$$;
