-- RPC pública para que invest-web notifique un signup nuevo sin exponer el
-- secreto interno (private.get_secret('cron_secret')) en el bundle del
-- cliente — mismo problema que ya resolvimos para Starter, pero ahí el
-- trigger corre 100% server-side (starter_leads es propia de MOY IQ). Invest
-- no tiene tabla propia de "nuevo signup" (profiles es compartida con MOY
-- IQ, ver invest-web/CLAUDE.md), así que el cliente de invest-web llama a
-- esta función justo después de un signUp() exitoso.
--
-- Freno anti-abuso liviano: solo dispara si existe un auth.users con ese
-- email creado en los últimos 10 minutos — no es un anon-callable
-- arbitrario, alguien podría llamarlo con cualquier email igual, pero como
-- mucho spamea el inbox admin con "nuevo registro" falsos, mismo riesgo ya
-- aceptado para register_starter_lead/register_diagnostico_lead.
create or replace function public.notify_invest_signup(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_email text; v_recent boolean;
begin
  v_email := trim(p_email);
  if v_email is null or v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false);
  end if;

  select exists(
    select 1 from auth.users
    where email = v_email and created_at > now() - interval '10 minutes'
  ) into v_recent;
  if not v_recent then
    return jsonb_build_object('ok', false, 'reason', 'not_a_recent_signup');
  end if;

  perform net.http_post(
    url := 'https://nelwgbcddwiaimzbcuas.supabase.co/functions/v1/notify-admin-signup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', coalesce(private.get_secret('cron_secret'), '')
    ),
    body := jsonb_build_object('event', 'invest_signup', 'email', v_email)
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.notify_invest_signup(text) from public;
grant  execute on function public.notify_invest_signup(text) to anon, authenticated;
