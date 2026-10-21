-- SEG-1 (auditoría 360): cierre del acceso directo a las RPC de formularios públicos.
--
-- Desde el 21-oct-2026 todas las altas pasan por la Edge Function lead-submit, que verifica
-- Cloudflare Turnstile (TURNSTILE_ENFORCE=1) y llama a la RPC con el service role. Sin este
-- cierre, un bot podía saltarse el captcha llamando /rest/v1/rpc/<rpc> con la clave publicable.
-- Después de esto, anon y authenticated reciben 401/42501 en esas rutas; solo service_role
-- (lead-submit) las ejecuta. Ver docs/turnstile.md.
--
-- Rollback (si un formulario deja de funcionar): volver a dar EXECUTE a anon/authenticated
-- en la función afectada (ver el bloque comentado al final).
-- Aplicar: supabase db query --linked -f <este archivo> + migration repair.

revoke execute on function public.register_newsletter_signup(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.register_diagnostico_lead(text, integer, text, boolean, text, text) from public, anon, authenticated;
revoke execute on function public.register_tax_calculator_lead(text, text, numeric, numeric) from public, anon, authenticated;
revoke execute on function public.register_invest_lead(text, text, integer, text, boolean) from public, anon, authenticated;
revoke execute on function public.register_starter_lead(text, text, boolean) from public, anon, authenticated;
revoke execute on function public.register_demo_lead(text, text, boolean, text) from public, anon, authenticated;
revoke execute on function public.submit_cancellation_request(text, text, text, text, text, text, date, text, text) from public, anon, authenticated;

grant execute on function public.register_newsletter_signup(text, text, text, text) to service_role;
grant execute on function public.register_diagnostico_lead(text, integer, text, boolean, text, text) to service_role;
grant execute on function public.register_tax_calculator_lead(text, text, numeric, numeric) to service_role;
grant execute on function public.register_invest_lead(text, text, integer, text, boolean) to service_role;
grant execute on function public.register_starter_lead(text, text, boolean) to service_role;
grant execute on function public.register_demo_lead(text, text, boolean, text) to service_role;
grant execute on function public.submit_cancellation_request(text, text, text, text, text, text, date, text, text) to service_role;

-- Rollback:
-- grant execute on function public.<rpc>(<firma>) to anon, authenticated;
