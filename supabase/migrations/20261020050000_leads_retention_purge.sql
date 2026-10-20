-- 20261020050000_leads_retention_purge.sql
-- Auditoría 360, LND-8 (D-18): la política publicada dice que un lead que
-- nunca confirmó el doble opt-in ni creó cuenta se guarda como máximo 12
-- meses, pero no había borrado automático (solo la vista
-- leads_retention_candidates, C-23).
--
-- 1. leads_retention_runs: una fila por corrida con los conteos (sin emails).
-- 2. purge_unconfirmed_leads(): borra de starter/diagnostico/invest/demo_leads
--    las filas que la vista marca 'sin_confirmar_mas_de_12_meses'.
--    Fuera de este job, a propósito:
--      - tax_calculator_leads: su tratamiento (LND-9) espera el OK de Walter.
--      - bajas de más de 30 días: falta decidir la lista de supresión (D-18).
-- 3. Job mensual 'leads-retention-monthly' (día 1, 06:17 UTC).
-- 4. cron_expected_interval reconoce los horarios mensuales y las listas de
--    horas (antes caían en "diario" y cron_health los daba por atrasados).
--
-- Aditiva e idempotente. Al aplicarla (20-oct-2026) la vista devolvía 0 filas:
-- los leads más viejos son del 12-sep-2026, así que el primer borrado real
-- sería en septiembre de 2027.

create table if not exists public.leads_retention_runs (
  id         bigserial primary key,
  ran_at     timestamptz not null default now(),
  deleted    jsonb not null,
  total      integer not null
);
comment on table public.leads_retention_runs is
  'Una fila por corrida de purge_unconfirmed_leads() (LND-8): cuántos leads sin confirmar de más de 12 meses se borraron por tabla. Sin datos personales.';
alter table public.leads_retention_runs enable row level security;
revoke all on public.leads_retention_runs from public, anon, authenticated;
grant select, insert on public.leads_retention_runs to service_role;
revoke all on sequence public.leads_retention_runs_id_seq from public, anon, authenticated;
grant usage, select on sequence public.leads_retention_runs_id_seq to service_role;

create or replace function public.purge_unconfirmed_leads()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text;
  n integer;
  v_total integer := 0;
  v_deleted jsonb := '{}'::jsonb;
begin
  foreach t in array array['starter_leads', 'diagnostico_leads', 'invest_leads', 'demo_leads'] loop
    execute format(
      'delete from public.%I where id in (select id from public.leads_retention_candidates where tabla = %L and motivo = %L)',
      t, t, 'sin_confirmar_mas_de_12_meses');
    get diagnostics n = row_count;
    v_deleted := v_deleted || jsonb_build_object(t, n);
    v_total := v_total + n;
  end loop;
  insert into public.leads_retention_runs (deleted, total) values (v_deleted, v_total);
  delete from public.leads_retention_runs where ran_at < now() - interval '3 years';
  return jsonb_build_object('deleted', v_deleted, 'total', v_total);
end;
$$;

comment on function public.purge_unconfirmed_leads() is
  'LND-8 / D-18: borra los leads que nunca confirmaron el doble opt-in ni crearon cuenta, con más de 12 meses (según leads_retention_candidates). No toca tax_calculator_leads ni las bajas. Lo corre el job mensual leads-retention-monthly.';
revoke all on function public.purge_unconfirmed_leads() from public, anon, authenticated;
grant execute on function public.purge_unconfirmed_leads() to service_role;

create or replace function public.cron_expected_interval(p_schedule text)
returns interval
language sql
immutable
set search_path = ''
as $$
  select case
    when p_schedule ~ '^\*/[0-9]+ \* \* \* \*$'
      then make_interval(mins => substring(p_schedule from '^\*/([0-9]+)')::int)
    when p_schedule ~ '^\* \* \* \* \*$' then interval '1 minute'
    when p_schedule ~ '^[0-9]+ \* \* \* \*$' then interval '1 hour'
    when p_schedule ~ '^[0-9]+ [0-9,]+ \* \* \*$' then interval '1 day'
    when p_schedule ~ '^[0-9]+ [0-9,]+ \* \* [0-9,-]+$' then interval '7 days'
    when p_schedule ~ '^[0-9]+ [0-9,]+ [0-9]+ \* \*$' then interval '31 days'
    else interval '1 day'
  end;
$$;

do $$ begin
  perform cron.unschedule('leads-retention-monthly');
exception when others then null; end $$;

select cron.schedule('leads-retention-monthly', '17 6 1 * *', $$select public.purge_unconfirmed_leads()$$);
