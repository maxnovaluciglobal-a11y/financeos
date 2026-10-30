-- Replay drift: two legacy overloads that a rebuilt database (scripts/test-db/) ends up with
-- in a different state than production. NO-OP ON PRODUCTION: checked on 2026-10-30 with
--   select p.oid::regprocedure, p.proacl from pg_proc p
--   where p.proname in ('issue_license','register_diagnostico_lead');
-- production has issue_license(text,text,text,text,text) with {postgres=X,service_role=X} and
-- no register_diagnostico_lead(text,integer,text).
--
-- 1. register_diagnostico_lead(text, integer, text): created by 20260912150000 with EXECUTE for
--    anon. Later migrations only added overloads with more arguments and dropped the 4- and
--    5-argument ones, never this one. Production dropped it by hand; a replay kept it, callable
--    by anon and without the rate limit of the current 6-argument version (20261019190000).
drop function if exists public.register_diagnostico_lead(text, integer, text);

-- 2. issue_license(text, text, text, text, text): it still EXISTS in production (service_role
--    only; locked by 20261008000500 and re-created in place by 20261020090000, which keeps the
--    ACL). On an empty database it is born in 20261020090000, so it gets the default PUBLIC
--    EXECUTE: anon could mint a Pro license. Dropping it would change production, so this only
--    sets the production ACL. stripe-webhook always sends p_subscription, so PostgREST resolves
--    to the 7-argument version and never calls this one.
do $$
begin
  if to_regprocedure('public.issue_license(text, text, text, text, text)') is not null then
    revoke all on function public.issue_license(text, text, text, text, text) from public, anon, authenticated;
    grant execute on function public.issue_license(text, text, text, text, text) to service_role;
  end if;
end $$;
