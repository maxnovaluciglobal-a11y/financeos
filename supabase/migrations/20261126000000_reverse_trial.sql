-- 20261126000000_reverse_trial.sql
-- Modelo A (decisión del 26-nov-2026, DECISIONES.md): 14 días de Pro al crear la
-- cuenta, SIN tarjeta, con vuelta a Starter sin perder datos.
--
-- Diseño: la prueba es una licencia Pro de verdad, emitida por el servidor y
-- atada a la cuenta, con vencimiento a los 14 días. Así todo lo que hoy exige
-- Pro en el servidor (validate_license, sync_push/sync_pull,
-- save_push_subscription, report_email_claim) funciona igual para la prueba sin
-- tocar esas funciones, y al vencer deja de funcionar solo (todas miran
-- expires_at). La clave en claro no existe: el servidor genera 32 bytes al azar
-- en forma "cliente" (64 hex, lo mismo que user_entitlements.license_key guarda
-- para las licencias pagas desde C-21) y licenses.key_hash guarda su HMAC
-- (fnos_license_id, SEG-12). La cuenta la lee de su propia fila de
-- user_entitlements, como cualquier licencia atada a la cuenta.
--
--   1. public.pro_trials: una fila por cuenta que usó la prueba (inicio, fin,
--      fin procesado, conversión a pago). La escriben solo funciones SECURITY
--      DEFINER; ni anon ni authenticated tienen privilegios sobre la tabla, así
--      que ningún campo de la prueba se puede escribir desde el cliente.
--  1b. public.pro_trial_tombstones (D1): una prueba por correo. Solo el HMAC del
--      correo normalizado (sin +etiqueta ni puntos en Gmail, sin +etiqueta en
--      Outlook/iCloud/Proton/Fastmail). Se escribe al empezar la prueba y en
--      delete_account_data, y no se borra con la cuenta.
--   2. fnos_pro_trial_eligible(uid): correo confirmado y cuenta no anónima (S1),
--      sin prueba previa, sin licencia asociada a la cuenta, sin ninguna licencia
--      (pagada, de pago único o prueba con tarjeta, de cualquier estado) con el
--      correo de la cuenta y sin HMAC de ese correo en pro_trial_tombstones.
--   3. start_pro_trial(): la llama la cuenta de la sesión (authenticated) cuando
--      acepta la hoja "Empieza 14 días de Pro gratis, sin tarjeta". Idempotente:
--      con la prueba en curso devuelve la misma; usada o no elegible, error.
--      El reloj empieza en ese momento (now() del servidor). Rechaza un JWT
--      anónimo (S1), bloquea la fila de user_entitlements antes de decidir y solo
--      escribe si la cuenta sigue sin licencia (S5), y crea la licencia sin correo
--      hasta tener la fila de pro_trials, para que el CRM no la tome como pago (S2).
--   4. pro_trial_status(): estado para la app (elegible, en curso, terminada) y,
--      si está en curso, la credencial de la cuenta. Si la prueba ya venció y no
--      se procesó, la procesa (ver 5).
--   5. fnos_end_pro_trial(uid) + job diario 'pro-trials-expire': al vencer (o si
--      la cuenta perdió la credencial), la cuenta vuelve a Starter en
--      user_entitlements (plan 'starter', sin clave) y se borran sus suscripciones
--      push (los avisos del navegador son Pro). Si la cuenta ya tiene otra
--      licencia, la prueba se da por convertida. Bloquea primero
--      user_entitlements y después pro_trials (S6). La copia cifrada del sync se
--      conserva 90 días (D2, job 'pro-trials-purge-sync'): si la persona compra
--      Pro antes, pasa a la licencia pagada.
--   6. validate_license: suma trial / trial_ends_at / no_card_trial (la app los
--      usa para los avisos de los días 10 y 13). Lo demás no cambia.
--   7. attach_license_to_account: una prueba sin tarjeta en curso ya no cuenta
--      como "already_pro"; comprar durante la prueba la reemplaza.
--   8. Trigger trg_carry_pro_trial_to_license (user_entitlements): cuando la
--      cuenta pasa de la licencia de prueba a otra licencia (compra atada a la
--      cuenta o clave pegada), la copia del sync y las suscripciones push pasan
--      a la licencia nueva (si ya tenía una copia, queda la más nueva; se vuelve
--      a aplicar el tope de 10 avisos), la prueba queda "convertida" y su
--      licencia vence ya.
--   9. save_push_subscription: también exige que la licencia no esté vencida
--      (antes solo miraba status; un vencido podía volver a registrar avisos).
--  10. report_email_claim: las licencias 'personal' (pago único, antes del
--      12-sep-2026) conservan todo Pro, también el envío del reporte por correo.
--  11. crm_refresh_contact: una prueba sin tarjeta no marca al contacto como
--      Pro/convertido.
--  12. Correos de la prueba (D3): pro_trial_emails (registro idempotente),
--      pro_trial_emails_due / _claim / _release y el job horario
--      'pro-trial-emails-hourly' que llama a la función send-pro-trial-email.
--  13. delete_account_data: también borra la licencia de prueba, su copia del
--      sync y las filas de la prueba (S4), y deja el HMAC del correo (D1).
--  14. funnel_report_metrics: 'pruebas' (con tarjeta) y 'pruebas_sin_tarjeta'.
--
-- Antes de aplicar: supabase/verify/2026-11-26-reverse-trial-preapply.sql (solo
-- lectura) para comparar con producción las funciones que se reemplazan.
--
-- Cuentas existentes: no se toca ninguna fila. Una cuenta Starter que nunca tuvo
-- prueba ni pagó queda elegible y ve la oferta la primera vez que entra con la
-- versión nueva de la app; nadie recibe Pro sin aceptarlo.
--
-- Aditiva e idempotente. Requiere 20261020090000 (fnos_license_id y pimienta),
-- 20261020030000 (licenses.is_trial / trial_ends_at) y 20261123000100.
-- Test: supabase/tests/reverse_trial.sql (job `db` del CI).

