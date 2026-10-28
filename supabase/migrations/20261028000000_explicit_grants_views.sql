-- Explicit GRANT for two views (found by replaying the migrations on an empty database that
-- simulates Supabase from 2026-10-30, see scripts/test-db/). ADDITIVE ONLY.
-- Production already has these privileges (checked with supabase/tests/acl_catalog.sql on
-- 2026-10-28): this file only writes them down so a rebuilt database has them too.

-- crm_funnel: read by the CRM admin screen (authenticated, gated by RLS on crm_contacts) and by Edge Functions.
grant select on table public.crm_funnel to authenticated, service_role;
-- invest_weekly_active: read by the weekly funnel report (invest-web also grants it in its own migration).
grant select on table public.invest_weekly_active to service_role;
