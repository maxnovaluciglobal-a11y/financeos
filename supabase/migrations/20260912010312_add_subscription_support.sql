-- Soporte de suscripciones (MOY IQ Pro mensual US$4.99 / anual US$39.99).
-- Hasta ahora licenses solo modelaba pago único (payment_intent_id + expires_at
-- siempre null = licencia permanente). Una suscripción necesita: (a) saber a
-- qué Stripe Subscription corresponde una fila, para poder extender su
-- vencimiento en cada renovación, y (b) esa extensión sin volver a emitir
-- clave ni reenviar el email de bienvenida.

alter table public.licenses
  add column if not exists stripe_subscription_id text;

-- Partial unique: nullable para las licencias de pago único existentes/futuras,
-- pero única cuando sí hay un subscription id (no puede haber dos licencias
-- para la misma suscripción de Stripe).
create unique index if not exists licenses_stripe_subscription_id_key
  on public.licenses (stripe_subscription_id)
  where stripe_subscription_id is not null;

create or replace function public.issue_license(
  p_key text,
  p_plan text,
  p_email text default null,
  p_session text default null,
  p_payment_intent text default null,
  p_subscription text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  insert into public.licenses (key_hash, plan, email, stripe_session_id, payment_intent_id, stripe_subscription_id)
  values (encode(digest(upper(trim(p_key)), 'sha256'), 'hex'),
          coalesce(p_plan, 'personal'), p_email, p_session, p_payment_intent, p_subscription)
  on conflict (key_hash) do nothing;
end;
$function$;

-- Fija o extiende el vencimiento de una licencia de suscripción cuando Stripe
-- confirma el pago de una invoice (alta o renovación) — ver webhookLogic.ts,
-- extendLicenseExpiry(). A propósito no falla ni avisa si stripe_subscription_id
-- no matchea ninguna fila: este webhook recibe invoice.payment_succeeded de
-- TODOS los productos de la cuenta de Stripe compartida (DypOS, Alika,
-- FinanceOS Invest), no solo MOY IQ — un update de 0 filas es el caso
-- esperado para esos eventos ajenos, no un error.
create or replace function public.extend_license_expiry(
  p_subscription text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  update public.licenses
  set expires_at = p_expires_at
  where stripe_subscription_id = p_subscription;
end;
$function$;
