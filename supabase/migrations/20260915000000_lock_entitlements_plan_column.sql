-- Cierra un hallazgo de la auditoría 360 (12-sep-2026): la policy de UPDATE
-- de user_entitlements restringe por fila (auth.uid() = user_id) pero no por
-- columna/valor, así que un usuario autenticado podía hacer upsert directo
-- con plan:'pro' sobre su propia fila sin tener ninguna licencia real. No es
-- un bypass de pago -- el gate de features pagas revalida server-side contra
-- licenses/validate_license, no contra esta tabla -- pero sí permite
-- "plan spoofing" visual en la UI (ver setServerEntitlement en
-- licenseValidator.js:184-192, que hace ese upsert desde el cliente).
--
-- El flujo legítimo (validar una key Pro real y guardarla acá para no volver
-- a pedirla en un dispositivo nuevo) sigue funcionando: este trigger exige
-- que, para escribir plan='pro', el license_key adjunto resuelva (via
-- fnos_resolve_hash, la misma función que usa sync_push/validate_license) a
-- una fila activa y no vencida en public.licenses. 'starter' siempre se
-- permite -- es el plan sin costo, no hay nada que espoofear downgradeando.

create or replace function public.lock_entitlements_plan_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.plan = 'pro' then
    if new.license_key is null or not exists (
      select 1 from public.licenses
      where key_hash = public.fnos_resolve_hash(new.license_key)
        and status = 'active'
        and (expires_at is null or expires_at > now())
    ) then
      raise exception 'user_entitlements.plan=pro requiere un license_key válido y activo';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_lock_entitlements_plan_column on public.user_entitlements;

create trigger trg_lock_entitlements_plan_column
  before insert or update on public.user_entitlements
  for each row
  execute function public.lock_entitlements_plan_column();
