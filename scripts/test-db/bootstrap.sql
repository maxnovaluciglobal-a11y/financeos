-- Runs once on the empty Supabase image before the migrations (CI / local test database).
-- The image has the platform roles and extensions but not everything production has.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
-- Same definition Supabase ships; the image's older auth schema lacks it.
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;
grant execute on function auth.jwt() to anon, authenticated, service_role;

-- Simulate Supabase from 2026-10-30: new objects in `public` get NO automatic privileges for
-- anon, authenticated or service_role. A missing explicit GRANT then shows up as a "faltante".
alter default privileges for role postgres, supabase_admin in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres, supabase_admin in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres, supabase_admin in schema public revoke all on functions from anon, authenticated, service_role;
