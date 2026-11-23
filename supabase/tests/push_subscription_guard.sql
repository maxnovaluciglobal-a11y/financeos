-- Suscripciones push (migración 20261123000100): solo servicios push conocidos,
-- tope de 10 por licencia, fallos seguidos por suscripción y 5 destinos por cuenta.
-- Solo en la base local de prueba (scripts/test-db); todo termina en ROLLBACK.
begin;

create temp table _t(n int) on commit drop;
grant all on _t to anon, authenticated, service_role;

do $$
declare
  a uuid := gen_random_uuid();
  ha text := encode(digest('FNOS-PUSH-PUSH-PUSH', 'sha256'), 'hex');
begin
  insert into auth.users (id, email, instance_id, aud, role) values
    (a, 'push-a@t.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  insert into public.licenses (key_hash, plan, status, email) values (public.fnos_license_id(ha), 'pro', 'active', 'push-a@t.local');
  insert into public.user_entitlements (user_id, plan, license_key) values (a, 'pro', ha);
  perform set_config('test.a', a::text, true);
  perform set_config('test.ha', ha, true);
end
$$;

-- 1. Lista de servicios push.
do $$
declare ok text; bad text;
begin
  foreach ok in array array[
    'https://fcm.googleapis.com/fcm/send/abc:def',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAA',
    'https://web.push.apple.com/QOabc',
    'https://wns2-par02p.notify.windows.com/w/?token=x',
    'https://FCM.googleapis.com:443/fcm/send/x'
  ] loop
    assert public.push_endpoint_allowed(ok), format('rechazó %s', ok);
  end loop;
  foreach bad in array array[
    'http://fcm.googleapis.com/fcm/send/x',
    'https://evil.example/fcm.googleapis.com/',
    'https://fcm.googleapis.com.evil.example/x',
    'https://evil@fcm.googleapis.com/x',
    'https://fcm.googleapis.com:8443/x',
    'https://push.apple.com/x',
    'https://10.0.0.1/x',
    'https://localhost/x',
    'https://fcm.googleapis.com/x y',
    'https://fcm.googleapis.com',
    ''
  ] loop
    assert not public.push_endpoint_allowed(bad), format('aceptó %s', bad);
  end loop;
  assert not public.push_endpoint_allowed(null), 'aceptó null';
  assert not public.push_endpoint_allowed('https://fcm.googleapis.com/' || repeat('a', 1100)), 'aceptó un endpoint enorme';
end
$$;

-- 2. save_push_subscription como la cuenta dueña de la licencia.
set local role authenticated;
do $$
declare r jsonb; n int; k text := current_setting('test.ha'); p text := repeat('B', 87); au text := repeat('a', 22);
begin
  perform set_config('request.jwt.claim.sub', current_setting('test.a'), true);
  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('test.a'), 'role', 'authenticated')::text, true);
  r := public.save_push_subscription(k, 'https://attacker.example/hook', p, au);
  assert r->>'error' = 'bad_endpoint', format('endpoint propio: %s', r);
  r := public.save_push_subscription(k, 'https://fcm.googleapis.com/fcm/send/x', 'no base64!', au);
  assert r->>'error' = 'bad_endpoint', format('p256dh inválido: %s', r);
  r := public.save_push_subscription(k, 'https://fcm.googleapis.com/fcm/send/x', p, null);
  assert r->>'error' = 'bad_args', format('auth null: %s', r);
  begin
    perform 1 from public.push_subscriptions limit 1;
    raise exception 'FALLA: authenticated leyó push_subscriptions';
  exception when insufficient_privilege then null;
  end;
  -- Tope de 10 por licencia: se van las más viejas.
  for i in 1..12 loop
    r := public.save_push_subscription(k, 'https://fcm.googleapis.com/fcm/send/dev-' || i, p, au);
    assert (r->>'ok')::boolean, format('alta %s: %s', i, r);
  end loop;
  begin
    perform public.push_subscriptions_record(null, null, null, now());
    raise exception 'FALLA: authenticated ejecutó push_subscriptions_record';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

