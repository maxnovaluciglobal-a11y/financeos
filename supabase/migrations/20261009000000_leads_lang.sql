-- Idioma del lead (lang) en starter_leads, diagnostico_leads y demo_leads.
--
-- Propósito
-- ---------
-- Las secuencias de nurture (send-nurture-starter-email,
-- send-nurture-diagnostico-email) mandan todo en español porque ninguna tabla
-- de leads guarda el idioma de quien se registró. Esta migración:
--   1. agrega `lang text` (nullable) a las tres tablas, con un check que solo
--      admite es/en/pt/de o null;
--   2. recrea register_starter_lead, register_diagnostico_lead y
--      register_demo_lead con un parámetro final OPCIONAL `p_lang text default
--      null`, que se normaliza ('pt-BR' → 'pt', 'EN' → 'en') y se guarda solo
--      si es uno de los 4 idiomas; cualquier otro valor queda null.
-- null significa "sin dato": las funciones de nurture caen a español.
--
-- Firmas vigentes antes de esta migración (rastreadas en supabase/migrations/,
-- los supabase-*.sql de la raíz no definen ninguna de las tres):
--   register_starter_lead(p_email text) returns jsonb {ok, id}
--     → 20260918000600_starter_lead_welcome_wiring.sql
--   register_demo_lead(p_email text, p_nombre text,
--                      p_consent_marketing boolean default false) returns jsonb {ok, id}
--     → 20260918001000_add_demo_leads.sql
--   register_diagnostico_lead(p_email text, p_score int default null,
--                             p_label text default null,
--                             p_consent_marketing boolean default false,
--                             p_fuente text default null) returns jsonb {ok, id}
--     → 20260913173000_diagnostico_nurture_send.sql
--   OJO con esta última: 20260916000000_crm_contacts.sql tiene un timestamp
--   POSTERIOR y redefine la misma firma SIN devolver id (y con fuente
--   recortada a 60). Por git, crm_contacts se commiteó antes (13-sep 17:15)
--   que nurture_send (13-sep 17:40), con un nombre de archivo "adelantado";
--   la landing (diagnostico.html, en/score-check.html) depende de data.id
--   para disparar el email 1, así que la versión que corre en producción
--   tiene que ser la de nurture_send. Se toma esa como base. Verificar antes
--   de aplicar (ver "Antes de aplicar").
--
-- Compatibilidad hacia atrás
-- --------------------------
-- Para Postgres, agregar un parámetro crea una función NUEVA (otra firma), no
-- reemplaza la vieja. Si quedaran las dos, un cliente viejo que llama vía
-- PostgREST sin p_lang ({p_email} a /rpc/register_starter_lead) matchea ambas
-- (la nueva por el default) y PostgREST responde PGRST203 "Could not choose
-- the best candidate function" → el registro deja de funcionar. Por eso cada
-- función se DROPEA en su firma vieja y se crea con la nueva en la misma
-- migración (supabase db push corre cada archivo en una transacción, igual
-- que el resto de las migraciones de este repo, que no usan begin/commit
-- explícito). Con una sola función y p_lang con default, PostgREST resuelve
-- por nombre de argumento: las llamadas sin p_lang entran a la nueva con
-- lang null. Mismo patrón que ya se usó con register_diagnostico_lead
-- (drop del overload de 4 args en 20260913173000 / 20260916000000).
--
-- Al revés NO es compatible: un cliente que manda p_lang ANTES de que esta
-- migración esté aplicada recibe 404 PGRST202 (no existe función con ese
-- argumento) y el lead no se guarda. Por eso la app solo manda p_lang detrás
-- de LEADS_LANG_ENABLED (src/utils/leadsLang.js, false por defecto) y la
-- landing no debe mandarlo hasta después de aplicar esto.
--
-- Upserts / sobrescritura: ninguna de las tres funciones hace upsert ni
-- update — cada registro es un insert nuevo (no hay unique en email). No hay
-- camino donde un registro posterior sin idioma pise un lang ya guardado, así
-- que no hace falta coalesce(excluded.lang, lang). Si algún día se convierten
-- en upsert, usar `lang = coalesce(excluded.lang, <tabla>.lang)` para que un
-- registro sin idioma no borre el que ya había.
--
-- Triggers y lecturas posicionales revisadas: trg_sync_starter_lead_to_crm
-- (20260918000700, notify-admin-signup vía pg_net),
-- trg_sync_diagnostico_lead_to_crm (20260916000000) y los triggers de
-- auth.users que marcan account_created_at leen columnas por nombre
-- (new.email, new.fuente, new.score) — una columna nueva no los afecta.
-- Ningún cron llama a estas RPCs (los crons llaman a las Edge Functions, que
-- leen las tablas por REST). Las Edge Functions de nurture pasan a pedir
-- select=* para poder leer lang sin romper antes de esta migración.
--
-- check constraint: las RPCs ya normalizan, pero las tablas también se
-- escriben con service role (CRM admin, SQL Editor, scripts). El check evita
-- que un 'es-AR' o 'Spanish' quede guardado y haga que la función de nurture
-- caiga a español sin que nadie lo note. Se agrega NOT VALID + VALIDATE (la
-- columna es nueva y está toda en null, la validación es inmediata) y dentro
-- de un bloque que lo saltea si ya existe, para que re-aplicar no falle.
--
-- Grants: se repite exactamente el patrón de cada función original
-- (revoke all from public; grant execute to anon) sobre la firma NUEVA. Los
-- grants de la firma vieja se van con el drop. authenticated/service_role
-- siguen recibiendo execute por los default privileges del schema public de
-- Supabase, igual que hoy.
--
-- Antes de aplicar
-- ----------------
--   supabase db query --linked "select pg_get_functiondef(oid) from pg_proc
--     where proname in ('register_starter_lead','register_demo_lead',
--                       'register_diagnostico_lead')"
-- y confirmar que el cuerpo vigente coincide con las versiones citadas arriba
-- (en particular que register_diagnostico_lead devuelve id). Si producción
-- difiere, ajustar este archivo para que coincida — no pisar producción.
--
-- Orden de despliegue
-- -------------------
--   1. Aplicar esta migración (supabase db push --linked).
--   2. Deployar send-nurture-starter-email y send-nurture-diagnostico-email
--      (funcionan antes y después de este paso: leen lead.lang de forma
--      defensiva y caen a español).
--   3. Poner LEADS_LANG_ENABLED = true en src/utils/leadsLang.js y deployar
--      la app.
--   4. Landing: diagnostico.html manda p_lang 'es' y en/score-check.html manda
--      p_lang 'en' en el body de /rpc/register_diagnostico_lead (opcional el
--      de 'es': null ya cae a español).
--
-- Rollback
-- --------
-- Primero apagar a los clientes (LEADS_LANG_ENABLED = false + deploy, sacar
-- p_lang de la landing): con la firma vieja restaurada, una llamada con
-- p_lang vuelve a dar 404. Después, en una migración nueva:
--   drop function if exists public.register_starter_lead(text, text);
--   drop function if exists public.register_demo_lead(text, text, boolean, text);
--   drop function if exists public.register_diagnostico_lead(text, int, text, boolean, text, text);
--   -- y recrear las tres con el cuerpo, revoke y grant de los archivos
--   -- citados en "Firmas vigentes" (copiar tal cual).
-- Las columnas lang pueden quedar (nullable, nadie las exige). Si se quieren
-- borrar: alter table ... drop constraint if exists <tabla>_lang_check,
-- drop column if exists lang; — las funciones de nurture toleran que no
-- exista porque leen con select=*.

