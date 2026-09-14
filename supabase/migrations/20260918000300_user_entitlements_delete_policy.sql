-- Causa raíz del bug "Desactivar licencia no hace nada": Settings.jsx solo
-- limpiaba el localStorage del dispositivo, pero App.jsx tiene un useEffect
-- que resincroniza el plan contra user_entitlements al cargar — con un
-- entitlement server-side todavía en pie, ese efecto reponía Starter/Pro
-- automáticamente antes de que la pantalla de activar llegara a aparecer.
-- La única forma real de "desactivar" es borrar también el entitlement de
-- la cuenta, y para eso al usuario le faltaba permiso de DELETE (RLS solo
-- tenía select/insert/update, ver 20260912143300_add_user_entitlements.sql).
create policy "user deletes own entitlement"
  on public.user_entitlements for delete
  using (auth.uid() = user_id);
