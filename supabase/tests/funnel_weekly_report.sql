-- Prueba de la migración 20261020060000 (EST-9). Base LOCAL con el esquema de
-- producción, nunca producción: psql -v ON_ERROR_STOP=1 -f
begin;
do $$
declare
  wk date := date '2026-10-12';  -- lunes
  d jsonb; c jsonb;
begin
  insert into auth.users (id, email, created_at, last_sign_in_at) values
    (gen_random_uuid(), 'ana@t.local', '2026-10-13 10:00+00', '2026-10-14 10:00+00'),
    (gen_random_uuid(), 'walterlamadriz+x@gmail.com', '2026-10-13 10:00+00', '2026-10-13 10:00+00'),
    (gen_random_uuid(), 'bruno@t.local', '2026-10-06 10:00+00', '2026-10-18 23:00+00'),
    (gen_random_uuid(), 'carla@t.local', '2026-10-19 00:00+00', '2026-10-19 00:00+00');
  insert into public.licenses (key_hash, plan, status, email, created_at, is_trial, trial_ends_at, expires_at) values
    ('h1', 'pro', 'active', 'ana@t.local', '2026-10-14 10:00+00', true, '2026-10-28 10:00+00', '2026-10-28 10:00+00'),
    ('h2', 'pro', 'active', 'dani@t.local', '2026-10-15 10:00+00', false, null, '2026-11-15 10:00+00'),
    ('h3', 'pro', 'active', 'eva@t.local', '2026-09-29 10:00+00', true, '2026-10-13 10:00+00', '2026-11-13 10:00+00'),
    ('h4', 'pro', 'active', 'maxnovaluciglobal@gmail.com', '2026-10-15 10:00+00', false, null, null);
  insert into public.cancellation_requests (email, created_at, kind) values ('fede@t.local', '2026-10-16 10:00+00', 'ordinary');
  insert into public.starter_leads (email, created_at) values ('lead1@t.local', '2026-10-13 10:00+00'), ('test@t.local', '2026-10-13 11:00+00');

  c := public.funnel_report_metrics(wk);
  assert c->'visitas' = 'null'::jsonb, 'visitas sin dato: ' || c::text;
  assert (c->>'altas')::int = 1, 'altas sin internos ni fuera de semana: ' || c::text;
  assert (c->>'activas')::int = 2, 'activas (ana, bruno): ' || c::text;
  assert (c->>'pruebas')::int = 1, 'pruebas: ' || c::text;
  assert (c->>'pagos')::int = 2, 'pago directo + prueba convertida: ' || c::text;
  assert (c->>'bajas')::int = 1, 'bajas: ' || c::text;

  d := public.funnel_report_data(wk);
  assert (d->>'already_sent')::boolean = false, 'no enviado';
  assert (d->>'previous_is_snapshot')::boolean = false, 'anterior calculada';
  assert jsonb_array_length(d->'leads') = 1 and (d->'leads'->0->>'emails')::int = 1, 'leads por origen sin internos: ' || (d->'leads')::text;

  assert public.funnel_report_mark_sent(wk, c) = true, 'primera marca';
  assert public.funnel_report_mark_sent(wk, c) = false, 'no duplica';
  d := public.funnel_report_data(wk + 7);
  assert (d->>'previous_is_snapshot')::boolean and (d->'previous'->>'altas')::int = 1, 'usa la foto guardada';
  assert (public.funnel_report_data(wk)->>'already_sent')::boolean, 'ya enviado';

  assert not has_function_privilege('anon', 'public.funnel_report_data(date)', 'execute'), 'anon';
  assert not has_function_privilege('authenticated', 'public.funnel_report_mark_sent(date, jsonb)', 'execute'), 'authenticated';
  assert exists (select 1 from cron.job where jobname = 'funnel-weekly-report' and schedule = '2 15,16 * * 1'), 'job';
  raise notice 'funnel_weekly_report OK';
end $$;
rollback;
