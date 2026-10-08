-- HOTFIX: las RPC de licencias deben ser ejecutables SOLO por service_role.
--
-- 20260912010312_add_subscription_support.sql recreó issue_license (6 args) y
-- creó extend_license_expiry como SECURITY DEFINER sin revocar EXECUTE. En
-- Postgres una función nueva queda ejecutable por PUBLIC por defecto, y
-- Supabase además otorga EXECUTE a anon/authenticated en el schema public.
-- Como la anon key es pública (va en el bundle de la app), cualquiera podría
-- llamar /rest/v1/rpc/issue_license y crearse una licencia Pro permanente,
-- o extender el vencimiento de una suscripción ajena.
--
-- Idempotente y segura de aplicar antes o después de la migración de billing
-- (20261008000000_trial_subscription_billing.sql): solo toca las firmas que
-- existan.

do $$
declare
  sig text;
begin
  foreach sig in array array[
    'public.issue_license(text,text,text,text)',
    'public.issue_license(text,text,text,text,text)',
    'public.issue_license(text,text,text,text,text,text)',
    'public.issue_license(text,text,text,text,text,text,timestamptz)',
    'public.extend_license_expiry(text,timestamptz)',
    'public.revoke_license(text)',
    'public.revoke_license_by_subscription(text)'
  ]
  loop
    if to_regprocedure(sig) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', sig);
      execute format('grant execute on function %s to service_role', sig);
    end if;
  end loop;
end
$$;

-- Verificación (debe devolver false en las 3 columnas para cada fila):
-- select p.oid::regprocedure as fn,
--        has_function_privilege('anon', p.oid, 'execute')          as anon,
--        has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
--        has_function_privilege('public', p.oid, 'execute')        as public
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('issue_license','extend_license_expiry','revoke_license','revoke_license_by_subscription');
