-- Alertas de precio de Inversiones (F4, migraciones 20261120000100 y 20261123000000): RLS por cuenta,
-- tope de 50, restricciones de la tabla, grants y la función de destinos push.
-- Solo en la base local de prueba (scripts/test-db); todo termina en ROLLBACK.
begin;

create temp table _t(n int) on commit drop;
grant all on _t to anon, authenticated, service_role;

do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  ha text := encode(digest('FNOS-ALRT-ALRT-ALRT', 'sha256'), 'hex');
begin
  insert into auth.users (id, email, instance_id, aud, role) values
    (a, 'alert-a@t.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (b, 'alert-b@t.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  insert into public.invest_alerts (user_id, symbol, condition, threshold) values
    (a, 'AAPL', 'above', 250), (a, 'SPY', 'pct_move', 3), (b, 'MSFT', 'below', 300);
  -- Push de A: licencia -> entitlement -> suscripción (key_hash = id HMAC).
  insert into public.licenses (key_hash, plan, status, email) values (public.fnos_license_id(ha), 'pro', 'active', 'alert-a@t.local');
  insert into public.user_entitlements (user_id, plan, license_key) values (a, 'pro', ha);
  insert into public.push_subscriptions (key_hash, endpoint, p256dh, auth) values
    (public.fnos_license_id(ha), 'https://push.example/alert-a', 'p', 'k');
  perform set_config('test.a', a::text, true);
  perform set_config('test.b', b::text, true);
end
$$;

-- 1. Restricciones: símbolo, condición y umbral.
do $$
begin
  begin
    insert into public.invest_alerts (user_id, symbol, condition, threshold) values (current_setting('test.a')::uuid, 'aapl;', 'above', 1);
    raise exception 'FALLA: aceptó un símbolo inválido';
  exception when check_violation then null;
  end;
  begin
    insert into public.invest_alerts (user_id, symbol, condition, threshold) values (current_setting('test.a')::uuid, 'AAPL', 'Max', 1);
    raise exception 'FALLA: aceptó una condición inválida';
  exception when check_violation then null;
  end;
  begin
    insert into public.invest_alerts (user_id, symbol, condition, threshold) values (current_setting('test.a')::uuid, 'AAPL', 'above', 0);
    raise exception 'FALLA: aceptó un umbral 0';
  exception when check_violation then null;
  end;
  begin
    insert into public.invest_alerts (user_id, symbol, condition, threshold) values (current_setting('test.a')::uuid, 'AAPL', 'pct_move', 150);
    raise exception 'FALLA: aceptó un movimiento de 150 %%';
  exception when check_violation then null;
  end;
  insert into public.invest_alerts (user_id, symbol, condition, threshold) values (current_setting('test.a')::uuid, '^GSPC', 'below', 5000.5);
  delete from public.invest_alerts where symbol = '^GSPC';
end
$$;

-- 2. anon no ve nada ni ejecuta la función.
set local role anon;
do $$
begin
  begin
    perform 1 from public.invest_alerts limit 1;
    raise exception 'FALLA: anon pudo leer invest_alerts';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.invest_alert_push_targets(array[gen_random_uuid()]);
    raise exception 'FALLA: anon ejecutó invest_alert_push_targets';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

-- 3. authenticated: solo sus alertas; no puede pasar una fila a otra cuenta.
set local role authenticated;
do $$
declare n int;
begin
  perform set_config('request.jwt.claim.sub', current_setting('test.a'), true);
  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('test.a'), 'role', 'authenticated')::text, true);
  select count(*) into n from public.invest_alerts;
  assert n = 2, format('A ve %s alertas (esperado 2)', n);
  update public.invest_alerts set threshold = 1 where symbol = 'MSFT';
  get diagnostics n = row_count;
  assert n = 0, 'A editó una alerta de B';
  delete from public.invest_alerts where symbol = 'MSFT';
  get diagnostics n = row_count;
  assert n = 0, 'A borró una alerta de B';
  update public.invest_alerts set threshold = 260, active = false, last_triggered_at = null where symbol = 'AAPL';
  get diagnostics n = row_count;
  assert n = 1, 'A no pudo editar su alerta';
  begin
    update public.invest_alerts set user_id = current_setting('test.b')::uuid where symbol = 'AAPL';
    raise exception 'FALLA: A pasó su alerta a B';
  exception when insufficient_privilege or check_violation then null;
  end;
  begin
    insert into public.invest_alerts (user_id, symbol, condition, threshold) values (current_setting('test.b')::uuid, 'NVDA', 'above', 1);
    raise exception 'FALLA: A creó una alerta a nombre de B';
  exception when insufficient_privilege or check_violation then null;
  end;
  begin
    perform 1 from public.invest_alert_push_targets(array[current_setting('test.a')::uuid]);
    raise exception 'FALLA: authenticated ejecutó invest_alert_push_targets';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.invest_alerts_mark_checked(array[]::uuid[], now());
    raise exception 'FALLA: authenticated ejecutó invest_alerts_mark_checked';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.invest_alerts_claim(array[]::uuid[], now());
    raise exception 'FALLA: authenticated ejecutó invest_alerts_claim';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.invest_alerts_release(array[]::uuid[], array[]::timestamptz[], now());
    raise exception 'FALLA: authenticated ejecutó invest_alerts_release';
  exception when insufficient_privilege then null;
  end;
  -- Rotación: la cuenta no puede ponerse primera en la fila (grants por columna).
  begin
    update public.invest_alerts set last_checked_at = null where symbol = 'AAPL';
    raise exception 'FALLA: A cambió last_checked_at';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.invest_alerts (user_id, symbol, condition, threshold, last_checked_at) values (current_setting('test.a')::uuid, 'IBM', 'above', 1, '-infinity');
    raise exception 'FALLA: A creó una alerta con last_checked_at propio';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.invest_alerts set created_at = '2000-01-01' where symbol = 'AAPL';
    raise exception 'FALLA: A cambió created_at';
  exception when insufficient_privilege then null;
  end;
  -- Tope de 50 por cuenta (ya tiene 2).
  for i in 1..48 loop
    insert into public.invest_alerts (user_id, symbol, condition, threshold) values (current_setting('test.a')::uuid, 'QQQ', 'above', 100 + i);
  end loop;
  begin
    insert into public.invest_alerts (user_id, symbol, condition, threshold) values (current_setting('test.a')::uuid, 'QQQ', 'above', 999);
    raise exception 'FALLA: pasó el tope de 50 alertas';
  exception when insufficient_privilege or check_violation then null;
  end;
