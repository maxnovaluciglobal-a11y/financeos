-- Aislamiento entre cuentas (18-oct-2026). Cada cuenta ve y modifica solo lo
-- suyo, también cuando dos cuentas conocen la misma licencia.
--
-- 1. Una licencia Pro pertenece a UNA sola cuenta (índice único + trigger con
--    mensaje claro). Antes dos cuentas podían guardar la misma clave.
-- 2. Sync cifrado y avisos push exigen la sesión de la cuenta dueña de la
--    licencia (auth.uid()). Antes bastaba la clave o su hash, sin sesión, y
--    otra cuenta con la misma clave leía y pisaba el respaldo.
-- 3. Tablas de usuario: sin privilegios para anon (RLS ya lo bloqueaba; esto
--    es la segunda barrera), WITH CHECK explícito y sin poder reescribir la
--    columna dueña (user_id / id) de holdings y watchlist.
-- 4. Funciones trigger: sin EXECUTE para anon/authenticated (higiene; los
--    triggers corren igual).
--
-- Verificado antes de aplicar: 0 licencias compartidas entre cuentas, y la
-- fila de synced_data y las 2 de push_subscriptions tienen dueño en
-- user_entitlements (siguen funcionando).

-- ── 1. Una licencia, una cuenta ─────────────────────────────────────────────
create unique index if not exists user_entitlements_license_one_account
  on public.user_entitlements (public.fnos_resolve_hash(license_key))
  where license_key is not null;

create or replace function public.lock_entitlements_plan_column()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.license_key is not null and exists (
    select 1 from public.user_entitlements
    where license_key is not null
      and public.fnos_resolve_hash(license_key) = public.fnos_resolve_hash(new.license_key)
      and user_id <> new.user_id
  ) then
    raise exception 'license_in_use: esta licencia ya está asociada a otra cuenta'
      using errcode = 'P0001';
  end if;

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
$function$;

-- ── 2. Sync y push atados a la cuenta de la sesión ──────────────────────────
-- ¿La cuenta de la sesión es la dueña de esta licencia (por hash)?
create or replace function public.fnos_caller_owns_license(p_hash text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
  select auth.uid() is not null and exists (
    select 1 from public.user_entitlements e
    where e.user_id = auth.uid()
      and e.license_key is not null
      and public.fnos_resolve_hash(e.license_key) = p_hash
  )
$function$;
revoke all on function public.fnos_caller_owns_license(text) from public, anon, authenticated;

create or replace function public.sync_pull(p_key text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_hash text; v_row public.synced_data%rowtype;
begin
  v_hash := public.fnos_resolve_hash(p_key);
  if not exists (select 1 from public.licenses where key_hash = v_hash and status = 'active'
                and (expires_at is null or expires_at > now())) then
    return jsonb_build_object('ok', false, 'error', 'invalid_license');
  end if;
  if not public.fnos_caller_owns_license(v_hash) then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  select * into v_row from public.synced_data where key_hash = v_hash;
  if not found then return jsonb_build_object('ok', true, 'empty', true); end if;
  return jsonb_build_object('ok', true, 'blob', v_row.blob, 'updated_at', v_row.updated_at);
end;
$function$;

create or replace function public.sync_push(p_key text, p_blob text, p_updated_at bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_hash text;
begin
  if p_key is null or p_blob is null then
    return jsonb_build_object('ok', false, 'error', 'bad_args');
  end if;
  v_hash := public.fnos_resolve_hash(p_key);
  if not exists (select 1 from public.licenses where key_hash = v_hash and status = 'active'
                and (expires_at is null or expires_at > now())) then
    return jsonb_build_object('ok', false, 'error', 'invalid_license');
  end if;
  if not public.fnos_caller_owns_license(v_hash) then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  insert into public.synced_data (key_hash, blob, updated_at, saved_at)
  values (v_hash, p_blob, coalesce(p_updated_at, 0), now())
  on conflict (key_hash) do update
    set blob = excluded.blob, updated_at = excluded.updated_at, saved_at = now();
  return jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.save_push_subscription(p_key text, p_endpoint text, p_p256dh text, p_auth text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_hash text;
begin
  if p_endpoint is null then return jsonb_build_object('ok', false, 'error', 'bad_args'); end if;
  v_hash := public.fnos_resolve_hash(p_key);
  if not exists (select 1 from public.licenses where key_hash = v_hash and status = 'active') then
    return jsonb_build_object('ok', false, 'error', 'invalid_license');
  end if;
  if not public.fnos_caller_owns_license(v_hash) then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  insert into public.push_subscriptions (key_hash, endpoint, p256dh, auth, created_at)
  values (v_hash, p_endpoint, p_p256dh, p_auth, now())
  on conflict (endpoint) do update set key_hash = excluded.key_hash, p256dh = excluded.p256dh, auth = excluded.auth;
  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.sync_pull(text) from public, anon;
revoke all on function public.sync_push(text, text, bigint) from public, anon;
revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke all on function public.delete_push_subscription(text) from public, anon;
grant execute on function public.sync_pull(text) to authenticated, service_role;
grant execute on function public.sync_push(text, text, bigint) to authenticated, service_role;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated, service_role;
grant execute on function public.delete_push_subscription(text) to authenticated, service_role;

-- ── 3. Tablas de usuario ────────────────────────────────────────────────────
revoke all on public.portfolio_holdings, public.watchlist, public.consents,
              public.user_entitlements, public.profiles,
              public.synced_data, public.push_subscriptions
  from anon;

-- Nadie cambia de dueño una fila (ni la propia: RLS ya impide pasarla a
-- otro). Un REVOKE de columna no le gana a un GRANT de tabla, por eso se
-- quita el UPDATE de tabla y se dan solo las columnas editables.
-- user_entitlements conserva UPDATE(user_id): licenseValidator.js hace upsert
-- con user_id y su WITH CHECK (auth.uid() = user_id) ya lo cubre.
revoke update on public.portfolio_holdings, public.watchlist, public.consents from authenticated;
grant update (ticker, asset_type, shares, avg_cost, note, stop, updated_at)
  on public.portfolio_holdings to authenticated;
grant update (ticker, added_at) on public.watchlist to authenticated;
-- consents: sin política UPDATE; se registra con INSERT y no se edita.

-- Sin WITH CHECK, Postgres ya usa el USING para la fila nueva; se deja
-- explícito para que nadie lo afloje sin darse cuenta.
alter policy "Users can update own holdings" on public.portfolio_holdings
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter policy "Users can update own profile" on public.profiles
  using (auth.uid() = id) with check (auth.uid() = id);

-- ── 4. Funciones trigger sin EXECUTE público ────────────────────────────────
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.fn);
  end loop;
end $$;
