-- CRM mínimo compartido MOY IQ + Invest (pedido de Walter, 13-sep-2026).
-- No reemplaza ninguna herramienta externa — es una tabla + vista para dejar
-- de mirar diagnostico_leads a mano en el SQL Editor. Acceso restringido al
-- email admin de Walter vía RLS (auth.jwt()->>'email'), no vía lógica de app.
--
-- Alimentación automática: hoy solo diagnostico_leads (MOY IQ) tiene captura
-- de leads real. Invest no tiene lead magnet propio todavía (ver memoria
-- financeos_moy_iq_invest_auditoria_completa_20260913.md, sección CRM) —
-- cuando se porte el diagnóstico a Invest, sumar su propio trigger acá.

create table if not exists public.crm_contacts (
  id               uuid primary key default gen_random_uuid(),
  email            text not null,
  producto_origen  text not null check (producto_origen in ('moyiq', 'invest')),
  fuente           text,
  estado           text not null default 'nuevo'
                     check (estado in ('nuevo','contactado','nutriendo','convertido','perdido')),
  score            int,
  ultimo_contacto  timestamptz,
  notas            text,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  unique (email, producto_origen)
);

alter table public.crm_contacts enable row level security;

-- Único lector/editor: el email admin de Walter, autenticado vía Supabase Auth.
-- No depende de ninguna tabla de roles de la app (MOY IQ usa licencias por
-- clave, no auth.users, para sus propios usuarios finales).
create policy "crm_contacts_admin_all"
  on public.crm_contacts for all
  to authenticated
  using (auth.jwt() ->> 'email' = 'walterlamadriz@gmail.com')
  with check (auth.jwt() ->> 'email' = 'walterlamadriz@gmail.com');

create index if not exists crm_contacts_estado_idx on public.crm_contacts (estado);
create index if not exists crm_contacts_producto_idx on public.crm_contacts (producto_origen);

-- Atribución: de dónde vino el lead del diagnóstico. Sin esto no se puede
-- medir qué canal funciona.
alter table public.diagnostico_leads
  add column if not exists fuente text;

-- Alimenta crm_contacts automáticamente cada vez que se registra o actualiza
-- un lead del diagnóstico. security definer porque diagnostico_leads solo
-- permite insert a anon (sin select) — la función corre con privilegios de
-- owner, no del rol que dispara el insert.
create or replace function public.sync_diagnostico_lead_to_crm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.crm_contacts (email, producto_origen, fuente, score)
  values (new.email, 'moyiq', new.fuente, new.score)
  on conflict (email, producto_origen) do update
    set score = coalesce(excluded.score, crm_contacts.score),
        fuente = coalesce(crm_contacts.fuente, excluded.fuente),
        actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_diagnostico_lead_to_crm on public.diagnostico_leads;
create trigger trg_sync_diagnostico_lead_to_crm
  after insert on public.diagnostico_leads
  for each row execute function public.sync_diagnostico_lead_to_crm();

-- register_diagnostico_lead ahora acepta fuente (UTM o "cómo nos encontraste").
create or replace function public.register_diagnostico_lead(
  p_email text,
  p_score int default null,
  p_label text default null,
  p_consent_marketing boolean default false,
  p_fuente text default null
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
  insert into public.diagnostico_leads (email, score, label, consent_marketing, fuente)
  values (v_email, p_score, nullif(left(coalesce(p_label, ''), 40), ''), coalesce(p_consent_marketing, false), nullif(left(coalesce(p_fuente, ''), 60), ''));
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.register_diagnostico_lead(text, int, text, boolean, text) from public;
grant  execute on function public.register_diagnostico_lead(text, int, text, boolean, text) to anon;

-- Elimina el overload de 4 argumentos: PostgREST resuelve por nombres de
-- parámetro, así que dejar los dos vivos significa que el JS viejo (sin
-- fuente) sigue pegándole al de 4 args para siempre y nunca captura
-- atribución. Mismo patrón de colisión de funciones ya encontrado y resuelto
-- hoy en Invest (validate_license) — no repetirlo acá.
drop function if exists public.register_diagnostico_lead(text, int, text, boolean);

-- Vista de embudo: cuántos contactos por producto/estado. Sin esto no se
-- puede medir conversión del lead magnet, solo mirar filas sueltas.
create or replace view public.crm_funnel as
select producto_origen, estado, count(*) as total
from public.crm_contacts
group by producto_origen, estado
order by producto_origen, estado;
