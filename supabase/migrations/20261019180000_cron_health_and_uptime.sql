-- Auditoría 360 (19-oct-2026): C-12 parte b (OPS-3 / DAT-13) y C-11 (OPS-2).
--
-- 1) cron_health: pg_cron marca "succeeded" aunque la llamada HTTP de un job
--    devuelva 401 (pasó con starter-nurture-daily del 08 al 18-oct). pg_net
--    guarda las respuestas solo 6 h (pg_net.ttl) y net._http_response no tiene
--    la URL, así que cron_health_snapshot() (cada hora) copia las respuestas a
--    cron_http_log y las atribuye al job por ventana de tiempo (cada job HTTP
--    corre a un minuto distinto). La vista cron_health resume cada job y la
--    Edge Function cron-health-alert manda un correo diario si algo falla.
--
-- 2) Uptime sin cuentas externas: uptime-check (cada 5 min) evalúa las
--    respuestas de la corrida anterior, lanza un net.http_get por sitio y llama
--    a la Edge Function uptime-alert, que guarda el estado por sitio y avisa
--    por correo (caída tras 2 fallas seguidas, recuperación, recordatorio cada
--    6 h). Cómo apagarlo: docs/monitoreo.md.
--
-- Todo es solo para service_role: anon y authenticated no ven nada.

-- === 1. cron_health ==========================================================

create table if not exists public.cron_http_log (
  request_id     bigint primary key,
  jobid          bigint,
  jobname        text,
  run_started_at timestamptz,
  status_code    integer,
  timed_out      boolean,
  error_msg      text,
  content_head   text,
  responded_at   timestamptz not null,
  logged_at      timestamptz not null default now()
);
create index if not exists cron_http_log_job_idx on public.cron_http_log (jobid, responded_at desc);
create index if not exists cron_http_log_responded_idx on public.cron_http_log (responded_at desc);
comment on table public.cron_http_log is
  'Copia de net._http_response (que pg_net borra a las 6 h) atribuida al job de pg_cron que hizo la llamada. Lo llena cron_health_snapshot(). Sin datos personales; se purga a los 90 días.';

create table if not exists public.uptime_sites (
  site    text primary key,
  url     text not null,
  marker  text not null,
  enabled boolean not null default true
);
comment on table public.uptime_sites is
  'Sitios que vigila uptime-check. Un sitio está arriba si responde 200 y el cuerpo contiene marker. Para pausar uno: enabled = false (docs/monitoreo.md).';

insert into public.uptime_sites (site, url, marker) values
  ('app.moyiq.app',    'https://app.moyiq.app/app/',  'id="root"'),
  ('demo.moyiq.app',   'https://demo.moyiq.app/app/', 'id="root"'),
  ('moyiq.app',        'https://moyiq.app/',          '<title>MOY IQ'),
  ('invest.moyiq.app', 'https://invest.moyiq.app/',   '<title>MOY IQ Invest')
on conflict (site) do nothing;

create table if not exists public.uptime_checks (
  id           bigserial primary key,
  site         text not null references public.uptime_sites(site) on delete cascade,
  url          text not null,
  marker       text not null,
  request_id   bigint,
  requested_at timestamptz not null default now(),
  evaluated_at timestamptz,
  status_code  integer,
  timed_out    boolean,
  error_msg    text,
  marker_found boolean,
  ok           boolean
);
create index if not exists uptime_checks_site_idx on public.uptime_checks (site, id desc);
create index if not exists uptime_checks_request_idx on public.uptime_checks (request_id);
create index if not exists uptime_checks_pending_idx on public.uptime_checks (requested_at) where evaluated_at is null;
comment on table public.uptime_checks is
  'Una fila por chequeo de uptime (pg_net). ok = status 200, sin timeout y con el marker del sitio en el cuerpo. Se purga a los 30 días.';

create table if not exists public.uptime_ticks (
  id               bigserial primary key,
  ran_at           timestamptz not null default now(),
  alert_request_id bigint
);
create index if not exists uptime_ticks_request_idx on public.uptime_ticks (alert_request_id);
comment on table public.uptime_ticks is
  'Cada corrida de uptime-check con el id de pg_net de su llamada a uptime-alert, para atribuir esa respuesta al job en cron_http_log. Se purga a los 7 días.';

