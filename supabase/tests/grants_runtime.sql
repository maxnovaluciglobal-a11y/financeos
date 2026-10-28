-- Behaviour of the privileges (not just their catalog): what anon, authenticated and
-- service_role can really do. Runs on the CI / local test database, never on production.
-- Everything happens in one transaction that ends in ROLLBACK.
begin;

create temp table _t(n int) on commit drop;
grant all on _t to anon, authenticated, service_role;

-- 1. anon cannot read the server-only tables (42501).
set local role anon;
do $$
declare t text;
begin
  foreach t in array array['licenses', 'synced_data', 'webhook_events', 'push_subscriptions', 'trial_emails'] loop
    begin
      execute format('select 1 from public.%I limit 1', t);
      raise exception 'FALLA: anon pudo leer %', t;
    exception when insufficient_privilege then null;
    end;
  end loop;
end
$$;

-- 2. anon cannot run the server-only functions, but can run the browser-facing license check.
do $$
declare r jsonb;
begin
  begin
    perform public.revoke_license('pi_x');
    raise exception 'FALLA: anon ejecutó revoke_license';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.issue_license('FNPR-AAAA-BBBB-CCCC', 'pro', 'a@b.c', 'cs_x', 'pi_x', 'sub_x', now() + interval '1 month');
    raise exception 'FALLA: anon ejecutó issue_license';
  exception when insufficient_privilege then null;
  end;
  r := public.validate_license('FNOS-NOPE-NOPE-NOPE');
  if coalesce((r->>'valid')::boolean, false) then raise exception 'FALLA: licencia inventada válida %', r; end if;
end
$$;
reset role;

-- 3. authenticated sees only its own profile row, and cannot TRUNCATE.
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, instance_id, aud, role) values
    (a, 'grants-a@t.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (b, 'grants-b@t.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  insert into public.profiles (id, email, name) values (a, 'grants-a@t.local', 'A') on conflict (id) do nothing;
  insert into public.profiles (id, email, name) values (b, 'grants-b@t.local', 'B') on conflict (id) do nothing;
  perform set_config('test.a', a::text, true);
  perform set_config('test.b', b::text, true);
end
$$;
set local role authenticated;
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', current_setting('test.a'), true);  -- older auth.uid() reads this
  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('test.a'), 'role', 'authenticated')::text, true);
  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'FALLA: authenticated ve % perfiles (esperado 1)', n; end if;
  if exists (select 1 from public.profiles where id = current_setting('test.b')::uuid) then
    raise exception 'FALLA: authenticated ve el perfil de otra cuenta';
  end if;
  begin
    truncate public.profiles;
    raise exception 'FALLA: authenticated pudo hacer TRUNCATE';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.licenses limit 1;
    raise exception 'FALLA: authenticated pudo leer licenses';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- 4. service_role can use the server-only tables.
set local role service_role;
do $$
declare t text;
begin
  foreach t in array array['licenses', 'synced_data', 'webhook_events', 'push_subscriptions', 'trial_emails'] loop
    execute format('select 1 from public.%I limit 1', t);
  end loop;
  perform public.revoke_license('pi_nonexistent');
end
$$;
reset role;

select 'OK: grants_runtime.sql' as resultado;
rollback;
