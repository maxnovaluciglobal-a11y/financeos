-- Suscripciones push: solo servicios push reales, tope por licencia y bajas
-- por fallos repetidos (revisión de Inversiones F4, 23-nov-2026).
-- Antes save_push_subscription (migración 20261020090000) guardaba cualquier
-- endpoint y sin tope: con una licencia activa se podían registrar cientos de
-- URLs propias, y send-push / invest-alerts-check les hacían POST (SSRF que se
-- repetía solo, y una corrida que pasaba el límite de reloj de la función).
--
--   1. public.push_endpoint_allowed(text): true solo si el endpoint es https,
--      sin usuario ni puerto raro, y su host es de un servicio Web Push:
--        · fcm.googleapis.com                    (Chrome, Edge Android, Samsung, Opera)
--        · updates.push.services.mozilla.com     (Firefox)
--        · *.push.apple.com                      (Safari macOS / iOS: web.push.apple.com)
--        · *.notify.windows.com                  (Edge / navegadores en Windows: WNS)
--   2. save_push_subscription: valida endpoint, p256dh y auth (base64url) y
--      deja como mucho 10 suscripciones por licencia (key_hash): borra las más
--      viejas. Volver a guardar el mismo endpoint lo renueva (created_at nuevo).
--      Mismo resultado jsonb; error nuevo 'bad_endpoint'.
--   3. push_subscriptions.fail_count / first_failed_at: fallos seguidos (una
--      vez por corrida) de invest-alerts-check. RPC
--      push_subscriptions_record(ok[], failed[], gone[], at), solo service_role:
--        · ok: vuelve a 0.
--        · gone (404/410): se borra.
--        · failed (400/403, 429/5xx, red): suma 1; se borra recién con 8 fallos
--          seguidos Y el primero hace 48 h o más. Un solo 403 (por ejemplo la
--          clave VAPID del servidor mal cargada) nunca borra nada: si el 400/403
--          se repite en 2 o más cuentas de un mismo servicio push donde nada
--          llegó, la función responde 502 mientras tanto.
--   4. invest_alert_push_targets (reemplaza la de 20261120000100): solo
--      endpoints permitidos y como mucho 5 por cuenta, las más recientes.
--
--   5. public.push_subscriptions_prune(), solo service_role, y se corre una vez
--      al final de esta migración: borra las filas que ya existían con un
--      endpoint fuera de la lista y deja cada licencia (key_hash) con sus 10
--      suscripciones más recientes. Así send-push (recordatorios de prueba) y
--      el tope de 10 parten de una tabla limpia, sin esperar a que la licencia
--      guarde una suscripción nueva. send-push además filtra con la misma lista
--      (_shared/pushEndpoint.ts) y manda a 5 por licencia como mucho.
--
-- Requiere 20261020090000 y 20261120000100.
-- Test: supabase/tests/push_subscription_guard.sql (job `db` del CI).

-- 1. Lista de servicios push.
create or replace function public.push_endpoint_allowed(p_endpoint text)
returns boolean
language sql
immutable
set search_path to 'public', 'extensions'
as $function$
  select coalesce(
    length(p_endpoint) <= 1024
    and p_endpoint !~ '[[:space:]\\]'
    and lower(substring(p_endpoint from '^https://([^/?#:@]+)(?::443)?/')) ~
      '^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)+push\.apple\.com|([a-z0-9-]+\.)+notify\.windows\.com)$',
    false)
$function$;
comment on function public.push_endpoint_allowed(text) is
  'true si el endpoint es https de un servicio Web Push conocido (FCM, Mozilla, Apple, WNS). Lo usan save_push_subscription e invest_alert_push_targets.';
revoke all on function public.push_endpoint_allowed(text) from public, anon, authenticated;
grant execute on function public.push_endpoint_allowed(text) to service_role;

-- 3 (antes que 2: la tabla). Fallos seguidos por suscripción.
alter table public.push_subscriptions add column if not exists fail_count integer not null default 0;
alter table public.push_subscriptions add column if not exists first_failed_at timestamptz;

-- 2. Guardar una suscripción: validada y con tope por licencia.
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
  if not exists (select 1 from public.licenses where key_hash = v_hash and status = 'active') then
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