create extension if not exists pgcrypto with schema extensions;

-- ── 1. Pruebas usadas ───────────────────────────────────────────────────────
create table if not exists public.pro_trials (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  -- La licencia de prueba (forma servidor). Si la borra delete_account_data,
  -- queda null; on update cascade por fnos_license_upgrade.
  key_hash       text unique references public.licenses(key_hash) on update cascade on delete set null,
  started_at     timestamptz not null default now(),
  ends_at        timestamptz not null,
  ended_at       timestamptz,
  converted_at   timestamptz,
  -- D2: la copia cifrada del sync de una prueba que terminó sin compra se borra
  -- a los 90 días de ended_at (pro_trials_purge_sync).
  sync_purged_at timestamptz,
  created_at     timestamptz not null default now(),
  constraint pro_trials_window check (ends_at > started_at)
);
alter table public.pro_trials add column if not exists sync_purged_at timestamptz;
comment on table public.pro_trials is
  'Reverse trial (20261126000000): una fila por cuenta que usó los 14 días de Pro sin tarjeta. Solo la escriben funciones SECURITY DEFINER. Sin acceso para anon ni authenticated.';
create index if not exists pro_trials_due_idx on public.pro_trials (ends_at)
  where ended_at is null and converted_at is null;
alter table public.pro_trials enable row level security;
revoke all on table public.pro_trials from public, anon, authenticated;
grant select, insert, update, delete on table public.pro_trials to service_role;

-- ── 1b. Una prueba por correo (D1, decisión del 26-nov) ────────────────────
-- Solo un HMAC del correo normalizado, con la pimienta de Vault y un prefijo de
-- propósito (no sirve como credencial de licencia ni se puede revertir). Se
-- escribe al empezar la prueba y en delete_account_data, y NO se borra al
-- eliminar la cuenta: es el dato mínimo para que borrar la cuenta y volver a
-- registrarse no dé otra prueba. Está declarado en la Política de Privacidad.
create table if not exists public.pro_trial_tombstones (
  email_hmac text primary key,
  created_at timestamptz not null default now()
);
comment on table public.pro_trial_tombstones is
  'D1: HMAC del correo normalizado de quien ya usó la prueba de Pro (o tuvo Pro y borró su cuenta). Sin correo ni id de cuenta. No se borra con la cuenta. Solo service_role.';
alter table public.pro_trial_tombstones enable row level security;
revoke all on table public.pro_trial_tombstones from public, anon, authenticated;
grant select, insert, delete on table public.pro_trial_tombstones to service_role;

