-- Infraestructura de ENVÍO real de la secuencia nurture del Diagnóstico
-- Exprés (ver financeos-landing/marketing/nurture-diagnostico-3-emails.md,
-- sección "Pendiente antes de activar el envío real"). Walter autorizó
-- explícitamente activar el envío real el 13-sep-2026.
--
-- Esta migración hace 4 cosas:
--
-- 1. Arregla un mismatch ya en producción: financeos-landing/diagnostico.html
--    manda `p_fuente` a register_diagnostico_lead desde el 13-sep (commit de
--    atribución UTM), pero la función y la tabla nunca tuvieron esa columna
--    — cada llamada real desde la landing viene fallando en silencio (el
--    fetch tiene .catch() que traga el error) y NO está guardando el lead
--    en absoluto desde que se agregó ese parámetro. Se agrega `fuente` y se
--    actualiza la función para aceptarlo.
--
-- 2. Agrega las columnas de tracking por email (email1/2/3_sent_at) que
--    necesita el cron para no reenviar. Diseño anti-spam retroactivo
--    (crítico, ver el .md): al activar el cron por primera vez van a existir
--    leads viejos de días/semanas. Si el filtro fuera solo "edad >= 2 días"
--    sin trackear qué ya se mandó, un lead de hace 3 semanas recibiría el
--    email 2 Y el 3 el mismo minuto. Regla implementada:
--      - Email 2: se manda si email2_sent_at IS NULL, sin importar la edad
--        del lead. Se manda una sola vez, el primer cron run que lo vea.
--      - Email 3: se manda solo si email2_sent_at IS NOT NULL (nunca se
--        saltea el 2) Y email3_sent_at IS NULL Y ya pasaron al menos 3 días
--        desde que se mandó el email 2 (preserva el espaciado día2→día5 del
--        plan original, pero medido desde el envío real del email 2, no
--        desde la creación del lead — así nunca se manda 2 y 3 en la misma
--        corrida para un lead viejo).
--    Filtro común a ambos: unsubscribed_at IS NULL AND consent_marketing =
--    true AND account_created_at IS NULL (ya se registró o convirtió →
--    afuera de esta secuencia).
--
-- 3. Trigger en auth.users: cuando se crea una cuenta real de MOY IQ, si el
--    email coincide con un lead de diagnostico_leads que todavía no tiene
--    account_created_at, se lo completa. Esto es lo que saca a alguien de la
--    secuencia en cuanto se registra — sin esto, el cron le seguiría
--    mandando los emails 2/3 a alguien que ya es usuario.
--
-- 4. pg_cron + pg_net: un job diario que llama a la Edge Function
--    send-nurture-diagnostico-email en modo "cron" (autenticado con un
--    secreto compartido vía header, no con la service role key — la función
--    hace su propia consulta con service role internamente). Elegido sobre
--    una Supabase Scheduled Function porque este proyecto no tiene ninguna
--    infra de cron previa y pg_cron es lo que ya trae el Postgres de
--    Supabase sin agregar una pieza operativa nueva.

-- === 1. fuente ===============================================================

alter table public.diagnostico_leads
  add column if not exists fuente text;

-- === 2. tracking de envíos ===================================================

alter table public.diagnostico_leads
  add column if not exists email1_sent_at timestamptz,
  add column if not exists email2_sent_at timestamptz,
  add column if not exists email3_sent_at timestamptz;

create index if not exists diagnostico_leads_nurture_eligible_idx
  on public.diagnostico_leads (unsubscribed_at, consent_marketing, account_created_at)
  where unsubscribed_at is null and consent_marketing = true and account_created_at is null;

create or replace function public.register_diagnostico_lead(
  p_email text,
  p_score int default null,
  p_label text default null,
  p_consent_marketing boolean default false,
  p_fuente text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text;
  v_id uuid;
begin
  v_email := trim(p_email);
  if v_email is null or v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false);
  end if;
  if p_score is not null and (p_score < 0 or p_score > 100) then
    p_score := null;
  end if;
  insert into public.diagnostico_leads (email, score, label, consent_marketing, fuente)
  values (v_email, p_score, nullif(left(coalesce(p_label, ''), 40), ''), coalesce(p_consent_marketing, false), nullif(left(coalesce(p_fuente, ''), 120), ''))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.register_diagnostico_lead(text, int, text, boolean, text) from public;
grant  execute on function public.register_diagnostico_lead(text, int, text, boolean, text) to anon;

-- La firma vieja (sin p_fuente) queda huérfana — Postgres permite overloads
-- por firma distinta, así que no rompe nada que siga llamando sin el 5to
-- parámetro, pero la borramos para no mantener dos versiones divergentes.
drop function if exists public.register_diagnostico_lead(text, int, text, boolean);

-- === 3. trigger account_created_at ==========================================

create or replace function public.mark_diagnostico_lead_account_created()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.diagnostico_leads
     set account_created_at = now()
   where email = new.email
     and account_created_at is null;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_mark_diagnostico_lead on auth.users;
create trigger on_auth_user_created_mark_diagnostico_lead
  after insert on auth.users
  for each row
  execute function public.mark_diagnostico_lead_account_created();

-- === 4. cron ==================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- El secreto de cron se referenciaba acá vía `current_setting('app.cron_secret')`
-- — CORREGIDO en la migración siguiente (20260913175000): el rol de la CLI
-- no tiene permiso para setear GUCs custom en el Postgres administrado de
-- Supabase. La versión vigente del job usa private.get_secret('cron_secret')
-- en su lugar. Ver esa migración para el detalle.

select cron.schedule(
  'diagnostico-nurture-daily',
  '17 14 * * *', -- 14:17 UTC ≈ 11:17 hora Chile/Argentina — hora hábil, fuera de horas pico de Resend
  $$
  select net.http_post(
    url := 'https://nelwgbcddwiaimzbcuas.supabase.co/functions/v1/send-nurture-diagnostico-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(current_setting('app.cron_secret', true), '')
    ),
    body := jsonb_build_object('mode', 'cron')
  );
  $$
);

-- El cron queda AGENDADO desde el momento en que se aplica esta migración —
-- si se aplica sin haber deployado la función y sin haber puesto
-- app.cron_secret, el job va a correr igual todos los días y va a fallar
-- silenciosamente (401 desde la función, sin reintento — net.http_post no
-- reintenta). No manda emails de más, pero no hace nada útil hasta que se
-- complete el setup manual de arriba. Para desactivarlo si hace falta:
--   select cron.unschedule('diagnostico-nurture-daily');
