-- Invest en pausa (D4, 07-oct-2026): apagar el cron diario de nurture.
-- invest-nurture-daily (20260918000900_invest_leads_nurture_cron.sql) manda
-- los correos 2 y 3 del quiz a toda fila de invest_leads. Con la página de
-- pausa, la lista de espera escribe en invest_leads con p_fuente='waitlist'
-- y recibiría correos "Tu perfil: Moderado" que no pidió.
-- Idempotente: no falla si pg_cron no está o el job ya no existe.
-- Para reactivar Invest: volver a programar el job con la definición de la
-- migración original.
do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname = 'invest-nurture-daily';
  end if;
end
$$;
