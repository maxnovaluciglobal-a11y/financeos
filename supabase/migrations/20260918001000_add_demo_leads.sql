-- El demo (demo.moyiq.app) pasa de "sin registro" a pedir email+nombre antes
-- de entrar. Mismo patrón que starter_leads (20260912115533): insert-only
-- desde anon, sin policy de select, para que una key filtrada no permita
-- listar/scrapear los correos ya guardados. A diferencia de starter_leads,
-- acá también se guarda p_nombre (pedido explícito del gate: email + nombre,
-- no solo email) y consentimiento de marketing explícito, mismo criterio que
-- diagnostico_leads (20260913120000) — nunca asumir opt-in del solo hecho de
-- pasar el gate.

create table if not exists public.demo_leads (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  nombre            text not null,
  consent_marketing boolean not null default false,
  created_at        timestamptz not null default now()
);

alter table public.demo_leads enable row level security;

create policy "demo_leads_insert_anon"
  on public.demo_leads for insert
  to anon
  with check (true);

create or replace function public.register_demo_lead(
  p_email  text,
  p_nombre text,
  p_consent_marketing boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email  text;
  v_nombre text;
  v_id     uuid;
begin
  v_email  := trim(p_email);
  v_nombre := trim(p_nombre);
  if v_email is null or v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false);
  end if;
  if v_nombre is null or v_nombre = '' then
    return jsonb_build_object('ok', false);
  end if;
  insert into public.demo_leads (email, nombre, consent_marketing)
  values (v_email, v_nombre, coalesce(p_consent_marketing, false))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.register_demo_lead(text, text, boolean) from public;
grant  execute on function public.register_demo_lead(text, text, boolean) to anon;
