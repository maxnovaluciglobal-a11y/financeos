-- Auditoría 360, C-11 / OPS-2 (21-oct-2026): lo que faltaba del monitoreo.
--
-- 1) Errores de Edge Functions: public.edge_function_errors. Cada función
--    envuelve su handler con _shared/errorReport.ts (withErrorReporting): si
--    lanza o responde 5xx, guarda una fila (función, status, mensaje limpio de
--    correos/claves/tokens, cortado a 300). uptime-alert (cada 5 min) manda un
--    resumen a maxnovaluciglobal@gmail.com, como máximo cada 30 min, y marca
--    notified_at. Antes, un 500 de una función llamada por el navegador, Stripe
--    o Auth solo quedaba en los logs del dashboard.
-- 2) Uptime con status esperado por sitio (uptime_sites.expected_status, 200 por
--    defecto) para vigilar dos cosas que no responden 200 a un GET:
--      stripe-webhook   → 400 "Webhook signature verification failed" (arrancó y
--                         verifica firmas; un 5xx o un BOOT_ERROR es caída)
--      newsletter-proxy → 405 {"error":"method_not_allowed"} en /api/subscribe
--
-- Aplicar: supabase db query --linked -f <este archivo> + supabase migration
-- repair --status applied 20261021000000 --linked. Idempotente.

-- === 1. Errores de Edge Functions ============================================

create table if not exists public.edge_function_errors (
  id          bigserial primary key,
  fn          text not null check (length(fn) between 1 and 64),
  status      integer,
  message     text check (message is null or length(message) <= 500),
  created_at  timestamptz not null default now(),
  notified_at timestamptz
);
create index if not exists edge_function_errors_pending_idx on public.edge_function_errors (id) where notified_at is null;
create index if not exists edge_function_errors_notified_idx on public.edge_function_errors (notified_at desc) where notified_at is not null;
create index if not exists edge_function_errors_created_idx on public.edge_function_errors (created_at);
comment on table public.edge_function_errors is
  'Excepciones y respuestas 5xx de las Edge Functions (las guarda _shared/errorReport.ts). uptime-alert avisa a la casilla de la empresa y marca notified_at. Sin datos personales (mensaje limpio). Se purga a los 30 días. Solo service_role. Ver docs/monitoreo.md.';

alter table public.edge_function_errors enable row level security;
revoke all on public.edge_function_errors from public, anon, authenticated;
grant select, insert, update, delete on public.edge_function_errors to service_role;
revoke all on sequence public.edge_function_errors_id_seq from public, anon, authenticated;
grant usage, select on sequence public.edge_function_errors_id_seq to service_role;

-- === 2. Uptime con status esperado ===========================================

alter table public.uptime_sites  add column if not exists expected_status integer not null default 200;
alter table public.uptime_checks add column if not exists expected_status integer not null default 200;
comment on table public.uptime_sites is
  'Sitios que vigila uptime-check. Un sitio está arriba si responde expected_status (200 por defecto) y el cuerpo contiene marker. Para pausar uno: enabled = false (docs/monitoreo.md).';

insert into public.uptime_sites (site, url, marker, expected_status) values
  ('stripe-webhook',   'https://nelwgbcddwiaimzbcuas.supabase.co/functions/v1/stripe-webhook', 'Webhook signature verification failed', 400),
  ('newsletter-proxy', 'https://moyiq-newsletter-proxy.vercel.app/api/subscribe',             'method_not_allowed',                    405)
on conflict (site) do update
  set url = excluded.url, marker = excluded.marker, expected_status = excluded.expected_status;

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
         ok           = (r.status_code = c.expected_status
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

  for s in select site, url, marker, expected_status from public.uptime_sites where enabled order by site loop
    insert into public.uptime_checks (site, url, marker, expected_status, request_id)
    values (s.site, s.url, s.marker, s.expected_status,
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
  delete from public.edge_function_errors where created_at < now() - interval '30 days';

  return jsonb_build_object('evaluated', v_evaluated, 'fired', v_fired);
end;
$$;

revoke all on function public.uptime_evaluate() from public, anon, authenticated;
revoke all on function public.uptime_tick() from public, anon, authenticated;
