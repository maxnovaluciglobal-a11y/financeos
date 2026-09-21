-- Notificación admin de nuevos Starter (pedido de Walter, 14-sep-2026): no
-- le llegaba ninguna señal cuando alguien se registraba gratis, a diferencia
-- de la compra Pro (que ya tenía config.alertEmail en stripe-webhook) o del
-- demo de DypOS (referencia que dio Walter). Se extiende el trigger que ya
-- sincroniza starter_leads → crm_contacts (20260918000400) para que además
-- dispare, vía pg_net (mismo patrón que el cron de nurture), la Edge
-- Function notify-admin-signup — best-effort: si el POST falla, no debe
-- tumbar el insert real del lead (por eso va en el mismo trigger AFTER
-- INSERT, no en una transacción separada que pueda hacer rollback del alta).
create or replace function public.sync_starter_lead_to_crm()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.crm_contacts (email, producto_origen, fuente)
  values (new.email, 'moyiq', 'starter')
  on conflict (email, producto_origen) do update
    set fuente = coalesce(crm_contacts.fuente, excluded.fuente),
        actualizado_en = now();

  perform net.http_post(
    url := 'https://nelwgbcddwiaimzbcuas.supabase.co/functions/v1/notify-admin-signup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', coalesce(private.get_secret('cron_secret'), '')
    ),
    body := jsonb_build_object('event', 'starter_signup', 'email', new.email)
  );

  return new;
end;
$$;
