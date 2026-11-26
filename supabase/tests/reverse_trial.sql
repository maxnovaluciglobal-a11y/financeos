-- Prueba de la migración 20261126000000 (reverse trial: 14 días de Pro sin
-- tarjeta). Corre en una base LOCAL con el esquema de producción (nunca en
-- producción): psql -v ON_ERROR_STOP=1 -f supabase/tests/reverse_trial.sql
-- Todo dentro de una transacción que se revierte.
begin;
create temp table rt_ids (name text primary key, id uuid not null) on commit drop;
grant select on rt_ids to authenticated;
insert into rt_ids values ('nueva', gen_random_uuid()), ('pago', gen_random_uuid()),
  ('mail', gen_random_uuid()), ('compra', gen_random_uuid()), ('vence', gen_random_uuid());
create temp table rt_out (tag text primary key, res jsonb) on commit drop;
grant select, insert, update on rt_out to authenticated;

-- auth.uid() de esta imagen lee request.jwt.claim.sub; el de producción, también claims.
create or replace function pg_temp.claim(p_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_id::text, true)
$$;

-- Llama a una RPC como la cuenta `who`, con su JWT, y guarda el resultado.
create or replace function pg_temp.as_user(who text, rpc text, p_tag text) returns void language plpgsql as $$
declare v_id uuid; v_res jsonb;
begin
  select id into v_id from rt_ids where name = who;
  perform pg_temp.claim(v_id);
  set local role authenticated;
  execute format('select public.%I()', rpc) into v_res;
  reset role;
  insert into rt_out values (p_tag, v_res) on conflict (tag) do update set res = excluded.res;
end $$;

do $$
declare
  n_id uuid := (select id from rt_ids where name = 'nueva');
  p_id uuid := (select id from rt_ids where name = 'pago');
  m_id uuid := (select id from rt_ids where name = 'mail');
  c_id uuid := (select id from rt_ids where name = 'compra');
  v_id uuid := (select id from rt_ids where name = 'vence');
  hp text := encode(digest('FNOS-RTPG-RTPG-RTPG','sha256'),'hex');
  hm text := encode(digest('FNOS-RTML-RTML-RTML','sha256'),'hex');
  hb text := encode(digest('FNOS-RTBY-RTBY-RTBY','sha256'),'hex');
