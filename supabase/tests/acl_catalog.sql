-- ACL catalog snapshot (read-only). Returns ONE json document describing, for every
-- table / sequence / function in `public` and `private`, what anon, authenticated and
-- service_role can do, plus RLS flags and the default privileges of the owner role.
-- It never reads user rows: only pg_catalog.
--
-- Local / CI:   psql -X -A -t -f supabase/tests/acl_catalog.sql > acl.json
-- Production:   supabase db query --linked --project-ref nelwgbcddwiaimzbcuas \
--                 --workdir "$(mktemp -d)" -o json -f supabase/tests/acl_catalog.sql
-- Compare with: node scripts/aclCheck.mjs --catalog acl.json --matrix supabase/tests/acl-esperada.json
--
-- Privilege letters follow Postgres: a=insert r=select w=update d=delete D=truncate
-- x=references t=trigger, U=usage (sequences), X=execute (functions).
select jsonb_build_object(
  'tables', coalesce((
    select jsonb_object_agg(n.nspname || '.' || c.relname, jsonb_build_object(
      'kind', c.relkind,
      'rls', c.relrowsecurity,
      'force_rls', c.relforcerowsecurity,
      'anon', priv.anon, 'authenticated', priv.authenticated, 'service_role', priv.service_role))
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral (
      select
        (select string_agg(p.l, '' order by p.l) from (values ('a','INSERT'),('r','SELECT'),('w','UPDATE'),('d','DELETE'),('D','TRUNCATE'),('x','REFERENCES'),('t','TRIGGER')) p(l, k) where has_table_privilege('anon', c.oid, p.k)) as anon,
        (select string_agg(p.l, '' order by p.l) from (values ('a','INSERT'),('r','SELECT'),('w','UPDATE'),('d','DELETE'),('D','TRUNCATE'),('x','REFERENCES'),('t','TRIGGER')) p(l, k) where has_table_privilege('authenticated', c.oid, p.k)) as authenticated,
        (select string_agg(p.l, '' order by p.l) from (values ('a','INSERT'),('r','SELECT'),('w','UPDATE'),('d','DELETE'),('D','TRUNCATE'),('x','REFERENCES'),('t','TRIGGER')) p(l, k) where has_table_privilege('service_role', c.oid, p.k)) as service_role
    ) priv
    where n.nspname in ('public', 'private') and c.relkind in ('r', 'p', 'v', 'm')
  ), '{}'::jsonb),
  'sequences', coalesce((
    select jsonb_object_agg(n.nspname || '.' || c.relname, jsonb_build_object(
      'anon', (select string_agg(p.l, '' order by p.l) from (values ('U','USAGE'),('r','SELECT'),('w','UPDATE')) p(l, k) where has_sequence_privilege('anon', c.oid, p.k)),
      'authenticated', (select string_agg(p.l, '' order by p.l) from (values ('U','USAGE'),('r','SELECT'),('w','UPDATE')) p(l, k) where has_sequence_privilege('authenticated', c.oid, p.k)),
      'service_role', (select string_agg(p.l, '' order by p.l) from (values ('U','USAGE'),('r','SELECT'),('w','UPDATE')) p(l, k) where has_sequence_privilege('service_role', c.oid, p.k))))
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private') and c.relkind = 'S'
  ), '{}'::jsonb),
  'functions', coalesce((
    select jsonb_object_agg(n.nspname || '.' || p.proname || '(' || oidvectortypes(p.proargtypes) || ')', jsonb_build_object(
      'definer', p.prosecdef,
      'trigger', (p.prorettype = 'pg_catalog.trigger'::regtype),
      'public_execute', has_function_privilege(0, p.oid, 'EXECUTE'),
      'anon', case when has_function_privilege('anon', p.oid, 'EXECUTE') then 'X' else '' end,
      'authenticated', case when has_function_privilege('authenticated', p.oid, 'EXECUTE') then 'X' else '' end,
      'service_role', case when has_function_privilege('service_role', p.oid, 'EXECUTE') then 'X' else '' end))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prokind in ('f', 'p')
      -- skip functions that belong to an extension (pgcrypto, pg_net, ...)
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  ), '{}'::jsonb),
  'default_acls', coalesce((
    select jsonb_agg(jsonb_build_object(
      'owner', pg_get_userbyid(d.defaclrole),
      'schema', coalesce(n.nspname, '*'),
      'object', d.defaclobjtype::text,
      'acl', d.defaclacl::text))
    from pg_default_acl d left join pg_namespace n on n.oid = d.defaclnamespace
    where n.nspname is null or n.nspname in ('public', 'private')
  ), '[]'::jsonb)
) as acl;