-- Normalización: minúsculas y sin espacios. Además, solo en proveedores donde
-- "+etiqueta" es por definición la misma casilla (Gmail, Outlook/Hotmail/Live,
-- iCloud, Proton, Fastmail) se quita la etiqueta, y en Gmail también los puntos
-- (Gmail los ignora y googlemail.com es el mismo dominio). Así el error posible
-- es solo negar la prueba a la misma casilla con otro alias; en el resto de los
-- dominios "+" puede ser parte real de la dirección y no se toca.
create or replace function public.fnos_trial_email_norm(p_email text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  with e as (select lower(btrim(coalesce(p_email, ''))) as v),
       p as (select split_part(v, '@', 1) as l, split_part(v, '@', 2) as d from e
              where v ~ '^[^@\s]+@[^@\s]+$')
  select case
           when d in ('gmail.com', 'googlemail.com')
             then coalesce(nullif(replace(split_part(l, '+', 1), '.', ''), ''), l) || '@gmail.com'
           when d in ('outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com',
                      'proton.me', 'protonmail.com', 'pm.me', 'fastmail.com')
             then coalesce(nullif(split_part(l, '+', 1), ''), l) || '@' || d
           else l || '@' || d
         end
    from p
$function$;
revoke all on function public.fnos_trial_email_norm(text) from public, anon, authenticated;
grant execute on function public.fnos_trial_email_norm(text) to service_role;

create or replace function public.fnos_trial_email_id(p_email text)
returns text
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
  select case when public.fnos_trial_email_norm(p_email) is null then null else
    encode(extensions.hmac('pro-trial-email:' || public.fnos_trial_email_norm(p_email),
      (select decrypted_secret from vault.decrypted_secrets where name = 'license_hash_pepper' limit 1),
      'sha256'), 'hex')
  end
$function$;
revoke all on function public.fnos_trial_email_id(text) from public, anon, authenticated;
grant execute on function public.fnos_trial_email_id(text) to service_role;

create or replace function public.fnos_trial_tombstone(p_email text)
returns void
language sql
volatile
security definer
set search_path to 'public', 'extensions'
as $function$
  insert into public.pro_trial_tombstones (email_hmac)
  select public.fnos_trial_email_id(p_email)
   where public.fnos_trial_email_id(p_email) is not null
  on conflict (email_hmac) do nothing
$function$;
revoke all on function public.fnos_trial_tombstone(text) from public, anon, authenticated;
grant execute on function public.fnos_trial_tombstone(text) to service_role;

-- ── 2. ¿Puede empezar la prueba? ───────────────────────────────────────────
create or replace function public.fnos_pro_trial_eligible(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
  select p_user_id is not null
     -- S1: cuenta con correo confirmado (las anónimas no tienen correo).
     and exists (select 1 from auth.users u where u.id = p_user_id
                    and u.email is not null and btrim(u.email) <> ''
                    and u.email_confirmed_at is not null
                    and coalesce(u.is_anonymous, false) = false)
     and not exists (select 1 from public.pro_trials t where t.user_id = p_user_id)
     -- Ya tiene (o tuvo) una licencia asociada a la cuenta: pagó o la pegó.
     and not exists (select 1 from public.user_entitlements e
                      where e.user_id = p_user_id and e.license_key is not null)
     -- Pagó, compró el plan de pago único o usó la prueba con tarjeta con ese
     -- correo, aunque sea desde otra cuenta o la licencia esté revocada.
     and not exists (select 1 from public.licenses l, auth.users u
                      where u.id = p_user_id
                        and l.email is not null
                        and lower(btrim(l.email)) = lower(btrim(u.email)))
     -- D1: ese correo (o un alias de la misma casilla) ya usó la prueba, también
     -- desde una cuenta que se borró.
     and not exists (select 1 from public.pro_trial_tombstones s, auth.users u
                      where u.id = p_user_id
                        and s.email_hmac = public.fnos_trial_email_id(u.email))
$function$;
comment on function public.fnos_pro_trial_eligible(uuid) is
  'Reverse trial: true si la cuenta tiene correo confirmado, nunca usó la prueba, no tiene licencia asociada, no hay licencia con su correo y su correo no está en pro_trial_tombstones. Interna.';
revoke all on function public.fnos_pro_trial_eligible(uuid) from public, anon, authenticated;
grant execute on function public.fnos_pro_trial_eligible(uuid) to service_role;

create or replace function public.fnos_epoch_ms(p_ts timestamptz)
returns bigint
language sql
immutable
set search_path to 'public'
as $function$
  select case when p_ts is null then null else (extract(epoch from p_ts) * 1000)::bigint end
$function$;
revoke all on function public.fnos_epoch_ms(timestamptz) from public, anon, authenticated;
grant execute on function public.fnos_epoch_ms(timestamptz) to service_role;

-- ── 5a. Pasar lo de la prueba a otra licencia ──────────────────────────────
-- Copia del sync: si la licencia nueva ya tiene una, queda la más nueva según
-- updated_at (la marca de cambio que pone el cliente, la misma regla de "gana
-- lo más nuevo" que usa el sync): el blob es una foto completa y cifrada, no se
-- puede mezclar en el servidor. Avisos push: pasan y se vuelve a aplicar el
-- tope de 10 por licencia de save_push_subscription.
create or replace function public.fnos_carry_trial_data(p_user_id uuid, p_old text, p_new text)
returns void
language plpgsql
volatile
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_o public.synced_data%rowtype; v_n public.synced_data%rowtype;
begin
  if p_old is not null and p_new is not null and p_old <> p_new
     and exists (select 1 from public.licenses where key_hash = p_new) then
    select * into v_o from public.synced_data where key_hash = p_old;
    if found then
      select * into v_n from public.synced_data where key_hash = p_new;
      if not found then
        update public.synced_data set key_hash = p_new where key_hash = p_old;
      else
        if coalesce(v_o.updated_at, 0) > coalesce(v_n.updated_at, 0) then
          update public.synced_data set blob = v_o.blob, updated_at = v_o.updated_at, saved_at = now()
           where key_hash = p_new;
        end if;
        delete from public.synced_data where key_hash = p_old;
      end if;
    end if;
    update public.push_subscriptions set key_hash = p_new where key_hash = p_old;
    delete from public.push_subscriptions
     where key_hash = p_new
       and id not in (select id from public.push_subscriptions where key_hash = p_new
                       order by created_at desc, id limit 10);
  end if;
  update public.pro_trials set converted_at = coalesce(converted_at, now()) where user_id = p_user_id;
  -- Un segundo antes: validate_license compara con "<" y now() es el de la transacción.
  update public.licenses
     set expires_at = least(coalesce(expires_at, now()), now() - interval '1 second'),
         trial_ends_at = least(coalesce(trial_ends_at, now()), now() - interval '1 second')
   where key_hash = p_old;
end;
$function$;
revoke all on function public.fnos_carry_trial_data(uuid, text, text) from public, anon, authenticated;
grant execute on function public.fnos_carry_trial_data(uuid, text, text) to service_role;

-- ── 5b. Fin de la prueba ───────────────────────────────────────────────────
-- Orden de bloqueo fijo (S6): primero la fila de user_entitlements, después la
-- de pro_trials, igual que start_pro_trial, para que dos llamadas no se
-- bloqueen en cruz. Cierra la prueba si:
--  · venció (ends_at), o
--  · está en curso pero la cuenta ya no tiene su credencial (borró el
--    entitlement o eligió Starter): la clave de prueba no se puede recuperar, así
--    que la prueba termina ahí; o
--  · la cuenta tiene otra licencia (pegó una clave o compró por un camino que no
--    pasó por el trigger): se cuenta como convertida y lo de la prueba pasa a esa.
create or replace function public.fnos_end_pro_trial(p_user_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_ent    public.user_entitlements%rowtype;
  v_t      public.pro_trials%rowtype;
  v_ent_id text;
begin
  select * into v_ent from public.user_entitlements where user_id = p_user_id for update;
  select * into v_t from public.pro_trials where user_id = p_user_id for update;
  if not found or v_t.ended_at is not null or v_t.converted_at is not null then return false; end if;
  if v_ent.user_id is not null and v_ent.license_key is not null then
    v_ent_id := public.fnos_license_id(v_ent.license_key);
  end if;

  if v_ent_id is not null and v_ent_id <> coalesce(v_t.key_hash, '')
     and exists (select 1 from public.licenses where key_hash = v_ent_id) then
    perform public.fnos_carry_trial_data(p_user_id, v_t.key_hash, v_ent_id);
    return true;
  end if;
  if v_t.ends_at > now() and v_ent_id is not null and v_ent_id = v_t.key_hash then
    return false; -- en curso, con su credencial
  end if;

  update public.pro_trials set ended_at = now() where user_id = p_user_id;
  if v_ent_id is not null and v_ent_id = v_t.key_hash then
    update public.user_entitlements
       set plan = 'starter', license_key = null, updated_at = now()
     where user_id = p_user_id;
  end if;
  if v_t.key_hash is not null then
    delete from public.push_subscriptions where key_hash = v_t.key_hash;
    update public.licenses
       set expires_at = least(coalesce(expires_at, now()), now() - interval '1 second'),
           trial_ends_at = least(coalesce(trial_ends_at, now()), now() - interval '1 second')
     where key_hash = v_t.key_hash;
  end if;
  return true;
end;
$function$;
comment on function public.fnos_end_pro_trial(uuid) is
  'Reverse trial: cierra una prueba vencida o sin credencial (vuelta a Starter, sin avisos push) o la da por convertida si la cuenta tiene otra licencia. No borra la licencia de prueba ni la copia del sync (eso es pro_trials_purge_sync a los 90 días). Interna.';
revoke all on function public.fnos_end_pro_trial(uuid) from public, anon, authenticated;
grant execute on function public.fnos_end_pro_trial(uuid) to service_role;

create or replace function public.pro_trials_expire_due()
returns integer
language plpgsql
volatile
security definer
set search_path to 'public', 'extensions'
as $function$
declare r record; v_n int := 0;
begin
  for r in select t.user_id from public.pro_trials t
            where t.ended_at is null and t.converted_at is null
              and (t.ends_at <= now()
                   or not exists (select 1 from public.user_entitlements e
                                   where e.user_id = t.user_id and e.license_key is not null
                                     and public.fnos_license_id(e.license_key) = t.key_hash))
  loop
    if public.fnos_end_pro_trial(r.user_id) then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end;
$function$;
comment on function public.pro_trials_expire_due() is
  'Reverse trial: procesa las pruebas vencidas o sin credencial que la app no procesó (job diario pro-trials-expire). Devuelve cuántas. Solo service_role.';
revoke all on function public.pro_trials_expire_due() from public, anon, authenticated;
grant execute on function public.pro_trials_expire_due() to service_role;

-- D2: 90 días después del fin de una prueba sin compra se borra su copia cifrada
-- del sync. La licencia de prueba vencida queda (sin datos) para que una compra
-- posterior no choque con nada; la fila de pro_trials también (una por cuenta).
create or replace function public.pro_trials_purge_sync(p_now timestamptz default now())
returns integer
language plpgsql
volatile
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_n int;
begin
  with due as (
    select t.user_id, t.key_hash from public.pro_trials t
     where t.converted_at is null and t.ended_at is not null
       and t.ended_at <= p_now - interval '90 days'
       and t.sync_purged_at is null
  ), del as (
    delete from public.synced_data s using due where s.key_hash = due.key_hash returning s.key_hash
  )
  update public.pro_trials t set sync_purged_at = p_now from due where t.user_id = due.user_id;
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;
comment on function public.pro_trials_purge_sync(timestamptz) is
  'D2: borra la copia cifrada del sync de las pruebas que terminaron sin compra hace 90 días o más (job diario pro-trials-purge-sync). Devuelve cuántas pruebas procesó. Solo service_role.';
revoke all on function public.pro_trials_purge_sync(timestamptz) from public, anon, authenticated;
grant execute on function public.pro_trials_purge_sync(timestamptz) to service_role;

-- ── 3. Empezar la prueba ───────────────────────────────────────────────────
create or replace function public.start_pro_trial()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_t      public.pro_trials%rowtype;
  v_key    text;
  v_client text;
  v_id     text;
  v_n      int;
  v_start  timestamptz := now();
  v_end    timestamptz := now() + interval '14 days';
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'no_session');
  end if;
  -- S1: una sesión anónima nunca empieza la prueba (en producción están apagadas;
  -- esto es la segunda barrera).
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    return jsonb_build_object('ok', false, 'error', 'not_eligible');
  end if;
  -- Dos toques seguidos (o dos dispositivos) no crean dos pruebas.
  perform pg_advisory_xact_lock(hashtext('pro_trial:' || v_uid::text));
  -- S5: la fila de la cuenta queda bloqueada hasta el final, así una compra que
  -- llega a la vez (attach_license_to_account) espera y no la pisamos.
  perform 1 from public.user_entitlements where user_id = v_uid for update;

  select * into v_t from public.pro_trials where user_id = v_uid;
  if found then
    if v_t.ended_at is null and v_t.converted_at is null and v_t.ends_at > now() then
      select e.license_key into v_key from public.user_entitlements e
       where e.user_id = v_uid and e.license_key is not null
         and public.fnos_license_id(e.license_key) = v_t.key_hash;
      if v_key is not null then
        return jsonb_build_object('ok', true, 'already', true, 'license_key', v_key,
          'started_at', public.fnos_epoch_ms(v_t.started_at), 'ends_at', public.fnos_epoch_ms(v_t.ends_at));
      end if;
    end if;
    return jsonb_build_object('ok', false, 'error', 'already_used');
  end if;

  if not public.fnos_pro_trial_eligible(v_uid) then
    return jsonb_build_object('ok', false, 'error', 'not_eligible');
  end if;

  select lower(btrim(u.email)) into v_email from auth.users u where u.id = v_uid;
  v_client := encode(extensions.gen_random_bytes(32), 'hex');
  v_id := public.fnos_license_id(v_client);
  if v_id is null then
    -- Sin la pimienta de Vault no hay licencias: mejor no emitir nada.
    return jsonb_build_object('ok', false, 'error', 'unavailable');
  end if;

  begin
    -- S2: la licencia nace sin correo y el correo se pone recién con la fila de
    -- pro_trials creada. Así el trigger del CRM (que mira licenses por correo)
    -- ya sabe que es una prueba y no marca al contacto como pago (ni corta la
    -- secuencia de Starter, ni lo deja 'perdido' después).
    insert into public.licenses (key_hash, key_hash_v, plan, status, email, expires_at, is_trial, trial_ends_at)
    values (v_id, 2, 'pro', 'active', null, v_end, true, v_end);
    insert into public.pro_trials (user_id, key_hash, started_at, ends_at)
    values (v_uid, v_id, v_start, v_end);
    update public.licenses set email = v_email where key_hash = v_id;
    -- Pasa por los triggers de user_entitlements (una licencia, una cuenta; plan
    -- 'pro' solo con licencia activa) con el rol de la sesión. S5: solo si la
    -- cuenta sigue sin licencia; si no, se deshace todo el bloque.
    insert into public.user_entitlements (user_id, plan, license_key, updated_at)
    values (v_uid, 'pro', v_client, now())
    on conflict (user_id) do update
      set plan = 'pro', license_key = excluded.license_key, updated_at = now()
      where public.user_entitlements.license_key is null;
    get diagnostics v_n = row_count;
    if v_n = 0 then
      raise exception 'pro_trial_not_eligible' using errcode = 'PT001';
    end if;
    perform public.fnos_trial_tombstone(v_email);
  exception when sqlstate 'PT001' then
    return jsonb_build_object('ok', false, 'error', 'not_eligible');
  end;

  return jsonb_build_object('ok', true, 'license_key', v_client,
    'started_at', public.fnos_epoch_ms(v_start), 'ends_at', public.fnos_epoch_ms(v_end));
end;
$function$;
comment on function public.start_pro_trial() is
  'Reverse trial: empieza los 14 días de Pro sin tarjeta para la cuenta de la sesión (correo confirmado, no anónima). Idempotente mientras la prueba está en curso.';
revoke all on function public.start_pro_trial() from public, anon, authenticated;
grant execute on function public.start_pro_trial() to authenticated, service_role;

-- ── 4. Estado para la app ──────────────────────────────────────────────────
create or replace function public.pro_trial_status()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_uid uuid := auth.uid();
  v_t   public.pro_trials%rowtype;
  v_key text;
  v_active boolean;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'no_session');
  end if;
  perform public.fnos_end_pro_trial(v_uid);

  select * into v_t from public.pro_trials where user_id = v_uid;
  if not found then
    return jsonb_build_object('ok', true, 'eligible', public.fnos_pro_trial_eligible(v_uid),
      'active', false, 'ended', false);
  end if;

  v_active := v_t.ended_at is null and v_t.converted_at is null and v_t.ends_at > now();
  if v_active then
    select e.license_key into v_key from public.user_entitlements e
     where e.user_id = v_uid and e.license_key is not null
       and public.fnos_license_id(e.license_key) = v_t.key_hash;
  end if;
  return jsonb_build_object('ok', true, 'eligible', false,
    'active', v_active and v_key is not null,
    'ended', not v_active and v_t.converted_at is null,
    'converted', v_t.converted_at is not null,
    'started_at', public.fnos_epoch_ms(v_t.started_at),
    'ends_at', public.fnos_epoch_ms(v_t.ends_at),
    'license_key', v_key);
end;
$function$;
comment on function public.pro_trial_status() is
  'Reverse trial: estado de la prueba de la cuenta de la sesión (elegible / en curso / terminada / convertida). Procesa una prueba vencida o sin credencial.';
revoke all on function public.pro_trial_status() from public, anon, authenticated;
grant execute on function public.pro_trial_status() to authenticated, service_role;

-- Jobs diarios: las cuentas que no abren la app también vuelven a Starter, y la
-- copia del sync de las pruebas sin compra se borra a los 90 días (D2).
do $$ begin
  perform cron.unschedule('pro-trials-expire');
exception when others then null; end $$;
select cron.schedule('pro-trials-expire', '41 4 * * *', $$select public.pro_trials_expire_due()$$);
do $$ begin
  perform cron.unschedule('pro-trials-purge-sync');
exception when others then null; end $$;
select cron.schedule('pro-trials-purge-sync', '53 4 * * *', $$select public.pro_trials_purge_sync()$$);

-- ── 6. validate_license con los datos de la prueba ─────────────────────────
CREATE OR REPLACE FUNCTION public.validate_license(p_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_hash text; v_row public.licenses%rowtype; v_trial boolean;
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
  v_trial := coalesce(v_row.is_trial and v_row.trial_ends_at > now(), false);
  return jsonb_build_object('valid', true, 'plan', v_row.plan,
    'expires_at', case when v_row.expires_at is null then null
                       else extract(epoch from v_row.expires_at) * 1000 end,
    'trial', v_trial,
    'trial_ends_at', case when v_trial then public.fnos_epoch_ms(v_row.trial_ends_at) end,
    'no_card_trial', exists (select 1 from public.pro_trials t where t.key_hash = v_hash));
end;
$function$
;

-- ── 7. Comprar durante la prueba ───────────────────────────────────────────
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
  -- Una prueba sin tarjeta en curso no es "ya Pro": la compra la reemplaza
  -- (trg_carry_pro_trial_to_license pasa el sync y los avisos).
  if v_cur.user_id is not null and v_cur.plan = 'pro' and v_cur.license_key is not null
     and v_cur_id <> v_hash
     and not exists (select 1 from public.pro_trials t where t.key_hash = v_cur_id)
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

-- ── 8. De la prueba a la licencia pagada ───────────────────────────────────
create or replace function public.carry_pro_trial_to_license()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_old text; v_new text;
begin
  if old.license_key is null or new.license_key is null or new.plan <> 'pro' then
    return new;
  end if;
  v_old := public.fnos_license_id(old.license_key);
  v_new := public.fnos_license_id(new.license_key);
  if v_old is null or v_new is null or v_old = v_new then return new; end if;
  if not exists (select 1 from public.pro_trials t where t.user_id = new.user_id and t.key_hash = v_old) then
    return new;
  end if;
  perform public.fnos_carry_trial_data(new.user_id, v_old, v_new);
  return new;
end;
$function$;
revoke all on function public.carry_pro_trial_to_license() from public, anon, authenticated;

drop trigger if exists trg_carry_pro_trial_to_license on public.user_entitlements;
create trigger trg_carry_pro_trial_to_license
  after update of license_key on public.user_entitlements
  for each row execute function public.carry_pro_trial_to_license();

-- ── 9. Avisos push solo con licencia vigente ───────────────────────────────
CREATE OR REPLACE FUNCTION public.save_push_subscription(p_key text, p_endpoint text, p_p256dh text, p_auth text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_hash text;
begin
  if p_endpoint is null or p_p256dh is null or p_auth is null then
    return jsonb_build_object('ok', false, 'error', 'bad_args');
  end if;
  if not public.push_endpoint_allowed(p_endpoint)
     or p_p256dh !~ '^[A-Za-z0-9_-]{40,200}={0,2}$'
     or p_auth !~ '^[A-Za-z0-9_-]{8,64}={0,2}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_endpoint');
  end if;
  v_hash := public.fnos_license_key_id(p_key);
  if not exists (select 1 from public.licenses where key_hash = v_hash and status = 'active'
                   and (expires_at is null or expires_at > now())) then
    return jsonb_build_object('ok', false, 'error', 'invalid_license');
  end if;
  if not public.fnos_caller_owns_license(v_hash) then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  -- Dos altas simultáneas de la misma licencia no pasan el tope.
  perform pg_advisory_xact_lock(hashtext('push_subscriptions:' || v_hash));
  insert into public.push_subscriptions (key_hash, endpoint, p256dh, auth, created_at)
  values (v_hash, p_endpoint, p_p256dh, p_auth, clock_timestamp())
  on conflict (endpoint) do update
    set key_hash = excluded.key_hash, p256dh = excluded.p256dh, auth = excluded.auth,
        created_at = excluded.created_at, fail_count = 0, first_failed_at = null;
  -- Tope: 10 por licencia; se van las más viejas.
  delete from public.push_subscriptions
   where key_hash = v_hash
     and id not in (
       select id from public.push_subscriptions
        where key_hash = v_hash
        order by created_at desc, id
        limit 10);
  return jsonb_build_object('ok', true);
end;
$function$
;

-- ── 10. Reporte por correo: las licencias de pago único conservan Pro ──────
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
  -- 'personal': licencias de pago único de antes del 12-sep-2026, con todo Pro.
  if v_plan is null or v_plan not in ('pro', 'enterprise', 'personal') then
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

-- ── 11. CRM: la prueba sin tarjeta no es un pago ───────────────────────────
create or replace function public.crm_refresh_contact(p_email text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email   text := lower(trim(p_email));
  v_account boolean;
  v_pro     boolean;
  v_uid     uuid;
  v_created timestamptz;
  v_login   timestamptz;
  v_name    text;
  v_lang    text;
  v_optin   boolean;
  v_product text;
begin
  if v_email is null or v_email = '' then return; end if;

  select exists(select 1 from auth.users where lower(email) = v_email) into v_account;
  -- Reverse trial (20261126000000): una prueba de Pro sin tarjeta no es un pago.
  select exists(select 1 from public.licenses l where lower(l.email) = v_email and l.status = 'active'
                   and not exists (select 1 from public.pro_trials t where t.key_hash = l.key_hash))
      or exists(select 1 from public.user_entitlements ue join auth.users u on u.id = ue.user_id
                 where lower(u.email) = v_email and ue.plan in ('pro', 'enterprise')
                   and not exists (select 1 from public.pro_trials t
                                    where t.user_id = ue.user_id
                                      and t.key_hash = public.fnos_license_id(ue.license_key)))
    into v_pro;

  if v_pro then
    -- Quien paga siempre está en el CRM, aunque no haya pasado por ningún lead.
    insert into public.crm_contacts (email, producto_origen, fuente, estado, plan)
    values (v_email, 'moyiq', 'stripe', 'convertido', 'pro')
    on conflict (email, producto_origen) do update
      set estado = 'convertido', plan = 'pro', actualizado_en = now()
      where crm_contacts.plan is distinct from 'pro' or crm_contacts.estado <> 'convertido';
    -- Ya es Pro: corta el correo de Starter que lo invita a pasarse a Pro.
    update public.starter_leads set account_created_at = coalesce(account_created_at, now())
     where lower(email) = v_email;
  else
    -- Pro que dejó de pagar (licencia revocada o suscripción cancelada).
    update public.crm_contacts
       set plan = case when v_account then 'gratis' end,
           estado = 'perdido',
           actualizado_en = now()
     where lower(email) = v_email and plan = 'pro';
  end if;

  if v_account then
    select u.id, u.created_at, u.last_sign_in_at,
           nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')), ''),
           nullif(u.raw_user_meta_data->>'lang', '')
      into v_uid, v_created, v_login, v_name, v_lang
      from auth.users u where lower(u.email) = v_email
     order by u.created_at limit 1;

    -- COM-8: una cuenta sin lead previo también entra (antes solo los Pro).
    if not exists (select 1 from public.crm_contacts where lower(email) = v_email) then
      v_product := case when exists (
        select 1 from public.consents c
         where c.user_id = v_uid and c.document_type = 'investment_disclaimer'
      ) then 'invest' else 'moyiq' end;
      insert into public.crm_contacts (email, producto_origen, fuente, plan, nombre)
      values (v_email, v_product, null, 'gratis', v_name)
      on conflict (email, producto_origen) do nothing;
    end if;

    update public.crm_contacts set plan = 'gratis', actualizado_en = now()
     where lower(email) = v_email and plan is null;
    -- Diagnóstico e Invest: "convertido" = creó cuenta. Cubre a quien la creó
    -- ANTES de dejar el email (el trigger de auth.users no lo veía).
    update public.diagnostico_leads set account_created_at = coalesce(account_created_at, now())
     where lower(email) = v_email and account_created_at is null;
    update public.invest_leads set account_created_at = coalesce(account_created_at, now())
     where lower(email) = v_email and account_created_at is null;
  end if;

  -- Opt-in de marketing confirmado y vigente en cualquier puerta.
  select exists(select 1 from public.starter_leads     where lower(email) = v_email and consent_confirmed_at is not null and unsubscribed_at is null)
      or exists(select 1 from public.diagnostico_leads where lower(email) = v_email and consent_confirmed_at is not null and unsubscribed_at is null)
      or exists(select 1 from public.demo_leads        where lower(email) = v_email and consent_confirmed_at is not null and unsubscribed_at is null)
      or exists(select 1 from public.invest_leads      where lower(email) = v_email and consent_confirmed_at is not null and unsubscribed_at is null)
      or exists(select 1 from public.newsletter_signups where lower(email) = v_email and consent_confirmed_at is not null and unsubscribed_at is null)
    into v_optin;

  update public.crm_contacts c
     set optin_confirmado = v_optin,
         ultimo_login     = coalesce(v_login, c.ultimo_login),
         cuenta_creada_en = coalesce(v_created, c.cuenta_creada_en),
         nombre           = coalesce(c.nombre, v_name),
         lang             = coalesce(v_lang, c.lang, (
                              select l.lang from (
                                select lang, created_at from public.starter_leads where lower(email) = v_email
                                union all select lang, created_at from public.diagnostico_leads where lower(email) = v_email
                                union all select lang, created_at from public.demo_leads where lower(email) = v_email
                                union all select lang, created_at from public.invest_leads where lower(email) = v_email
                              ) l where l.lang is not null order by l.created_at desc limit 1))
   where lower(c.email) = v_email
     and (c.optin_confirmado is distinct from v_optin
       or c.ultimo_login is distinct from coalesce(v_login, c.ultimo_login)
       or c.cuenta_creada_en is distinct from coalesce(v_created, c.cuenta_creada_en)
       or (c.nombre is null and v_name is not null)
       or c.lang is null);
end;
$$;
revoke all on function public.crm_refresh_contact(text) from public, anon, authenticated;
grant execute on function public.crm_refresh_contact(text) to service_role;

-- ── 12. Correos de la prueba sin tarjeta (D3, decisión del 26-nov) ──────────
-- Tres correos de servicio en el idioma de la cuenta (auth.users
-- raw_user_meta_data.lang), sin hablar de cobros: al empezar ("welcome"), a los
-- 10 días ("day10", quedan 4) y al terminar sin compra ("ended", con cómo pasar
-- a Pro en la web). Los manda la función send-pro-trial-email (cron horario).
-- pro_trial_emails es el registro idempotente: una fila por cuenta y paso; la
-- función la reclama ANTES de mandar (claim) y la suelta si Resend falla, así
-- dos corridas a la vez nunca mandan el mismo correo dos veces.
create table if not exists public.pro_trial_emails (
  user_id uuid not null references auth.users(id) on delete cascade,
  step    text not null check (step in ('welcome', 'day10', 'ended')),
  sent_at timestamptz not null default now(),
  primary key (user_id, step)
);
comment on table public.pro_trial_emails is
  'D3: correos ya enviados de la prueba de Pro sin tarjeta (welcome, day10, ended). Solo id de cuenta, paso y fecha. Solo service_role.';
alter table public.pro_trial_emails enable row level security;
revoke all on table public.pro_trial_emails from public, anon, authenticated;
grant select, insert, delete on table public.pro_trial_emails to service_role;

create or replace function public.pro_trial_emails_due(p_now timestamptz default now())
returns table (user_id uuid, email text, lang text, step text, started_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select t.user_id, u.email, nullif(u.raw_user_meta_data ->> 'lang', ''), s.step, t.started_at, t.ends_at
    from public.pro_trials t
    join auth.users u on u.id = t.user_id
   cross join lateral (values
     -- Al empezar: dentro de los 2 días (un cron caído no manda bienvenidas viejas).
     ('welcome', t.ended_at is null and t.converted_at is null and t.ends_at > p_now
                 and t.started_at <= p_now and t.started_at > p_now - interval '2 days'),
     -- Día 10: quedan 4 días.
     ('day10',   t.ended_at is null and t.converted_at is null and t.ends_at > p_now
                 and t.started_at <= p_now - interval '10 days'),
     -- Al terminar sin compra, dentro de los 7 días.
     ('ended',   t.converted_at is null
                 and (t.ended_at is not null or t.ends_at <= p_now)
                 and coalesce(t.ended_at, t.ends_at) > p_now - interval '7 days')
   ) as s(step, due)
   where s.due
     and u.email is not null and u.email_confirmed_at is not null
     and not exists (select 1 from public.pro_trial_emails e where e.user_id = t.user_id and e.step = s.step)
   order by t.started_at
   limit 200
$function$;
comment on function public.pro_trial_emails_due(timestamptz) is
  'D3: correos de la prueba sin tarjeta que tocan ahora (welcome/day10/ended) y no se mandaron. Solo service_role (send-pro-trial-email).';
revoke all on function public.pro_trial_emails_due(timestamptz) from public, anon, authenticated;
grant execute on function public.pro_trial_emails_due(timestamptz) to service_role;

-- Reclamar (true = este proceso lo manda) y soltar si el envío falló.
create or replace function public.pro_trial_email_claim(p_user_id uuid, p_step text)
returns boolean
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
begin
  insert into public.pro_trial_emails (user_id, step) values (p_user_id, p_step)
  on conflict (user_id, step) do nothing;
  return found;
end;
$function$;
revoke all on function public.pro_trial_email_claim(uuid, text) from public, anon, authenticated;
grant execute on function public.pro_trial_email_claim(uuid, text) to service_role;

create or replace function public.pro_trial_email_release(p_user_id uuid, p_step text)
returns void
language sql
volatile
security definer
set search_path to 'public'
as $function$
  delete from public.pro_trial_emails where user_id = p_user_id and step = p_step
$function$;
revoke all on function public.pro_trial_email_release(uuid, text) from public, anon, authenticated;
grant execute on function public.pro_trial_email_release(uuid, text) to service_role;

do $$ begin
  perform cron.unschedule('pro-trial-emails-hourly');
exception when others then null; end $$;
select cron.schedule(
  'pro-trial-emails-hourly',
  '23 * * * *',
  $$
  select net.http_post(
    url := 'https://nelwgbcddwiaimzbcuas.supabase.co/functions/v1/send-pro-trial-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(private.get_secret('cron_secret'), '')
    ),
    body := jsonb_build_object('mode', 'cron'),
    timeout_milliseconds := 30000
  );
  $$
);

-- ── 13. Borrar la cuenta también borra la prueba (S4) y deja el HMAC (D1) ───
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
    union
    -- S4: la licencia de la prueba sin tarjeta, aunque la cuenta ya no la tenga
    -- en user_entitlements (prueba vencida) o haya cambiado de correo.
    select t.key_hash
      from public.pro_trials t
     where t.user_id = p_user_id and t.key_hash is not null
  ) s where h is not null;

  -- D1: quien usó la prueba (o tuvo una licencia) deja el HMAC de su correo, el
  -- de ahora y el de la licencia de prueba si era otro, para que volver a
  -- registrarse no dé otra prueba. Es lo único que queda (sin correo ni id).
  if v_email is not null and (cardinality(v_hashes) > 0
     or exists (select 1 from public.pro_trials t where t.user_id = p_user_id)) then
    perform public.fnos_trial_tombstone(v_email);
  end if;
  perform public.fnos_trial_tombstone(l.email)
     from public.licenses l join public.pro_trials t on t.key_hash = l.key_hash
    where t.user_id = p_user_id and l.email is not null;

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

  delete from public.pro_trial_emails where user_id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('pro_trial_emails', v_n);
  delete from public.pro_trials where user_id = p_user_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('pro_trials', v_n);
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

-- ── 14. Reporte semanal: pruebas con tarjeta y sin tarjeta por separado ───
create or replace function public.funnel_report_metrics(p_week_start date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with w as (
    select (p_week_start::timestamp at time zone 'UTC') as d0
  ), r as (
    select (select d0 from w) as d0, (select d0 from w) + interval '7 days' as d1
  )
  select jsonb_build_object(
    'visitas', null,
    'altas', (select count(*) from auth.users u, r
               where u.created_at >= r.d0 and u.created_at < r.d1 and not private.is_internal_email(u.email)),
    'activas', (select count(*) from auth.users u, r
                 where u.last_sign_in_at >= r.d0 and u.last_sign_in_at < r.d1 and not private.is_internal_email(u.email)),
    -- Con tarjeta (Stripe) y, aparte, la prueba sin tarjeta del modelo A (sin suscripción).
    'pruebas', (select count(*) from public.licenses l, r
                 where l.is_trial and l.stripe_subscription_id is not null
                   and l.created_at >= r.d0 and l.created_at < r.d1 and not private.is_internal_email(l.email)),
    'pruebas_sin_tarjeta', (select count(*) from public.licenses l, r
                 where l.is_trial and l.stripe_subscription_id is null
                   and l.created_at >= r.d0 and l.created_at < r.d1 and not private.is_internal_email(l.email)),
    'pagos', (select count(*) from public.licenses l, r
               where not private.is_internal_email(l.email)
                 and coalesce(l.plan, '') <> 'starter'
                 and ((not l.is_trial and l.status = 'active' and l.created_at >= r.d0 and l.created_at < r.d1)
                      or (l.is_trial and l.status = 'active' and l.trial_ends_at >= r.d0 and l.trial_ends_at < r.d1
                          and l.expires_at > l.trial_ends_at + interval '1 day'))),
    'bajas', (select count(*) from public.cancellation_requests c, r
               where c.created_at >= r.d0 and c.created_at < r.d1 and not private.is_internal_email(c.email))
  )
$$;
revoke all on function public.funnel_report_metrics(date) from public, anon, authenticated;
grant execute on function public.funnel_report_metrics(date) to service_role;
