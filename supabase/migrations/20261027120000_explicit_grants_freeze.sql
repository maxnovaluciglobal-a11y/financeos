-- Explicit GRANT freeze (TR-03). ADDITIVE ONLY: grants, no revoke / drop / alter.
--
-- Why: from 2026-10-30 Supabase stops giving new `public` tables the automatic
-- select/insert/update/delete for anon, authenticated AND service_role. Tables that
-- already exist keep what they have, so production is unaffected by this file (it
-- restates privileges the catalog already shows, checked read-only on 2026-10-28 with
-- supabase/tests/acl_catalog.sql). Its value is for any database built from the
-- migrations after that date (a restore into a new project, the CI database): without
-- these lines those objects would be born unreachable.
--
-- Rules followed:
--   * Flat statements (no loops) so supabase/tests/grants-explicitos.test.js can read them.
--   * Least privilege for anon / authenticated: what each RLS policy needs, nothing more.
--     (Privileges production has on top of this are reported by scripts/aclCheck.mjs as
--     "sobrantes" and are NOT removed here: removing is a separate, approved migration.)
--   * Every grant to anon carries `-- anon-ok: <reason>`.
--   * Idempotent: GRANT of an existing privilege is a no-op.
-- Matrix of expected privileges: supabase/tests/acl-esperada.json.

-- ── 1. service_role on the tables that only had it through the platform default ───
-- (Edge Functions and SECURITY DEFINER callers run as service_role.)
grant select, insert, update, delete on table
  public.licenses, public.synced_data, public.push_subscriptions, public.trial_emails,
  public.webhook_events, public.profiles, public.consents, public.user_entitlements,
  public.crm_contacts, public.cloud_backups, public.portfolio_holdings, public.watchlist,
  public.invest_activity_days, public.starter_leads, public.diagnostico_leads,
  public.invest_leads, public.demo_leads, public.tax_calculator_leads,
  public.cancellation_requests, public.crm_activities
  to service_role;

-- ── 2. authenticated on user-owned tables: exactly what the RLS policies use ─────
-- profiles: "view own" (select). UPDATE stays column-level (20261018030000 / invest-web).
grant select on table public.profiles to authenticated;
-- consents: insert + read own; there is no update policy.
grant select, insert on table public.consents to authenticated;
-- user_entitlements: four own-row policies.
grant select, insert, update, delete on table public.user_entitlements to authenticated;
-- crm_contacts (admin ALL policy) and cloud_backups (own ALL policy, feature off).
grant select, insert, update, delete on table public.crm_contacts to authenticated;
grant select, insert, update, delete on table public.cloud_backups to authenticated;
-- portfolio_holdings / watchlist: select, insert, delete; UPDATE stays column-level.
grant select, insert, delete on table public.portfolio_holdings to authenticated;
grant select, insert, delete on table public.watchlist to authenticated;
-- invest_activity_days: one insert per account per day (policy insert_own).
grant insert on table public.invest_activity_days to authenticated;

-- ── 3. sequences used by inserts ────────────────────────────────────────────────
grant usage, select on sequence public.trial_emails_id_seq to service_role;
grant usage, select on sequence public.portfolio_holdings_id_seq to authenticated, service_role;
grant usage, select on sequence public.watchlist_id_seq to authenticated, service_role;

-- ── 4. functions: explicit EXECUTE where it was implicit or only in the legacy root .sql
-- Browser-callable RPCs (the app calls them with the public anon key).
-- anon-ok: validate_license is the license check the browser runs before sign-in
grant execute on function public.validate_license(text) to anon, authenticated, service_role;
-- anon-ok: set_license_email is called by the browser right after validation
grant execute on function public.set_license_email(text, text) to anon, authenticated, service_role;
-- anon-ok: notify_invest_signup is called from the Invest sign-up form
grant execute on function public.notify_invest_signup(text) to anon, authenticated, service_role;
-- anon-ok: unsubscribe links in emails open without a session
grant execute on function public.unsubscribe_demo_lead(uuid) to anon, authenticated, service_role;
-- anon-ok: unsubscribe links in emails open without a session
grant execute on function public.unsubscribe_diagnostico_lead(uuid) to anon, authenticated, service_role;
-- anon-ok: unsubscribe links in emails open without a session
grant execute on function public.unsubscribe_invest_lead(uuid) to anon, authenticated, service_role;
-- anon-ok: unsubscribe links in emails open without a session
grant execute on function public.unsubscribe_starter_lead(uuid) to anon, authenticated, service_role;

-- Signed-in callers (CRM admin RPCs gate on the caller inside the function).
grant execute on function public.crm_add_activity(uuid, text, text) to authenticated, service_role;
grant execute on function public.crm_followup_check(uuid, timestamptz) to authenticated, service_role;
grant execute on function public.crm_set_estado(uuid, text) to authenticated, service_role;
grant execute on function public.crm_set_next_action(uuid, text, date) to authenticated, service_role;

-- Server-only helpers (Edge Functions / definers).
grant execute on function public.crm_is_admin_caller() to service_role;
grant execute on function public.crm_refresh_contact(text) to service_role;
grant execute on function public.crm_refresh_contact_safe(text) to service_role;
grant execute on function public.fnos_caller_owns_license(text) to service_role;
grant execute on function public.fnos_has_legacy_sync_blob(text) to service_role;
grant execute on function public.fnos_license_id(text) to service_role;
grant execute on function public.fnos_license_key_id(text) to service_role;
grant execute on function public.fnos_license_upgrade(text) to service_role;

-- Functions defined outside this folder (legacy root .sql files / invest-web): guarded so the
-- file also runs on a database that lacks them. The GRANT text is kept literal for the test.
do $$
begin
  if to_regprocedure('public.revoke_license(text)') is not null then
    grant execute on function public.revoke_license(text) to service_role;
  end if;
  if to_regprocedure('public.fnos_resolve_hash(text)') is not null then
    -- anon-ok: fnos_resolve_hash is the helper the legacy license RPCs call, production already grants it
    grant execute on function public.fnos_resolve_hash(text) to anon, authenticated, service_role;
  end if;
  if to_regprocedure('public.invest_record_activity()') is not null then
    grant execute on function public.invest_record_activity() to authenticated, service_role;
  end if;
end
$$;