begin
  insert into auth.users (id, email, instance_id, aud, role) values
    (n_id,'nueva-rt@t.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
    (p_id,'pago-rt@t.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
    (m_id,'mail-rt@t.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
    (c_id,'compra-rt@t.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
    (v_id,'vence-rt@t.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
  -- 'pago' ya pagó (licencia atada a la cuenta); 'mail' tuvo una licencia con su
  -- correo (revocada) sin atarla a la cuenta; 'compra' comprará durante la prueba
  -- (su licencia la emite el webhook después de empezar la prueba: sin correo acá).
  insert into public.licenses (key_hash, key_hash_v, plan, status, email) values
    (public.fnos_license_id(hp), 2, 'pro', 'active', 'pago-rt@t.local'),
    (public.fnos_license_id(hm), 2, 'personal', 'revoked', 'MAIL-RT@t.local'),
    (public.fnos_license_id(hb), 2, 'pro', 'active', null);
  insert into public.user_entitlements (user_id, plan, license_key) values (p_id, 'pro', hp), (v_id, 'starter', null);
end $$;

-- Elegibilidad.
select pg_temp.as_user('nueva', 'pro_trial_status', 's_nueva');
select pg_temp.as_user('pago', 'pro_trial_status', 's_pago');
select pg_temp.as_user('mail', 'pro_trial_status', 's_mail');
select pg_temp.as_user('vence', 'pro_trial_status', 's_vence');
do $$ begin
  assert (select res->>'eligible' from rt_out where tag = 's_nueva') = 'true', 'cuenta nueva elegible';
  assert (select res->>'eligible' from rt_out where tag = 's_pago') = 'false', 'quien pagó no es elegible';
  assert (select res->>'eligible' from rt_out where tag = 's_mail') = 'false', 'licencia vieja con su correo: no elegible';
  assert (select res->>'eligible' from rt_out where tag = 's_vence') = 'true', 'Starter existente sin prueba: elegible';
end $$;

-- Empezar: una sola vez, idempotente mientras dura.
select pg_temp.as_user('nueva', 'start_pro_trial', 'a1');
select pg_temp.as_user('nueva', 'start_pro_trial', 'a2');
select pg_temp.as_user('pago', 'start_pro_trial', 'a_pago');
select pg_temp.as_user('nueva', 'pro_trial_status', 's_nueva2');
do $$
declare a1 jsonb := (select res from rt_out where tag = 'a1'); a2 jsonb := (select res from rt_out where tag = 'a2');
  s jsonb := (select res from rt_out where tag = 's_nueva2'); r jsonb; n int;
  n_id uuid := (select id from rt_ids where name = 'nueva');
begin
  assert a1->>'ok' = 'true' and a1->>'license_key' ~ '^[0-9a-f]{64}$', 'empieza: ' || a1::text;
  assert ((a1->>'ends_at')::bigint - (a1->>'started_at')::bigint) = 14 * 86400000, '14 días exactos';
  assert a2->>'already' = 'true' and a2->>'license_key' = a1->>'license_key', 'idempotente: ' || a2::text;
  assert (select res->>'error' from rt_out where tag = 'a_pago') = 'not_eligible', 'quien pagó no la empieza';
  select count(*) into n from public.pro_trials where user_id = n_id; assert n = 1, 'una fila';
  assert s->>'active' = 'true' and s->>'license_key' = a1->>'license_key', 'estado en curso: ' || s::text;
  -- La licencia de prueba es Pro de verdad para todo lo que ya exige Pro.
  r := public.validate_license(a1->>'license_key');
  assert r->>'valid' = 'true' and r->>'plan' = 'pro' and r->>'trial' = 'true' and r->>'no_card_trial' = 'true', 'validate: ' || r::text;
  assert (select plan from public.user_entitlements where user_id = n_id) = 'pro', 'entitlement pro';
  -- Ningún campo de la prueba es escribible ni legible desde el cliente.
  assert not has_table_privilege('authenticated', 'public.pro_trials', 'select');
  assert not has_table_privilege('authenticated', 'public.pro_trials', 'update');
  assert not has_table_privilege('anon', 'public.pro_trials', 'insert');
  assert not has_function_privilege('anon', 'public.start_pro_trial()', 'execute');
  assert not has_function_privilege('anon', 'public.pro_trial_status()', 'execute');
  assert not has_function_privilege('authenticated', 'public.fnos_end_pro_trial(uuid)', 'execute');
  assert not has_function_privilege('authenticated', 'public.pro_trials_expire_due()', 'execute');
  -- El CRM no la cuenta como pago.
  perform public.crm_refresh_contact('nueva-rt@t.local');
  assert not exists (select 1 from public.crm_contacts where email = 'nueva-rt@t.local' and plan = 'pro'), 'CRM no la marca Pro';
end $$;

-- Sync y push funcionan con la credencial de la prueba (sesión de la dueña).
do $$
declare k text := (select res->>'license_key' from rt_out where tag = 'a1'); r jsonb;
begin
  perform pg_temp.claim((select id from rt_ids where name = 'nueva'));
  set local role authenticated;
  r := public.sync_push(k, 'fnos2:{"v":2}', 1);
  assert r->>'ok' = 'true', 'sync_push con la prueba: ' || r::text;
  r := public.save_push_subscription(k, 'https://fcm.googleapis.com/fcm/send/rt-abc', repeat('A', 87), 'abcdefghijkl');
  assert r->>'ok' = 'true', 'push con la prueba: ' || r::text;
  reset role;
end $$;

-- Vence: vuelve a Starter sin perder la copia; no se puede volver a empezar.
do $$
declare n_id uuid := (select id from rt_ids where name = 'nueva'); k text := (select res->>'license_key' from rt_out where tag = 'a1');
  h text; r jsonb; n int;
begin
  h := public.fnos_license_id(k);
  update public.pro_trials set started_at = now() - interval '15 days', ends_at = now() - interval '1 day' where user_id = n_id;
  update public.licenses set expires_at = now() - interval '1 day', trial_ends_at = now() - interval '1 day' where key_hash = h;
  r := public.validate_license(k);
  assert r->>'valid' = 'false' and r->>'expired' = 'true', 'vencida: ' || r::text;
  assert public.pro_trials_expire_due() = 1, 'el job procesa una';
  assert public.pro_trials_expire_due() = 0, 'y no la repite';
  assert (select plan from public.user_entitlements where user_id = n_id) = 'starter', 'vuelve a Starter';
  assert (select license_key from public.user_entitlements where user_id = n_id) is null, 'sin credencial';
  select count(*) into n from public.push_subscriptions where key_hash = h; assert n = 0, 'sin avisos push';
  select count(*) into n from public.synced_data where key_hash = h; assert n = 1, 'la copia cifrada se conserva';
  perform pg_temp.claim(n_id);
  set local role authenticated;
  r := public.sync_push(k, 'fnos2:{"v":3}', 2);
  assert r->>'ok' = 'false', 'sync vencido: ' || r::text;
  r := public.save_push_subscription(k, 'https://fcm.googleapis.com/fcm/send/rt-def', repeat('A', 87), 'abcdefghijkl');
  assert r->>'error' = 'invalid_license', 'push vencido: ' || r::text;
  reset role;
end $$;
select pg_temp.as_user('nueva', 'start_pro_trial', 'a3');
select pg_temp.as_user('nueva', 'pro_trial_status', 's_nueva3');
do $$ begin
  assert (select res->>'error' from rt_out where tag = 'a3') = 'already_used', 'una prueba por cuenta';
  assert (select res->>'ended' from rt_out where tag = 's_nueva3') = 'true', 'estado terminada';
  assert (select res->>'eligible' from rt_out where tag = 's_nueva3') = 'false', 'ya no elegible';
end $$;

-- Comprar durante la prueba: la compra la reemplaza y se lleva la copia y los avisos.
select pg_temp.as_user('compra', 'start_pro_trial', 'b1');
do $$
declare c_id uuid := (select id from rt_ids where name = 'compra'); k text := (select res->>'license_key' from rt_out where tag = 'b1');
  hb text := encode(digest('FNOS-RTBY-RTBY-RTBY','sha256'),'hex'); h text; r jsonb; n int;
begin
  h := public.fnos_license_id(k);
  perform pg_temp.claim(c_id);
  set local role authenticated;
  r := public.sync_push(k, 'fnos2:{"compra":1}', 1);
  assert r->>'ok' = 'true', 'sync de la prueba: ' || r::text;
  r := public.save_push_subscription(k, 'https://fcm.googleapis.com/fcm/send/rt-buy', repeat('A', 87), 'abcdefghijkl');
  assert r->>'ok' = 'true';
  reset role;
  r := public.attach_license_to_account(c_id, 'FNOS-RTBY-RTBY-RTBY');
  assert r->>'ok' = 'true', 'la compra no choca con la prueba: ' || r::text;
  assert (select license_key from public.user_entitlements where user_id = c_id) = hb, 'queda la licencia pagada';
  select count(*) into n from public.synced_data where key_hash = public.fnos_license_id(hb); assert n = 1, 'copia pasada a la pagada';
  select count(*) into n from public.push_subscriptions where key_hash = public.fnos_license_id(hb); assert n = 1, 'avisos pasados';
  assert (select converted_at from public.pro_trials where user_id = c_id) is not null, 'prueba convertida';
  r := public.validate_license(k);
  assert r->>'valid' = 'false', 'la licencia de prueba ya no vale: ' || r::text;
  assert public.pro_trials_expire_due() = 0, 'una convertida no se procesa como vencida';
  -- Una licencia pagada sigue bloqueando a otra (sin cambios).
  r := public.attach_license_to_account(c_id, 'FNOS-RTPG-RTPG-RTPG');
  assert r->>'error' in ('already_pro', 'license_in_use'), 'pagada vs pagada: ' || r::text;
  raise notice 'OK: reverse_trial';
end $$;
-- Licencia de pago único ('personal', antes del 12-sep-2026): conserva todo Pro.
do $$
declare u uuid := gen_random_uuid(); h text := encode(digest('FNOS-RTPS-RTPS-RTPS','sha256'),'hex'); r jsonb;
begin
  insert into auth.users (id, email, instance_id, aud, role) values
    (u,'personal-rt@t.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
  insert into public.licenses (key_hash, key_hash_v, plan, status, email) values (public.fnos_license_id(h), 2, 'personal', 'active', 'personal-rt@t.local');
  insert into public.user_entitlements (user_id, plan, license_key) values (u, 'pro', h);
  r := public.report_email_claim(u, h);
  assert r->>'ok' = 'true', 'reporte por correo con licencia personal: ' || r::text;
  assert not public.fnos_pro_trial_eligible(u), 'quien tiene licencia de pago único no tiene prueba';
end $$;
rollback;
