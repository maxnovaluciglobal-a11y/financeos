-- Inversiones F4 (20-nov-2026, decisión de Walter): alertas de precio EN EL
-- SERVIDOR, con aviso push aunque la app esté cerrada. En Invest vivían solo en
-- el navegador (localStorage ia_<uid>) y sonaban solo con la pestaña abierta.
--
--   1. public.invest_alerts: una fila por alerta, de la cuenta (auth.users).
--      condition: 'above' (sube hasta o por encima de threshold, en la moneda
--      del activo), 'below' (baja hasta o por debajo) o 'pct_move' (en el día se
--      mueve threshold % o más, hacia arriba o hacia abajo).
--      last_triggered_at: último aviso; la función invest-alerts-check no vuelve
--      a avisar la misma alerta antes de 24 h.
--      RLS: cada cuenta ve y cambia solo sus alertas. Tope de 50 por cuenta con
--      el trigger invest_alerts_cap (una política de INSERT que cuenta la misma
--      tabla entra en recursión de RLS); el cliente avisa antes.
--   2. public.invest_alert_push_targets(uuid[]): las suscripciones push de esas
--      cuentas. push_subscriptions se ata a la licencia (key_hash = id HMAC de
--      la clave, migración 20261020090000) y la cuenta llega a la licencia por
--      user_entitlements, igual que fnos_caller_owns_license. Solo service_role.
--      La migración 20261123000100 la reemplaza: solo servicios push conocidos
--      y 5 por cuenta.
--
-- Nada a anon. Al borrar la cuenta (delete-account borra auth.users) las
-- alertas se van por ON DELETE CASCADE.
-- Test: supabase/tests/invest_alerts.sql (job `db` del CI).

create table if not exists public.invest_alerts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  symbol             text not null,
  condition          text not null,
  threshold          numeric not null,
  active             boolean not null default true,
  last_triggered_at  timestamptz,
  created_at         timestamptz not null default now(),
  constraint invest_alerts_symbol_check check (symbol ~ '^[\^A-Z0-9.=-]{1,15}$'),
  constraint invest_alerts_condition_check check (condition in ('above', 'below', 'pct_move')),
  constraint invest_alerts_threshold_check check (
    threshold > 0 and threshold < 1000000000000
    and (condition <> 'pct_move' or threshold <= 100)
  )
);
comment on table public.invest_alerts is
  'Inversiones F4: alertas de precio de cada cuenta; las revisa la Edge Function invest-alerts-check y avisa por push.';

-- La función programada lee solo las activas.
create index if not exists invest_alerts_active_idx on public.invest_alerts (active, symbol) where active;
create index if not exists invest_alerts_user_idx on public.invest_alerts (user_id);

alter table public.invest_alerts enable row level security;

drop policy if exists "invest_alerts_select_own" on public.invest_alerts;
create policy "invest_alerts_select_own" on public.invest_alerts
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "invest_alerts_insert_own" on public.invest_alerts;
create policy "invest_alerts_insert_own" on public.invest_alerts
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "invest_alerts_update_own" on public.invest_alerts;
create policy "invest_alerts_update_own" on public.invest_alerts
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "invest_alerts_delete_own" on public.invest_alerts;
create policy "invest_alerts_delete_own" on public.invest_alerts
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Tope de 50 alertas por cuenta. SECURITY DEFINER para contar sin RLS; el
-- advisory lock por cuenta evita que dos altas simultáneas pasen el tope.
create or replace function public.invest_alerts_cap()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
begin
  perform pg_advisory_xact_lock(hashtext('invest_alerts:' || new.user_id::text));
  if (select count(*) from public.invest_alerts where user_id = new.user_id) >= 50 then
    raise exception 'alert_limit' using errcode = 'check_violation';
  end if;
  return new;
end;
$function$;
revoke all on function public.invest_alerts_cap() from public, anon, authenticated;

drop trigger if exists invest_alerts_cap on public.invest_alerts;
create trigger invest_alerts_cap before insert on public.invest_alerts
  for each row execute function public.invest_alerts_cap();

revoke all on table public.invest_alerts from public, anon;
grant select, insert, update, delete on table public.invest_alerts to authenticated;
grant select, insert, update, delete on table public.invest_alerts to service_role;

create or replace function public.invest_alert_push_targets(p_user_ids uuid[])
returns table (user_id uuid, sub_id uuid, endpoint text, p256dh text, auth text)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
  select distinct e.user_id, s.id, s.endpoint, s.p256dh, s.auth
    from public.user_entitlements e
    join public.push_subscriptions s on s.key_hash = public.fnos_license_id(e.license_key)
   where e.user_id = any (coalesce(p_user_ids, '{}'::uuid[]))
     and e.license_key is not null
$function$;
comment on function public.invest_alert_push_targets(uuid[]) is
  'Inversiones F4: suscripciones push de las cuentas con alertas disparadas. Solo service_role (invest-alerts-check).';

revoke all on function public.invest_alert_push_targets(uuid[]) from public, anon, authenticated;
grant execute on function public.invest_alert_push_targets(uuid[]) to service_role;
