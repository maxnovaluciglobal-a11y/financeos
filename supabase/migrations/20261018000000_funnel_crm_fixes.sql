-- 20261018000000_funnel_crm_fixes.sql
-- Arreglos de la auditoría del embudo y el CRM (18-oct-2026, informe en
-- `02 - MOY IQ/07 - Clientes y Ventas/2026-10-18-auditoria-embudo-y-crm.md`).
--
-- 1. Todas las puertas de entrada llegan al CRM: demo_leads y
--    tax_calculator_leads no se sincronizaban (había leads reales del demo
--    invisibles en el panel).
-- 2. crm_contacts gana `nombre` (lo da el demo) y `plan` (null = sin cuenta,
--    'gratis' = tiene cuenta, 'pro' = paga). `estado` sigue siendo la etapa de
--    venta que mueve Walter; `plan` es el hecho, lo mantiene la base.
-- 3. crm_refresh_contact(email) recalcula cuenta/pago desde auth.users,
--    licenses y user_entitlements, y la llaman todos los triggers. Arregla:
--    leads que crearon cuenta antes de dejar el email (no se marcaban), Pro
--    sin lead previo (no entraba al CRM), licencia revocada (quedaba
--    "convertido") y comparación de email sensible a mayúsculas.
-- 4. ultimo_contacto se escribe solo: al mandar un correo de nurture y al
--    pasar un contacto a "contactado" desde el panel.
-- 5. El quiz de Invest ya no pisa las notas manuales.
-- 6. Bajas: por email (todas las filas de esa dirección en la tabla, no solo
--    la del link) y nueva baja para el demo.
-- 7. Lectura de admin para invest/demo/calculadora (el detalle del panel no
--    podía leerlas) y escritura de admin en cancellation_requests (marcar
--    procesada desde el panel).
-- 8. crm_funnel deja de ser pública: era una vista sin security_invoker que
--    devolvía conteos del CRM a la key anónima.
--
-- Todo lo que llaman los triggers está envuelto en un bloque de excepción:
-- un problema del CRM nunca puede bloquear un alta, un lead o un pago.

-- ---------------------------------------------------------------------------
-- Columnas nuevas
-- ---------------------------------------------------------------------------
alter table public.crm_contacts add column if not exists nombre text;
alter table public.crm_contacts add column if not exists plan text;
do $$ begin
  alter table public.crm_contacts add constraint crm_contacts_plan_check check (plan in ('gratis', 'pro'));
exception when duplicate_object then null; end $$;

alter table public.demo_leads add column if not exists unsubscribed_at timestamptz;

