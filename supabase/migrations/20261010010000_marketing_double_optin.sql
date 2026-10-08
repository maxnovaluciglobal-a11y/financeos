-- Doble opt-in para correos de marketing (starter_leads, diagnostico_leads,
-- demo_leads; invest_leads solo para el filtro de nurture).
--
-- Propósito
-- ---------
-- § 7 Abs. 2 Nr. 2 UWG (y RGPD art. 7.1: el responsable tiene que poder
-- demostrar el consentimiento) exigen consentimiento previo y demostrable
-- para mandar publicidad por email. La práctica aceptada en Alemania es el
-- doble opt-in: casilla sin marcar + correo con enlace de confirmación; hasta
-- el clic no sale marketing. Hasta hoy:
--   - starter_leads.consent_marketing tenía default true y el signup Starter
--     no preguntaba nada (20260918000500): la secuencia de nurture salía a
--     todo Starter sin consentimiento;
--   - diagnóstico y demo tenían casilla, pero ningún correo de confirmación.
--
-- Qué hace
-- --------
--   1. starter_leads.consent_marketing pasa a default false (y invest_leads,
--      que tampoco pide casilla: 20260918000900).
--   2. Agrega a starter_leads, diagnostico_leads y demo_leads:
--        consent_token        uuid (unique) — se genera en el registro solo
--                             si consent = true; viaja únicamente en el correo;
--        consent_confirmed_at timestamptz   — se completa al hacer clic;
--        optin_email_sent_at  timestamptz   — idempotencia/tope del correo de
--                             confirmación (send-optin-confirmation).
--      A invest_leads solo consent_confirmed_at (para que el filtro de
--      send-nurture-invest-email no dé 400).
--   3. RPC pública confirm_marketing_consent(p_token uuid) → {ok} (anon).
--   4. Recrea register_starter_lead, register_demo_lead y
--      register_diagnostico_lead sobre las definiciones vigentes de
--      20261009000000_leads_lang.sql, con el mismo cuerpo + generación del
--      token. Devuelven lo mismo ({ok, id}): el token NO se devuelve, si no el
--      navegador podría confirmarse solo y el doble opt-in no probaría nada.
--
-- Firmas
-- ------
--   register_demo_lead(text, text, boolean, text)               — igual
--   register_diagnostico_lead(text, int, text, boolean, text, text) — igual
--   register_starter_lead(p_email text, p_lang text default null,
--                         p_consent_marketing boolean default false)
--     ← ÚNICA firma que cambia: hasta hoy Starter no recibía consentimiento.
--     Se dropea la de (text, text) en la misma migración (mismo motivo que en
--     20261009000000: con las dos vivas PostgREST responde PGRST203 a las
--     llamadas sin el parámetro nuevo). Llamadas viejas ({p_email, p_lang})
--     siguen funcionando y entran con consent false. Una llamada con
--     p_consent_marketing ANTES de aplicar esto da 404 PGRST202 y el lead no se
--     guarda: la app solo lo manda detrás de MARKETING_DOI_ENABLED
--     (src/utils/leadsLang.js, false por defecto).
--
-- Leads existentes (decisión: default seguro)
-- -------------------------------------------
-- Ninguna fila existente tiene consent_confirmed_at, así que desde el deploy
-- de las funciones de nurture nadie existente recibe marketing (emails 2+ de
-- Starter/diagnóstico/Invest). No se les manda un correo de confirmación
-- retroactivo: pedir consentimiento por email a quien no lo dio ya es
-- publicidad no consentida (BGH, I ZR 218/07). consent_marketing de esas filas
-- no se toca (queda como registro de lo que se guardó en su momento).
-- Los correos transaccionales siguen igual: bienvenida de Starter (ayuda de
-- uso de la cuenta) y el email 1 del diagnóstico (el resultado que la persona
-- pidió al marcar la casilla).
--
-- Seguridad
-- ---------
-- confirm_marketing_consent es SECURITY DEFINER con search_path fijo; revoke
-- de public y grant explícito a anon (la página no tiene sesión) y
-- service_role. Solo escribe consent_confirmed_at de la fila cuyo token
-- coincide (uuid aleatorio, 122 bits) y que tiene consent_marketing = true;
-- un token vence a los 30 días del registro. No revela email ni tabla.
--
-- Idempotente: add column if not exists, create unique index if not exists,
-- create or replace, drop if exists.
--
-- Orden: aplicar DESPUÉS de 20261009000000_leads_lang.sql (base de los
-- cuerpos) y de 20261010000000_cancellation_requests.sql (no dependen entre
-- sí, solo por orden de archivo).
--
-- Antes de aplicar
-- ----------------
--   supabase db query --linked "select pg_get_functiondef(oid) from pg_proc
--     where proname in ('register_starter_lead','register_demo_lead',
--                       'register_diagnostico_lead')"
-- y confirmar que coinciden con 20261009000000_leads_lang.sql. Si producción
-- difiere, ajustar este archivo — no pisar producción.
--
-- Rollback
-- --------
-- Apagar primero MARKETING_DOI_ENABLED en la app (si no, las llamadas con
-- p_consent_marketing dan 404). Después, en una migración nueva, recrear las
-- tres register_* con el cuerpo de 20261009000000 (dropeando
-- register_starter_lead(text, text, boolean)) y
-- drop function if exists public.confirm_marketing_consent(uuid);
-- Las columnas pueden quedar (nullable).

