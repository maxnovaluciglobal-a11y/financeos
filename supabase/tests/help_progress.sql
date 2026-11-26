-- (auth.uid() de la imagen de prueba lee request.jwt.claim.sub; producción, también
-- request.jwt.claims: se fijan los dos.)
-- Prueba de help_progress y merge_help_progress (20261126010000). SOLO en la base
-- local del job `db` (scripts/test-db). Todo dentro de una transacción que se revierte.
begin;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  r jsonb; n int; ok boolean;
begin
  insert into auth.users (id, email, instance_id, aud, role) values
    (a,'ana-help@t.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
    (b,'beto-help@t.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated');

  -- A guarda desde un dispositivo y después desde otro: se suma, no se pisa.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', a::text, true);
  set local role authenticated;
  r := public.merge_help_progress(array['dashboard','budgets'], array['n2611help']);
  assert r->'tours_seen' = '["budgets","dashboard"]'::jsonb, 'primer guardado: ' || r::text;
  r := public.merge_help_progress(array['goals','dashboard'], array['n2411home']);
  assert r->'tours_seen' = '["budgets","dashboard","goals"]'::jsonb, 'unión de recorridos: ' || r::text;
  assert r->'news_read' = '["n2411home","n2611help"]'::jsonb, 'unión de novedades: ' || r::text;

  -- Ids con otro formato se descartan (no rompen el guardado).
  r := public.merge_help_progress(array['Bad Id','<x>','', 'reports'], null);
  assert r->'tours_seen' = '["budgets","dashboard","goals","reports"]'::jsonb, 'ids inválidos fuera: ' || r::text;

  -- Escribir directo con basura choca con los checks.
  ok := false;
  begin
    update public.help_progress set tours_seen = array['NO VALE'] where user_id = a;
  exception when check_violation then ok := true;
  end;
  assert ok, 'check de formato';

  -- A no puede escribir la fila de otra cuenta.
  ok := false;
  begin
    insert into public.help_progress (user_id, tours_seen) values (b, array['dashboard']);
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'insert con user_id ajeno rechazado por RLS';

  -- A no puede borrar (sin grant de delete).
  ok := false;
  begin
    delete from public.help_progress where user_id = a;
  exception when insufficient_privilege then ok := true;
  end;
  assert ok, 'authenticated sin delete';
  reset role;

  -- B no ve la fila de A.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', b::text, true);
  set local role authenticated;
  select count(*) into n from public.help_progress;
  assert n = 0, 'B ve filas ajenas: ' || n;
  update public.help_progress set news_read = '{}' where user_id = a;
  get diagnostics n = row_count;
  assert n = 0, 'B actualizó la fila de A';
  reset role;

  -- anon no lee ni llama.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  set local role anon;
  ok := false;
  begin perform 1 from public.help_progress; exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon lee help_progress';
  ok := false;
  begin perform public.merge_help_progress(array['dashboard'], null); exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon llama merge_help_progress';
  reset role;

  -- Sin sesión (auth.uid() nulo) la función se niega.
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  perform set_config('request.jwt.claim.sub', '', true);
  set local role authenticated;
  ok := false;
  begin perform public.merge_help_progress(array['dashboard'], null); exception when insufficient_privilege then ok := true; end;
  assert ok, 'sin uid';
  reset role;

  -- Borrar la cuenta borra su progreso (cascade).
  delete from auth.users where id = a;
  select count(*) into n from public.help_progress where user_id = a;
  assert n = 0, 'progreso de A tras borrar la cuenta';
end $$;
rollback;