create table if not exists public.uptime_state (
  site                 text primary key references public.uptime_sites(site) on delete cascade,
  status               text not null default 'up' check (status in ('up', 'down')),
  consecutive_failures integer not null default 0,
  down_since           timestamptz,
  last_alert_at        timestamptz,
  last_change_at       timestamptz,
  last_check_id        bigint,
  updated_at           timestamptz not null default now()
);
comment on table public.uptime_state is
  'Estado por sitio que mantiene la Edge Function uptime-alert (evita repetir avisos).';

alter table public.cron_http_log enable row level security;
alter table public.uptime_sites  enable row level security;
alter table public.uptime_checks enable row level security;
alter table public.uptime_ticks  enable row level security;
alter table public.uptime_state  enable row level security;

revoke all on public.cron_http_log, public.uptime_sites, public.uptime_checks, public.uptime_ticks, public.uptime_state
  from public, anon, authenticated;
grant select, insert, update, delete on public.cron_http_log, public.uptime_sites, public.uptime_checks, public.uptime_ticks, public.uptime_state
  to service_role;
revoke all on sequence public.uptime_checks_id_seq, public.uptime_ticks_id_seq from public, anon, authenticated;
grant usage, select on sequence public.uptime_checks_id_seq, public.uptime_ticks_id_seq to service_role;

-- Intervalo esperado entre corridas según el cron (solo las formas que se usan
-- acá; cualquier otra se trata como diaria).
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
    when p_schedule ~ '^[0-9]+ [0-9]+ \* \* \*$' then interval '1 day'
    when p_schedule ~ '^[0-9]+ [0-9]+ \* \* [0-9,-]+$' then interval '7 days'
    else interval '1 day'
  end;
$$;

create or replace function public.cron_health_snapshot()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
  v_uptime_job bigint;
begin
  select jobid into v_uptime_job from cron.job where jobname = 'uptime-check' limit 1;

  insert into public.cron_http_log
    (request_id, jobid, jobname, run_started_at, status_code, timed_out, error_msg, content_head, responded_at)
  select r.id,
         coalesce(case when t.id is not null then v_uptime_job end, m.jobid),
         coalesce(case when t.id is not null then 'uptime-check' end, m.jobname),
         coalesce(t.ran_at, m.start_time),
         r.status_code,
         r.timed_out,
         left(r.error_msg, 300),
         left(r.content, 300),
         r.created
  from net._http_response r
  left join public.uptime_ticks t on t.alert_request_id = r.id
  left join lateral (
    select d.jobid, j.jobname, d.start_time
    from cron.job_run_details d
    join cron.job j on j.jobid = d.jobid
    where t.id is null
      and j.command ~ 'net\.http_(post|get)'
      and d.start_time <= r.created + interval '1 second'
      and r.created <= coalesce(d.end_time, d.start_time) + interval '60 seconds'
    order by d.start_time desc
    limit 1
  ) m on true
  where not exists (select 1 from public.cron_http_log l where l.request_id = r.id)
    and not exists (select 1 from public.uptime_checks c where c.request_id = r.id)
  on conflict (request_id) do nothing;
  get diagnostics v_inserted = row_count;

  delete from public.cron_http_log where responded_at < now() - interval '90 days';
  delete from cron.job_run_details where end_time < now() - interval '30 days';

  return v_inserted;
end;
$$;

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
         when b.last_run_at is null then 'never_ran'
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
         when b.last_run_at is null then false
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

-- === 2. Uptime ===============================================================

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
         marker_found = coalesce(strpos(r.content, c.marker) > 0, false),
         ok           = (r.status_code = 200
                         and not coalesce(r.timed_out, false)
                         and coalesce(strpos(r.content, c.marker) > 0, false))
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

create or replace function public.uptime_tick()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evaluated integer;
  v_fired integer := 0;
  v_alert bigint;
  s record;
