-- Prueba de la migración 20261020090000 (SEG-12): el hash guardado deja de
-- servir como credencial. Base LOCAL con el esquema de producción, nunca
-- producción: psql -v ON_ERROR_STOP=1 -f. Todo se revierte.
begin;
do $$
declare
  k1 text := 'FNOS-HMC1-HMC1-HMC1';
  s1 text := encode(digest('FNOS-HMC1-HMC1-HMC1','sha256'),'hex');
  k2 text := 'FNOS-OLD2-OLD2-OLD2';
  s2 text := encode(digest('FNOS-OLD2-OLD2-OLD2','sha256'),'hex');
  stored text; r jsonb; n int; u uuid := gen_random_uuid();
begin
  assert exists (select 1 from vault.secrets where name = 'license_hash_pepper'), 'pimienta en Vault';

  -- Licencia nueva: se guarda el HMAC, no el sha256.
  perform public.issue_license(k1, 'pro', 'hmac@t.local', 'cs_hmac_1', null, null, null);
  select key_hash into stored from public.licenses where stripe_session_id = 'cs_hmac_1';
  assert stored <> s1 and stored = public.fnos_license_id(k1), 'guarda el HMAC';
  assert (select key_hash_v from public.licenses where key_hash = stored) = 2, 'marcada v2';
  -- La app sigue funcionando con la clave o con su sha256...
  assert (public.validate_license(k1)->>'valid')::boolean, 'valida con la clave';
  assert (public.validate_license(lower(k1) || ' ')->>'valid')::boolean, 'normaliza la clave';
  assert (public.validate_license(s1)->>'valid')::boolean, 'valida con el sha256 que guarda la app';
  -- ...pero lo guardado en la base ya no es una credencial.
  assert not (public.validate_license(stored)->>'valid')::boolean, 'el valor guardado no valida';

  -- Licencia vieja (sha256) con filas dependientes: se re-hashea al usarla.
  insert into public.licenses (key_hash, plan, status) values (s2, 'pro', 'active');
  insert into public.synced_data (key_hash, blob, updated_at) values (s2, 'fnos2:{}', 1);
  insert into auth.users (id, email, instance_id, aud, role) values (u,'old2@t.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
  insert into public.report_email_sends (key_hash, user_id) values (s2, u);
  r := public.validate_license(k2);
  assert (r->>'valid')::boolean, 'la licencia vieja sigue validando: ' || r::text;
  select count(*) into n from public.licenses where key_hash = s2; assert n = 0, 'ya no queda el sha256';
  assert (select key_hash_v from public.licenses where key_hash = public.fnos_license_id(k2)) = 2, 're-hasheada';
  select count(*) into n from public.synced_data where key_hash = public.fnos_license_id(k2); assert n = 1, 'sync sigue a la licencia';
  select count(*) into n from public.report_email_sends where key_hash = public.fnos_license_id(k2); assert n = 1, 'reportes siguen a la licencia';
  assert (public.validate_license(s2)->>'valid')::boolean, 'el sha256 de la app sigue valiendo';
  -- Idempotente.
  assert public.fnos_license_upgrade(s2) is null, 'no re-hashea dos veces';

  assert not has_function_privilege('anon', 'public.fnos_license_id(text)', 'execute');
  assert not has_function_privilege('authenticated', 'public.fnos_license_key_id(text)', 'execute');
  assert not has_function_privilege('authenticated', 'public.fnos_license_upgrade(text)', 'execute');
  raise notice 'OK: license_hash_hmac';
end $$;
rollback;
