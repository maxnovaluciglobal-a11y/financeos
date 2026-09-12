-- user_entitlements: recuerda la elección de plan (Starter/Pro) por CUENTA,
-- no por dispositivo. Antes de esta tabla, Starter/Pro vivían solo en
-- localStorage (ver licenseValidator.js) — un usuario que entraba desde un
-- dispositivo nuevo con el mismo login (Google o email/contraseña) volvía a
-- ver la pantalla de elegir plan, porque no había ninguna cuenta compartida
-- entre dispositivos hasta el login obligatorio del 12-sep-2026.
--
-- Se escribe una sola vez, al momento de acknowledgeStarter() (Starter) o de
-- validar una key Pro exitosamente (ver LicenseGate.jsx). No reemplaza la
-- validación real de la key — esa sigue viviendo en el sistema existente
-- (licenses / validate_license, ver financeos-app/CLAUDE.md). Guardar la key
-- ya validada acá es solo para poder re-validarla automáticamente (mismo
-- validateLicense() de siempre) en un dispositivo nuevo, sin pedirla de nuevo.
create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null check (plan in ('starter', 'pro')),
  license_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_entitlements enable row level security;

create policy "user reads own entitlement"
  on public.user_entitlements for select
  using (auth.uid() = user_id);

create policy "user inserts own entitlement"
  on public.user_entitlements for insert
  with check (auth.uid() = user_id);

create policy "user updates own entitlement"
  on public.user_entitlements for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
