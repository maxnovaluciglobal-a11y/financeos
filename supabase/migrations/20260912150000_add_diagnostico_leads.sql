-- La auditoría 360 (12-sep-2026) encontró que el lead magnet "Diagnóstico
-- Exprés" de financeos-landing/diagnostico.html no capturaba el email de
-- quien lo completaba: el cálculo corre 100% client-side y no quedaba
-- ningún dato para hacer seguimiento (nurture). Esta tabla + RPC replican
-- el mismo patrón ya usado por starter_leads (20260912115533) para el
-- gate de email del diagnóstico: insert-only para el rol anon, sin policy
-- de select/update/delete, así una key filtrada no permite listar los
-- leads ya guardados.

create table if not exists public.diagnostico_leads (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  score      int,
  label      text,
  created_at timestamptz not null default now()
);

alter table public.diagnostico_leads enable row level security;

create policy "diagnostico_leads_insert_anon"
  on public.diagnostico_leads for insert
  to anon
  with check (true);

create or replace function public.register_diagnostico_lead(p_email text, p_score int default null, p_label text default null)
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
  insert into public.diagnostico_leads (email, score, label)
  values (v_email, p_score, nullif(left(coalesce(p_label, ''), 40), ''));
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.register_diagnostico_lead(text, int, text) from public;
grant  execute on function public.register_diagnostico_lead(text, int, text) to anon;
