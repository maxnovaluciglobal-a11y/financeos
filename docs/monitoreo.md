# Monitoreo desde Supabase (uptime y salud de los crons)

Desde el 19-oct-2026 (auditoría 360, C-11 y C-12). Sin cuentas externas: todo corre en el proyecto `financeos-prod` (`nelwgbcddwiaimzbcuas`) con `pg_cron`, `pg_net` y dos Edge Functions. Los avisos salen por Resend desde `MOY IQ <hola@moyiq.app>` y llegan **solo** a `maxnovaluciglobal@gmail.com`.

Migración: `supabase/migrations/20261019180000_cron_health_and_uptime.sql`. Funciones: `supabase/functions/uptime-alert/` y `supabase/functions/cron-health-alert/`.

## 1. Uptime (caídas de los sitios)

**Qué mide.** Cada 5 minutos el job `uptime-check` corre `public.uptime_tick()`, que:

1. evalúa las respuestas de la corrida anterior (`net._http_response`): un sitio está **arriba** si respondió **200**, sin timeout (10 s) y si el cuerpo contiene su `marker` (el contenido real, no solo el status);
2. lanza un `net.http_get` por sitio de `public.uptime_sites`;
3. llama a la Edge Function `uptime-alert` (header `x-cron-secret`), que mantiene `public.uptime_state` y manda los correos.

| Sitio | URL | Marker |
|---|---|---|
| app.moyiq.app | https://app.moyiq.app/app/ | `id="root"` |
| demo.moyiq.app | https://demo.moyiq.app/app/ | `id="root"` |
| moyiq.app | https://moyiq.app/ | `<title>MOY IQ` |
| invest.moyiq.app | https://invest.moyiq.app/ | `<title>MOY IQ Invest` |

**Cuándo avisa** (estado por sitio, sin spam; lógica pura en `supabase/functions/_shared/uptimeState.ts` con tests):

- **Caída:** 2 chequeos seguidos fallidos → un correo "[MOY IQ] caída: <sitio>" (o sea, unos 10 minutos de caída).
- **Sigue caído:** un recordatorio cada 6 h ("[MOY IQ] sigue caído: <sitio>").
- **Recuperación:** el primer chequeo bueno → "[MOY IQ] recuperado: <sitio>".
- Si Resend falla, el cambio de estado no se guarda y se reintenta en la corrida siguiente.

**Ver el estado:** en el SQL Editor (service role), `select * from public.uptime_status;` (último chequeo, fallas y % de uptime en 24 h por sitio). Historial: `public.uptime_checks` (30 días).

**Probar sin mandar correos:** llamar a la función con `{"mode":"check"}` desde SQL, así el secreto no sale de la base, y leer la respuesta un par de segundos después:

```sql
select net.http_post(
  url := 'https://nelwgbcddwiaimzbcuas.supabase.co/functions/v1/uptime-alert',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', private.get_secret('cron_secret')),
  body := '{"mode":"check"}'::jsonb);
select status_code, content from net._http_response order by id desc limit 1;
```

**Pausar un sitio:** `update public.uptime_sites set enabled = false where site = 'demo.moyiq.app';` (volver con `true`).
**Agregar uno:** `insert into public.uptime_sites (site, url, marker) values ('…', 'https://…', 'texto que siempre está en la página');`
**Apagar todo el uptime:** `select cron.unschedule('uptime-check');` Para volver a prenderlo: `select cron.schedule('uptime-check', '*/5 * * * *', $$select public.uptime_tick();$$);`

**Límites.** Mira desde la infraestructura de Supabase: si se cae Supabase entero, no hay aviso (tampoco funcionaría la app). No mide latencia ni el webhook de Stripe. Un monitor externo (Better Stack, UptimeRobot) seguiría siendo un buen complemento si algún día se crea la cuenta.

## 2. Salud de los crons (`cron_health`)

**El problema que tapa.** `pg_cron` marca la corrida como `succeeded` en cuanto encola el `net.http_post`, aunque la Edge Function responda 401 o 500 (el nurture de Starter estuvo así del 08 al 18-oct-2026). `pg_net` además borra sus respuestas a las 6 h y no guarda la URL.

**Cómo funciona.**

- `public.cron_health_snapshot()` (job `cron-health-snapshot`, minuto 7 de cada hora) copia las respuestas nuevas de `net._http_response` a `public.cron_http_log` (90 días) y las atribuye al job que hizo la llamada por ventana de tiempo (cada job HTTP corre a un minuto distinto; las del uptime se atribuyen por id). También borra el historial de `cron.job_run_details` de más de 30 días.
- La vista `public.cron_health` da un renglón por job: última corrida, estado SQL, último código HTTP, `problem` y `ok`. `problem` puede ser `never_ran`, `overdue` (no corrió en su horario), `sql_failed`, `stuck_running`, `no_http_response`, `http_timeout` o `http_error`.
- El job `cron-health-alert-daily` (15:03 UTC, después de los nurtures de las 14:00-14:37 UTC) llama a la Edge Function `cron-health-alert`, que refresca el log, lee la vista y las respuestas ≠ 2xx de las últimas 24 h (también las de triggers como `notify-admin-signup`) y, si hay algo, manda **un** correo "[MOY IQ] cron con problemas: N".

**Ver el estado:** `select public.cron_health_snapshot(); select * from public.cron_health;`
**Probar sin mandar correos:** igual que arriba, con la URL `…/functions/v1/cron-health-alert` y `{"mode":"check"}`.
**Apagar el aviso diario:** `select cron.unschedule('cron-health-alert-daily');` (el snapshot horario puede quedar: no manda nada).

## Permisos

Tablas, vistas y funciones de este documento son solo de `service_role`: `anon` y `authenticated` no tienen ningún privilegio (verificado con `has_table_privilege` al desplegar). Las dos funciones tienen `verify_jwt = false` en `supabase/config.toml` y se autentican con `x-cron-secret` (el mismo `cron_secret` de `private.app_secrets` que usan los nurtures), comparado en tiempo constante.
