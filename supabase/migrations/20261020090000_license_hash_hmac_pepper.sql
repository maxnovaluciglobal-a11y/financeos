-- SEG-12 (auditoría 360): el hash guardado de la licencia deja de servir como
-- credencial. Antes, licenses.key_hash (y las tablas que cuelgan de él) guardaban
-- sha256(CLAVE), que es exactamente lo que la app manda como p_key: un volcado de
-- la base daba credenciales válidas. Ahora lo guardado es
--   HMAC-SHA256(sha256(CLAVE), pimienta)
-- con la pimienta en Supabase Vault (secreto 'license_hash_pepper', generado
-- dentro de la base, nunca impreso ni copiado). La app no cambia: sigue mandando
-- la clave o su sha256, y el servidor calcula el HMAC.
--
-- Compatible con lo anterior:
--   * fnos_resolve_hash() sigue igual (forma "cliente": sha256 o el hash de 64
--     hex tal cual). user_entitlements.license_key sigue en forma cliente (es la
--     credencial de la propia cuenta, solo visible para ella) y su índice único
--     no cambia.
--   * Hashes viejos: licenses.key_hash_v NULL = sha256 viejo; 2 = HMAC. La
--     migración convierte todo lo existente y fnos_license_key_id() re-hashea al
--     usar cualquier fila vieja que aparezca después (p. ej. un .sql viejo de la
--     raíz vuelto a correr), en licenses y report_email_sends; synced_data,
--     push_subscriptions y trial_activation_emails la siguen por su FK (on
--     update cascade).
--   * ⚠️ La pimienta no se rota ni se borra: sin ella ninguna licencia valida.
--
-- Idempotente: la pimienta se crea una sola vez y la conversión solo toca filas
-- con key_hash_v NULL. Aplicar con supabase db query --linked -f + migration repair.

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'license_hash_pepper') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'license_hash_pepper',
      'SEG-12: pimienta del HMAC de licencias. No rotar ni borrar: sin ella ninguna licencia valida.');
  end if;
end $$;

alter table public.licenses add column if not exists key_hash_v smallint;

-- Las tablas que cuelgan de licenses.key_hash siguen el cambio solas.
alter table public.synced_data drop constraint if exists synced_data_key_hash_fkey,
  add constraint synced_data_key_hash_fkey foreign key (key_hash)
  references public.licenses(key_hash) on delete cascade on update cascade;
alter table public.push_subscriptions drop constraint if exists push_subscriptions_key_hash_fkey,
  add constraint push_subscriptions_key_hash_fkey foreign key (key_hash)
  references public.licenses(key_hash) on delete cascade on update cascade;
alter table public.trial_activation_emails drop constraint if exists trial_activation_emails_key_hash_fkey,
  add constraint trial_activation_emails_key_hash_fkey foreign key (key_hash)
  references public.licenses(key_hash) on delete cascade on update cascade;
comment on column public.licenses.key_hash_v is
  'SEG-12: NULL = key_hash es sha256 viejo (se re-hashea al usar); 2 = HMAC con la pimienta de Vault.';

-- Identificador guardado (forma servidor) a partir de la clave o de su sha256.
create or replace function public.fnos_license_id(p_input text)
returns text
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
  select case when p_input is null then null else
    encode(extensions.hmac(public.fnos_resolve_hash(p_input),
      (select decrypted_secret from vault.decrypted_secrets where name = 'license_hash_pepper' limit 1),
      'sha256'), 'hex')
  end
$function$;
revoke all on function public.fnos_license_id(text) from public, anon, authenticated;

-- Pasa una licencia vieja (key_hash = sha256) y sus filas dependientes al HMAC.
create or replace function public.fnos_license_upgrade(p_sha text)
returns text
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_new text;
begin
  if p_sha is null or p_sha !~ '^[0-9a-f]{64}$' then return null; end if;
  v_new := public.fnos_license_id(p_sha);
  if v_new is null then return null; end if;
  update public.licenses set key_hash = v_new, key_hash_v = 2
   where key_hash = p_sha and key_hash_v is null;
  if not found then return null; end if;
  -- synced_data, push_subscriptions y trial_activation_emails: on update cascade.
  update public.report_email_sends set key_hash = v_new where key_hash = p_sha;
  return v_new;
