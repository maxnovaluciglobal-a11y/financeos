-- Prueba de la migración 20261020080000 (PRD-5). Base LOCAL, nunca producción.
begin;
do $$
declare u uuid := gen_random_uuid(); r jsonb;
begin
  insert into auth.users (id, email, instance_id, aud, role) values (u,'nps@t.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
  r := public.nps_claim(u); assert r->>'ok' = 'true', 'primera: ' || r::text;
  r := public.nps_claim(u); assert r->>'error' = 'already_answered', 'segunda: ' || r::text;
  r := public.nps_claim(null); assert r->>'error' = 'bad_args';
  assert not exists (select 1 from information_schema.columns where table_name = 'nps_answers' and column_name not in ('user_id','answered_at')), 'sin puntaje ni texto';
  delete from auth.users where id = u;
  assert not exists (select 1 from public.nps_answers where user_id = u), 'cascada al borrar la cuenta';
  assert not has_function_privilege('authenticated', 'public.nps_claim(uuid)', 'execute');
  assert not has_table_privilege('anon', 'public.nps_answers', 'select');
  raise notice 'OK: nps_once';
end $$;
rollback;
