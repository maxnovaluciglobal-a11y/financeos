-- Lead magnet: calculadora de impuestos (financeos-landing/calculadora-impuestos.html).
-- Tabla propia y distinta de starter_leads (esa es del flujo "Empezar gratis" de
-- la app) para no pisar ese proceso ni mezclar dos orígenes de lead distintos.
-- Mismo patrón de seguridad: insert-only para anon, sin policy de select — una
-- key filtrada no permite listar/scrapear los correos ya guardados.

create table if not exists public.tax_calculator_leads (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  country      text not null default 'CL',
  renta_anual  numeric,
  impuesto     numeric,
  created_at   timestamptz not null default now()
);

alter table public.tax_calculator_leads enable row level security;

create policy "tax_calculator_leads_insert_anon"
  on public.tax_calculator_leads for insert
  to anon
  with check (true);

create or replace function public.register_tax_calculator_lead(
  p_email       text,
  p_country     text default 'CL',
  p_renta_anual numeric default null,
  p_impuesto    numeric default null
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
  insert into public.tax_calculator_leads (email, country, renta_anual, impuesto)
  values (v_email, coalesce(nullif(trim(p_country), ''), 'CL'), p_renta_anual, p_impuesto);
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.register_tax_calculator_lead(text, text, numeric, numeric) from public;
grant  execute on function public.register_tax_calculator_lead(text, text, numeric, numeric) to anon;
