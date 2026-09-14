-- Limpieza del diagnóstico temporal de 20260918000100 (Walter no podía
-- activar su licencia Pro existente). Ya resuelto: fnos_resolve_hash/
-- validate_license estaban bien, el problema era la clave en sí, se le
-- emitió una nueva. No dejar esta función de introspección en producción.
drop function if exists public._debug_validate_license_def();
