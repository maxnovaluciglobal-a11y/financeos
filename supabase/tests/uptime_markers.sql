-- Prueba de la migración 20261117000000 (monitor de uptime durante el
-- rebranding: título nuevo "moyiq" o viejo "MOY IQ"). Base LOCAL, nunca producción.
begin;
do $$
declare
  m_landing text := (select marker from public.uptime_sites where site = 'moyiq.app');
  m_invest  text := (select marker from public.uptime_sites where site = 'invest.moyiq.app');
  m_app     text := (select marker from public.uptime_sites where site = 'app.moyiq.app');
  req bigint;
  chk record;
begin
  -- Landing: título viejo, el de transición y el definitivo.
  assert public.uptime_marker_found('<head><title>MOY IQ — Finanzas Personales Privada</title>', m_landing), 'landing vieja';
  assert public.uptime_marker_found('<title>Moyiq (antes MOY IQ) — Finanzas personales privadas, gratis</title>', m_landing), 'landing de transición';
  assert public.uptime_marker_found('<title>moyiq — Finanzas personales</title>', m_landing), 'landing definitiva';
  assert not public.uptime_marker_found('<title>404: NOT_FOUND</title>', m_landing), 'página de error de Vercel';

  -- Invest: viejo y nuevo.
  assert public.uptime_marker_found('<title>MOY IQ Invest · Portafolio, riesgo e indicadores en español</title>', m_invest), 'invest vieja';
  assert public.uptime_marker_found('<title>moyiq · Inversiones (antes MOY IQ Invest): portafolio</title>', m_invest), 'invest nueva';
  assert not public.uptime_marker_found('<title>Deployment not found</title>', m_invest), 'invest caída';

  -- Los markers de siempre siguen funcionando (sin '||').
  assert m_app = 'id="root"', 'marker de la app sin cambios';
  assert public.uptime_marker_found('<div id="root"></div>', m_app), 'app';
  assert public.uptime_marker_found('Webhook signature verification failed', 'Webhook signature verification failed'), 'webhook';

  -- Bordes: sin contenido, marker vacío o con alternativas vacías.
  assert not public.uptime_marker_found(null, m_landing), 'contenido nulo';
  assert not public.uptime_marker_found('<title>moyiq', ''), 'marker vacío no da arriba';
  assert not public.uptime_marker_found('<title>moyiq', '||'), 'solo separadores';
  assert public.uptime_marker_found('abc', ' || B '), 'alternativas con espacios';

  -- De punta a punta: uptime_evaluate() marca arriba un título de transición.
  insert into net._http_response (id, status_code, content, timed_out, created)
  values (-424242, 200, '<title>Moyiq (antes MOY IQ) — x</title>', false, now())
  returning id into req;
  insert into public.uptime_checks (site, url, marker, expected_status, request_id)
  values ('moyiq.app', 'https://moyiq.app/', m_landing, 200, req);
  perform public.uptime_evaluate();
  select ok, marker_found into chk from public.uptime_checks where request_id = req;
  assert chk.ok and chk.marker_found, 'uptime_evaluate con el título nuevo: ' || coalesce(chk::text, 'sin fila');

  assert not has_function_privilege('anon', 'public.uptime_marker_found(text, text)', 'execute'), 'anon sin execute';
  assert not has_function_privilege('authenticated', 'public.uptime_marker_found(text, text)', 'execute'), 'authenticated sin execute';
  raise notice 'OK: uptime_markers';
end $$;
rollback;
