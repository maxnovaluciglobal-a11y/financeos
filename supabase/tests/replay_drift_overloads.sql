-- Prueba de la migración 20261030120000 (drift del replay). Base LOCAL, nunca producción.
-- Después de reproducir las migraciones, los overloads viejos quedan como en producción.
begin;
do $$
begin
  assert to_regprocedure('public.register_diagnostico_lead(text, integer, text)') is null,
    'register_diagnostico_lead de 3 argumentos sigue existiendo';
  assert to_regprocedure('public.register_diagnostico_lead(text, integer, text, boolean, text, text)') is not null,
    'falta la versión vigente de register_diagnostico_lead';
  assert to_regprocedure('public.issue_license(text, text, text, text, text)') is not null,
    'issue_license de 5 argumentos existe en producción: no hay que borrarlo';
  assert not has_function_privilege('anon', 'public.issue_license(text, text, text, text, text)', 'execute'),
    'anon puede ejecutar issue_license de 5 argumentos';
  assert not has_function_privilege('authenticated', 'public.issue_license(text, text, text, text, text)', 'execute'),
    'authenticated puede ejecutar issue_license de 5 argumentos';
  assert has_function_privilege('service_role', 'public.issue_license(text, text, text, text, text)', 'execute');
  raise notice 'OK: replay_drift_overloads';
end $$;
rollback;
