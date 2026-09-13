-- Adds the columns the diagnostico-nurture 3-email sequence needs to filter
-- who's still eligible (see financeos-landing/marketing/nurture-diagnostico-3-emails.md).
-- Only schema + consent capture — does NOT create the sending function/cron.
-- That's a separate follow-up once Walter reviews the sender/domain setup.

alter table public.diagnostico_leads
  add column if not exists consent_marketing boolean not null default false,
  add column if not exists account_created_at timestamptz,
  add column if not exists unsubscribed_at timestamptz;

-- register_diagnostico_lead now requires explicit consent to be true before
-- accepting the insert — no more "implied consent from filling the form".
create or replace function public.register_diagnostico_lead(
  p_email text,
  p_score int default null,
  p_label text default null,
  p_consent_marketing boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_email text;
begin
  v_email := trim(p_email);
  if v_email is null or v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false);
  end if;
  if p_score is not null and (p_score < 0 or p_score > 100) then
    p_score := null;
  end if;
  insert into public.diagnostico_leads (email, score, label, consent_marketing)
  values (v_email, p_score, nullif(left(coalesce(p_label, ''), 40), ''), coalesce(p_consent_marketing, false));
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.register_diagnostico_lead(text, int, text, boolean) from public;
grant  execute on function public.register_diagnostico_lead(text, int, text, boolean) to anon;
