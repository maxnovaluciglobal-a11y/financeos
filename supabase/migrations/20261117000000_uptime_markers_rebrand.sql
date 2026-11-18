-- Monitor de uptime: aceptar el nombre nuevo (moyiq) y el viejo (MOY IQ)
-- durante la transición del rebranding (Entrega 1, 17-nov-2026).
--
-- Antes: un sitio estaba arriba si el cuerpo contenía uptime_sites.marker tal
-- cual (strpos, sensible a mayúsculas). La landing y Invest cambian su <title>
-- ("Moyiq (antes MOY IQ) — …", "moyiq · Inversiones (antes MOY IQ Invest) …"),
-- así que '<title>MOY IQ' y '<title>MOY IQ Invest' dejarían de aparecer y el
-- monitor daría una caída falsa en cuanto se publiquen.
--
-- Ahora:
--   1. public.uptime_marker_found(contenido, marker): el marker admite varias
--      alternativas separadas por '||' y la comparación ignora mayúsculas. Basta
--      con que aparezca una. Los markers existentes (sin '||') siguen igual,
--      solo que sin distinguir mayúsculas.
--   2. uptime_evaluate() usa esa función en lugar de strpos.
--   3. Markers de moyiq.app e invest.moyiq.app: el título nuevo O el viejo.
--      Al terminar la transición se puede dejar solo '<title>moyiq'.
--
-- Test: supabase/tests/uptime_markers.sql (job `db` del CI).

create or replace function public.uptime_marker_found(p_content text, p_marker text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_or(strpos(lower(p_content), lower(btrim(alt))) > 0), false)
    from unnest(string_to_array(coalesce(p_marker, ''), '||')) as alt
   where btrim(alt) <> ''
$$;

comment on function public.uptime_marker_found(text, text) is
  'true si p_content contiene alguna de las alternativas de p_marker (separadas por ||), sin distinguir mayúsculas. La usa uptime_evaluate().';

revoke all on function public.uptime_marker_found(text, text) from public, anon, authenticated;
grant execute on function public.uptime_marker_found(text, text) to service_role;

create or replace function public.uptime_evaluate()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_done integer;
  v_lost integer;
begin
  update public.uptime_checks c
     set evaluated_at = now(),
         status_code  = r.status_code,
         timed_out    = coalesce(r.timed_out, false),
         error_msg    = left(r.error_msg, 300),
         marker_found = public.uptime_marker_found(r.content, c.marker),
         ok           = (r.status_code = c.expected_status
                         and not coalesce(r.timed_out, false)
                         and public.uptime_marker_found(r.content, c.marker))
    from net._http_response r
   where r.id = c.request_id
     and c.evaluated_at is null;
  get diagnostics v_done = row_count;

  update public.uptime_checks
     set evaluated_at = now(),
         timed_out    = true,
         error_msg    = coalesce(error_msg, 'no response recorded by pg_net'),
         marker_found = false,
         ok           = false
   where evaluated_at is null
     and requested_at < now() - interval '2 minutes';
  get diagnostics v_lost = row_count;

  return v_done + v_lost;
end;
$$;

revoke all on function public.uptime_evaluate() from public, anon, authenticated;

update public.uptime_sites set marker = '<title>moyiq||<title>MOY IQ'
 where site = 'moyiq.app';
update public.uptime_sites set marker = '<title>moyiq||<title>MOY IQ Invest'
 where site = 'invest.moyiq.app';

comment on table public.uptime_sites is
  'Sitios que vigila uptime-check. Un sitio está arriba si responde expected_status y el cuerpo contiene marker (alternativas separadas por ||, sin distinguir mayúsculas; uptime_marker_found). Para pausar uno: enabled = false (docs/monitoreo.md).';
