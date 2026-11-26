-- Prueba de la migración 20261126000000 (reverse trial: 14 días de Pro sin
-- tarjeta). Corre en una base LOCAL con el esquema de producción (nunca en
-- producción): psql -v ON_ERROR_STOP=1 -f supabase/tests/reverse_trial.sql
-- Todo dentro de una transacción que se revierte.
begin;
create temp table rt_ids (name text primary key, id uuid not null) on commit drop;
grant select on rt_ids to authenticated;
insert into rt_ids values ('nueva', gen_random_uuid()), ('pago', gen_random_uuid()),
  ('mail', gen_random_uuid()), ('compra', gen_random_uuid()), ('vence', gen_random_uuid()),
  ('anon', gen_random_uuid()), ('sinconf', gen_random_uuid()), ('crm', gen_random_uuid()),
  ('borra', gen_random_uuid()), ('borra2', gen_random_uuid()), ('alias', gen_random_uuid()),
  ('cambia', gen_random_uuid()), ('carry', gen_random_uuid()), ('sincred', gen_random_uuid());
create temp table rt_out (tag text primary key, res jsonb) on commit drop;
grant select, insert, update on rt_out to authenticated;

-- auth.uid() de esta imagen lee request.jwt.claim.sub; el de producción, también claims.
create or replace function pg_temp.claim(p_id uuid, p_anon boolean default false) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true),
         set_config('request.jwt.claim.sub', p_id::text, true)
$$;

