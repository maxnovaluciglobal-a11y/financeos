-- Relanzamiento v2 de Invest (beta pública gratuita, oct-2026): volver a
-- programar el cron diario de nurture invest-nurture-daily, que se apagó en
-- 20261008000600_pause_invest_nurture_cron.sql mientras Invest estaba en pausa.
--
-- APLICAR SOLO DESPUÉS de desplegar la versión nueva de la función:
--   supabase functions deploy send-nurture-invest-email
-- La versión anterior manda copy con planes Pro, precios y "tiempo real",
-- que ya no corresponde al relanzamiento.
--
-- Backlog y consentimiento (decisión de Walter, 08-oct-2026):
--   1. Toda fila de invest_leads creada antes del 2026-10-08 (lista de espera
--      de la pausa y leads viejos del quiz) se marca como ya enviada para los
--      correos 2 y 3 y queda sin consentimiento de marketing: la lista de
--      espera recibe solo el email de relanzamiento (envío manual único).
--   2. consent_marketing pasa a default false y register_invest_lead acepta
--      p_consent_marketing (la casilla del quiz). El cron (correos 2 y 3) ya
--      filtra consent_marketing=is.true; el correo 1 con el RESULTADO del quiz
--      es transaccional (lo pidió la persona) y se sigue mandando siempre.
--
-- Definición calcada de 20260918000900_invest_leads_nurture_cron.sql: mismo
-- nombre, mismo horario (37 14 * * * UTC), misma URL y el mismo secreto
-- compartido vía private.get_secret('cron_secret'). Nada de secretos inline.
--
-- Idempotente: si el job existe se desprograma antes de volver a crearlo.
--
-- Rollback (volver a pausar):
--   select cron.unschedule('invest-nurture-daily');
-- (El update del backlog y el default de consentimiento no se revierten: son
-- la política vigente.)

-- === 1. Backlog: nadie anterior al relanzamiento entra a la secuencia =========
update public.invest_leads
   set email2_sent_at    = coalesce(email2_sent_at, now()),
       email3_sent_at    = coalesce(email3_sent_at, now()),
       consent_marketing = false
 where created_at < '2026-10-08T00:00:00Z';

-- === 2. Consentimiento explícito ==============================================
alter table public.invest_leads
  alter column consent_marketing set default false;

-- Se reemplaza la firma de 4 argumentos por una de 5 (con default), para que
-- PostgREST no vea dos candidatas ambiguas. Las llamadas viejas con 4
-- argumentos nombrados siguen funcionando y quedan sin consentimiento.
drop function if exists public.register_invest_lead(text, text, int, text);

create or replace function public.register_invest_lead(
  p_email  text,
  p_perfil text default null,
  p_score  int default null,
  p_fuente text default null,
  p_consent_marketing boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text;
  v_perfil text;
  v_id uuid;
begin
  v_email := trim(p_email);
  if v_email is null or v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false);
  end if;

  v_perfil := nullif(left(coalesce(p_perfil, ''), 20), '');
  if v_perfil is not null and v_perfil not in ('conservador', 'moderado', 'agresivo') then
    v_perfil := null;
  end if;

  if p_score is not null and (p_score < 0 or p_score > 100) then
    p_score := null;
  end if;

  insert into public.invest_leads (email, perfil, score, fuente, consent_marketing)
  values (v_email, v_perfil, p_score, nullif(left(coalesce(p_fuente, ''), 60), ''),
          coalesce(p_consent_marketing, false))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.register_invest_lead(text, text, int, text, boolean) from public;
grant  execute on function public.register_invest_lead(text, text, int, text, boolean) to anon;

-- === 3. Cron ===================================================================
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