-- === 1. defaults =============================================================

alter table public.starter_leads alter column consent_marketing set default false;

do $$
begin
  if to_regclass('public.invest_leads') is not null then
    alter table public.invest_leads alter column consent_marketing set default false;
    alter table public.invest_leads add column if not exists consent_confirmed_at timestamptz;
  end if;
end
$$;

-- === 2. columnas =============================================================

alter table public.starter_leads
  add column if not exists consent_token        uuid,
  add column if not exists consent_confirmed_at timestamptz,
  add column if not exists optin_email_sent_at  timestamptz;
alter table public.diagnostico_leads
  add column if not exists consent_token        uuid,
  add column if not exists consent_confirmed_at timestamptz,
  add column if not exists optin_email_sent_at  timestamptz;
alter table public.demo_leads
  add column if not exists consent_token        uuid,
  add column if not exists consent_confirmed_at timestamptz,
  add column if not exists optin_email_sent_at  timestamptz;

create unique index if not exists starter_leads_consent_token_key     on public.starter_leads (consent_token);
create unique index if not exists diagnostico_leads_consent_token_key on public.diagnostico_leads (consent_token);
create unique index if not exists demo_leads_consent_token_key        on public.demo_leads (consent_token);

-- Tope de send-optin-confirmation (correos por dirección en 24 h).
create index if not exists starter_leads_optin_sent_idx     on public.starter_leads (email, optin_email_sent_at)     where optin_email_sent_at is not null;
create index if not exists diagnostico_leads_optin_sent_idx on public.diagnostico_leads (email, optin_email_sent_at) where optin_email_sent_at is not null;
create index if not exists demo_leads_optin_sent_idx        on public.demo_leads (email, optin_email_sent_at)        where optin_email_sent_at is not null;

-- === 3. confirm_marketing_consent ============================================

