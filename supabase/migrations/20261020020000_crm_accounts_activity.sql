-- 20261020020000_crm_accounts_activity.sql
-- Auditoría 360, C-46 (COM-8, DAT-19).
--
-- COM-8: el CRM no veía las cuentas sin lead previo (solo entraban los Pro),
-- ni la actividad, ni la próxima acción.
--   1. crm_contacts gana proxima_accion (+ fecha), ultimo_login, cuenta_creada_en,
--      optin_confirmado y lang. Los calcula crm_refresh_contact; la próxima
--      acción la escribe Walter desde el panel.
--   2. crm_refresh_contact: toda cuenta entra al CRM (fuente vacía: el panel la
--      muestra como "cuenta" y un lead posterior la completa, porque las funciones
--      de sync hacen coalesce(fuente); nombre
--      desde full_name/name de Google, producto 'invest' si aceptó el aviso de
--      inversión de Invest y no hay lead previo), y refresca los datos de arriba.
--   3. Un login actualiza ultimo_login (trigger liviano y a prueba de errores:
--      nunca bloquea un login).
--   4. crm_activities: historial de contactos (nota, correo, llamada…) en vez de
--      una sola columna `notas`.
-- DAT-19: las tareas programadas escriben en el CRM por dos RPC acotadas
--   (crm_add_activity, crm_set_next_action) que referencian el contacto por id,
--   nunca con UPDATE libre ni con el email en el archivo de la tarea.
--
-- Aditiva e idempotente. Todo lo que corre desde auth.users está envuelto en
-- bloques de excepción.

alter table public.crm_contacts add column if not exists proxima_accion text;
alter table public.crm_contacts add column if not exists proxima_accion_fecha date;
alter table public.crm_contacts add column if not exists ultimo_login timestamptz;
alter table public.crm_contacts add column if not exists cuenta_creada_en timestamptz;
alter table public.crm_contacts add column if not exists optin_confirmado boolean;
alter table public.crm_contacts add column if not exists lang text;

create index if not exists crm_contacts_proxima_accion_fecha_idx
  on public.crm_contacts (proxima_accion_fecha) where proxima_accion_fecha is not null;

-- ---------------------------------------------------------------------------
-- crm_refresh_contact: cuenta, pago, login, opt-in e idioma de un email
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
  v_uid     uuid;
  v_created timestamptz;
  v_login   timestamptz;
  v_name    text;
  v_lang    text;
  v_optin   boolean;
  v_product text;
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
    select u.id, u.created_at, u.last_sign_in_at,
           nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')), ''),
           nullif(u.raw_user_meta_data->>'lang', '')
      into v_uid, v_created, v_login, v_name, v_lang
      from auth.users u where lower(u.email) = v_email
     order by u.created_at limit 1;

    -- COM-8: una cuenta sin lead previo también entra (antes solo los Pro).
    if not exists (select 1 from public.crm_contacts where lower(email) = v_email) then
      v_product := case when exists (
        select 1 from public.consents c
         where c.user_id = v_uid and c.document_type = 'investment_disclaimer'
      ) then 'invest' else 'moyiq' end;
      insert into public.crm_contacts (email, producto_origen, fuente, plan, nombre)
      values (v_email, v_product, null, 'gratis', v_name)
      on conflict (email, producto_origen) do nothing;
    end if;

    update public.crm_contacts set plan = 'gratis', actualizado_en = now()
     where lower(email) = v_email and plan is null;
    -- Diagnóstico e Invest: "convertido" = creó cuenta. Cubre a quien la creó
    -- ANTES de dejar el email (el trigger de auth.users no lo veía).
    update public.diagnostico_leads set account_created_at = coalesce(account_created_at, now())
     where lower(email) = v_email and account_created_at is null;
    update public.invest_leads set account_created_at = coalesce(account_created_at, now())
     where lower(email) = v_email and account_created_at is null;
  end if;

  -- Opt-in de marketing confirmado y vigente en cualquier puerta.
  select exists(select 1 from public.starter_leads     where lower(email) = v_email and consent_confirmed_at is not null and unsubscribed_at is null)
      or exists(select 1 from public.diagnostico_leads where lower(email) = v_email and consent_confirmed_at is not null and unsubscribed_at is null)
      or exists(select 1 from public.demo_leads        where lower(email) = v_email and consent_confirmed_at is not null and unsubscribed_at is null)
      or exists(select 1 from public.invest_leads      where lower(email) = v_email and consent_confirmed_at is not null and unsubscribed_at is null)
      or exists(select 1 from public.newsletter_signups where lower(email) = v_email and consent_confirmed_at is not null and unsubscribed_at is null)
    into v_optin;

  update public.crm_contacts c
     set optin_confirmado = v_optin,
         ultimo_login     = coalesce(v_login, c.ultimo_login),
         cuenta_creada_en = coalesce(v_created, c.cuenta_creada_en),
         nombre           = coalesce(c.nombre, v_name),
         lang             = coalesce(v_lang, c.lang, (
                              select l.lang from (
                                select lang, created_at from public.starter_leads where lower(email) = v_email
                                union all select lang, created_at from public.diagnostico_leads where lower(email) = v_email
                                union all select lang, created_at from public.demo_leads where lower(email) = v_email
                                union all select lang, created_at from public.invest_leads where lower(email) = v_email
                              ) l where l.lang is not null order by l.created_at desc limit 1))
   where lower(c.email) = v_email
     and (c.optin_confirmado is distinct from v_optin
       or c.ultimo_login is distinct from coalesce(v_login, c.ultimo_login)
       or c.cuenta_creada_en is distinct from coalesce(v_created, c.cuenta_creada_en)
       or (c.nombre is null and v_name is not null)
       or c.lang is null);
