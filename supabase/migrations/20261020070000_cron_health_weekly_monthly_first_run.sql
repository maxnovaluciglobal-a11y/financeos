-- 20261020070000_cron_health_weekly_monthly_first_run.sql
-- Auditoría 360 (LND-8, EST-9): un job semanal o mensual recién creado
-- figuraba como 'never_ran' (ok = false) hasta su primera corrida, y el aviso
-- diario de cron-health-alert lo reportaba como problema durante días. Ahora
-- un job sin corridas cuyo intervalo esperado es de 7 días o más cuenta como
-- ok; si después se atrasa, 'overdue' lo detecta igual (se mide desde su
-- primera corrida). Los jobs diarios o más frecuentes siguen igual.
-- Solo reemplaza la vista (mismas columnas). Idempotente.

create or replace view public.cron_health as
with last_run as (
  select distinct on (d.jobid) d.jobid, d.start_time, d.end_time, d.status, d.return_message
  from cron.job_run_details d
  order by d.jobid, d.start_time desc
),
last_http as (
  select distinct on (l.jobid) l.jobid, l.status_code, l.timed_out, l.error_msg, l.responded_at, l.run_started_at
  from public.cron_http_log l
  where l.jobid is not null
  order by l.jobid, l.responded_at desc
),
base as (
  select j.jobid,
         j.jobname,
         j.schedule,
         j.active,
         (j.command ~ 'net\.http_(post|get)' or j.jobname = 'uptime-check') as uses_http,
         public.cron_expected_interval(j.schedule) as expected_interval,
         lr.start_time as last_run_at,
         lr.status as last_run_status,
         left(lr.return_message, 200) as last_run_message,
         lh.status_code as last_http_status,
         lh.timed_out as last_http_timed_out,
         left(lh.error_msg, 200) as last_http_error,
         lh.responded_at as last_http_at,
         (lh.responded_at is not null and lr.start_time is not null
           and lh.responded_at >= lr.start_time - interval '1 second') as http_is_from_last_run
  from cron.job j
  left join last_run lr on lr.jobid = j.jobid
  left join last_http lh on lh.jobid = j.jobid
)
select b.*,
       (b.last_run_at is not null
         and now() - b.last_run_at > b.expected_interval + greatest(b.expected_interval / 4, interval '10 minutes')) as overdue,
       case
         when not b.active then 'paused'
         when b.last_run_at is null and b.expected_interval < interval '7 days' then 'never_ran'
         when now() - b.last_run_at > b.expected_interval + greatest(b.expected_interval / 4, interval '10 minutes') then 'overdue'
         when b.last_run_status = 'failed' then 'sql_failed'
         when b.last_run_status = 'running' and now() - b.last_run_at > interval '15 minutes' then 'stuck_running'
         when b.uses_http and not b.http_is_from_last_run and now() - b.last_run_at > interval '2 minutes' then 'no_http_response'
         when b.uses_http and b.http_is_from_last_run and coalesce(b.last_http_timed_out, false) then 'http_timeout'
         when b.uses_http and b.http_is_from_last_run and (b.last_http_status is null or b.last_http_status not between 200 and 299) then 'http_error'
         else null
       end as problem,
       case
         when not b.active then true
         when b.last_run_at is null then b.expected_interval >= interval '7 days'
         when now() - b.last_run_at > b.expected_interval + greatest(b.expected_interval / 4, interval '10 minutes') then false
         when b.last_run_status = 'failed' then false
         when b.last_run_status = 'running' and now() - b.last_run_at > interval '15 minutes' then false
         when b.uses_http and not b.http_is_from_last_run and now() - b.last_run_at > interval '2 minutes' then false
         when b.uses_http and b.http_is_from_last_run
              and (coalesce(b.last_http_timed_out, false) or b.last_http_status is null or b.last_http_status not between 200 and 299) then false
         else true
       end as ok
from base b;
comment on view public.cron_health is
  'Un renglón por job de pg_cron: última corrida, estado SQL, último código HTTP (de cron_http_log) y ok. Llamar antes a cron_health_snapshot() para tener las respuestas recientes. Solo service_role.';

revoke all on public.cron_health from public, anon, authenticated;
grant select on public.cron_health to service_role;
