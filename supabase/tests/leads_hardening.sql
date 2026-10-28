-- Prueba de C-19/C-23 contra una base LOCAL (nunca producción): todo corre en
-- una transacción que termina en ROLLBACK. Desde el 28-oct-2026 las altas se ejercen como
-- service_role (así las llama lead-submit desde SEG-1) y se comprueba que anon no puede. Uso:
--   supabase start (solo db) + esquema de producción + migraciones nuevas, y
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/leads_hardening.sql
-- Falla con una excepción si algún caso no se cumple.
begin;

set local role anon;
do $$
begin
  begin
    insert into public.starter_leads (email, consent_confirmed_at) values ('x@example.com', now());
    raise exception 'FALLA: anon pudo insertar directo en starter_leads';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from private.lead_rate_events limit 1;
    raise exception 'FALLA: anon pudo leer private.lead_rate_events';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- SEG-1 (migración 20261021060000): las RPC de altas son solo de service_role (las llama la
-- Edge Function lead-submit). anon recibe 42501.
do $$
begin
  begin
    perform public.register_starter_lead('x@example.com', 'es', false);
    raise exception 'FALLA: anon ejecutó register_starter_lead';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;
set local role service_role;
select set_config('request.headers', '{"x-forwarded-for":"203.0.113.7, 10.0.0.1"}', true);
do $$
declare r1 jsonb; r2 jsonb; r3 jsonb; i int; v_rows int;
begin
  r1 := public.register_starter_lead('  Ana.Test@Example.com ', 'es', false);
  if not (r1->>'ok')::boolean then raise exception 'FALLA: alta válida rechazada %', r1; end if;
  r2 := public.register_starter_lead('ana.test@example.com', 'es', true);
  if r2->>'id' <> r1->>'id' or not (r2->>'existing')::boolean then raise exception 'FALLA: el mismo correo creó otra fila % %', r1, r2; end if;
  r3 := public.register_starter_lead('no-es-un-correo', 'es', false);
  if (r3->>'ok')::boolean then raise exception 'FALLA: correo inválido aceptado'; end if;
  -- 2 altas ya contadas para esta IP (la inválida no cuenta): 4 más pasan, la 7.a se corta.
  for i in 1..4 loop
    if not (public.register_starter_lead('ip' || i || '@example.com', null, false)->>'ok')::boolean then
      raise exception 'FALLA: alta % de la IP cortada antes de tiempo', i;
    end if;
  end loop;
  if (public.register_starter_lead('ip5@example.com', null, false)->>'error') is distinct from 'rate_limited' then
    raise exception 'FALLA: sin límite por IP';
  end if;
end
$$;

-- Otra IP no queda bloqueada por la primera.
select set_config('request.headers', '{"x-forwarded-for":"198.51.100.9"}', true);
do $$
begin
  if not (public.register_demo_lead('otra@example.com', 'Otra', true, 'pt')->>'ok')::boolean then
    raise exception 'FALLA: el límite de una IP afectó a otra';
  end if;
  if not (public.register_tax_calculator_lead('otra@example.com', 'CL', 1000, 10)->>'ok')::boolean then raise exception 'FALLA: calculadora'; end if;
  if not ((public.register_tax_calculator_lead('OTRA@example.com', 'CL', 2000, 20))->>'existing')::boolean then raise exception 'FALLA: calculadora duplicó'; end if;
  if not (public.register_invest_lead('inv@example.com', 'moderado', 50, 'test', false)->>'ok')::boolean then raise exception 'FALLA: invest'; end if;
  if not (public.register_diagnostico_lead('diag@example.com', 70, 'ok', false, 'test', 'es')->>'ok')::boolean then raise exception 'FALLA: diagnostico'; end if;
end
$$;

reset role;
do $$
declare v record;
begin
  select count(*) as n, bool_and(consent_marketing) as consent, bool_and(consent_token is not null) as token,
         bool_and(consent_confirmed_at is null) as unconfirmed, min(email) as email
    into v from public.starter_leads where lower(email) = 'ana.test@example.com';
  if v.n <> 1 or not v.consent or not v.token or not v.unconfirmed or v.email <> 'ana.test@example.com' then
    raise exception 'FALLA: fila de ana %', row_to_json(v);
  end if;
  if exists (select 1 from private.lead_rate_events where ip_hash like '%203.0.113.7%') then raise exception 'FALLA: IP en claro'; end if;
  if (select count(*) from private.lead_rate_events where ip_hash is null) > 0 then raise exception 'FALLA: no tomó la IP del header'; end if;
end
$$;

-- Límite global por tabla: 120 por hora.
insert into private.lead_rate_events (bucket, ip_hash) select 'invest', 'h' || g from generate_series(1, 120) g;
set local role service_role;
select set_config('request.headers', '{"x-forwarded-for":"192.0.2.55"}', true);
do $$
begin
  if (public.register_invest_lead('global@example.com')->>'error') is distinct from 'rate_limited' then
    raise exception 'FALLA: sin límite global';
  end if;
end
$$;
reset role;

-- set_license_email: sin sesión de dueño no pisa un email existente.
insert into public.licenses (key_hash, plan, status, email)
values (encode(extensions.digest('FNPR-TEST-TEST-TEST', 'sha256'), 'hex'), 'pro', 'active', 'dueno@example.com');
set local role anon;
do $$
begin
  perform public.set_license_email(encode(extensions.digest('FNPR-TEST-TEST-TEST', 'sha256'), 'hex'), 'atacante@example.com');
end
$$;
reset role;
do $$
begin
  if (select email from public.licenses where key_hash = encode(extensions.digest('FNPR-TEST-TEST-TEST', 'sha256'), 'hex')) <> 'dueno@example.com' then
    raise exception 'FALLA: set_license_email pisó el email del dueño';
  end if;
end
$$;

-- Grants: nada de TRUNCATE ni INSERT directo para anon/authenticated.
do $$
declare t text;
begin
  foreach t in array array['starter_leads','diagnostico_leads','invest_leads','demo_leads','tax_calculator_leads','crm_contacts','licenses','trial_emails','webhook_events','profiles','user_entitlements'] loop
    if has_table_privilege('anon', 'public.' || t, 'TRUNCATE') or has_table_privilege('authenticated', 'public.' || t, 'TRUNCATE') then
      raise exception 'FALLA: TRUNCATE en %', t;
    end if;
  end loop;
  foreach t in array array['starter_leads','diagnostico_leads','invest_leads','demo_leads','tax_calculator_leads','trial_emails','licenses','webhook_events'] loop
    if has_table_privilege('anon', 'public.' || t, 'INSERT') or has_table_privilege('authenticated', 'public.' || t, 'INSERT') then
      raise exception 'FALLA: INSERT en %', t;
    end if;
  end loop;
end
$$;

select 'OK: todos los casos de leads_hardening.sql pasaron' as resultado;
rollback;
