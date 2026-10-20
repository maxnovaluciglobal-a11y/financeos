-- 20261020040000_crm_followup_rpc.sql
-- Auditoría 360, C-46 (DAT-19): tareas programadas de seguimiento con acceso mínimo.
--
-- Una tarea de seguimiento no necesita SQL libre ni el email en su archivo:
--   crm_followup_check(contact_id, since)  decide en la base si corresponde escribirle
--     (volvió a entrar, se dio de baja o ya hubo un correo) y devuelve el email SOLO
--     cuando corresponde enviar.
--   crm_set_estado(contact_id, estado)     único cambio de estado permitido.
-- Se suman a crm_add_activity y crm_set_next_action (20261020020000). Solo la cuenta
-- de empresa o una conexión directa (CLI) pueden ejecutarlas.
--
-- Aditiva e idempotente.

create or replace function public.crm_followup_check(p_contact_id uuid, p_since timestamptz)
returns table (eligible boolean, reason text, to_email text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text;
  v_login timestamptz;
begin
  if not public.crm_is_admin_caller() then raise exception 'forbidden' using errcode = '42501'; end if;
  select lower(email), ultimo_login into v_email, v_login from public.crm_contacts where id = p_contact_id;
  if v_email is null then raise exception 'contact_not_found' using errcode = 'P0002'; end if;

  select greatest(v_login, max(last_sign_in_at)) into v_login from auth.users where lower(email) = v_email;
  if v_login is not null and v_login > p_since then
    return query select false, 'volvio_a_entrar'::text, null::text; return;
  end if;

  if exists (select 1 from public.starter_leads     where lower(email) = v_email and unsubscribed_at is not null)
     or exists (select 1 from public.diagnostico_leads where lower(email) = v_email and unsubscribed_at is not null)
     or exists (select 1 from public.demo_leads        where lower(email) = v_email and unsubscribed_at is not null)
     or exists (select 1 from public.invest_leads      where lower(email) = v_email and unsubscribed_at is not null)
     or exists (select 1 from public.newsletter_signups where lower(email) = v_email and unsubscribed_at is not null) then
    return query select false, 'baja'::text, null::text; return;
  end if;

  if exists (select 1 from public.crm_activities where contact_id = p_contact_id and tipo = 'correo') then
    return query select false, 'ya_contactado'::text, null::text; return;
  end if;

  return query select true, 'corresponde'::text, v_email;
end; $$;

revoke all on function public.crm_followup_check(uuid, timestamptz) from public, anon;
grant execute on function public.crm_followup_check(uuid, timestamptz) to authenticated;

create or replace function public.crm_set_estado(p_contact_id uuid, p_estado text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.crm_is_admin_caller() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.crm_contacts set estado = p_estado, actualizado_en = now() where id = p_contact_id;
  if not found then raise exception 'contact_not_found' using errcode = 'P0002'; end if;
end; $$;

revoke all on function public.crm_set_estado(uuid, text) from public, anon;
grant execute on function public.crm_set_estado(uuid, text) to authenticated;