-- ---------------------------------------------------------------------------
-- crm_refresh_contact: cuenta y pago reales de un email
-- ---------------------------------------------------------------------------
create or replace function public.crm_refresh_contact(p_email text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email   text := lower(trim(p_email));
  v_account boolean;
  v_pro     boolean;
begin
  if v_email is null or v_email = '' then return; end if;

  select exists(select 1 from auth.users where lower(email) = v_email) into v_account;
  select exists(select 1 from public.licenses where lower(email) = v_email and status = 'active')
      or exists(select 1 from public.user_entitlements ue join auth.users u on u.id = ue.user_id
                 where lower(u.email) = v_email and ue.plan in ('pro', 'enterprise'))
    into v_pro;

  if v_pro then
    -- Quien paga siempre está en el CRM, aunque no haya pasado por ningún lead.
    insert into public.crm_contacts (email, producto_origen, fuente, estado, plan)
    values (v_email, 'moyiq', 'stripe', 'convertido', 'pro')
    on conflict (email, producto_origen) do update
      set estado = 'convertido', plan = 'pro', actualizado_en = now()
      where crm_contacts.plan is distinct from 'pro' or crm_contacts.estado <> 'convertido';
    -- Ya es Pro: corta el correo de Starter que lo invita a pasarse a Pro.
    update public.starter_leads set account_created_at = coalesce(account_created_at, now())
     where lower(email) = v_email;
  else
    -- Pro que dejó de pagar (licencia revocada o suscripción cancelada).
    update public.crm_contacts
       set plan = case when v_account then 'gratis' end,
           estado = 'perdido',
           actualizado_en = now()
     where lower(email) = v_email and plan = 'pro';
  end if;

  if v_account then
    update public.crm_contacts set plan = 'gratis', actualizado_en = now()
     where lower(email) = v_email and plan is null;
    -- Diagnóstico e Invest: "convertido" = creó cuenta. Cubre a quien la creó
    -- ANTES de dejar el email (el trigger de auth.users no lo veía).
    update public.diagnostico_leads set account_created_at = coalesce(account_created_at, now())
     where lower(email) = v_email and account_created_at is null;
    update public.invest_leads set account_created_at = coalesce(account_created_at, now())
     where lower(email) = v_email and account_created_at is null;
  end if;
end;
$$;

revoke all on function public.crm_refresh_contact(text) from public, anon, authenticated;

-- Envoltorio para triggers: nunca propaga un error.
create or replace function public.crm_refresh_contact_safe(p_email text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.crm_refresh_contact(p_email);
exception when others then
  raise warning 'crm_refresh_contact(%) falló: %', p_email, sqlerrm;
end;
$$;

revoke all on function public.crm_refresh_contact_safe(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Sincronización de cada puerta al CRM (emails en minúscula)
-- ---------------------------------------------------------------------------
create or replace function public.sync_diagnostico_lead_to_crm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into public.crm_contacts (email, producto_origen, fuente, score)
    values (lower(trim(new.email)), 'moyiq', new.fuente, new.score)
    on conflict (email, producto_origen) do update
      set score = coalesce(excluded.score, crm_contacts.score),
          fuente = coalesce(crm_contacts.fuente, excluded.fuente),
          actualizado_en = now();
  exception when others then
    raise warning 'sync_diagnostico_lead_to_crm: %', sqlerrm;
  end;
  perform public.crm_refresh_contact_safe(new.email);
  return new;
end; $$;

create or replace function public.sync_starter_lead_to_crm()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  begin
    insert into public.crm_contacts (email, producto_origen, fuente)
    values (lower(trim(new.email)), 'moyiq', 'starter')
    on conflict (email, producto_origen) do update
      set fuente = coalesce(crm_contacts.fuente, excluded.fuente),
          actualizado_en = now();
  exception when others then
    raise warning 'sync_starter_lead_to_crm: %', sqlerrm;
  end;
  perform public.crm_refresh_contact_safe(new.email);

  perform net.http_post(
    url := 'https://nelwgbcddwiaimzbcuas.supabase.co/functions/v1/notify-admin-signup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', coalesce(private.get_secret('cron_secret'), '')
    ),
    body := jsonb_build_object('event', 'starter_signup', 'email', new.email)
  );
  return new;
end; $$;

-- El perfil del quiz va a `notas` solo si todavía no hay notas: antes pisaba
-- las notas manuales cada vez que alguien repetía el quiz.
create or replace function public.sync_invest_lead_to_crm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into public.crm_contacts (email, producto_origen, fuente, score, notas)
    values (lower(trim(new.email)), 'invest', new.fuente, new.score, new.perfil)
    on conflict (email, producto_origen) do update
      set score = coalesce(excluded.score, crm_contacts.score),
          fuente = coalesce(crm_contacts.fuente, excluded.fuente),
          notas = coalesce(crm_contacts.notas, excluded.notas),
          actualizado_en = now();
  exception when others then
    raise warning 'sync_invest_lead_to_crm: %', sqlerrm;
  end;
  perform public.crm_refresh_contact_safe(new.email);
  return new;
end; $$;

create or replace function public.sync_demo_lead_to_crm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into public.crm_contacts (email, producto_origen, fuente, nombre)
    values (lower(trim(new.email)), 'moyiq', 'demo', nullif(trim(new.nombre), ''))
    on conflict (email, producto_origen) do update
      set nombre = coalesce(crm_contacts.nombre, excluded.nombre),
          fuente = coalesce(crm_contacts.fuente, excluded.fuente),
          actualizado_en = now();
  exception when others then
    raise warning 'sync_demo_lead_to_crm: %', sqlerrm;
  end;
  perform public.crm_refresh_contact_safe(new.email);
  return new;
end; $$;

drop trigger if exists trg_sync_demo_lead_to_crm on public.demo_leads;
create trigger trg_sync_demo_lead_to_crm
  after insert on public.demo_leads
  for each row execute function public.sync_demo_lead_to_crm();

create or replace function public.sync_tax_calculator_lead_to_crm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into public.crm_contacts (email, producto_origen, fuente)
    values (lower(trim(new.email)), 'moyiq', 'calculadora')
    on conflict (email, producto_origen) do update
      set fuente = coalesce(crm_contacts.fuente, excluded.fuente),
          actualizado_en = now();
  exception when others then
    raise warning 'sync_tax_calculator_lead_to_crm: %', sqlerrm;
  end;
  perform public.crm_refresh_contact_safe(new.email);
  return new;
end; $$;

drop trigger if exists trg_sync_tax_calculator_lead_to_crm on public.tax_calculator_leads;
create trigger trg_sync_tax_calculator_lead_to_crm
  after insert on public.tax_calculator_leads
  for each row execute function public.sync_tax_calculator_lead_to_crm();

-- ---------------------------------------------------------------------------
-- Cuenta y pago: auth.users, licenses, user_entitlements
-- ---------------------------------------------------------------------------
create or replace function public.crm_on_auth_user_created()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.crm_refresh_contact_safe(new.email);
  return new;
end; $$;

drop trigger if exists on_auth_user_created_crm_refresh on auth.users;
create trigger on_auth_user_created_crm_refresh
  after insert on auth.users
  for each row execute function public.crm_on_auth_user_created();

-- Reemplaza a la versión que solo marcaba "convertido" y nunca lo deshacía.
create or replace function public.sync_license_activation_to_crm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.crm_refresh_contact_safe(new.email);
  if tg_op = 'UPDATE' and old.email is distinct from new.email then
    perform public.crm_refresh_contact_safe(old.email);
  end if;
  return new;
end; $$;

create or replace function public.crm_on_entitlement_change()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare v_email text;
begin
  select email into v_email from auth.users where id = new.user_id;
  perform public.crm_refresh_contact_safe(v_email);
  return new;
end; $$;

drop trigger if exists trg_crm_on_entitlement_change on public.user_entitlements;
create trigger trg_crm_on_entitlement_change
  after insert or update on public.user_entitlements
  for each row execute function public.crm_on_entitlement_change();

-- ---------------------------------------------------------------------------
-- ultimo_contacto
-- ---------------------------------------------------------------------------
-- Cada correo de nurture enviado cuenta como contacto.
create or replace function public.crm_touch_on_nurture_sent()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_product text := case tg_table_name when 'invest_leads' then 'invest' else 'moyiq' end;
begin
  begin
    update public.crm_contacts set ultimo_contacto = now(), actualizado_en = now()
     where lower(email) = lower(trim(new.email)) and producto_origen = v_product;
  exception when others then
    raise warning 'crm_touch_on_nurture_sent: %', sqlerrm;
  end;
  return new;
end; $$;

drop trigger if exists trg_crm_touch_diagnostico on public.diagnostico_leads;
create trigger trg_crm_touch_diagnostico
  after update of email1_sent_at, email2_sent_at, email3_sent_at, email4_sent_at on public.diagnostico_leads
  for each row
  when (old.email1_sent_at is distinct from new.email1_sent_at
     or old.email2_sent_at is distinct from new.email2_sent_at
     or old.email3_sent_at is distinct from new.email3_sent_at
     or old.email4_sent_at is distinct from new.email4_sent_at)
  execute function public.crm_touch_on_nurture_sent();

drop trigger if exists trg_crm_touch_starter on public.starter_leads;
create trigger trg_crm_touch_starter
  after update of email1_sent_at, email2_sent_at, email3_sent_at on public.starter_leads
  for each row
  when (old.email1_sent_at is distinct from new.email1_sent_at
     or old.email2_sent_at is distinct from new.email2_sent_at
     or old.email3_sent_at is distinct from new.email3_sent_at)
  execute function public.crm_touch_on_nurture_sent();

drop trigger if exists trg_crm_touch_invest on public.invest_leads;
create trigger trg_crm_touch_invest
  after update of email1_sent_at, email2_sent_at, email3_sent_at on public.invest_leads
  for each row
  when (old.email1_sent_at is distinct from new.email1_sent_at
     or old.email2_sent_at is distinct from new.email2_sent_at
     or old.email3_sent_at is distinct from new.email3_sent_at)
  execute function public.crm_touch_on_nurture_sent();

-- Pasar a "contactado" desde el panel registra la fecha del contacto.
create or replace function public.crm_touch_on_contactado()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.estado = 'contactado' and old.estado is distinct from 'contactado'
     and new.ultimo_contacto is not distinct from old.ultimo_contacto then
    new.ultimo_contacto := now();
  end if;
  return new;
end; $$;

drop trigger if exists trg_crm_touch_on_contactado on public.crm_contacts;
create trigger trg_crm_touch_on_contactado
  before update on public.crm_contacts
  for each row execute function public.crm_touch_on_contactado();

-- ---------------------------------------------------------------------------
-- Bajas por email (todas las filas de esa dirección en la tabla)
-- ---------------------------------------------------------------------------
create or replace function public.unsubscribe_diagnostico_lead(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_email text;
begin
  select lower(email) into v_email from public.diagnostico_leads where id = p_id;
  if v_email is not null then
    update public.diagnostico_leads set unsubscribed_at = now()
     where lower(email) = v_email and unsubscribed_at is null;
  end if;
  -- Misma respuesta exista o no: no revela qué ids son válidos.
  return jsonb_build_object('ok', true);
end; $$;

create or replace function public.unsubscribe_starter_lead(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_email text;
begin
  select lower(email) into v_email from public.starter_leads where id = p_id;
  if v_email is not null then
    update public.starter_leads set unsubscribed_at = now()
     where lower(email) = v_email and unsubscribed_at is null;
  end if;
  return jsonb_build_object('ok', true);
end; $$;

create or replace function public.unsubscribe_invest_lead(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_email text;
begin
  select lower(email) into v_email from public.invest_leads where id = p_id;
  if v_email is not null then
    update public.invest_leads set unsubscribed_at = now()
     where lower(email) = v_email and unsubscribed_at is null;
  end if;
  return jsonb_build_object('ok', true);
end; $$;

create or replace function public.unsubscribe_demo_lead(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_email text;
begin
  select lower(email) into v_email from public.demo_leads where id = p_id;
  if v_email is not null then
    update public.demo_leads set unsubscribed_at = now()
     where lower(email) = v_email and unsubscribed_at is null;
  end if;
  return jsonb_build_object('ok', true);
end; $$;

grant execute on function public.unsubscribe_diagnostico_lead(uuid) to anon, authenticated;
grant execute on function public.unsubscribe_starter_lead(uuid) to anon, authenticated;
grant execute on function public.unsubscribe_invest_lead(uuid) to anon, authenticated;
grant execute on function public.unsubscribe_demo_lead(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Políticas de admin (mismo patrón que crm_contacts)
-- ---------------------------------------------------------------------------
drop policy if exists invest_leads_admin_select on public.invest_leads;
create policy invest_leads_admin_select on public.invest_leads for select to authenticated
  using ((auth.jwt() ->> 'email') = any (array['walterlamadriz@gmail.com', 'maxnovaluciglobal@gmail.com']));

drop policy if exists demo_leads_admin_select on public.demo_leads;
create policy demo_leads_admin_select on public.demo_leads for select to authenticated
  using ((auth.jwt() ->> 'email') = any (array['walterlamadriz@gmail.com', 'maxnovaluciglobal@gmail.com']));

drop policy if exists tax_calculator_leads_admin_select on public.tax_calculator_leads;
create policy tax_calculator_leads_admin_select on public.tax_calculator_leads for select to authenticated
  using ((auth.jwt() ->> 'email') = any (array['walterlamadriz@gmail.com', 'maxnovaluciglobal@gmail.com']));

drop policy if exists cancellation_requests_admin_update on public.cancellation_requests;
create policy cancellation_requests_admin_update on public.cancellation_requests for update to authenticated
  using ((auth.jwt() ->> 'email') = any (array['walterlamadriz@gmail.com', 'maxnovaluciglobal@gmail.com']))
  with check ((auth.jwt() ->> 'email') = any (array['walterlamadriz@gmail.com', 'maxnovaluciglobal@gmail.com']));

-- ---------------------------------------------------------------------------
-- crm_funnel: respeta el RLS de crm_contacts y deja de ser pública
-- ---------------------------------------------------------------------------
alter view public.crm_funnel set (security_invoker = true);
revoke all on public.crm_funnel from anon;

-- ---------------------------------------------------------------------------
-- Relleno de lo que ya existe
-- ---------------------------------------------------------------------------
insert into public.crm_contacts (email, producto_origen, fuente, nombre, creado_en)
select distinct on (lower(trim(email))) lower(trim(email)), 'moyiq', 'demo', nullif(trim(nombre), ''), created_at
  from public.demo_leads order by lower(trim(email)), created_at
on conflict (email, producto_origen) do update
  set nombre = coalesce(crm_contacts.nombre, excluded.nombre);

insert into public.crm_contacts (email, producto_origen, fuente, creado_en)
select distinct on (lower(trim(email))) lower(trim(email)), 'moyiq', 'calculadora', created_at
  from public.tax_calculator_leads order by lower(trim(email)), created_at
on conflict (email, producto_origen) do nothing;

do $$
declare r record;
begin
  for r in
    select email from public.crm_contacts
    union select email from public.licenses where email is not null
    union select u.email from public.user_entitlements ue join auth.users u on u.id = ue.user_id
  loop
    perform public.crm_refresh_contact_safe(r.email);
  end loop;
end $$;

-- ultimo_contacto histórico: el último correo de nurture ya enviado.
update public.crm_contacts c set ultimo_contacto = x.ultimo
  from (
    select lower(email) email, 'moyiq' prod, max(greatest(email1_sent_at, email2_sent_at, email3_sent_at, email4_sent_at)) ultimo
      from public.diagnostico_leads group by 1
    union all
    select lower(email), 'moyiq', max(greatest(email1_sent_at, email2_sent_at, email3_sent_at)) from public.starter_leads group by 1
    union all
    select lower(email), 'invest', max(greatest(email1_sent_at, email2_sent_at, email3_sent_at)) from public.invest_leads group by 1
  ) x
 where lower(c.email) = x.email and c.producto_origen = x.prod and x.ultimo is not null
   and (c.ultimo_contacto is null or c.ultimo_contacto < x.ultimo);

-- Contactos de prueba internos (Walter, QA, verificaciones automáticas): se
-- marcan para que no inflen el embudo del panel. No se borra nada.
update public.crm_contacts
   set notas = case when coalesce(notas, '') ilike '%prueba interna%' then notas
                    else trim(both ' ·' from concat_ws(' · ', 'Prueba interna', nullif(notas, ''))) end,
       estado = case when plan = 'pro' then estado else 'perdido' end,
       actualizado_en = now()
 where email ilike 'walterlamadriz%@gmail.com'
    or email ilike 'walter.la.madriz@%'
    or email ilike 'walter+%'
    or email ilike 'walter.test%'
    or email ilike '%@example.com'
    or email ilike '%@test.local'
    or email ilike '%@moyiq.app';
