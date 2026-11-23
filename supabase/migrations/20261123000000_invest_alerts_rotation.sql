-- Inversiones F4, revisión del 23-nov-2026: que ninguna cuenta deje a otras
-- sin revisar. invest-alerts-check lee hasta 5000 alertas y cotiza hasta 400
-- símbolos por corrida; antes las leía por created_at, así que las cuentas más
-- viejas (o símbolos sin cotización que nunca salían de la fila) ocupaban
-- siempre los mismos lugares.
--
--   1. invest_alerts.last_checked_at: última corrida que pidió el precio de la
--      alerta (haya tenido precio o no). La función ordena por esta columna
--      (nulls first), así cada corrida empieza por las que hace más que no se
--      revisan, y reparte los símbolos por cuenta antes del tope de 400.
--   2. public.invest_alerts_mark_checked(uuid[], timestamptz): la función la
--      llama con los ids revisados (un POST en vez de cientos de PATCH con
--      ids en la URL). Solo service_role.
--
-- Solo agrega: no cambia filas ni políticas. Requiere 20261120000100.

alter table public.invest_alerts add column if not exists last_checked_at timestamptz;

create index if not exists invest_alerts_rotation_idx
  on public.invest_alerts (last_checked_at asc nulls first, created_at)
  where active;

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

revoke all on function public.invest_alerts_mark_checked(uuid[], timestamptz) from public, anon, authenticated;
grant execute on function public.invest_alerts_mark_checked(uuid[], timestamptz) to service_role;