create or replace function public.confirm_marketing_consent(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_created timestamptz;
  v_found   boolean := false;
begin
  if p_token is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select created_at into v_created from public.starter_leads
   where consent_token = p_token and consent_marketing;
  if found then
    v_found := true;
    if v_created < now() - interval '30 days' then
      return jsonb_build_object('ok', false, 'error', 'expired');
    end if;
    update public.starter_leads set consent_confirmed_at = coalesce(consent_confirmed_at, now())
     where consent_token = p_token;
  end if;

  if not v_found then
    select created_at into v_created from public.diagnostico_leads
     where consent_token = p_token and consent_marketing;
    if found then
      v_found := true;
      if v_created < now() - interval '30 days' then
        return jsonb_build_object('ok', false, 'error', 'expired');
      end if;
      update public.diagnostico_leads set consent_confirmed_at = coalesce(consent_confirmed_at, now())
       where consent_token = p_token;
    end if;
  end if;

  if not v_found then
    select created_at into v_created from public.demo_leads
     where consent_token = p_token and consent_marketing;
    if found then
      v_found := true;
      if v_created < now() - interval '30 days' then
        return jsonb_build_object('ok', false, 'error', 'expired');
      end if;
      update public.demo_leads set consent_confirmed_at = coalesce(consent_confirmed_at, now())
       where consent_token = p_token;
    end if;
  end if;

  if not v_found then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.confirm_marketing_consent(uuid) from public, anon, authenticated;
grant  execute on function public.confirm_marketing_consent(uuid) to anon, service_role;

-- === 4. register_starter_lead (firma nueva: + p_consent_marketing) ===========

drop function if exists public.register_starter_lead(text, text);

create or replace function public.register_starter_lead(
  p_email text,
  p_lang text default null,
  p_consent_marketing boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_email text; v_id uuid; v_lang text; v_consent boolean;
begin
  v_email := trim(p_email);
  if v_email is null or v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false);
  end if;
  v_lang := split_part(replace(lower(trim(p_lang)), '_', '-'), '-', 1);
  if v_lang is null or v_lang not in ('es', 'en', 'pt', 'de') then
    v_lang := null;
  end if;
  v_consent := coalesce(p_consent_marketing, false);
  insert into public.starter_leads (email, lang, consent_marketing, consent_token)
  values (v_email, v_lang, v_consent, case when v_consent then gen_random_uuid() end)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.register_starter_lead(text, text, boolean) from public;
grant  execute on function public.register_starter_lead(text, text, boolean) to anon;

-- === 5. register_demo_lead (misma firma) =====================================

create or replace function public.register_demo_lead(
  p_email  text,
  p_nombre text,
  p_consent_marketing boolean default false,
  p_lang   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email   text;
  v_nombre  text;
  v_id      uuid;
  v_lang    text;
  v_consent boolean;
begin
  v_email  := trim(p_email);
  v_nombre := trim(p_nombre);
  if v_email is null or v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false);
  end if;
  if v_nombre is null or v_nombre = '' then
    return jsonb_build_object('ok', false);
  end if;
  v_lang := split_part(replace(lower(trim(p_lang)), '_', '-'), '-', 1);
  if v_lang is null or v_lang not in ('es', 'en', 'pt', 'de') then
    v_lang := null;
  end if;
  v_consent := coalesce(p_consent_marketing, false);
  insert into public.demo_leads (email, nombre, consent_marketing, lang, consent_token)
  values (v_email, v_nombre, v_consent, v_lang, case when v_consent then gen_random_uuid() end)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.register_demo_lead(text, text, boolean, text) from public;
grant  execute on function public.register_demo_lead(text, text, boolean, text) to anon;

-- === 6. register_diagnostico_lead (misma firma) ==============================

create or replace function public.register_diagnostico_lead(
  p_email text,
  p_score int default null,
  p_label text default null,
  p_consent_marketing boolean default false,
  p_fuente text default null,
  p_lang text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email   text;
  v_id      uuid;
  v_lang    text;
  v_consent boolean;
begin
  v_email := trim(p_email);
  if v_email is null or v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false);
  end if;
  if p_score is not null and (p_score < 0 or p_score > 100) then
    p_score := null;
  end if;
  v_lang := split_part(replace(lower(trim(p_lang)), '_', '-'), '-', 1);
  if v_lang is null or v_lang not in ('es', 'en', 'pt', 'de') then
    v_lang := null;
  end if;
  v_consent := coalesce(p_consent_marketing, false);
  insert into public.diagnostico_leads (email, score, label, consent_marketing, fuente, lang, consent_token)
  values (v_email, p_score, nullif(left(coalesce(p_label, ''), 40), ''), v_consent, nullif(left(coalesce(p_fuente, ''), 120), ''), v_lang,
          case when v_consent then gen_random_uuid() end)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.register_diagnostico_lead(text, int, text, boolean, text, text) from public;
grant  execute on function public.register_diagnostico_lead(text, int, text, boolean, text, text) to anon;

notify pgrst, 'reload schema';

-- Verificación después de aplicar:
-- select has_function_privilege('anon', 'public.confirm_marketing_consent(uuid)', 'execute');            -- true
-- select has_function_privilege('authenticated', 'public.confirm_marketing_consent(uuid)', 'execute');   -- false
-- select has_function_privilege('anon', 'public.register_starter_lead(text,text,boolean)', 'execute');   -- true
-- select count(*) from pg_proc where proname = 'register_starter_lead';                                  -- 1
-- select column_default from information_schema.columns
--  where table_name = 'starter_leads' and column_name = 'consent_marketing';                             -- false
