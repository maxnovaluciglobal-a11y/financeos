# Edge Functions

Cada carpeta es una función de Supabase (Deno). Reglas generales en `CLAUDE.md`
("Sesiones paralelas y despliegue", punto 5): se despliegan a mano desde el
árbol principal en `main`, con el candado, una entrada en `config.toml` y en
`_shared/verifyJwtConfig.test.ts`, y el handler envuelto en
`withErrorReporting("<nombre>", …)`.

## invest-alerts-check (Inversiones F4, 20-nov-2026)

Revisa las alertas de precio activas (`public.invest_alerts`, migración
`20261120000100_invest_alerts.sql`) y avisa por Web Push a los dispositivos de
la cuenta, con la app cerrada.

- **Quién la llama:** solo un scheduler, con `POST` y el header
  `x-cron-secret: <CRON_SECRET>` (el mismo secreto que usan `send-push` y
  `cron-health-alert`). Sin CORS: un navegador no puede usarla. `OPTIONS`
  responde 204 sin hacer nada; cualquier otro método, 405.
- **Qué hace:** lee las alertas activas con service role, pide los precios en
  lotes de 10 a `GET https://invest.moyiq.app/api/quote?ticker=…` (los mismos
  endpoints que usa la app, sin cabecera `Origin`, que la API acepta), marca
  `last_triggered_at` con un `PATCH` que solo reclama las alertas sin aviso en
  las últimas 24 h (dos corridas cruzadas no avisan dos veces) y manda el aviso
  con `_shared/webPush.ts` (el cifrado de `send-push`). Un movimiento del día
  (`pct_move`) avisa una sola vez por sesión de mercado. Las suscripciones que
  responden 404/410 se borran, como en `send-push`.
- **Destinos:** `invest_alert_push_targets(uuid[])` (solo service role) une
  cuenta → `user_entitlements.license_key` → `push_subscriptions.key_hash`. Una
  cuenta sin licencia o sin avisos activados en ningún dispositivo no recibe el
  push; la alerta igual queda marcada y la app la muestra como alcanzada.
- **Cuerpo opcional:** `{ "mode": "check" }` solo cuenta (alertas, símbolos,
  cuántas sonarían) sin marcar ni avisar. Sirve para probarla en producción sin
  mandar nada.
- **Secrets:** `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
  `VAPID_SUBJECT` (ya existen para `send-push`), `INVEST_API_URL` opcional
  (por defecto `https://invest.moyiq.app`). `SUPABASE_URL` y
  `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase.
- **Lógica y pruebas:** `alertLogic.ts` (pura) y `alertLogic.test.ts`; la app
  decide igual con `src/utils/investAlerts.js` (el test compara las dos).
  SQL: `supabase/tests/invest_alerts.sql`.

### Pasos para ponerla en marcha (no se hicieron: los hace Walter)

1. Aplicar la migración (historial compartido con `invest-web`):

   ```bash
   supabase db query --linked --project-ref nelwgbcddwiaimzbcuas --workdir "$(mktemp -d)" \
     -f "$PWD/supabase/migrations/20261120000100_invest_alerts.sql"
   supabase migration repair --status applied 20261120000100 --linked --project-ref nelwgbcddwiaimzbcuas
   ```

2. Desplegar la función (desde la raíz del repo, en `main`, con el candado):

   ```bash
   supabase functions deploy invest-alerts-check --project-ref nelwgbcddwiaimzbcuas --no-verify-jwt
   ```

   Como `send-push` ahora importa `_shared/webPush.ts`, redesplegarla también
   (sin `--no-verify-jwt`: es la única que verifica JWT):

   ```bash
   supabase functions deploy send-push --project-ref nelwgbcddwiaimzbcuas
   ```

3. Probar sin avisar a nadie:

   ```bash
   curl -sS -X POST "https://nelwgbcddwiaimzbcuas.supabase.co/functions/v1/invest-alerts-check" \
     -H "x-cron-secret: $CRON_SECRET" -H "Content-Type: application/json" -d '{"mode":"check"}'
   ```

4. Programarla. Con pg_cron + pg_net (lo mismo que los otros jobs; el secreto
   sale de Vault, nunca escrito en el SQL). Cada 15 minutos en un minuto que no
   choca con `newsletter-sync` (`*/10`) ni `uptime-check` (`*/5`), porque
   `cron_health_snapshot()` atribuye las respuestas HTTP por ventana de tiempo
   (ver `20261031000000_cron_push_reminders_offset.sql`):

   ```sql
   select cron.schedule(
     'invest-alerts-check',
     '3,18,33,48 * * * *',
     $$
     select net.http_post(
       url := 'https://nelwgbcddwiaimzbcuas.supabase.co/functions/v1/invest-alerts-check',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'x-cron-secret', coalesce(private.get_secret('cron_secret'), '')
       ),
       body := '{}'::jsonb
     );
     $$
   );
   ```

   `private.get_secret('cron_secret')` es lo que usan los jobs de nurture
   (`20260918000500_starter_leads_consent_and_nurture_cron.sql`); antes de
   correrlo, confirmar con `select command from cron.job where jobname =
   'fnos-push-trial-reminders'` que `send-push` usa el mismo. Alternativa sin
   pg_cron: cualquier scheduler externo que haga el mismo `POST` con el header.

5. Sumar el job a `docs/monitoreo.md` si `cron-health-alert` lo tiene que vigilar.

**Costo:** cada corrida pide como máximo 40 lotes (400 símbolos distintos) a la
API de Invest, que cachea 60 s en el CDN. Con 15 minutos son ~96 corridas por
día.
