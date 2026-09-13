-- Cierra el hueco del CRM mínimo (ver 20260916000000_crm_contacts.sql): hoy
-- crm_contacts.estado solo se llena una vez, al completar el diagnóstico, y
-- nunca se actualiza aunque ese lead termine pagando. Pedido de Walter,
-- 13-sep-2026.
--
-- Fuente de verdad de "cliente pago" para MOY IQ: public.licenses con
-- status='active' y email seteado (poblada por el webhook de Stripe, ver
-- financeos-app/CLAUDE.md). NO se usa user_entitlements — esa tabla solo
-- recuerda el plan elegido por dispositivo/cuenta (incluye Starter, que es
-- gratis) y no tiene columna email, así que no sirve como señal de pago.
--
-- Solo UPDATE, nunca INSERT: si el email nunca pasó por el diagnóstico (no
-- está en crm_contacts todavía), no lo agregamos acá — este trigger cierra
-- el funnel existente, no crea leads nuevos a partir de compras directas.
-- Invest queda fuera a propósito: su modelo es suscripción+login, no key,
-- y vive en un repo/tabla distintos (invest-web) — portar el mismo patrón
-- ahí es una sesión aparte.

create or replace function public.sync_license_activation_to_crm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and new.email is not null then
    update public.crm_contacts
       set estado = 'convertido',
           actualizado_en = now()
     where email = new.email
       and producto_origen = 'moyiq'
       and estado <> 'convertido';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_license_activation_to_crm on public.licenses;
create trigger trg_sync_license_activation_to_crm
  after insert or update of status, email on public.licenses
  for each row execute function public.sync_license_activation_to_crm();
