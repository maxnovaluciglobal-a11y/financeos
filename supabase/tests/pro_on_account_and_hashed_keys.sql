-- Prueba de la migración 20261020010000 (C-39 / C-21). Corre en una base LOCAL
-- con el esquema de producción (nunca en producción): psql -v ON_ERROR_STOP=1 -f
-- Todo dentro de una transacción que se revierte.
begin;
do $$
declare
  x uuid := gen_random_uuid(); y uuid := gen_random_uuid(); z uuid := gen_random_uuid(); w uuid := gen_random_uuid();
  h1 text := encode(digest('FNOS-TST1-TST1-TST1','sha256'),'hex');
  h2 text := encode(digest('FNOS-TST2-TST2-TST2','sha256'),'hex');
  h3 text := encode(digest('FNOS-TST3-TST3-TST3','sha256'),'hex');
  r jsonb; k text;
begin
  insert into auth.users (id, email, instance_id, aud, role) values
    (x,'x@t.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
    (y,'y@t.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
    (z,'z@t.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
    (w,'w@t.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
  insert into public.licenses (key_hash, plan, status) values (h1,'pro','active'),(h2,'pro','active'),(h3,'pro','active');

  r := public.attach_license_to_account(x, 'FNOS-TST1-TST1-TST1');
  assert r->>'ok' = 'true', 'attach x: ' || r::text;
  select license_key into k from public.user_entitlements where user_id = x;
  assert k = h1, 'la cuenta guarda el hash, no la clave: ' || k;

  r := public.attach_license_to_account(y, 'FNOS-TST1-TST1-TST1');
  assert r->>'error' = 'license_in_use', 'otra cuenta: ' || r::text;
  r := public.attach_license_to_account(x, 'FNOS-TST2-TST2-TST2');
  assert r->>'error' = 'already_pro', 'ya Pro: ' || r::text;
  r := public.attach_license_to_account(gen_random_uuid(), 'FNOS-TST2-TST2-TST2');
  assert r->>'error' = 'no_account', 'sin cuenta: ' || r::text;
  r := public.attach_license_to_account(y, 'FNOS-NOPE-NOPE-NOPE');
  assert r->>'error' = 'invalid_license', 'licencia inexistente: ' || r::text;
  -- reintento idempotente de la misma licencia en la misma cuenta
  r := public.attach_license_to_account(x, 'FNOS-TST1-TST1-TST1');
  assert r->>'ok' = 'true', 'reintento: ' || r::text;

  -- La app (o una versión vieja) guarda la clave en claro: el trigger guarda el hash.
  insert into public.user_entitlements (user_id, plan, license_key) values (z, 'pro', 'fnos-tst2-tst2-tst2 ');
  select license_key into k from public.user_entitlements where user_id = z;
  assert k = h2, 'trigger hashea: ' || k;

  -- Con copia vieja del sync (modelo de licencia) la clave se conserva...
  insert into public.synced_data (key_hash, blob, updated_at) values (h3, 'AAAAbase64viejo', 1);
  insert into public.user_entitlements (user_id, plan, license_key) values (w, 'pro', 'FNOS-TST3-TST3-TST3');
  select license_key into k from public.user_entitlements where user_id = w;
  assert k = 'FNOS-TST3-TST3-TST3', 'con blob viejo se conserva: ' || k;
  assert public.fnos_caller_owns_license(h3) is not null;
  -- ...hasta que sube el primer blob con frase de paso.
  update public.synced_data set blob = 'fnos2:{"v":2}' where key_hash = h3;
  select license_key into k from public.user_entitlements where user_id = w;
  assert k = h3, 'tras v2 queda el hash: ' || k;
  -- Volver a v1 (rollback) no vuelve a poner la clave en claro.
  update public.synced_data set blob = 'AAAAbase64viejo' where key_hash = h3;
  select license_key into k from public.user_entitlements where user_id = w;
  assert k = h3, 'rollback no restaura la clave: ' || k;

  -- Tope de comentarios: 5 por día.
  for i in 1..5 loop
    r := public.feedback_claim(x);
    assert r->>'ok' = 'true', 'feedback ' || i;
  end loop;
  r := public.feedback_claim(x);
  assert r->>'error' = 'rate_limited', 'sexto: ' || r::text;

  assert not has_function_privilege('authenticated', 'public.attach_license_to_account(uuid,text)', 'execute');
  assert not has_function_privilege('anon', 'public.feedback_claim(uuid,int)', 'execute');
  assert not has_table_privilege('authenticated', 'public.feedback_sends', 'select');
  raise notice 'OK: pro_on_account_and_hashed_keys';
end $$;
rollback;
