-- Prueba de la migración 20261020030000 (C-35 / COM-10). Base LOCAL con el
-- esquema de producción, nunca producción: psql -v ON_ERROR_STOP=1 -f
begin;
do $$
declare
  h text := encode(digest('FNOS-TRL1-TRL1-TRL1','sha256'),'hex');
  h2 text := encode(digest('FNOS-TRL2-TRL2-TRL2','sha256'),'hex');
  r jsonb; v_id uuid; n int;
begin
  insert into public.licenses (key_hash, plan, status, email) values (h, 'pro', 'active', 'trial@t.local'), (h2, 'pro', 'active', 'trial2@t.local');

  r := public.mark_license_trial('FNOS-TRL1-TRL1-TRL1', now() + interval '14 days', 'Trial@T.local ', 'pt');
  assert r->>'ok' = 'true', 'marca: ' || r::text;
  v_id := (r->>'id')::uuid;
  assert (select is_trial and trial_ends_at is not null from public.licenses where key_hash = h), 'licencia marcada como prueba';
  assert (select email = 'trial@t.local' and lang = 'pt' from public.trial_activation_emails where id = v_id), 'fila de la secuencia';
  -- Reintento de Stripe: no duplica.
  r := public.mark_license_trial('FNOS-TRL1-TRL1-TRL1', now() + interval '14 days', 'trial@t.local', 'pt');
  assert (select count(*) from public.trial_activation_emails where key_hash = h) = 1, 'idempotente';
  r := public.mark_license_trial('FNOS-NOPE-NOPE-NOPE', now(), 'x@t.local');
  assert r->>'error' = 'license_not_found', 'licencia inexistente';

  -- Recién empezada: nada pendiente. A las 25 h aparece.
  select count(*) into n from public.trial_activation_due(now());
  assert n = 0, 'nada el día 0';
  select count(*) into n from public.trial_activation_due(now() + interval '25 hours');
  assert n = 1, 'pendiente el día 1';

  perform public.mark_trial_activation_sent(v_id, 'day1');
  assert (select day1_sent_at is not null from public.trial_activation_emails where id = v_id), 'marcado';

  -- Licencia revocada (canceló la prueba): ya no recibe nada.
  update public.licenses set status = 'revoked' where key_hash = h;
  select count(*) into n from public.trial_activation_due(now() + interval '4 days');
  assert n = 0, 'revocada no recibe';
  update public.licenses set status = 'active' where key_hash = h;
  -- Vencida: tampoco.
  select count(*) into n from public.trial_activation_due(now() + interval '15 days');
  assert n = 0, 'vencida no recibe';

  -- Baja con un clic, también para anon.
  set local role anon;
  r := public.unsubscribe_trial_activation(v_id);
  reset role;
  assert r->>'ok' = 'true', 'baja: ' || r::text;
  select count(*) into n from public.trial_activation_due(now() + interval '4 days');
  assert n = 0, 'dado de baja no recibe';

  -- Acceso: anon/authenticated no leen la tabla ni ejecutan las RPC internas.
  assert not has_table_privilege('anon', 'public.trial_activation_emails', 'select'), 'anon sin select';
  assert not has_table_privilege('authenticated', 'public.trial_activation_emails', 'select'), 'auth sin select';
  assert not has_function_privilege('anon', 'public.mark_license_trial(text,timestamptz,text,text)', 'execute'), 'anon sin mark';
  assert not has_function_privilege('authenticated', 'public.trial_activation_due(timestamptz)', 'execute'), 'auth sin due';
  assert not has_function_privilege('anon', 'public.mark_trial_activation_sent(uuid,text)', 'execute'), 'anon sin sent';

  -- Borrar la licencia (borrado de cuenta) borra la fila con el email.
  delete from public.licenses where key_hash = h;
  assert not exists (select 1 from public.trial_activation_emails where id = v_id), 'cascade';
  raise notice 'OK: trial_activation_emails';
end $$;
rollback;