create or replace function public.push_subscriptions_record(p_ok uuid[], p_failed uuid[], p_gone uuid[], p_at timestamptz)
returns integer
language plpgsql
volatile
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_at timestamptz := coalesce(p_at, now()); v_gone int; v_over int;
begin
  update public.push_subscriptions
     set fail_count = 0, first_failed_at = null
   where id = any (coalesce(p_ok, '{}'::uuid[])) and fail_count > 0;

  delete from public.push_subscriptions where id = any (coalesce(p_gone, '{}'::uuid[]));
  get diagnostics v_gone = row_count;

  update public.push_subscriptions
     set fail_count = fail_count + 1, first_failed_at = coalesce(first_failed_at, v_at)
   where id = any (coalesce(p_failed, '{}'::uuid[]));

  delete from public.push_subscriptions
   where id = any (coalesce(p_failed, '{}'::uuid[]))
     and fail_count >= 8
     and first_failed_at <= v_at - interval '48 hours';
  get diagnostics v_over = row_count;
  return v_gone + v_over;
end;
$function$;
comment on function public.push_subscriptions_record(uuid[], uuid[], uuid[], timestamptz) is
  'invest-alerts-check: resultado de los envíos push de una corrida (ok vuelve a 0, gone se borra, failed suma y se borra con 8 fallos seguidos en 48 h o más). Devuelve cuántas borró. Solo service_role.';
revoke all on function public.push_subscriptions_record(uuid[], uuid[], uuid[], timestamptz) from public, anon, authenticated;
grant execute on function public.push_subscriptions_record(uuid[], uuid[], uuid[], timestamptz) to service_role;

-- 4. Destinos de las alertas: solo servicios push y 5 por cuenta.
create or replace function public.invest_alert_push_targets(p_user_ids uuid[])
returns table (user_id uuid, sub_id uuid, endpoint text, p256dh text, auth text)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
  select t.user_id, t.id, t.endpoint, t.p256dh, t.auth
    from (
      select x.*, row_number() over (partition by x.user_id order by x.created_at desc, x.id) as rn
        from (
          select distinct e.user_id, s.id, s.endpoint, s.p256dh, s.auth, s.created_at
            from public.user_entitlements e
            join public.push_subscriptions s on s.key_hash = public.fnos_license_id(e.license_key)
           where e.user_id = any (coalesce(p_user_ids, '{}'::uuid[]))
             and e.license_key is not null
             and public.push_endpoint_allowed(s.endpoint)
        ) x
    ) t
   where t.rn <= 5
$function$;
comment on function public.invest_alert_push_targets(uuid[]) is
  'Inversiones F4: suscripciones push (solo servicios push conocidos, 5 por cuenta, las más recientes) de las cuentas con alertas disparadas. Solo service_role (invest-alerts-check).';
revoke all on function public.invest_alert_push_targets(uuid[]) from public, anon, authenticated;
grant execute on function public.invest_alert_push_targets(uuid[]) to service_role;

-- 5. Limpieza de las filas que ya existían: fuera de la lista y más de 10 por licencia.
create or replace function public.push_subscriptions_prune()
returns integer
language plpgsql
volatile
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_bad int; v_over int;
begin
  delete from public.push_subscriptions where not public.push_endpoint_allowed(endpoint);
  get diagnostics v_bad = row_count;
  delete from public.push_subscriptions
   where id in (
     select id from (
       select id, row_number() over (partition by key_hash order by created_at desc, id) as rn
         from public.push_subscriptions
     ) x
     where x.rn > 10);
  get diagnostics v_over = row_count;
  return v_bad + v_over;
end;
$function$;
comment on function public.push_subscriptions_prune() is
  'Borra las suscripciones push con endpoint fuera de push_endpoint_allowed y deja 10 por licencia (las más recientes). Devuelve cuántas borró. Solo service_role; la corre la migración 20261123000100.';
revoke all on function public.push_subscriptions_prune() from public, anon, authenticated;
grant execute on function public.push_subscriptions_prune() to service_role;

select public.push_subscriptions_prune();