begin
  v_evaluated := public.uptime_evaluate();

  for s in select site, url, marker from public.uptime_sites where enabled order by site loop
    insert into public.uptime_checks (site, url, marker, request_id)
    values (s.site, s.url, s.marker,
            net.http_get(
              url := s.url,
              headers := jsonb_build_object('User-Agent', 'moyiq-uptime/1 (supabase pg_net)'),
              timeout_milliseconds := 10000));
    v_fired := v_fired + 1;
  end loop;

  v_alert := net.http_post(
    url := 'https://nelwgbcddwiaimzbcuas.supabase.co/functions/v1/uptime-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(private.get_secret('cron_secret'), '')
    ),
    body := jsonb_build_object('mode', 'cron'),
    timeout_milliseconds := 15000
  );
  insert into public.uptime_ticks (alert_request_id) values (v_alert);

  delete from public.uptime_checks where requested_at < now() - interval '30 days';
  delete from public.uptime_ticks where ran_at < now() - interval '7 days';

  return jsonb_build_object('evaluated', v_evaluated, 'fired', v_fired);
end;
$$;

create or replace view public.uptime_status as
with last_check as (
  select distinct on (c.site) c.site, c.id, c.requested_at, c.status_code, c.timed_out, c.error_msg, c.marker_found, c.ok
  from public.uptime_checks c
  where c.evaluated_at is not null
  order by c.site, c.id desc
),
day as (
  select c.site,
         count(*) as checks_24h,
         count(*) filter (where not c.ok) as failures_24h,
         max(c.requested_at) filter (where c.ok) as last_ok_at
  from public.uptime_checks c
  where c.evaluated_at is not null
    and c.requested_at > now() - interval '24 hours'
  group by c.site
)
select s.site,
       s.url,
       s.enabled,
       coalesce(st.status, 'up') as status,
       st.down_since,
       st.consecutive_failures,
       st.last_alert_at,
       lc.requested_at as last_check_at,
       lc.ok as last_check_ok,
       lc.status_code as last_status_code,
       lc.timed_out as last_timed_out,
       lc.marker_found as last_marker_found,
       lc.error_msg as last_error,
       d.last_ok_at,
       coalesce(d.checks_24h, 0) as checks_24h,
       coalesce(d.failures_24h, 0) as failures_24h,
       case when coalesce(d.checks_24h, 0) = 0 then null
            else round(100.0 * (d.checks_24h - d.failures_24h) / d.checks_24h, 2) end as uptime_pct_24h
from public.uptime_sites s
left join public.uptime_state st on st.site = s.site
left join last_check lc on lc.site = s.site
left join day d on d.site = s.site;
comment on view public.uptime_status is
  'Estado de cada sitio vigilado: último chequeo, fallas y % de uptime en 24 h. Solo service_role. Ver docs/monitoreo.md.';

revoke all on public.cron_health, public.uptime_status from public, anon, authenticated;
grant select on public.cron_health, public.uptime_status to service_role;

revoke all on function public.cron_expected_interval(text) from public, anon, authenticated;
revoke all on function public.cron_health_snapshot() from public, anon, authenticated;
revoke all on function public.uptime_evaluate() from public, anon, authenticated;
revoke all on function public.uptime_tick() from public, anon, authenticated;
grant execute on function public.cron_expected_interval(text) to service_role;
grant execute on function public.cron_health_snapshot() to service_role;
grant execute on function public.uptime_evaluate() to service_role;
grant execute on function public.uptime_tick() to service_role;

-- === 3. Jobs =================================================================

do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid) from cron.job
     where jobname in ('cron-health-snapshot', 'cron-health-alert-daily', 'uptime-check');
  end if;
end
$$;

select cron.schedule('cron-health-snapshot', '7 * * * *', $$select public.cron_health_snapshot();$$);

-- 15:03 UTC: después de los jobs HTTP de las 14:00-14:37 UTC y fuera de los
-- minutos múltiplos de 5 de uptime-check.
select cron.schedule(
  'cron-health-alert-daily',
  '3 15 * * *',
  $$
  select net.http_post(
    url := 'https://nelwgbcddwiaimzbcuas.supabase.co/functions/v1/cron-health-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(private.get_secret('cron_secret'), '')
    ),
    body := jsonb_build_object('mode', 'cron'),
    timeout_milliseconds := 15000
  );
  $$
);

select cron.schedule('uptime-check', '*/5 * * * *', $$select public.uptime_tick();$$);