-- === 1. columnas + check =====================================================

alter table public.starter_leads     add column if not exists lang text;
alter table public.diagnostico_leads add column if not exists lang text;
alter table public.demo_leads        add column if not exists lang text;

do $$
declare
  t text;
begin
  foreach t in array array['starter_leads', 'diagnostico_leads', 'demo_leads']
  loop
    if not exists (
      select 1 from pg_constraint
       where conname = t || '_lang_check'
         and conrelid = ('public.' || t)::regclass
    ) then
      execute format(
        'alter table public.%I add constraint %I check (lang is null or lang in (''es'', ''en'', ''pt'', ''de'')) not valid',
        t, t || '_lang_check'
      );
      execute format('alter table public.%I validate constraint %I', t, t || '_lang_check');
    end if;
  end loop;
end
$$;

-- Normalización (inline en cada función, sin helper público: cualquier
-- función nueva en public queda expuesta por PostgREST a anon):
--   v_lang := split_part(replace(lower(trim(p_lang)), '_', '-'), '-', 1);
--   if v_lang not in ('es','en','pt','de') then v_lang := null; end if;
-- (null/'' terminan en null.)

-- === 2. register_starter_lead ================================================

drop function if exists public.register_starter_lead(text);

create or replace function public.register_starter_lead(p_email text, p_lang text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_email text; v_id uuid; v_lang text;
begin
  v_email := trim(p_email);
  if v_email is null or v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false);
  end if;
  v_lang := split_part(replace(lower(trim(p_lang)), '_', '-'), '-', 1);
  if v_lang is null or v_lang not in ('es', 'en', 'pt', 'de') then
    v_lang := null;
  end if;
  insert into public.starter_leads (email, lang) values (v_email, v_lang) returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.register_starter_lead(text, text) from public;
grant  execute on function public.register_starter_lead(text, text) to anon;

-- === 3. register_demo_lead ===================================================

drop function if exists public.register_demo_lead(text, text, boolean);

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
  v_email  text;
  v_nombre text;
  v_id     uuid;
  v_lang   text;
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
  insert into public.demo_leads (email, nombre, consent_marketing, lang)
  values (v_email, v_nombre, coalesce(p_consent_marketing, false), v_lang)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.register_demo_lead(text, text, boolean, text) from public;
grant  execute on function public.register_demo_lead(text, text, boolean, text) to anon;

-- === 4. register_diagnostico_lead ============================================

drop function if exists public.register_diagnostico_lead(text, int, text, boolean, text);

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
  v_email text;
  v_id uuid;
  v_lang text;
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
  insert into public.diagnostico_leads (email, score, label, consent_marketing, fuente, lang)
  values (v_email, p_score, nullif(left(coalesce(p_label, ''), 40), ''), coalesce(p_consent_marketing, false), nullif(left(coalesce(p_fuente, ''), 120), ''), v_lang)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.register_diagnostico_lead(text, int, text, boolean, text, text) from public;
grant  execute on function public.register_diagnostico_lead(text, int, text, boolean, text, text) to anon;

-- PostgREST recarga el schema cache solo ante DDL en Supabase; esto lo fuerza
-- por si acaso, para que la firma nueva quede visible en el mismo minuto.
notify pgrst, 'reload schema';
