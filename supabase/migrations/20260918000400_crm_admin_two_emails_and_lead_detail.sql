-- Pedido de Walter (14-sep-2026): el CRM lo tienen que poder usar sus dos
-- cuentas — la personal (walterlamadriz@gmail.com, con la que ya operaba) y
-- la de negocio (maxnovaluciglobal@gmail.com, cuenta a la que se migró la
-- infra en 20260831). Antes era un solo email hardcodeado
-- (20260916000000_crm_contacts.sql) — cualquier login con otra cuenta seguía
-- viendo la pantalla vacía sin error, pero maxnovaluciglobal tampoco podía
-- entrar. Se reemplaza el policy por un `in (...)` con las dos.
drop policy if exists "crm_contacts_admin_all" on public.crm_contacts;
create policy "crm_contacts_admin_all"
  on public.crm_contacts for all
  to authenticated
  using (auth.jwt() ->> 'email' in ('walterlamadriz@gmail.com', 'maxnovaluciglobal@gmail.com'))
  with check (auth.jwt() ->> 'email' in ('walterlamadriz@gmail.com', 'maxnovaluciglobal@gmail.com'));

-- Detalle de lead: hasta ahora AdminCRM solo mostraba la fila de crm_contacts
-- (estado/notas/score), sin poder ver el historial real de nurture (qué
-- email de la secuencia de 3 ya se mandó, cuándo). Esa data vive en
-- diagnostico_leads (email1/2/3_sent_at, ver 20260913173000), que no tenía
-- ninguna policy de lectura para admin — solo insert para anon. Sin esto el
-- panel no puede mostrar "qué nurture recibió este lead todavía".
drop policy if exists "diagnostico_leads_admin_select" on public.diagnostico_leads;
create policy "diagnostico_leads_admin_select"
  on public.diagnostico_leads for select
  to authenticated
  using (auth.jwt() ->> 'email' in ('walterlamadriz@gmail.com', 'maxnovaluciglobal@gmail.com'));

-- Starter (usuario gratis) hoy no aparece en ningún lado salvo starter_leads
-- (solo insert, ver 20260912115533) — sin trigger, no cae en crm_contacts ni
-- recibe seguimiento. Walter pidió explícitamente sumarlo (14-sep-2026):
-- CRM + nurture automático, igual que el Diagnóstico Exprés. Este trigger
-- resuelve la mitad "CRM" (alimenta crm_contacts); la mitad "nurture"
-- (secuencia de emails + cron) es trabajo aparte, ver
-- supabase/functions/send-nurture-starter-email/.
alter table public.starter_leads
  add column if not exists email1_sent_at timestamptz,
  add column if not exists email2_sent_at timestamptz,
  add column if not exists email3_sent_at timestamptz,
  add column if not exists unsubscribed_at timestamptz,
  add column if not exists account_created_at timestamptz;

create index if not exists starter_leads_nurture_eligible_idx
  on public.starter_leads (unsubscribed_at, account_created_at)
  where unsubscribed_at is null and account_created_at is null;

create or replace function public.sync_starter_lead_to_crm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.crm_contacts (email, producto_origen, fuente)
  values (new.email, 'moyiq', 'starter')
  on conflict (email, producto_origen) do update
    set fuente = coalesce(crm_contacts.fuente, excluded.fuente),
        actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_starter_lead_to_crm on public.starter_leads;
create trigger trg_sync_starter_lead_to_crm
  after insert on public.starter_leads
  for each row execute function public.sync_starter_lead_to_crm();

-- Igual que diagnostico_leads: cuando se crea la cuenta real, sale de la
-- secuencia de nurture (ya no es "lead sin convertir", es usuario).
create or replace function public.mark_starter_lead_account_created()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.starter_leads
     set account_created_at = now()
   where email = new.email
     and account_created_at is null;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_mark_starter_lead on auth.users;
create trigger on_auth_user_created_mark_starter_lead
  after insert on auth.users
  for each row
  execute function public.mark_starter_lead_account_created();

-- El admin necesita leer starter_leads igual que diagnostico_leads (detalle
-- de lead en el panel, ver AdminCRM.jsx).
drop policy if exists "starter_leads_admin_select" on public.starter_leads;
create policy "starter_leads_admin_select"
  on public.starter_leads for select
  to authenticated
  using (auth.jwt() ->> 'email' in ('walterlamadriz@gmail.com', 'maxnovaluciglobal@gmail.com'));
