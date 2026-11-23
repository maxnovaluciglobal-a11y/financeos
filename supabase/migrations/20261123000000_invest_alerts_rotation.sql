-- Inversiones F4, revisión del 23-nov-2026: que ninguna cuenta deje a otras
-- sin revisar y que la corrida no dependa del largo de una URL.
-- invest-alerts-check lee hasta 5000 alertas y cotiza hasta 400 símbolos por
-- corrida; antes las leía por created_at, así que las cuentas más viejas (o
-- símbolos sin cotización que nunca salían de la fila) ocupaban siempre los
-- mismos lugares.
--
--   1. invest_alerts.last_checked_at: última corrida que pidió el precio de la
--      alerta (haya tenido precio o no). La función ordena por esta columna
--      (nulls first), así cada corrida empieza por las que hace más que no se
--      revisan, y reparte los símbolos por cuenta antes del tope de 400. Una
--      alerta nueva entra con now(): espera su turno como las demás (borrar y
--      volver a crear no adelanta a nadie).
--   2. Grants por columna: authenticated escribe solo symbol, condition,
--      threshold, active y last_triggered_at (y user_id al crear, que la
--      política obliga a ser la propia cuenta). last_checked_at, id y
--      created_at quedan para service_role: una cuenta no puede ponerse
--      primera en la fila.
--   3. RPC solo para service_role, con los ids en el cuerpo (uuid[]) y no en
--      la URL (cientos de ids pasaban el largo que acepta el gateway):
--        · invest_alerts_mark_checked(uuid[], timestamptz): marca revisadas.
--        · invest_alerts_claim(uuid[], timestamptz): reclama el aviso SOLO si
--          nadie avisó en las últimas 24 h; devuelve los ids reclamados.
--        · invest_alerts_release(uuid[], timestamptz[], timestamptz): devuelve
--          un reclamo que no llegó a ningún dispositivo a su valor anterior
--          (solo si la marca sigue siendo la de esa corrida) y lo pone primero
--          en la fila (last_checked_at = null) para la próxima corrida.
--
-- No cambia filas existentes ni políticas. Requiere 20261120000100.

alter table public.invest_alerts add column if not exists last_checked_at timestamptz;
alter table public.invest_alerts alter column last_checked_at set default now();

create index if not exists invest_alerts_rotation_idx
  on public.invest_alerts (last_checked_at asc nulls first, created_at)
  where active;

-- 2. Grants por columna (la política invest_alerts_update_own sigue igual).
revoke insert, update on table public.invest_alerts from authenticated;
grant insert (user_id, symbol, condition, threshold, active, last_triggered_at) on table public.invest_alerts to authenticated;
grant update (symbol, condition, threshold, active, last_triggered_at) on table public.invest_alerts to authenticated;

-- 3. RPC de la función programada.
create or replace function public.invest_alerts_mark_checked(p_ids uuid[], p_at timestamptz)
returns integer
language sql
volatile
security definer
set search_path to 'public', 'extensions'
as $function$
  with done as (
    update public.invest_alerts
       set last_checked_at = coalesce(p_at, now())
     where id = any (coalesce(p_ids, '{}'::uuid[]))
    returning 1
  )
  select count(*)::integer from done
$function$;
comment on function public.invest_alerts_mark_checked(uuid[], timestamptz) is
  'Inversiones F4: marca qué alertas revisó invest-alerts-check (rotación justa entre cuentas). Solo service_role.';

create or replace function public.invest_alerts_claim(p_ids uuid[], p_at timestamptz)
returns setof uuid
language sql
volatile
security definer
set search_path to 'public', 'extensions'
as $function$
  update public.invest_alerts
     set last_triggered_at = p_at
   where p_at is not null
     and id = any (coalesce(p_ids, '{}'::uuid[]))
     and active
     and (last_triggered_at is null or last_triggered_at < p_at - interval '24 hours')
  returning id
$function$;
comment on function public.invest_alerts_claim(uuid[], timestamptz) is
  'Inversiones F4: invest-alerts-check reclama el aviso de estas alertas si nadie avisó en 24 h (dos corridas cruzadas no avisan dos veces). Solo service_role.';

create or replace function public.invest_alerts_release(p_ids uuid[], p_prev timestamptz[], p_at timestamptz)
returns integer
language sql
volatile
security definer
set search_path to 'public', 'extensions'
as $function$
  with back as (
    update public.invest_alerts a
       set last_triggered_at = x.prev,
           last_checked_at = null
      from unnest(coalesce(p_ids, '{}'::uuid[]), coalesce(p_prev, '{}'::timestamptz[])) as x(id, prev)
     where a.id = x.id
       and a.last_triggered_at = p_at
    returning 1
  )
  select count(*)::integer from back
$function$;
comment on function public.invest_alerts_release(uuid[], timestamptz[], timestamptz) is
  'Inversiones F4: devuelve reclamos de invest-alerts-check que no llegaron a ningún dispositivo (solo los marcados en p_at). Solo service_role.';

revoke all on function public.invest_alerts_mark_checked(uuid[], timestamptz) from public, anon, authenticated;
revoke all on function public.invest_alerts_claim(uuid[], timestamptz) from public, anon, authenticated;
revoke all on function public.invest_alerts_release(uuid[], timestamptz[], timestamptz) from public, anon, authenticated;
grant execute on function public.invest_alerts_mark_checked(uuid[], timestamptz) to service_role;
grant execute on function public.invest_alerts_claim(uuid[], timestamptz) to service_role;
grant execute on function public.invest_alerts_release(uuid[], timestamptz[], timestamptz) to service_role;