end;
$$;

revoke all on function public.crm_refresh_contact(text) from public, anon, authenticated;

-- Por si una versión previa de esta migración llegó a crear el trigger de adopción.
drop trigger if exists trg_crm_adopt_account_row on public.crm_contacts;
drop function if exists public.crm_adopt_account_row();

-- ---------------------------------------------------------------------------
-- Login → ultimo_login (liviano; nunca bloquea un login)
-- ---------------------------------------------------------------------------
create or replace function public.crm_on_auth_user_login()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  begin
    update public.crm_contacts set ultimo_login = new.last_sign_in_at
     where lower(email) = lower(new.email)
       and ultimo_login is distinct from new.last_sign_in_at;
  exception when others then
    raise warning 'crm_on_auth_user_login: %', sqlerrm;
  end;
  return new;
end; $$;

revoke all on function public.crm_on_auth_user_login() from public, anon, authenticated;

drop trigger if exists on_auth_user_login_crm on auth.users;
create trigger on_auth_user_login_crm
  after update of last_sign_in_at on auth.users
  for each row when (old.last_sign_in_at is distinct from new.last_sign_in_at)
  execute function public.crm_on_auth_user_login();

-- ---------------------------------------------------------------------------
-- crm_activities: historial de contactos
-- ---------------------------------------------------------------------------
create table if not exists public.crm_activities (
  id          uuid primary key default gen_random_uuid(),
  contact_id  uuid not null references public.crm_contacts(id) on delete cascade,
  tipo        text not null default 'nota',
  nota        text not null,
  creado_en   timestamptz not null default now(),
  creado_por  text
);
do $$ begin
  alter table public.crm_activities add constraint crm_activities_tipo_check
    check (tipo in ('nota', 'correo', 'llamada', 'mensaje', 'reunion'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.crm_activities add constraint crm_activities_nota_len
    check (char_length(nota) between 1 and 2000);
exception when duplicate_object then null; end $$;
create index if not exists crm_activities_contact_idx on public.crm_activities (contact_id, creado_en desc);

alter table public.crm_activities enable row level security;
revoke all on public.crm_activities from public, anon, authenticated;
grant select, delete on public.crm_activities to authenticated;
drop policy if exists crm_activities_admin_read on public.crm_activities;
create policy crm_activities_admin_read on public.crm_activities
  for select to authenticated
  using ((select auth.jwt() ->> 'email') = 'maxnovaluciglobal@gmail.com');
drop policy if exists crm_activities_admin_delete on public.crm_activities;
create policy crm_activities_admin_delete on public.crm_activities
  for delete to authenticated
  using ((select auth.jwt() ->> 'email') = 'maxnovaluciglobal@gmail.com');

-- ---------------------------------------------------------------------------
-- RPC acotadas (DAT-19): la única forma de escribir actividad o próxima acción.
-- Las puede llamar la cuenta de empresa desde el panel o una tarea programada
-- con la conexión del CLI (postgres). Nunca anon ni otra cuenta.
-- ---------------------------------------------------------------------------
create or replace function public.crm_is_admin_caller()
returns boolean
language sql
stable
set search_path = public
as $$
  -- Por la API (PostgREST) siempre hay claims: solo la cuenta de empresa o
  -- service_role. Sin claims es una conexión directa a la base (CLI con las
  -- credenciales del proyecto), que ya es administración.
  select case
    when (select auth.jwt()) is null then true
    else coalesce((select auth.jwt() ->> 'email'), '') = 'maxnovaluciglobal@gmail.com'
      or coalesce((select auth.jwt() ->> 'role'), '') = 'service_role'
  end
$$;
revoke all on function public.crm_is_admin_caller() from public, anon, authenticated;

create or replace function public.crm_add_activity(p_contact_id uuid, p_nota text, p_tipo text default 'nota')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.crm_is_admin_caller() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.crm_contacts where id = p_contact_id) then
    raise exception 'contact_not_found' using errcode = 'P0002';
  end if;
  insert into public.crm_activities (contact_id, tipo, nota, creado_por)
  values (p_contact_id, coalesce(nullif(p_tipo, ''), 'nota'), trim(p_nota),
          coalesce((select auth.jwt() ->> 'email'), current_user))
  returning id into v_id;
  -- Un contacto real (no una nota interna) cuenta como último contacto.
  if coalesce(p_tipo, 'nota') <> 'nota' then
    update public.crm_contacts set ultimo_contacto = now(), actualizado_en = now() where id = p_contact_id;
  end if;
  return v_id;
end; $$;

revoke all on function public.crm_add_activity(uuid, text, text) from public, anon;
grant execute on function public.crm_add_activity(uuid, text, text) to authenticated;

create or replace function public.crm_set_next_action(p_contact_id uuid, p_accion text, p_fecha date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.crm_is_admin_caller() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.crm_contacts
     set proxima_accion = nullif(trim(coalesce(p_accion, '')), ''),
         proxima_accion_fecha = case when nullif(trim(coalesce(p_accion, '')), '') is null then null else p_fecha end,
         actualizado_en = now()
   where id = p_contact_id;
  if not found then raise exception 'contact_not_found' using errcode = 'P0002'; end if;
end; $$;

revoke all on function public.crm_set_next_action(uuid, text, date) from public, anon;
grant execute on function public.crm_set_next_action(uuid, text, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: cuentas que no estaban en el CRM y datos nuevos de las que sí
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select distinct lower(email) as email from auth.users where email is not null
           union select distinct lower(email) from public.crm_contacts loop
    perform public.crm_refresh_contact_safe(r.email);
  end loop;
end $$;
