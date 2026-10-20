-- Prueba de la migración 20261020050000 (LND-8). Base LOCAL con el esquema de
-- producción, nunca producción: psql -v ON_ERROR_STOP=1 -f
begin;
do $$
declare r jsonb; n int;
begin
  -- Viejo sin confirmar (se borra), viejo confirmado, viejo con cuenta, nuevo
  -- sin confirmar y viejo dado de baja (no se borran en este job).
  insert into public.starter_leads (email, created_at) values ('old@t.local', now() - interval '13 months');
  insert into public.starter_leads (email, created_at, consent_confirmed_at) values ('okc@t.local', now() - interval '13 months', now() - interval '13 months');
  insert into public.starter_leads (email, created_at, account_created_at) values ('acct@t.local', now() - interval '13 months', now() - interval '13 months');
  insert into public.starter_leads (email, created_at) values ('new@t.local', now() - interval '11 months');
  insert into public.starter_leads (email, created_at, unsubscribed_at, consent_confirmed_at) values ('bye@t.local', now() - interval '13 months', now() - interval '60 days', now() - interval '13 months');
  insert into public.diagnostico_leads (email, created_at) values ('d-old@t.local', now() - interval '400 days');
  insert into public.invest_leads (email, created_at) values ('i-old@t.local', now() - interval '400 days');
  insert into public.demo_leads (email, nombre, created_at) values ('m-old@t.local', 'x', now() - interval '400 days');
  insert into public.tax_calculator_leads (email, created_at) values ('tax-old@t.local', now() - interval '400 days');

  r := public.purge_unconfirmed_leads();
  assert (r->>'total')::int = 4, 'borra 4: ' || r::text;
  assert (r->'deleted'->>'starter_leads')::int = 1, 'starter: ' || r::text;
  assert not exists (select 1 from public.starter_leads where email = 'old@t.local'), 'viejo sin confirmar borrado';
  select count(*) into n from public.starter_leads where email in ('okc@t.local', 'acct@t.local', 'new@t.local', 'bye@t.local');
  assert n = 4, 'los demás quedan: ' || n;
  assert exists (select 1 from public.tax_calculator_leads where email = 'tax-old@t.local'), 'calculadora fuera (LND-9)';
  assert (select total from public.leads_retention_runs order by id desc limit 1) = 4, 'corrida registrada';
  -- Segunda corrida: nada que borrar.
  r := public.purge_unconfirmed_leads();
  assert (r->>'total')::int = 0, 'idempotente';
  -- Sin acceso para anon/authenticated.
  assert not has_function_privilege('anon', 'public.purge_unconfirmed_leads()', 'execute'), 'anon sin execute';
  assert not has_function_privilege('authenticated', 'public.purge_unconfirmed_leads()', 'execute'), 'authenticated sin execute';
  assert not has_table_privilege('anon', 'public.leads_retention_runs', 'select'), 'anon sin select';
  -- Job mensual y cron_health lo espera cada 31 días.
  assert exists (select 1 from cron.job where jobname = 'leads-retention-monthly' and schedule = '17 6 1 * *'), 'job';
  assert public.cron_expected_interval('17 6 1 * *') = interval '31 days', 'mensual';
  assert (select ok and problem is null from public.cron_health where jobname = 'leads-retention-monthly'), 'cron_health no lo da por fallado antes de su primera corrida (20261020070000)';
  assert public.cron_expected_interval('0 15,16 * * 1') = interval '7 days', 'semanal con 2 horas';
  assert public.cron_expected_interval('47 14 * * *') = interval '1 day', 'diario sin cambios';
  assert public.cron_expected_interval('*/10 * * * *') = interval '10 minutes', 'cada 10 min sin cambios';
  raise notice 'leads_retention_purge OK';
end $$;
rollback;
