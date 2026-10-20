-- Prueba de la migración 20261020020000 (C-46: COM-8, DAT-19). Corre en una base
-- LOCAL con el esquema de producción (nunca en producción): psql -v ON_ERROR_STOP=1 -f
-- Todo dentro de una transacción que se revierte.
begin;
-- En producción este trigger ya existe (el volcado local solo trae `public`).
drop trigger if exists on_auth_user_created_crm_refresh on auth.users;
create trigger on_auth_user_created_crm_refresh after insert on auth.users
  for each row execute function public.crm_on_auth_user_created();

do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  ca uuid; cb uuid; act uuid; n int; r record; failed boolean;
begin
  -- 1. Cuenta sin lead previo (alta con Google): entra al CRM con su nombre.
  insert into auth.users (id, email, instance_id, aud, role, raw_user_meta_data, created_at, last_sign_in_at) values
    (a, 'Ana@T.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     '{"full_name":"Ana Prueba","lang":"pt"}', now() - interval '3 days', now() - interval '2 days');
  select * into r from public.crm_contacts where email = 'ana@t.local';
  assert r.id is not null, 'cuenta sin lead entra al CRM';
  assert r.fuente is null and r.producto_origen = 'moyiq' and r.plan = 'gratis', 'fuente/producto/plan: ' || row_to_json(r)::text;
  assert r.nombre = 'Ana Prueba', 'nombre desde full_name';
  assert r.lang = 'pt', 'idioma desde metadata';
  assert r.cuenta_creada_en is not null and r.ultimo_login is not null, 'fechas de cuenta y login';
  assert r.optin_confirmado = false, 'sin opt-in';
  ca := r.id;

  -- 2. Alta nacida en Invest (aceptó el aviso de inversión): producto invest.
  insert into auth.users (id, email, instance_id, aud, role) values
    (b, 'beto@t.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  delete from public.crm_contacts where email = 'beto@t.local';
  insert into public.consents (user_id, document_type, version, source) values (b, 'investment_disclaimer', 'v1', 'consent_gate');
  perform public.crm_refresh_contact('beto@t.local');
  select producto_origen into r from public.crm_contacts where email = 'beto@t.local';
  assert r.producto_origen = 'invest', 'producto invest para altas de Invest';

  -- 3. Un lead que llega después de la cuenta completa la fuente (sin duplicar) y
  --    con opt-in confirmado se marca.
  insert into public.starter_leads (email, consent_confirmed_at) values ('ana@t.local', now());
  select count(*) into n from public.crm_contacts where email = 'ana@t.local';
  assert n = 1, 'sin duplicado: ' || n;
  select * into r from public.crm_contacts where email = 'ana@t.local';
  assert r.fuente = 'starter', 'la fila toma la fuente del lead: ' || r.fuente;
  perform public.crm_refresh_contact('ana@t.local');
  select optin_confirmado into r from public.crm_contacts where email = 'ana@t.local';
  assert r.optin_confirmado, 'opt-in confirmado';

  -- 4. Un login actualiza ultimo_login.
  update auth.users set last_sign_in_at = now() where id = a;
  select ultimo_login into r from public.crm_contacts where id = ca;
  assert r.ultimo_login > now() - interval '1 minute', 'ultimo_login tras login';

  -- 5. RPC acotadas: como postgres (tarea programada) funcionan.
  act := public.crm_add_activity(ca, 'Escribió por la prueba', 'correo');
  assert act is not null, 'actividad creada';
  select ultimo_contacto into r from public.crm_contacts where id = ca;
  assert r.ultimo_contacto is not null, 'un correo cuenta como último contacto';
  perform public.crm_set_next_action(ca, 'Llamar', current_date + 2);
  select proxima_accion, proxima_accion_fecha into r from public.crm_contacts where id = ca;
  assert r.proxima_accion = 'Llamar' and r.proxima_accion_fecha = current_date + 2, 'próxima acción';
  perform public.crm_set_next_action(ca, '  ', current_date);
  select proxima_accion, proxima_accion_fecha into r from public.crm_contacts where id = ca;
  assert r.proxima_accion is null and r.proxima_accion_fecha is null, 'acción vacía limpia la fecha';

  -- 6. Otra cuenta no puede (ni leer ni escribir).
  perform set_config('request.jwt.claims', '{"email":"otro@t.local","role":"authenticated"}', true);
  set local role authenticated;
  failed := false;
  begin perform public.crm_add_activity(ca, 'x'); exception when insufficient_privilege then failed := true; end;
  assert failed, 'otra cuenta no escribe actividad';
  failed := false;
  begin perform public.crm_set_next_action(ca, 'x', current_date); exception when insufficient_privilege then failed := true; end;
  assert failed, 'otra cuenta no fija próxima acción';
  select count(*) into n from public.crm_activities;
  assert n = 0, 'otra cuenta no lee actividades';
  reset role;

  -- 7. La cuenta de empresa sí, y lee el historial.
  perform set_config('request.jwt.claims', '{"email":"maxnovaluciglobal@gmail.com","role":"authenticated"}', true);
  set local role authenticated;
  perform public.crm_add_activity(ca, 'Nota interna');
  select count(*) into n from public.crm_activities where contact_id = ca;
  assert n = 2, 'admin lee el historial: ' || n;
  reset role;

  -- 8. anon no tiene EXECUTE.
  assert not has_function_privilege('anon', 'public.crm_add_activity(uuid,text,text)', 'execute'), 'anon sin execute';
  assert not has_function_privilege('anon', 'public.crm_set_next_action(uuid,text,date)', 'execute'), 'anon sin execute';
  assert not has_table_privilege('anon', 'public.crm_activities', 'select'), 'anon sin select';

  -- 8b. Seguimiento (20261020040000): crm_followup_check y crm_set_estado.
  insert into auth.users (id, email, instance_id, aud, role, last_sign_in_at) values
    (c, 'cata@t.local', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', now() - interval '10 days');
  select id into cb from public.crm_contacts where email = 'cata@t.local';
  select * into r from public.crm_followup_check(cb, now() - interval '5 days');
  assert r.eligible and r.to_email = 'cata@t.local', 'corresponde y devuelve el email: ' || row_to_json(r)::text;
  select * into r from public.crm_followup_check(cb, now() - interval '20 days');
  assert not r.eligible and r.reason = 'volvio_a_entrar' and r.to_email is null, 'volvio a entrar, sin email';
  perform public.crm_add_activity(cb, 'Correo de seguimiento', 'correo');
  select * into r from public.crm_followup_check(cb, now() - interval '5 days');
  assert not r.eligible and r.reason = 'ya_contactado' and r.to_email is null, 'ya contactado';
  delete from public.crm_activities where contact_id = cb;
  insert into public.starter_leads (email, unsubscribed_at) values ('cata@t.local', now());
  select * into r from public.crm_followup_check(cb, now() - interval '5 days');
  assert not r.eligible and r.reason = 'baja' and r.to_email is null, 'baja';
  perform public.crm_set_estado(cb, 'contactado');
  select estado into r from public.crm_contacts where id = cb;
  assert r.estado = 'contactado', 'estado';
  failed := false;
  begin perform public.crm_set_estado(cb, 'inventado'); exception when check_violation then failed := true; end;
  assert failed, 'estado fuera de la lista';
  perform set_config('request.jwt.claims', '{"email":"otro@t.local","role":"authenticated"}', true);
  set local role authenticated;
  failed := false;
  begin perform * from public.crm_followup_check(cb, now()); exception when insufficient_privilege then failed := true; end;
  assert failed, 'otra cuenta no consulta el seguimiento';
  failed := false;
  begin perform public.crm_set_estado(cb, 'perdido'); exception when insufficient_privilege then failed := true; end;
  assert failed, 'otra cuenta no cambia estado';
  reset role;
  assert not has_function_privilege('anon', 'public.crm_followup_check(uuid,timestamptz)', 'execute'), 'anon sin execute (followup)';
  assert not has_function_privilege('anon', 'public.crm_set_estado(uuid,text)', 'execute'), 'anon sin execute (estado)';

  -- 9. Borrar el contacto borra su historial.
  delete from public.crm_contacts where id = ca;
  select count(*) into n from public.crm_activities where contact_id = ca;
  assert n = 0, 'cascade';
  raise notice 'crm_accounts_activity: OK';
end $$;
rollback;