end;
$function$;
revoke all on function public.fnos_license_upgrade(text) from public, anon, authenticated;

-- Entrada de las RPC: el id guardado de la clave, re-hasheando antes una fila
-- vieja si la hay ("aceptar hashes viejos y re-hashear al usar").
create or replace function public.fnos_license_key_id(p_input text)
returns text
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_new text := public.fnos_license_id(p_input);
begin
  if v_new is not null and not exists (select 1 from public.licenses where key_hash = v_new) then
    perform public.fnos_license_upgrade(public.fnos_resolve_hash(p_input));
  end if;
  return v_new;
end;
$function$;
revoke all on function public.fnos_license_key_id(text) from public, anon, authenticated;

-- Funciones que comparan contra key_hash: misma lógica, ahora con el id HMAC.
CREATE OR REPLACE FUNCTION public.attach_license_to_account(p_user_id uuid, p_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_hash text;
  v_cur_id text;
  v_cur  public.user_entitlements%rowtype;
begin
  if p_user_id is null or p_key is null or length(trim(p_key)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'bad_args');
  end if;
  v_hash := public.fnos_license_key_id(p_key);

  if not exists (select 1 from auth.users where id = p_user_id) then
    return jsonb_build_object('ok', false, 'error', 'no_account');
  end if;
  if not exists (select 1 from public.licenses
                  where key_hash = v_hash and status = 'active'
                    and (expires_at is null or expires_at > now())) then
    return jsonb_build_object('ok', false, 'error', 'invalid_license');
  end if;
  if exists (select 1 from public.user_entitlements
              where user_id <> p_user_id and license_key is not null
                and public.fnos_license_id(license_key) = v_hash) then
    return jsonb_build_object('ok', false, 'error', 'license_in_use');
  end if;

  select * into v_cur from public.user_entitlements where user_id = p_user_id;
  if found and v_cur.license_key is not null then
    v_cur_id := public.fnos_license_key_id(v_cur.license_key);
  end if;
  if v_cur.user_id is not null and v_cur.plan = 'pro' and v_cur.license_key is not null
     and v_cur_id <> v_hash
     and exists (select 1 from public.licenses l
                  where l.key_hash = v_cur_id
                    and l.status = 'active'
                    and (l.expires_at is null or l.expires_at > now())) then
    return jsonb_build_object('ok', false, 'error', 'already_pro');
  end if;

  insert into public.user_entitlements (user_id, plan, license_key, updated_at)
  values (p_user_id, 'pro', public.fnos_resolve_hash(p_key), now())
  on conflict (user_id) do update
    set plan = 'pro', license_key = excluded.license_key, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_account_data(p_user_id uuid, p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
  perform public.fnos_license_key_id(e.license_key)
     from public.user_entitlements e
    where e.user_id = p_user_id and e.license_key is not null;

  select coalesce(array_agg(distinct h), '{}') into v_hashes from (
    select public.fnos_license_id(e.license_key) h
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
            and l.key_hash in (public.fnos_license_id(o.license_key), public.fnos_resolve_hash(o.license_key)))
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
$function$
;

CREATE OR REPLACE FUNCTION public.fnos_caller_owns_license(p_hash text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select auth.uid() is not null and exists (
    select 1 from public.user_entitlements e
    where e.user_id = auth.uid()
      and e.license_key is not null
      and public.fnos_license_id(e.license_key) = p_hash
  )
$function$
;

CREATE OR REPLACE FUNCTION public.forget_license_key_after_v2_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  if new.blob like 'fnos2:%' then
    update public.user_entitlements e
       set license_key = public.fnos_resolve_hash(e.license_key)
     where e.license_key is not null
       and e.license_key !~ '^[0-9a-f]{64}$'
       and public.fnos_license_id(e.license_key) = new.key_hash;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.hash_entitlement_license_key()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_hash text;
begin
  if new.license_key is null or new.license_key ~ '^[0-9a-f]{64}$' then
    return new;
  end if;
  v_hash := public.fnos_license_key_id(new.license_key);
  if not public.fnos_has_legacy_sync_blob(v_hash) then
    new.license_key := public.fnos_resolve_hash(new.license_key);
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.issue_license(p_key text, p_plan text, p_email text DEFAULT NULL::text, p_session text DEFAULT NULL::text, p_payment_intent text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  insert into public.licenses (key_hash, key_hash_v, plan, email, stripe_session_id, payment_intent_id)
  values (public.fnos_license_id(p_key), 2,
          coalesce(p_plan,'personal'), p_email, p_session, p_payment_intent)
  on conflict (key_hash) do nothing;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.issue_license(p_key text, p_plan text, p_email text DEFAULT NULL::text, p_session text DEFAULT NULL::text, p_payment_intent text DEFAULT NULL::text, p_subscription text DEFAULT NULL::text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_pending timestamptz;
  v_expires timestamptz := p_expires_at;
begin
  if p_subscription is not null then
    delete from public.subscription_expiry_pending
     where stripe_subscription_id = p_subscription
    returning expires_at into v_pending;
    if v_pending is not null then
      v_expires := greatest(coalesce(v_expires, v_pending), v_pending);
    end if;
  end if;

  insert into public.licenses (key_hash, key_hash_v, plan, email, stripe_session_id, payment_intent_id, stripe_subscription_id, expires_at)
  values (public.fnos_license_id(p_key), 2,
          coalesce(p_plan, 'personal'), p_email, p_session, p_payment_intent, p_subscription, v_expires)
  on conflict (key_hash) do nothing;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.lock_entitlements_plan_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id text;
begin
  if new.license_key is not null and exists (
    select 1 from public.user_entitlements
    where license_key is not null
      and public.fnos_resolve_hash(license_key) = public.fnos_resolve_hash(new.license_key)
      and user_id <> new.user_id
  ) then
    raise exception 'license_in_use: esta licencia ya está asociada a otra cuenta'
      using errcode = 'P0001';
  end if;

  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.plan = 'pro' then
    v_id := public.fnos_license_key_id(new.license_key);
    if new.license_key is null or not exists (
      select 1 from public.licenses
      where key_hash = v_id
        and status = 'active'
        and (expires_at is null or expires_at > now())
    ) then
      raise exception 'user_entitlements.plan=pro requiere un license_key válido y activo';
    end if;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_license_trial(p_key text, p_trial_ends_at timestamp with time zone, p_email text, p_lang text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_hash text := public.fnos_license_key_id(p_key);
  v_id uuid;
begin
  if v_hash is null or p_trial_ends_at is null then return jsonb_build_object('ok', false, 'error', 'invalid_args'); end if;
  update public.licenses set is_trial = true, trial_ends_at = p_trial_ends_at where key_hash = v_hash;
  if not found then return jsonb_build_object('ok', false, 'error', 'license_not_found'); end if;
  if coalesce(trim(p_email), '') <> '' then
    insert into public.trial_activation_emails (key_hash, email, lang, trial_ends_at)
    values (v_hash, lower(trim(p_email)), nullif(p_lang, ''), p_trial_ends_at)
    on conflict (key_hash) do nothing
    returning id into v_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end; $function$
;

CREATE OR REPLACE FUNCTION public.report_email_claim(p_user_id uuid, p_key text, p_daily_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_hash  text;
  v_plan  text;
  v_count int;
  v_limit int := greatest(coalesce(p_daily_limit, 20), 1);
begin
  if p_user_id is null or p_key is null or length(trim(p_key)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'bad_args');
  end if;
  v_hash := public.fnos_license_key_id(p_key);

  select l.plan into v_plan
    from public.licenses l
   where l.key_hash = v_hash
     and l.status = 'active'
     and (l.expires_at is null or l.expires_at > now());
  if v_plan is null or v_plan not in ('pro', 'enterprise') then
    return jsonb_build_object('ok', false, 'error', 'license_required');
  end if;

  if not exists (
    select 1 from public.user_entitlements e
     where e.user_id = p_user_id
       and e.license_key is not null
       and public.fnos_license_id(e.license_key) = v_hash
  ) then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;

  perform pg_advisory_xact_lock(hashtext('report_email:' || v_hash));
  select count(*) into v_count
    from public.report_email_sends
   where key_hash = v_hash
     and sent_at > now() - interval '24 hours';
  if v_count >= v_limit then
    return jsonb_build_object('ok', false, 'error', 'daily_limit', 'limit', v_limit);
  end if;

  insert into public.report_email_sends (key_hash, user_id) values (v_hash, p_user_id);
  delete from public.report_email_sends where sent_at < now() - interval '30 days';

  return jsonb_build_object('ok', true, 'remaining', v_limit - v_count - 1);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_push_subscription(p_key text, p_endpoint text, p_p256dh text, p_auth text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_hash text;
begin
  if p_endpoint is null then return jsonb_build_object('ok', false, 'error', 'bad_args'); end if;
  v_hash := public.fnos_license_key_id(p_key);
  if not exists (select 1 from public.licenses where key_hash = v_hash and status = 'active') then
    return jsonb_build_object('ok', false, 'error', 'invalid_license');
  end if;
  if not public.fnos_caller_owns_license(v_hash) then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  insert into public.push_subscriptions (key_hash, endpoint, p256dh, auth, created_at)
  values (v_hash, p_endpoint, p_p256dh, p_auth, now())
  on conflict (endpoint) do update set key_hash = excluded.key_hash, p256dh = excluded.p256dh, auth = excluded.auth;
  return jsonb_build_object('ok', true);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_license_email(p_key text, p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_hash  text;
  v_email text;
  v_jwt_email text;
begin
  v_email := lower(btrim(p_email));
  if v_email is null or v_email = '' or length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false);
  end if;
  v_hash := public.fnos_license_key_id(p_key);
  v_jwt_email := lower(btrim((select auth.jwt()) ->> 'email'));

  if public.fnos_caller_owns_license(v_hash) and v_jwt_email is not null then
    update public.licenses set email = v_jwt_email where key_hash = v_hash and status = 'active';
    return jsonb_build_object('ok', found);
  end if;

  update public.licenses set email = v_email
   where key_hash = v_hash and status = 'active' and (email is null or btrim(email) = '');
  return jsonb_build_object('ok', found);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_pull(p_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_hash text; v_row public.synced_data%rowtype;
begin
  v_hash := public.fnos_license_key_id(p_key);
  if not exists (select 1 from public.licenses where key_hash = v_hash and status = 'active'
                and (expires_at is null or expires_at > now())) then
    return jsonb_build_object('ok', false, 'error', 'invalid_license');
  end if;
  if not public.fnos_caller_owns_license(v_hash) then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  select * into v_row from public.synced_data where key_hash = v_hash;
  if not found then return jsonb_build_object('ok', true, 'empty', true); end if;
  return jsonb_build_object('ok', true, 'blob', v_row.blob, 'updated_at', v_row.updated_at);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_push(p_key text, p_blob text, p_updated_at bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_hash text;
begin
  if p_key is null or p_blob is null then
    return jsonb_build_object('ok', false, 'error', 'bad_args');
  end if;
  v_hash := public.fnos_license_key_id(p_key);
  if not exists (select 1 from public.licenses where key_hash = v_hash and status = 'active'
                and (expires_at is null or expires_at > now())) then
    return jsonb_build_object('ok', false, 'error', 'invalid_license');
  end if;
  if not public.fnos_caller_owns_license(v_hash) then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  insert into public.synced_data (key_hash, blob, updated_at, saved_at)
  values (v_hash, p_blob, coalesce(p_updated_at, 0), now())
  on conflict (key_hash) do update
    set blob = excluded.blob, updated_at = excluded.updated_at, saved_at = now();
  return jsonb_build_object('ok', true);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_license(p_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_hash text; v_row public.licenses%rowtype;
begin
  if p_key is null or length(trim(p_key)) = 0 then
    return jsonb_build_object('valid', false);
  end if;
  v_hash := public.fnos_license_key_id(p_key);
  select * into v_row from public.licenses where key_hash = v_hash and status = 'active';
  if not found then
    return jsonb_build_object('valid', false);
  end if;
  if v_row.expires_at is not null and v_row.expires_at < now() then
    return jsonb_build_object('valid', false, 'expired', true);
  end if;
  return jsonb_build_object('valid', true, 'plan', v_row.plan,
    'expires_at', case when v_row.expires_at is null then null
                       else extract(epoch from v_row.expires_at) * 1000 end);
end;
$function$
;

-- Convertir lo existente (una sola vez por fila: key_hash_v NULL).
do $$
declare r record;
begin
  for r in select key_hash from public.licenses where key_hash_v is null loop
    perform public.fnos_license_upgrade(r.key_hash);
  end loop;
end $$;
