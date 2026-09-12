-- Starter (free tier) no pedía ningún dato de contacto — nadie que elige
-- "Empezar gratis" quedaba registrado en ningún lado, a diferencia de quien
-- compra Pro (email vía Stripe) o activa una clave (email opcional vía
-- set_license_email). Esta tabla + RPC le dan el mismo camino a Starter,
-- sin bloquear la activación si el usuario lo salta.

create table if not exists public.starter_leads (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  created_at timestamptz not null default now()
);

alter table public.starter_leads enable row level security;

-- Solo insert desde el cliente (anon) — sin policy de select, así una key
-- filtrada no permite listar/scrapear los correos ya guardados.
create policy "starter_leads_insert_anon"
  on public.starter_leads for insert
  to anon
  with check (true);

create or replace function public.register_starter_lead(p_email text)
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
  insert into public.starter_leads (email) values (v_email);
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.register_starter_lead(text) from public;
grant  execute on function public.register_starter_lead(text) to anon;
