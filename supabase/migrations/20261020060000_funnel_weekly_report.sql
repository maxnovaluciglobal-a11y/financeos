-- 20261020060000_funnel_weekly_report.sql
-- Auditoría 360, EST-9 (parte de Claude): reporte semanal de los 6 números del
-- embudo, por correo, solo a la cuenta de empresa.
--
-- 1. private.is_internal_email(email): la misma regla que la columna generada
--    is_internal de los leads (C-14), para tablas que no la tienen (auth.users,
--    licenses, cancellation_requests).
-- 2. funnel_report_runs: la foto de cada semana enviada. La variación se
--    calcula contra la foto de la semana anterior (las métricas de "sesión en
--    la semana" cambian con el tiempo y no se pueden recalcular después).
-- 3. funnel_report_data(week_start): los 6 números de la semana [lunes, lunes+7)
--    en UTC, sin internos, más los leads por origen de private.funnel_weekly.
--    Visitas queda en null: la base no las ve (Vercel Web Analytics).
-- 4. funnel_report_mark_sent(week_start, metrics): guarda la foto (una vez).
-- 5. Job 'funnel-weekly-report' los lunes a las 15:02 y 16:02 UTC: la función
--    solo envía en la corrida que cae a las 12 en Chile (horario de verano o
--    no) y nunca dos veces la misma semana.
--
-- Solo service_role. Aditiva e idempotente.

create schema if not exists private;

create or replace function private.is_internal_email(p_email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(lower(p_email), '') ~ '(walterlamadriz|maxnovaluciglobal|lamadriz)|@example\.(com|net|org)$|(^|[._+-])(test|prueba)[0-9]*([._+@-]|$)'
$$;
revoke all on function private.is_internal_email(text) from public, anon, authenticated;

create table if not exists public.funnel_report_runs (
  week_start date primary key,
  metrics    jsonb not null,
  sent_at    timestamptz not null default now()
);
comment on table public.funnel_report_runs is
  'EST-9: foto de los 6 números del embudo de cada semana ya enviada por send-funnel-report. Sin datos personales.';
alter table public.funnel_report_runs enable row level security;
revoke all on public.funnel_report_runs from public, anon, authenticated;
grant select, insert on public.funnel_report_runs to service_role;

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
    'pruebas', (select count(*) from public.licenses l, r
                 where l.is_trial and l.created_at >= r.d0 and l.created_at < r.d1 and not private.is_internal_email(l.email)),
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

create or replace function public.funnel_report_data(p_week_start date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'week_start', p_week_start,
    'current', public.funnel_report_metrics(p_week_start),
    'previous', coalesce((select metrics from public.funnel_report_runs where week_start = p_week_start - 7),
                         public.funnel_report_metrics(p_week_start - 7)),
    'previous_is_snapshot', exists (select 1 from public.funnel_report_runs where week_start = p_week_start - 7),
    'already_sent', exists (select 1 from public.funnel_report_runs where week_start = p_week_start),
    'leads', coalesce((select jsonb_agg(jsonb_build_object('etapa', f.etapa, 'emails', f.emails, 'confirmados', f.confirmados) order by f.etapa)
                         from private.funnel_weekly f where f.semana = p_week_start and f.emails > 0), '[]'::jsonb),
    'leads_previous', coalesce((select jsonb_agg(jsonb_build_object('etapa', f.etapa, 'emails', f.emails, 'confirmados', f.confirmados) order by f.etapa)
                         from private.funnel_weekly f where f.semana = p_week_start - 7 and f.emails > 0), '[]'::jsonb)
  )
$$;
revoke all on function public.funnel_report_data(date) from public, anon, authenticated;
grant execute on function public.funnel_report_data(date) to service_role;

create or replace function public.funnel_report_mark_sent(p_week_start date, p_metrics jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.funnel_report_runs (week_start, metrics) values (p_week_start, p_metrics)
  on conflict (week_start) do nothing;
  return found;
end;
$$;
revoke all on function public.funnel_report_mark_sent(date, jsonb) from public, anon, authenticated;
grant execute on function public.funnel_report_mark_sent(date, jsonb) to service_role;

do $$ begin
  perform cron.unschedule('funnel-weekly-report');
exception when others then null; end $$;

select cron.schedule(
  'funnel-weekly-report',
  '2 15,16 * * 1',
  $$
  select net.http_post(
    url := 'https://nelwgbcddwiaimzbcuas.supabase.co/functions/v1/send-funnel-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(private.get_secret('cron_secret'), '')
    ),
    body := jsonb_build_object('mode', 'cron'),
    timeout_milliseconds := 30000
  );
  $$
);
