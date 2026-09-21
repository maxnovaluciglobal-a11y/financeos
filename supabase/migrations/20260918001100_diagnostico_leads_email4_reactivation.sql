-- Agrega el 4to email de la secuencia (reactivación, día 12) al Diagnóstico
-- Exprés — ver financeos-landing/marketing/nurture-diagnostico-3-emails.md
-- (revisión 18-sep-2026) para el copy y el razonamiento de negocio.
--
-- Mismo diseño anti-spam retroactivo que email2/email3 (ver migración
-- 20260913173000): se manda una sola vez, solo si ya se mandó el 3 y
-- pasaron >= 7 días desde ESE envío (5+7=12, respeta el timing del plan).
-- Mismo filtro común: unsubscribed_at IS NULL AND consent_marketing = true
-- AND account_created_at IS NULL — sale de la secuencia en cuanto convierte.
--
-- Simplificación deliberada respecto al .md: la señal de "no abrió nada" que
-- el documento dejaba pendiente de decidir (webhook de Resend vs. tracking
-- propio) NO se implementó — el filtro real es el mismo que ya usan 2 y 3
-- (no convirtió), sin distinguir si abrió o no los correos anteriores.
-- Motivo: agregar tracking de apertura es una pieza nueva de infraestructura
-- (webhook de Resend, tabla de eventos) que no existía para ningún otro
-- email de nurture del proyecto — sumarla solo para el email 4 hubiera sido
-- inconsistente con el resto. Si más adelante se agrega tracking de apertura
-- para toda la plataforma, este filtro es el lugar donde sumar esa condición.

alter table public.diagnostico_leads
  add column if not exists email4_sent_at timestamptz;
