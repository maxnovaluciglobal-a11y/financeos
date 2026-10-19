# Esquema de la base: de dónde sale cada tabla

Auditoría 360, DAT-10 (19-oct-2026). La base `financeos-prod` la comparten la app y MOY IQ Invest.

- `supabase/migrations/` de este repo es la fuente para lo de la app (leads, CRM, entitlements, cancelaciones, monitoreo…).
- `supabase/migrations/20261019185000_baseline_handmade_tables.sql` versiona, de forma idempotente, las tablas que se crearon a mano o desde `invest-web` (licencias, `synced_data`, `cloud_backups`, `push_subscriptions`, `profiles`, `portfolio_holdings`, `watchlist`, `consents`, `invest_leads`, `trial_emails`, `webhook_events`, `invest_activity_days`), con constraints, índices, triggers, RLS y políticas. Se generó del esquema de producción y en producción no cambia nada. Probado en una base local: aplicado dos veces sin errores y, borradas esas tablas, las recrea con sus 13 políticas.
- `invest-web/supabase/migrations/` sigue existiendo (no se tocó): el historial remoto de migraciones es compartido y no conoce las de ese repo.
- Los archivos `supabase-*.sql` de la raíz quedan como historia.

**Reconstruir el esquema en una base nueva:** el camino verificado es `supabase db dump --linked --schema public,private` y restaurarlo (se restauró sin errores en un Postgres local de Supabase el 19-oct-2026). Si se reconstruye con migraciones, correr primero el baseline y después el resto en orden. Los triggers sobre `auth.users` (`handle_new_user`, `crm_on_auth_user_created`) viven en el esquema `auth` y no están en el dump de `public`: revisarlos a mano.

**Aplicar una migración en producción:** el historial remoto es compartido con `invest-web`. Aplicar el archivo con `supabase db query --linked -f <archivo>` y registrarlo con `supabase migration repair --status applied <versión> --linked`; verificar con `supabase migration list --linked` y SELECT.

**Privilegios por defecto (desde el 19-oct-2026):** una tabla, vista, secuencia o función nueva en `public` creada por `postgres` ya **no** recibe permisos para `anon` ni `authenticated` (antes nacía con ALL). Cada migración tiene que dar explícitamente los grants que necesita (`grant select on … to authenticated`, `grant execute on function … to anon`). Los privilegios por defecto del rol `supabase_admin` no se pueden cambiar desde `postgres`.
