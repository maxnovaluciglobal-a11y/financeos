-- Mitad "nurture" de Starter (la mitad "CRM" ya se resolvió en
-- 20260918000400_crm_admin_two_emails_and_lead_detail.sql). Ver
-- supabase/functions/send-nurture-starter-email/ para la función que llama
-- este cron.
--
-- Decisión sobre consent_marketing (pedida explícitamente en el brief de
-- esta tarea, 14-sep-2026):
--
-- starter_leads no tenía columna de opt-in de marketing — a diferencia de
-- diagnostico_leads, cuyo formulario público sí pide un checkbox explícito
-- de "quiero recibir contenido" (consent_marketing en
-- 20260913120000_diagnostico_leads_nurture_tracking.sql). El signup de
-- Starter hoy no pregunta nada de eso: es simplemente "Empezar gratis".
--
-- Evaluadas dos opciones:
--   (a) Asumir opt-in implícito porque ya es un usuario con cuenta activa
--       (no un lead frío) — no agregar columna, filtrar solo por
--       unsubscribed_at/account_created_at.
--   (b) Agregar consent_marketing boolean not null default true, con
--       opt-out visible en cada email (mismo link de unsubscribe que ya
--       usa diagnostico_leads) — no cambia el comportamiento de arranque
--       (todos elegibles desde el día uno, igual que (a)), pero deja
--       almacenado un booleano real que se puede poner en false por
--       unsubscribe o por un futuro checkbox en el signup, y deja el
--       filtro de elegibilidad simétrico con diagnostico_leads en vez de
--       dos formas distintas de expresar lo mismo.
--
-- Se elige (b). Es estrictamente más seguro que (a) con el mismo costo (una
-- columna) y sin downside: el default true preserva el comportamiento
-- esperado por Walter (todo Starter activo recibe la secuencia salvo que se
-- dé de baja), pero si más adelante se agrega un checkbox de opt-in
-- explícito en el signup, el gate ya existe y no hace falta otra migración
-- ni tocar la función de envío.

alter table public.starter_leads
  add column if not exists consent_marketing boolean not null default true;

create index if not exists starter_leads_nurture_eligible_idx2
  on public.starter_leads (unsubscribed_at, consent_marketing, account_created_at)
  where unsubscribed_at is null and consent_marketing = true and account_created_at is null;

-- El índice parcial viejo (starter_leads_nurture_eligible_idx, de
-- 20260918000400, sin consent_marketing en la condición) queda redundante
-- con este — se deja en su lugar en vez de dropearlo: Postgres no rompe con
-- índices redundantes y borrarlo no es parte de esta tarea.

-- === RPC de unsubscribe para Starter =========================================
-- Mismo patrón que 20260913174000_diagnostico_leads_unsubscribe_rpc.sql —
-- unsubscribe.html ya existe y apunta a diagnostico_leads; se agrega el
-- equivalente para starter_leads para que el link de baja en los 3 emails
-- de Starter funcione. El html de unsubscribe.html decide qué tabla tocar
-- según un parámetro `tabla`/`t` en la URL — ver nota en el reporte final si
-- ese wiring del lado landing queda pendiente.

create or replace function public.unsubscribe_starter_lead(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.starter_leads
     set unsubscribed_at = now()
   where id = p_id
     and unsubscribed_at is null;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.unsubscribe_starter_lead(uuid) from public;
grant  execute on function public.unsubscribe_starter_lead(uuid) to anon;

-- === cron ======================================================================

-- 10 minutos después del cron de diagnóstico (14:17 UTC) para no competir
-- por la misma ventana de envío de Resend ni por el mismo minuto de
-- ejecución de pg_cron.
select cron.schedule(
  'starter-nurture-daily',
  '27 14 * * *',
  $$
  select net.http_post(
    url := 'https://nelwgbcddwiaimzbcuas.supabase.co/functions/v1/send-nurture-starter-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(private.get_secret('cron_secret'), '')
    ),
    body := jsonb_build_object('mode', 'cron')
  );
  $$
);

-- Reusa el mismo private.get_secret('cron_secret') que ya está insertado en
-- private.app_secrets desde 20260913175000 — ningún secreto nuevo que cargar.
-- Para desactivar si hace falta: select cron.unschedule('starter-nurture-daily');