-- Llama a una RPC como la cuenta `who`, con su JWT, y guarda el resultado.
create or replace function pg_temp.as_user(who text, rpc text, p_tag text, p_anon boolean default false) returns void language plpgsql as $$
declare v_id uuid; v_res jsonb;
begin
  select id into v_id from rt_ids where name = who;
  perform pg_temp.claim(v_id, p_anon);
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
  -- Cuentas extra para los casos de S1–S6 / D1–D3.
  insert into auth.users (id, email, instance_id, aud, role)
  select r.id, r.name || '-rt@t.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'
    from rt_ids r where r.name in ('anon', 'sinconf', 'crm', 'borra', 'carry', 'sincred');
  insert into auth.users (id, email, instance_id, aud, role) values
    ((select id from rt_ids where name = 'alias'), 'ana.perez+moyiq@gmail.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    ((select id from rt_ids where name = 'cambia'), 'antes-rt@t.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  -- Correo confirmado (mailer_autoconfirm false en producción), salvo 'sinconf'.
  update auth.users set email_confirmed_at = now() where id in (select id from rt_ids where name <> 'sinconf');
  update auth.users set is_anonymous = true, email = null where id = (select id from rt_ids where name = 'anon');
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
-- S1: sesión anónima, cuenta sin correo o sin confirmar: nunca.
select pg_temp.as_user('anon', 'start_pro_trial', 'x_anon', true);
select pg_temp.as_user('sinconf', 'start_pro_trial', 'x_sinconf');
select pg_temp.as_user('sinconf', 'pro_trial_status', 'x_sinconf_s');
do $$ begin
  assert (select res->>'error' from rt_out where tag = 'x_anon') = 'not_eligible', 'anónima: ' || (select res::text from rt_out where tag = 'x_anon');
  assert (select res->>'error' from rt_out where tag = 'x_sinconf') = 'not_eligible', 'sin confirmar';
  assert (select res->>'eligible' from rt_out where tag = 'x_sinconf_s') = 'false', 'sin confirmar no es elegible';
  assert not exists (select 1 from public.pro_trials where user_id in (select id from rt_ids where name in ('anon', 'sinconf'))), 'sin filas';
end $$;

-- S2: el CRM no ve la prueba como pago ni corta la secuencia de Starter.
do $$
declare v_id uuid := (select id from rt_ids where name = 'crm');
begin
  insert into public.starter_leads (email) values ('crm-rt@t.local');
  perform public.crm_refresh_contact('crm-rt@t.local');
end $$;
create temp table rt_crm_before on commit drop as
  select estado, plan from public.crm_contacts where lower(email) = 'crm-rt@t.local';
select pg_temp.as_user('crm', 'start_pro_trial', 'x_crm');
do $$
declare v_acc timestamptz; v_estado text; v_plan text; b_estado text; b_plan text;
begin
  assert (select res->>'ok' from rt_out where tag = 'x_crm') = 'true', 'crm empieza';
  select account_created_at into v_acc from public.starter_leads where lower(email) = 'crm-rt@t.local';
  assert v_acc is null, 'la prueba no corta la secuencia de Starter (account_created_at): ' || coalesce(v_acc::text, '');
  select estado, plan into b_estado, b_plan from rt_crm_before;
  select estado, plan into v_estado, v_plan from public.crm_contacts where lower(email) = 'crm-rt@t.local';
  assert v_estado is not distinct from b_estado and v_estado not in ('convertido', 'perdido'), 'estado CRM intacto: ' || coalesce(v_estado, 'null');
  assert v_plan is distinct from 'pro', 'plan CRM no es pro: ' || coalesce(v_plan, 'null');
  -- Al vencer tampoco queda 'perdido'.
  update public.pro_trials set started_at = now() - interval '15 days', ends_at = now() - interval '1 day' where user_id = (select id from rt_ids where name = 'crm');
  perform public.pro_trials_expire_due();
  select estado into v_estado from public.crm_contacts where lower(email) = 'crm-rt@t.local';
  assert v_estado is distinct from 'perdido', 'tras vencer no queda perdido';
end $$;

-- S3 / D1: borrar la cuenta y volver a registrarse (mismo correo o alias de Gmail) no da otra prueba.
select pg_temp.as_user('borra', 'start_pro_trial', 'x_borra');
select pg_temp.as_user('alias', 'start_pro_trial', 'x_alias');
do $$
declare b uuid := (select id from rt_ids where name = 'borra'); a uuid := (select id from rt_ids where name = 'alias'); r jsonb; n int;
begin
  assert (select res->>'ok' from rt_out where tag = 'x_borra') = 'true';
  assert (select res->>'ok' from rt_out where tag = 'x_alias') = 'true';
  r := public.delete_account_data(b, 'borra-rt@t.local');
  assert r->>'ok' = 'true';
  delete from auth.users where id = b;
  r := public.delete_account_data(a, 'ana.perez+moyiq@gmail.com');
  delete from auth.users where id = a;
  -- Nada de la prueba queda (licencia, copia, filas), salvo el HMAC.
  select count(*) into n from public.pro_trials where user_id in (a, b); assert n = 0, 'pro_trials borrado';
  select count(*) into n from public.licenses where lower(email) in ('borra-rt@t.local', 'ana.perez+moyiq@gmail.com'); assert n = 0, 'licencias de prueba borradas';
  select count(*) into n from public.pro_trial_tombstones where email_hmac in (public.fnos_trial_email_id('borra-rt@t.local'), public.fnos_trial_email_id('anaperez@gmail.com'));
  assert n = 2, 'quedan los HMAC: ' || n;
  assert not exists (select 1 from information_schema.columns where table_name = 'pro_trial_tombstones' and column_name ~ '(email$|user|license)'), 'tombstone sin PII';
  -- Vuelven a registrarse.
  insert into auth.users (id, email, instance_id, aud, role, email_confirmed_at) values
    ((select id from rt_ids where name = 'borra2'), 'BORRA-rt@t.local ', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now());
  assert not public.fnos_pro_trial_eligible((select id from rt_ids where name = 'borra2')), 'mismo correo (mayúsculas/espacios): sin prueba';
  insert into auth.users (id, email, instance_id, aud, role, email_confirmed_at) values
    (gen_random_uuid(), 'AnaPerez@googlemail.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now());
  assert not public.fnos_pro_trial_eligible((select id from auth.users where email = 'AnaPerez@googlemail.com')), 'alias de Gmail: sin prueba';
  -- En otros dominios "+" no se toca (puede ser parte real de la dirección).
  assert public.fnos_trial_email_norm('a+b@empresa.cl') = 'a+b@empresa.cl';
  assert public.fnos_trial_email_norm('A.B+x@Gmail.com') = 'ab@gmail.com';
  assert public.fnos_trial_email_norm('x+y@outlook.com') = 'x@outlook.com';
  assert public.fnos_trial_email_norm('no-es-correo') is null;
end $$;

-- S4: cambiar el correo y después borrar la cuenta no deja nada de la prueba.
select pg_temp.as_user('cambia', 'start_pro_trial', 'x_cambia');
do $$
declare c uuid := (select id from rt_ids where name = 'cambia'); k text := (select res->>'license_key' from rt_out where tag = 'x_cambia'); h text; r jsonb; n int;
begin
  h := public.fnos_license_id(k);
  insert into public.synced_data (key_hash, blob, updated_at) values (h, 'fnos2:{"c":1}', 1);
  update auth.users set email = 'despues-rt@t.local' where id = c;
  -- La prueba vence y la cuenta ya no tiene la licencia en user_entitlements.
  update public.pro_trials set started_at = now() - interval '15 days', ends_at = now() - interval '1 day' where user_id = c;
  perform public.pro_trials_expire_due();
  assert (select license_key from public.user_entitlements where user_id = c) is null;
  r := public.delete_account_data(c, 'despues-rt@t.local');
  assert r->>'ok' = 'true';
  select count(*) into n from public.licenses where key_hash = h; assert n = 0, 'licencia de prueba (correo viejo) borrada';
  select count(*) into n from public.synced_data where key_hash = h; assert n = 0, 'copia de la prueba borrada';
  select count(*) into n from public.pro_trials where user_id = c; assert n = 0, 'fila de prueba borrada';
  select count(*) into n from public.pro_trial_tombstones where email_hmac in (public.fnos_trial_email_id('antes-rt@t.local'), public.fnos_trial_email_id('despues-rt@t.local'));
  assert n = 2, 'HMAC de los dos correos';
end $$;

-- S6: comprar cuando la licencia pagada ya tiene copia: queda la más nueva; tope de avisos.
select pg_temp.as_user('carry', 'start_pro_trial', 'x_carry');
do $$
declare c uuid := (select id from rt_ids where name = 'carry'); k text := (select res->>'license_key' from rt_out where tag = 'x_carry');
  hp text := encode(digest('FNOS-RTCY-RTCY-RTCY','sha256'),'hex'); h text; r jsonb; n int; v_blob text;
begin
  h := public.fnos_license_id(k);
  insert into public.licenses (key_hash, key_hash_v, plan, status) values (public.fnos_license_id(hp), 2, 'pro', 'active');
  insert into public.synced_data (key_hash, blob, updated_at) values (h, 'fnos2:{"nuevo":1}', 200), (public.fnos_license_id(hp), 'fnos2:{"viejo":1}', 100);
  for i in 1..8 loop
    insert into public.push_subscriptions (key_hash, endpoint, p256dh, auth, created_at)
    values (h, 'https://fcm.googleapis.com/fcm/send/t' || i, repeat('A', 87), 'abcdefghijkl', now() - (i || ' minutes')::interval),
           (public.fnos_license_id(hp), 'https://fcm.googleapis.com/fcm/send/p' || i, repeat('A', 87), 'abcdefghijkl', now() - (i || ' hours')::interval);
  end loop;
  r := public.attach_license_to_account(c, 'FNOS-RTCY-RTCY-RTCY');
  assert r->>'ok' = 'true', r::text;
  select blob into v_blob from public.synced_data where key_hash = public.fnos_license_id(hp);
  assert v_blob = 'fnos2:{"nuevo":1}', 'gana la copia más nueva: ' || v_blob;
  select count(*) into n from public.synced_data where key_hash = h; assert n = 0, 'no queda la copia de la prueba';
  select count(*) into n from public.push_subscriptions where key_hash = public.fnos_license_id(hp); assert n = 10, 'tope de 10 avisos: ' || n;
end $$;

-- S6: en curso pero sin credencial (borró el entitlement): la prueba termina, no queda colgada.
select pg_temp.as_user('sincred', 'start_pro_trial', 'x_sincred');
do $$ begin
  delete from public.user_entitlements where user_id = (select id from rt_ids where name = 'sincred');
end $$;
select pg_temp.as_user('sincred', 'pro_trial_status', 'x_sincred_s');
do $$
declare k text := (select res->>'license_key' from rt_out where tag = 'x_sincred');
begin
  assert (select res->>'ended' from rt_out where tag = 'x_sincred_s') = 'true', 'sin credencial: terminada ' || (select res::text from rt_out where tag = 'x_sincred_s');
  assert (public.validate_license(k))->>'valid' = 'false', 'su licencia ya no vale';
end $$;

-- Cliente: ninguna tabla nueva se lee ni se escribe como authenticated; el plan
-- 'pro' no se pone a mano sin licencia.
do $$
declare v uuid := (select id from rt_ids where name = 'vence'); ok boolean;
begin
  perform pg_temp.claim(v);
  set local role authenticated;
  begin update public.pro_trials set ends_at = now() + interval '1 year'; ok := true; exception when insufficient_privilege then ok := false; end;
  assert not ok, 'authenticated no puede tocar pro_trials';
  begin insert into public.pro_trial_tombstones (email_hmac) values ('x'); ok := true; exception when insufficient_privilege then ok := false; end;
  assert not ok, 'authenticated no puede tocar tombstones';
  begin delete from public.pro_trial_tombstones; ok := true; exception when insufficient_privilege then ok := false; end;
  assert not ok, 'authenticated no puede borrar tombstones';
  begin insert into public.pro_trial_emails (user_id, step) values (v, 'welcome'); ok := true; exception when insufficient_privilege then ok := false; end;
  assert not ok, 'authenticated no puede tocar pro_trial_emails';
  begin update public.user_entitlements set plan = 'pro', license_key = repeat('f', 64) where user_id = v; ok := true; exception when others then ok := false; end;
  assert not ok, 'plan pro sin licencia válida desde el cliente';
  reset role;
  assert not has_function_privilege('authenticated', 'public.pro_trials_purge_sync(timestamptz)', 'execute');
  assert not has_function_privilege('authenticated', 'public.pro_trial_emails_due(timestamptz)', 'execute');
  assert not has_function_privilege('authenticated', 'public.fnos_trial_email_id(text)', 'execute');
end $$;

-- D2: la copia cifrada de una prueba que terminó sin compra se borra a los 90 días.
do $$
declare c uuid := (select id from rt_ids where name = 'crm'); h text; n int;
begin
  select key_hash into h from public.pro_trials where user_id = c;
  insert into public.synced_data (key_hash, blob, updated_at) values (h, 'fnos2:{"p":1}', 1);
  assert public.pro_trials_purge_sync(now()) = 0, 'antes de 90 días no se borra';
  assert public.pro_trials_purge_sync(now() + interval '91 days') >= 1, 'a los 90 días sí';
  select count(*) into n from public.synced_data where key_hash = h; assert n = 0, 'copia borrada';
  assert public.pro_trials_purge_sync(now() + interval '92 days') = 0, 'una sola vez';
  assert (select sync_purged_at from public.pro_trials where user_id = c) is not null;
end $$;

-- D3: correos de la prueba: bienvenida al empezar, día 10, fin; reclamar es idempotente.
do $$
declare c uuid := (select id from rt_ids where name = 'crm'); s uuid := (select id from rt_ids where name = 'nueva'); n int;
begin
  -- 'crm' terminó hace un rato: le toca 'ended'.
  select count(*) into n from public.pro_trial_emails_due(now()) d where d.user_id = c and d.step = 'ended';
  assert n = 1, 'fin de prueba pendiente';
  assert public.pro_trial_email_claim(c, 'ended'), 'reclamar';
  assert not public.pro_trial_email_claim(c, 'ended'), 'no dos veces';
  select count(*) into n from public.pro_trial_emails_due(now()) d where d.user_id = c and d.step = 'ended';
  assert n = 0, 'ya no está pendiente';
  perform public.pro_trial_email_release(c, 'ended');
  assert public.pro_trial_email_claim(c, 'ended'), 'soltado tras un fallo, se vuelve a reclamar';
  -- Una prueba en curso con 10 días: bienvenida vieja no, día 10 sí.
  update public.pro_trials set started_at = now() - interval '10 days 1 hour', ends_at = now() + interval '3 days 23 hours', ended_at = null, converted_at = null
   where user_id = (select id from rt_ids where name = 'carry');
  select count(*) into n from public.pro_trial_emails_due(now()) d where d.user_id = (select id from rt_ids where name = 'carry') and d.step = 'day10';
  assert n = 1, 'día 10 pendiente';
  select count(*) into n from public.pro_trial_emails_due(now()) d where d.user_id = (select id from rt_ids where name = 'carry') and d.step = 'welcome';
  assert n = 0, 'sin bienvenida vieja';
  assert not has_table_privilege('authenticated', 'public.pro_trial_emails', 'select');
end $$;

-- Reporte semanal: la prueba sin tarjeta va aparte.
do $$
declare m jsonb := public.funnel_report_metrics(date_trunc('week', now())::date);
begin
  assert m ? 'pruebas_sin_tarjeta', 'métrica nueva: ' || m::text;
end $$;

rollback;
