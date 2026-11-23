# Edge Functions

Cada carpeta es una función de Supabase (Deno). Reglas generales en `CLAUDE.md`
("Sesiones paralelas y despliegue", punto 5): se despliegan a mano desde el
árbol principal en `main`, con el candado, una entrada en `config.toml` y en
`_shared/verifyJwtConfig.test.ts`, y el handler envuelto en
`withErrorReporting("<nombre>", …)`.

## invest-alerts-check (Inversiones F4, 20-nov-2026)

Revisa las alertas de precio activas (`public.invest_alerts`, migraciones
`20261120000100_invest_alerts.sql`, `20261123000000_invest_alerts_rotation.sql` y
`20261123000100_push_subscription_guard.sql`) y avisa por Web Push a los dispositivos de
la cuenta, con la app cerrada.

- **Quién la llama:** solo un scheduler, con `POST` y el header
  `x-cron-secret: <CRON_SECRET>` (el mismo secreto que usan `send-push` y
  `cron-health-alert`). Sin CORS: un navegador no puede usarla. `OPTIONS`
  responde 204 sin hacer nada; cualquier otro método, 405.
- **Qué hace:** lee las alertas activas fuera de la espera de 24 h, empezando
  por las que hace más que no se revisan (`last_checked_at`, que la cuenta no
  puede escribir: grants por columna), reparte los símbolos por cuenta antes
  del tope de 400 y marca las revisadas con `invest_alerts_mark_checked`
  (rotación: ninguna cuenta deja a otras sin revisar). Pide los precios en
  lotes de 10, 4 a la vez, a `GET https://invest.moyiq.app/api/quote?ticker=…`
  (los mismos endpoints que usa la app, sin cabecera `Origin`, que la API
  acepta). Pide los destinos push ANTES de reclamar (si fallan, lanza y no
  marca nada). Reclama con la RPC `invest_alerts_claim` (ids en el cuerpo, en
  tandas de 500; solo las alertas sin aviso en las últimas 24 h: dos corridas
  cruzadas no avisan dos veces) y manda el aviso con `_shared/webPush.ts` (el
  cifrado de `send-push`). Un movimiento del día (`pct_move`) avisa una sola
  vez por sesión de mercado.
- **Tiempos:** cada pedido tiene timeout de 8 s. Los precios tienen 35 s y los
  envíos 40 s propios (contados desde el primer envío y revisados antes de
  cada dispositivo): lo reclamado siempre tiene tiempo para mandarse. Los
  dispositivos de una alerta (5 como mucho) reciben el aviso a la vez; uno que
  ya falló en la corrida no se vuelve a llamar. Un aviso que no llegó a ningún
  dispositivo por la red, un 429/5xx o falta de tiempo se devuelve con
  `invest_alerts_release` (vuelve a su valor anterior y queda revisado en esa
  corrida: no se adelanta a las demás en cada corrida).
- **Suscripciones:** `save_push_subscription` solo acepta endpoints https de
  servicios Web Push (FCM, Mozilla, `*.push.apple.com`, `*.notify.windows.com`)
  y deja 10 por licencia (la migración borra además las filas que ya existían
  fuera de la lista o por encima del tope, con `push_subscriptions_prune()`).
  `send-push` filtra con la misma lista (`_shared/pushEndpoint.ts`) y manda a 5
  por licencia como mucho. Al final de la corrida `push_subscriptions_record`
  anota el resultado de cada dispositivo: ok vuelve a 0, 404/410 se borra, los
  demás fallos suman y se borran con 8 fallos seguidos y el primero hace 48 h
  o más. Un solo 400/403 nunca borra nada.
- **Cuándo responde 502** (queda en `edge_function_errors` y avisa
  `uptime-alert`): errores del sistema (precios, RPC, reclamo, devolución,
  falta de tiempo), un proveedor push (FCM, Mozilla, Apple, WNS) donde nada
  llegó y hubo 400/403 en 2 o más suscripciones de 2 o más cuentas (puede ser
  la clave VAPID del servidor; esos avisos se devuelven) o más de la mitad de
  los envíos fallidos (con 10 o más).
- **Destinos:** `invest_alert_push_targets(uuid[])` (solo service role) une
  cuenta → `user_entitlements.license_key` → `push_subscriptions.key_hash`, solo
  con endpoints de servicios push y 5 por cuenta (los más recientes). Una
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

1. Aplicar las tres migraciones, en orden (historial compartido con `invest-web`).
   La segunda crea las RPC `invest_alerts_mark_checked`, `invest_alerts_claim`
   e `invest_alerts_release` y cambia los grants de `invest_alerts` a grants
   por columna; la tercera valida `save_push_subscription`, agrega
   `push_subscriptions.fail_count` y la RPC `push_subscriptions_record`. Las
   tres ANTES de desplegar la función.

   ```bash
   for v in 20261120000100_invest_alerts 20261123000000_invest_alerts_rotation 20261123000100_push_subscription_guard; do
     supabase db query --linked --project-ref nelwgbcddwiaimzbcuas --workdir "$(mktemp -d)" \
       -f "$PWD/supabase/migrations/$v.sql"
     supabase migration repair --status applied "${v%%_*}" --linked --project-ref nelwgbcddwiaimzbcuas
   done
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
   (ver `20261031000000_cron_push_reminders_offset.sql`). Una corrida puede
   tardar hasta ~90 s (35 s de precios + 40 s de envíos + RPC): por eso
   `timeout_milliseconds := 120000` (el de pg_net por defecto es 5 s):

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
       body := '{}'::jsonb,
       timeout_milliseconds := 120000
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
