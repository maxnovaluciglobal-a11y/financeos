-- Diagnóstico temporal: Walter no puede activar su licencia Pro existente
-- (13-sep). Necesito ver la definición real de validate_license Y
-- fnos_resolve_hash en producción para descartar el bug histórico de doble
-- hash (ver financeos-app/CLAUDE.md, sección Supabase). Se borra en la
-- migración siguiente una vez resuelto.
create or replace function public._debug_validate_license_def()
returns text
language sql
security definer
set search_path = public
as $$
  select string_agg(pg_get_functiondef(oid), E'\n\n---\n\n')
  from pg_proc
  where proname in ('validate_license', 'fnos_resolve_hash');
$$;
revoke all on function public._debug_validate_license_def() from public, anon, authenticated;
grant execute on function public._debug_validate_license_def() to service_role;
