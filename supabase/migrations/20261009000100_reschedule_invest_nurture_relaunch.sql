-- Relanzamiento v2 de Invest (beta pública gratuita, oct-2026): volver a
-- programar el cron diario de nurture invest-nurture-daily, que se apagó en
-- 20261008000600_pause_invest_nurture_cron.sql mientras Invest estaba en pausa.
--
-- APLICAR SOLO DESPUÉS de desplegar la versión nueva de la función:
--   supabase functions deploy send-nurture-invest-email
-- La versión anterior manda copy con planes Pro, precios y "tiempo real",
-- que ya no corresponde al relanzamiento.
--
-- OJO, backlog: la función no filtra por fuente ni por antigüedad. En la
-- primera corrida, toda fila de invest_leads con unsubscribed_at null,
-- consent_marketing true, account_created_at null y email2_sent_at null
-- (incluida la lista de espera, fuente='waitlist') recibe el correo 2, hasta
-- 200 por corrida; el correo 3 sale 3 días después. Revisar el conteo antes
-- de aplicar.
--
-- Definición calcada de 20260918000900_invest_leads_nurture_cron.sql: mismo
-- nombre, mismo horario (37 14 * * * UTC), misma URL y el mismo secreto
-- compartido vía private.get_secret('cron_secret'). Nada de secretos inline.
--
-- Idempotente: si el job existe se desprograma antes de volver a crearlo.
--
-- Rollback (volver a pausar):
--   select cron.unschedule('invest-nurture-daily');

do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname = 'invest-nurture-daily';
  end if;
end
$$;

select cron.schedule(
  'invest-nurture-daily',
  '37 14 * * *',
  $$
  select net.http_post(
    url := 'https://nelwgbcddwiaimzbcuas.supabase.co/functions/v1/send-nurture-invest-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(private.get_secret('cron_secret'), '')
    ),
    body := jsonb_build_object('mode', 'cron')
  );
  $$
);
