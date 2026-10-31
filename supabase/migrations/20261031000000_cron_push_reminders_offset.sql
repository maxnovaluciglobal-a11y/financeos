-- fnos-push-trial-reminders corría a las 14:00:00, el mismo segundo que
-- newsletter-sync (*/10) y uptime-check (*/5). cron_health_snapshot() atribuye
-- cada respuesta HTTP por ventana de tiempo, así que el 200 de send-push quedaba
-- registrado a nombre de newsletter-sync y cron-health-alert avisaba todos los
-- días "no hay respuesta HTTP registrada" sin que el job fallara (correos
-- "[MOY IQ] cron con problemas" desde el 20-oct). Se corre en el minuto 1, que
-- no choca con ningún otro job. Sin efecto si el job no existe (replay).
do $$
declare v_job bigint;
begin
  if to_regclass('cron.job') is null then return; end if;
  select jobid into v_job from cron.job where jobname = 'fnos-push-trial-reminders';
  if v_job is not null then
    perform cron.alter_job(job_id := v_job, schedule := '1 14 * * *');
  end if;
end $$;
