-- Four functions that production has but no migration created: they only lived in the
-- legacy root files (supabase-e2e-hardening.sql, supabase-push.sql, supabase-license-revoke.sql)
-- or in invest-web. Without them the migrations cannot be replayed on an empty database
-- (CI, a restore into a new project): later files call them.
--
-- The bodies below are production's, read with pg_get_functiondef on 2026-10-28 (not copied
-- from the root files, which had gone stale). In production this file is only REGISTERED
-- (supabase migration repair --status applied 20260101000000), never executed: the
-- functions already exist there. It is also idempotent (create or replace).
--
-- Dated before every other migration so a replay creates them first. Privileges are set
-- later by 20261018030000 / 20261027120000; the revoke below only closes the default
-- PUBLIC execute that Postgres gives a new function.

create or replace function public.fnos_resolve_hash(p_input text)
 returns text
 language sql
 immutable
 set search_path to 'public', 'extensions'
as $function$
  select case
    when p_input ~ '^[0-9a-f]{64}$' then lower(p_input)
    else encode(digest(upper(trim(coalesce(p_input, ''))), 'sha256'), 'hex')
  end
$function$;

create or replace function public.delete_push_subscription(p_endpoint text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
begin
  delete from public.push_subscriptions where endpoint = p_endpoint;
  return jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.invest_record_activity()
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if (select auth.uid()) is null then
    return;
  end if;
  insert into public.invest_activity_days (user_id)
  values ((select auth.uid()))
  on conflict (user_id, day) do nothing;
end;
$function$;

create or replace function public.revoke_license(p_payment_intent text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare v_count int;
begin
  if p_payment_intent is null then
    return jsonb_build_object('ok', false, 'error', 'bad_args');
  end if;
  update public.licenses
     set status = 'revoked'
   where payment_intent_id = p_payment_intent
     and status = 'active';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    return jsonb_build_object('ok', false, 'error', 'not_found_or_already_revoked');
  end if;
  return jsonb_build_object('ok', true, 'revoked', v_count);
end;
$function$;

revoke all on function public.fnos_resolve_hash(text) from public;
revoke all on function public.delete_push_subscription(text) from public;
revoke all on function public.invest_record_activity() from public;
revoke all on function public.revoke_license(text) from public;