end
$$;
reset role;

-- 4. service_role: lee las activas, marca el aviso y encuentra la suscripción de A (y ninguna de B).
set local role service_role;
do $$
declare n int; ep text;
begin
  select count(*) into n from public.invest_alerts where active;
  assert n >= 2, 'service_role no ve las alertas activas';
  update public.invest_alerts set last_triggered_at = now() where symbol = 'SPY';
  get diagnostics n = row_count;
  assert n = 1, 'service_role no pudo marcar el aviso';
  select string_agg(endpoint, ',') into ep from public.invest_alert_push_targets(array[current_setting('test.a')::uuid, current_setting('test.b')::uuid]);
  assert ep = 'https://push.example/alert-a', format('destinos push: %s', ep);
  select count(*) into n from public.invest_alert_push_targets(null);
  assert n = 0, 'null devuelve destinos';
  -- Rotación (migración 20261123000000): marca las revisadas y solo esas.
  update public.invest_alerts set last_checked_at = null;
  select public.invest_alerts_mark_checked(array_agg(id), now()) into n from public.invest_alerts where symbol = 'AAPL';
  assert n = 1, format('mark_checked marcó %s', n);
  select count(*) into n from public.invest_alerts where last_checked_at is not null;
  assert n = 1, 'mark_checked tocó otras alertas';
  assert public.invest_alerts_mark_checked(null, now()) = 0, 'null marcó alertas';
  -- Una alerta nueva entra con last_checked_at (espera su turno).
  insert into public.invest_alerts (user_id, symbol, condition, threshold) values (current_setting('test.b')::uuid, 'IBM', 'above', 1);
  select count(*) into n from public.invest_alerts where symbol = 'IBM' and last_checked_at is null;
  assert n = 0, 'una alerta nueva entró sin last_checked_at (se adelanta en la fila)';
end
$$;
reset role;

-- 4b. Reclamo y devolución por RPC (ids en el cuerpo, no en la URL).
set local role service_role;
do $$
declare n int; at1 timestamptz := '2026-11-23 12:00:00+00'; prev timestamptz; ids uuid[];
begin
  select array_agg(id) into ids from public.invest_alerts where user_id = current_setting('test.a')::uuid and symbol = 'QQQ';
  update public.invest_alerts set last_triggered_at = at1 - interval '30 hours' where id = ids[1];
  update public.invest_alerts set last_triggered_at = at1 - interval '2 hours' where id = ids[2];
  update public.invest_alerts set active = false where id = ids[3];
  select count(*) into n from public.invest_alerts_claim(ids, at1);
  assert n = array_length(ids, 1) - 2, format('claim reclamó %s de %s', n, array_length(ids, 1));
  select count(*) into n from public.invest_alerts_claim(ids, at1);
  assert n = 0, 'un segundo reclamo en la misma ventana volvió a reclamar';
  assert (select last_triggered_at from public.invest_alerts where id = ids[2]) = at1 - interval '2 hours', 'reclamó una alerta en espera';
  -- Devolver la 1 (con valor anterior) y la 4 (sin valor anterior); la 2 no es de esta corrida.
  prev := at1 - interval '30 hours';
  select public.invest_alerts_release(array[ids[1], ids[4], ids[2]], array[prev, null, null]::timestamptz[], at1) into n;
  assert n = 2, format('release devolvió %s', n);
  assert (select last_triggered_at from public.invest_alerts where id = ids[1]) = prev, 'no volvió al valor anterior';
  assert (select last_triggered_at is null and last_checked_at is null from public.invest_alerts where id = ids[4]), 'la devuelta no quedó primera en la fila';
  assert (select last_triggered_at from public.invest_alerts where id = ids[2]) = at1 - interval '2 hours', 'release tocó una alerta de otra corrida';
  select count(*) into n from public.invest_alerts_claim(null, at1);
  assert n = 0, 'null reclamó alertas';
end
$$;
reset role;

-- 5. Borrar la cuenta borra sus alertas.
do $$
declare n int;
begin
  delete from auth.users where id = current_setting('test.b')::uuid;
  select count(*) into n from public.invest_alerts where user_id = current_setting('test.b')::uuid;
  assert n = 0, 'las alertas de B sobrevivieron al borrado de la cuenta';
end
$$;

select 'OK: invest_alerts.sql' as resultado;
rollback;
