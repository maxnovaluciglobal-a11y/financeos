-- Secuencia de nurture por email para el lead magnet de Invest
-- (perfil-inversor.html → invest_leads), pedido explícito de Walter,
-- 14-sep-2026 — calcada del patrón ya construido para Starter
-- (20260918000500_starter_leads_consent_and_nurture_cron.sql) y Diagnóstico.
--
-- invest_leads vive físicamente en el Supabase compartido pero se creó
-- desde una migración de invest-web (20260914150000_invest_lead_magnet.sql).
-- Esta migración corre desde financeos-app porque es el repo que tiene el
-- CLI linkeado a este proyecto — no hay problema en tocar la tabla desde
-- acá, ya se hizo lo mismo con `licenses` en el pasado (ver CLAUDE.md de
-- invest-web, hallazgo de colisión ya resuelto).
--
-- Verificado antes de escribir esto (session 14-sep-2026):
--   - Los 3 triggers existentes en auth.users son on_auth_user_created,
--     on_auth_user_created_mark_diagnostico_lead y
--     on_auth_user_created_mark_starter_lead. Ninguno toca invest_leads —
--     se agrega uno nuevo, sin pisar ni reemplazar los otros dos.
--   - register_invest_lead ya existe (creada en invest-web) y hoy retorna
--     solo {ok:true} — se reemplaza acá con CREATE OR REPLACE para sumar el
--     id en el retorno, mismo cambio que se hizo para register_starter_lead
--     en 20260918000600. No se toca ninguna otra parte de esa función.
--
-- Consent: invest_leads tampoco pide opt-in explícito en el quiz — mismo
-- razonamiento documentado en 20260918000500 para starter_leads: se agrega
-- consent_marketing boolean not null default true, con opt-out visible en
-- cada email. No cambia el comportamiento (todos elegibles desde el día
-- uno), pero deja el gate simétrico con starter_leads/diagnostico_leads.

alter table public.invest_leads
  add column if not exists email1_sent_at timestamptz,
  add column if not exists email2_sent_at timestamptz,
  add column if not exists email3_sent_at timestamptz,
  add column if not exists consent_marketing boolean not null default true,
  add column if not exists unsubscribed_at timestamptz,
  add column if not exists account_created_at timestamptz;

create index if not exists invest_leads_nurture_eligible_idx
  on public.invest_leads (unsubscribed_at, consent_marketing, account_created_at)
  where unsubscribed_at is null and consent_marketing = true and account_created_at is null;

-- === trigger: marcar cuenta creada (sale de la secuencia de nurture) =========
-- Específico para invest_leads — NO reemplaza ni toca
-- mark_starter_lead_account_created ni mark_diagnostico_lead_account_created.

create or replace function public.mark_invest_lead_account_created()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.invest_leads
     set account_created_at = now()
   where email = new.email
     and account_created_at is null;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_mark_invest_lead on auth.users;
create trigger on_auth_user_created_mark_invest_lead
  after insert on auth.users
  for each row
  execute function public.mark_invest_lead_account_created();

-- === RPC de unsubscribe =======================================================

create or replace function public.unsubscribe_invest_lead(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.invest_leads
     set unsubscribed_at = now()
   where id = p_id
     and unsubscribed_at is null;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.unsubscribe_invest_lead(uuid) from public;
grant  execute on function public.unsubscribe_invest_lead(uuid) to anon;

-- === register_invest_lead: ahora devuelve id ================================
-- Igual cambio que 20260918000600 hizo con register_starter_lead — necesario
-- para que perfil-inversor.html dispare el email de bienvenida apenas el
-- RPC responde ok:true. No cambia ninguna otra parte del comportamiento
-- (misma validación de email/perfil/score, mismo insert, mismo trigger de
-- sync a crm_contacts que ya dispara solo con el insert).

create or replace function public.register_invest_lead(
  p_email  text,
  p_perfil text default null,
  p_score  int default null,
  p_fuente text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text;
  v_perfil text;
  v_id uuid;
begin
  v_email := trim(p_email);
  if v_email is null or v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false);
  end if;

  v_perfil := nullif(left(coalesce(p_perfil, ''), 20), '');
  if v_perfil is not null and v_perfil not in ('conservador', 'moderado', 'agresivo') then
    v_perfil := null;
  end if;

  if p_score is not null and (p_score < 0 or p_score > 100) then
    p_score := null;
  end if;

  insert into public.invest_leads (email, perfil, score, fuente)
  values (v_email, v_perfil, p_score, nullif(left(coalesce(p_fuente, ''), 60), ''))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.register_invest_lead(text, text, int, text) from public;
grant  execute on function public.register_invest_lead(text, text, int, text) to anon;

-- === cron ======================================================================
-- 37 14 * * * UTC — 13 min después del de Starter (27 14 * * *), para no
-- competir por la misma ventana de envío de Resend ni el mismo minuto de
-- pg_cron. Reusa private.get_secret('cron_secret'), mismo secreto
-- compartido — nada nuevo que cargar.

select cron.schedule(
  'invest-nurture-daily',
  '37 14 * * *',
  $$
  select net.http_post(
    url := 'https://nelwgbcddwiaimzbcuas.supabase.co/functions/v1/send-nurture-invest-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(private.get_secret('cron_secret'), '')
    ),
    body := jsonb_build_object('mode', 'cron')
  );
  $$
);

-- Para desactivar si hace falta: select cron.unschedule('invest-nurture-daily');