do $$
declare n int; eps text;
begin
  select count(*), string_agg(right(endpoint, 6), ',' order by created_at) into n, eps
    from public.push_subscriptions where key_hash = public.fnos_license_id(current_setting('test.ha'));
  assert n = 10, format('quedaron %s suscripciones (esperado 10)', n);
  assert eps not like '%dev-1,%' and eps not like '%dev-2,%' and eps like '%dev-12', format('no se fueron las más viejas: %s', eps);
end
$$;

-- 3. anon no ejecuta nada de esto.
set local role anon;
do $$
begin
  begin
    perform public.push_subscriptions_record(null, null, null, now());
    raise exception 'FALLA: anon ejecutó push_subscriptions_record';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.push_endpoint_allowed('https://fcm.googleapis.com/x');
    raise exception 'FALLA: anon ejecutó push_endpoint_allowed';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- 4. Destinos: solo servicios push conocidos, 5 por cuenta, las más recientes.
do $$
begin
  insert into public.push_subscriptions (key_hash, endpoint, p256dh, auth, created_at)
  values (public.fnos_license_id(current_setting('test.ha')), 'https://attacker.example/old-row', 'p', 'k', clock_timestamp() + interval '1 hour');
end
$$;
set local role service_role;
do $$
declare n int; eps text;
begin
  select count(*), string_agg(endpoint, ',') into n, eps from public.invest_alert_push_targets(array[current_setting('test.a')::uuid]);
  assert n = 5, format('destinos: %s (esperado 5)', n);
  assert eps not like '%attacker%', 'devolvió un endpoint fuera de la lista';
  assert eps like '%dev-12%' and eps like '%dev-8%' and eps not like '%dev-7%', format('no son los 5 más recientes: %s', eps);
end
$$;

-- 5. Fallos seguidos: ok vuelve a 0, gone se borra, failed suma y borra con 8 en 48 h.
do $$
declare s1 uuid; s2 uuid; s3 uuid; s4 uuid; n int; at1 timestamptz := '2026-11-23 12:00:00+00';
begin
  select id into s1 from public.push_subscriptions where endpoint like '%/dev-12';
  select id into s2 from public.push_subscriptions where endpoint like '%/dev-11';
  select id into s3 from public.push_subscriptions where endpoint like '%/dev-10';
  select id into s4 from public.push_subscriptions where endpoint like '%/dev-9';
  n := public.push_subscriptions_record(null, array[s1, s2, s3], array[s4], at1);
  assert n = 1, format('borró %s (esperado 1: la gone)', n);
  assert not exists (select 1 from public.push_subscriptions where id = s4), 'la gone sigue';
  assert (select fail_count = 1 and first_failed_at = at1 from public.push_subscriptions where id = s1), 'no sumó el fallo';
  n := public.push_subscriptions_record(array[s2], null, null, at1 + interval '15 minutes');
  assert (select fail_count = 0 and first_failed_at is null from public.push_subscriptions where id = s2), 'ok no volvió a 0';
  -- 7 corridas más en 2 h: 8 fallos, pero el primero hace menos de 48 h: no se borra.
  for i in 1..7 loop
    n := public.push_subscriptions_record(null, array[s1], null, at1 + i * interval '15 minutes');
  end loop;
  assert exists (select 1 from public.push_subscriptions where id = s1), 'borró con 8 fallos en 2 h (un 403 del servidor no debe borrar)';
  -- s3: 8 fallos con el primero hace 48 h o más: se borra.
  update public.push_subscriptions set fail_count = 7, first_failed_at = at1 - interval '49 hours' where id = s3;
  n := public.push_subscriptions_record(null, array[s3], null, at1);
  assert n = 1 and not exists (select 1 from public.push_subscriptions where id = s3), 'no borró tras 8 fallos en 48 h';
  assert public.push_subscriptions_record(null, null, null, null) = 0, 'null borró algo';
end
$$;
reset role;

select 'OK: push_subscription_guard.sql' as resultado;
rollback;
