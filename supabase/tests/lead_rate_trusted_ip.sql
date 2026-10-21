-- Prueba de SEG-1 (lead_rate_ok con x-moyiq-client-ip). Todo en una
-- transacción con ROLLBACK: se puede correr contra producción sin dejar filas.
--   supabase db query --linked -f supabase/tests/lead_rate_trusted_ip.sql
-- Falla con una excepción si algún caso no se cumple.
begin;
do $$
declare v_hash text;
begin
  -- service_role + x-moyiq-client-ip: cuenta la IP del visitante, no la del proxy.
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('request.headers', '{"cf-connecting-ip":"198.51.100.1","x-moyiq-client-ip":"203.0.113.9"}', true);
  if not private.lead_rate_ok('seg1_test') then raise exception 'FALLA: primera alta rechazada'; end if;
  select ip_hash into v_hash from private.lead_rate_events where bucket = 'seg1_test' order by id desc limit 1;
  if v_hash is distinct from encode(extensions.digest('203.0.113.9', 'sha256'), 'hex') then
    raise exception 'FALLA: con service_role no usó x-moyiq-client-ip';
  end if;

  -- anon con el mismo encabezado: se ignora y se usa cf-connecting-ip.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  if not private.lead_rate_ok('seg1_test') then raise exception 'FALLA: alta anon rechazada'; end if;
  select ip_hash into v_hash from private.lead_rate_events where bucket = 'seg1_test' order by id desc limit 1;
  if v_hash is distinct from encode(extensions.digest('198.51.100.1', 'sha256'), 'hex') then
    raise exception 'FALLA: anon pudo falsear la IP con x-moyiq-client-ip';
  end if;

  -- límite por IP (6 por hora) sigue andando por la IP del visitante.
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  for i in 1..5 loop perform private.lead_rate_ok('seg1_test'); end loop;
  if private.lead_rate_ok('seg1_test') then raise exception 'FALLA: la 7a alta de la misma IP pasó'; end if;
  perform set_config('request.headers', '{"x-moyiq-client-ip":"203.0.113.10"}', true);
  if not private.lead_rate_ok('seg1_test') then raise exception 'FALLA: otra IP quedó bloqueada'; end if;
  raise notice 'OK lead_rate_trusted_ip';
end
$$;
rollback;
