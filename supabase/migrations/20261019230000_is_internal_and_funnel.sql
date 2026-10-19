-- Auditoría 360, C-14 / DAT-9: marcar las filas internas y de prueba en leads y
-- CRM, y un embudo semanal que cuenta emails distintos sin internos.
-- Aditiva e idempotente. La vista vive en `private` (no expuesta por la API):
-- se lee con service role o desde el SQL Editor.

do $$
declare t text;
begin
  foreach t in array array['demo_leads','starter_leads','diagnostico_leads','invest_leads','newsletter_signups','crm_contacts'] loop
    if to_regclass('public.' || t) is not null and not exists (
      select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'is_internal'
    ) then
      execute format(
        $f$alter table public.%I add column is_internal boolean generated always as (
          coalesce(lower(email), '') ~ '(walterlamadriz|maxnovaluciglobal|lamadriz)|@example\.(com|net|org)$|(^|[._+-])(test|prueba)[0-9]*([._+@-]|$)'
        ) stored$f$, t);
    end if;
  end loop;
end $$;

create schema if not exists private;

create or replace view private.funnel_weekly as
with src as (
  select 'demo' as etapa, lower(email) as email, created_at, consent_confirmed_at, is_internal from public.demo_leads
  union all select 'diagnostico', lower(email), created_at, consent_confirmed_at, is_internal from public.diagnostico_leads
  union all select 'starter', lower(email), created_at, consent_confirmed_at, is_internal from public.starter_leads
  union all select 'invest', lower(email), created_at, consent_confirmed_at, is_internal from public.invest_leads
  union all select 'newsletter_' || product, lower(email), created_at, consent_confirmed_at, is_internal from public.newsletter_signups
)
select date_trunc('week', created_at)::date as semana,
       etapa,
       count(distinct email) filter (where not is_internal) as emails,
       count(distinct email) filter (where not is_internal and consent_confirmed_at is not null) as confirmados,
       count(distinct email) filter (where is_internal) as internos_excluidos
from src
group by 1, 2;

revoke all on private.funnel_weekly from public, anon, authenticated;
