-- Auditoría 360 (19-oct-2026): C-22 (SEG-5, META-5). Aditiva e idempotente.
--
-- Borrado de cuenta por autoservicio. La Edge Function delete-account verifica
-- la sesión contra Auth, llama a delete_account_data con el id y el email de
-- esa sesión (nunca los que mande el cliente) y después borra auth.users con
-- la API de administración. Esta función borra, en una sola transacción, todo
-- lo que el servidor guarda de la cuenta en las dos apps (MOY IQ e Invest
-- comparten la cuenta):
--   - por user_id: user_entitlements, profiles, consents, cloud_backups,
--     trial_emails, report_email_sends, portfolio_holdings, watchlist,
--     invest_activity_days;
--   - por licencia (hash): licenses, synced_data (el sync cifrado),
--     push_subscriptions, report_email_sends, subscription_expiry_pending.
--     Una licencia con el mismo email pero asociada a OTRA cuenta no se toca;
--   - por email: starter_leads, diagnostico_leads, demo_leads, invest_leads,
--     newsletter_signups, tax_calculator_leads, crm_contacts.
-- Queda solo lo que la política de privacidad dice que se conserva:
-- cancellation_requests (3 años, para probar la baja) y los comprobantes de
-- pago en Stripe. La constancia del borrado (account_deletions) no guarda el
-- email, el id de la cuenta ni la licencia: solo la fecha y cuántas filas se
-- borraron por tabla.
-- Devuelve los ids de suscripción de Stripe que seguían activos, para que la
-- función avise a soporte y se cancelen (el proyecto no tiene hoy una clave de
-- Stripe de MOY IQ para hacerlo solo) y si había alguna dirección sincronizada
-- con el newsletter (el contacto de Resend vive en el proxy).

create table if not exists public.account_deletions (
  id                       bigserial primary key,
  deleted_at               timestamptz not null default now(),
  rows_deleted             jsonb not null default '{}'::jsonb,
  stripe_followup          boolean not null default false,
  newsletter_followup      boolean not null default false
);
comment on table public.account_deletions is
  'C-22: constancia de cada borrado de cuenta por autoservicio. Sin email, id de cuenta ni licencia.';
alter table public.account_deletions enable row level security;
revoke all on table public.account_deletions from public, anon, authenticated;
grant select, insert on table public.account_deletions to service_role;
revoke all on sequence public.account_deletions_id_seq from public, anon, authenticated;
grant usage on sequence public.account_deletions_id_seq to service_role;

create or replace function public.delete_account_data(p_user_id uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_email   text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_hashes  text[];
  v_subs    text[];
  v_news    boolean;
  v_counts  jsonb := '{}'::jsonb;
  v_n       int;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'bad_args');
  end if;

  perform pg_advisory_xact_lock(hashtext('delete_account:' || p_user_id::text));

  select coalesce(array_agg(distinct h), '{}') into v_hashes from (
    select public.fnos_resolve_hash(e.license_key) h
      from public.user_entitlements e
     where e.user_id = p_user_id and e.license_key is not null
    union
    select l.key_hash
      from public.licenses l
     where v_email is not null
       and lower(l.email) = v_email
       and not exists (
         select 1 from public.user_entitlements o
          where o.user_id <> p_user_id
            and o.license_key is not null
            and public.fnos_resolve_hash(o.license_key) = l.key_hash)
  ) s where h is not null;

  select coalesce(array_agg(distinct l.stripe_subscription_id), '{}') into v_subs
    from public.licenses l
   where l.key_hash = any(v_hashes)
     and l.stripe_subscription_id is not null
     and l.status = 'active'
     and (l.expires_at is null or l.expires_at > now());

  v_news := v_email is not null and (
       exists (select 1 from public.starter_leads     where lower(email) = v_email and newsletter_synced_at is not null)
    or exists (select 1 from public.diagnostico_leads where lower(email) = v_email and newsletter_synced_at is not null)
    or exists (select 1 from public.demo_leads        where lower(email) = v_email and newsletter_synced_at is not null)
    or exists (select 1 from public.invest_leads      where lower(email) = v_email and newsletter_synced_at is not null)
    or exists (select 1 from public.newsletter_signups where lower(email) = v_email and newsletter_synced_at is not null));

  delete from public.synced_data where key_hash = any(v_hashes);
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('synced_data', v_n);
  delete from public.push_subscriptions where key_hash = any(v_hashes);
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('push_subscriptions', v_n);
  delete from public.report_email_sends where user_id = p_user_id or key_hash = any(v_hashes);
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('report_email_sends', v_n);
  delete from public.subscription_expiry_pending where stripe_subscription_id in (
    select l.stripe_subscription_id from public.licenses l
     where l.key_hash = any(v_hashes) and l.stripe_subscription_id is not null);
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('subscription_expiry_pending', v_n);

  delete from public.user_entitlements where user_id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('user_entitlements', v_n);
  delete from public.licenses where key_hash = any(v_hashes);
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('licenses', v_n);

  delete from public.trial_emails where user_id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('trial_emails', v_n);
  delete from public.consents where user_id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('consents', v_n);
  delete from public.cloud_backups where user_id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('cloud_backups', v_n);
  delete from public.portfolio_holdings where user_id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('portfolio_holdings', v_n);
  delete from public.watchlist where user_id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('watchlist', v_n);
  delete from public.invest_activity_days where user_id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('invest_activity_days', v_n);
  delete from public.profiles where id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('profiles', v_n);

  if v_email is not null then
    delete from public.starter_leads where lower(email) = v_email;
    get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('starter_leads', v_n);
    delete from public.diagnostico_leads where lower(email) = v_email;
    get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('diagnostico_leads', v_n);
    delete from public.demo_leads where lower(email) = v_email;
    get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('demo_leads', v_n);
    delete from public.invest_leads where lower(email) = v_email;
    get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('invest_leads', v_n);
    delete from public.newsletter_signups where lower(email) = v_email;
    get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('newsletter_signups', v_n);
    delete from public.tax_calculator_leads where lower(email) = v_email;
    get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('tax_calculator_leads', v_n);
    delete from public.crm_contacts where lower(email) = v_email;
    get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('crm_contacts', v_n);
  end if;

  insert into public.account_deletions (rows_deleted, stripe_followup, newsletter_followup)
  values (v_counts, cardinality(v_subs) > 0, coalesce(v_news, false));

  return jsonb_build_object(
    'ok', true,
    'rows_deleted', v_counts,
    'stripe_subscriptions', to_jsonb(v_subs),
    'newsletter_followup', coalesce(v_news, false));
end;
$function$;

revoke all on function public.delete_account_data(uuid, text) from public, anon, authenticated;
grant execute on function public.delete_account_data(uuid, text) to service_role;
