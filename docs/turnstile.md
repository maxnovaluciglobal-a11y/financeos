# Turnstile (anti-bots) en los formularios públicos

Auditoría 360, items SEG-1 (formularios) y SEG-7 (login). **Estado al 21-oct-2026 (06:30 UTC):**

- Widget `moyiq-forms` creado; secreto `TURNSTILE_SECRET_KEY` cargado en Supabase.
- Landing, Invest, app y demo mandan el token (verificado en producción: `turnstile (observar): válido`
  en los logs de `lead-submit` para newsletter, quiz de Invest y gate del demo).
- **`TURNSTILE_ENFORCE=1` prendido**: sin token o con token inválido, `lead-submit` responde 403
  `captcha_failed` (probado); con token real, 200 (newsletter y calculadora probados después).
- **EXECUTE revocado** a `anon`/`authenticated` en las 7 RPC (migración
  `20261021060000_lead_rpcs_service_role_only.sql`): `/rest/v1/rpc/register_*` con la clave publicable
  → 401 `42501` (probado).
- Login de la app (`app.moyiq.app`) y de Invest (`invest.moyiq.app/app`) ya mandan
  `gotrue_meta_security.captcha_token` (comprobado interceptando el request, sin enviarlo).
- **Falta solo el captcha de Supabase Auth** (paso de Walter, ver "Login (SEG-7)"): pegar la secret key
  en el panel. Ojo con la PWA: el service worker sirve el bundle viejo en la primera carga y el nuevo en
  la siguiente; quien tenga la app abierta desde antes del 21-oct puede necesitar recargar una vez.

Rollback rápido si algo falla: `supabase secrets unset TURNSTILE_ENFORCE --project-ref nelwgbcddwiaimzbcuas`
(vuelve a modo observar) y, si hiciera falta, el `grant execute ... to anon, authenticated` que está al
final de la migración.

## Widget de Cloudflare

| Dato | Valor |
|---|---|
| Nombre | `moyiq-forms` |
| Cuenta | la de la empresa en Cloudflare, donde está la zona `moyiq.app` |
| Dominios | `moyiq.app`, `app.moyiq.app`, `demo.moyiq.app`, `invest.moyiq.app` |
| Modo | Managed |
| **Site key (pública)** | `0x4AAAAAAFes7XsVjxTdfS7Y` (creada el 21-oct-2026; hostname `moyiq.app` con subdominios) |
| Secret key | solo en el secreto `TURNSTILE_SECRET_KEY` de Supabase. Nunca en el repo, el chat ni el frontend |

La site key es pública: va en el HTML/JS del frontend (`data-sitekey` del widget o
`turnstile.render(el, { sitekey })`). Cuando exista, anotarla en la tabla de arriba.

Para desarrollo local, Cloudflare publica claves de prueba (no van a producción):
site key `1x00000000000000000000AA` (siempre pasa) con secret `1x0000000000000000000000000000000AA`.

## Cómo verifica el servidor

Helper: `supabase/functions/_shared/turnstile.ts` (tests en `turnstile.test.ts`). Llama a
`https://challenges.cloudflare.com/turnstile/v0/siteverify` con el secreto, el token y la IP
del visitante.

| `TURNSTILE_SECRET_KEY` | `TURNSTILE_ENFORCE` | Comportamiento |
|---|---|---|
| no existe | (cualquiera) | pasa todo, como antes |
| existe | sin definir / `0` | si llega token, se verifica y se escribe el resultado en el log; **nunca bloquea** |
| existe | `1` / `true` | sin token o token inválido/repetido/vencido → **403** `{ok:false, error:"captcha_failed"}`; Cloudflare no responde → **503** `captcha_unavailable` (queda en `edge_function_errors`) |

El token se manda en el body JSON como `turnstileToken` (también se acepta el campo
`cf-turnstile-response` en el body o como encabezado). Un token sirve **una sola vez**:
después de cada envío hay que llamar a `turnstile.reset()` para tener uno nuevo.

## Endpoints que lo exigen

| Endpoint | Quién lo usa | Qué cambia en el frontend |
|---|---|---|
| `POST /functions/v1/lead-submit` (nueva) | todos los formularios de leads | reemplaza la llamada directa a `/rest/v1/rpc/<rpc>` |
| `POST /functions/v1/send-feedback` | app (FeedbackSheet, NPS) | sumar `turnstileToken` al body |

### lead-submit

Puerta de entrada de las RPC de formularios públicos (PostgREST no puede verificar un captcha):

```
POST https://nelwgbcddwiaimzbcuas.supabase.co/functions/v1/lead-submit
Content-Type: application/json            (sin apikey ni Authorization)
{ "rpc": "register_diagnostico_lead",
  "args": { "p_email": "...", "p_score": 7, "p_label": "...", "p_consent_marketing": true, "p_fuente": "directo", "p_lang": "es" },
  "turnstileToken": "<token del widget>" }
```

Responde el **mismo status y JSON que la RPC** (`{ok, id, ...}`), así que el cambio en cada
formulario es: otra URL, `args` envuelto y el token. Errores propios: 400 `invalid_request`,
403 `captcha_failed`, 503 `captcha_unavailable`, 502 `upstream_*`.

RPC permitidas y dónde se usan hoy:

| RPC | Formulario |
|---|---|
| `register_newsletter_signup` | landing `newsletter-form.js` |
| `register_diagnostico_lead` | landing `diagnostico.html`, `en/score-check.html` (score-check) |
| `register_tax_calculator_lead` | landing `calculadora-impuestos.html` |
| `register_invest_lead` | invest-web `perfil-inversor.html` |
| `register_starter_lead`, `register_demo_lead` | app `src/utils/licenseValidator.js` |
| `submit_cancellation_request` | landing `cancel-form.js` |

La función llama a la RPC con el service role y pasa la IP del visitante en
`x-moyiq-client-ip`; `private.lead_rate_ok` solo confía en ese encabezado cuando el rol es
`service_role` (migración `20261021030000_lead_rate_trusted_client_ip.sql`, prueba en
`supabase/tests/lead_rate_trusted_ip.sql`), así el límite de 6 altas por IP y hora sigue igual.

`send-optin-confirmation`, `send-nurture-*` y `send-cancellation-confirmation` no piden token:
solo actúan sobre un id de lead que ya existe (creado por la puerta) y tienen su propio tope
de envíos. Quedan protegidas cuando se cierra el acceso directo a las RPC (paso 4).

## Dónde va la site key en cada frontend

| Repo | Dónde | Notas |
|---|---|---|
| `financeos-app` (app y demo) | `VITE_TURNSTILE_SITE_KEY` en Vercel (Production y Preview) | se hornea en el build: cambiarla exige redeploy. Sin valor = sin widget. Código: `src/core/turnstile.js`, `src/components/Turnstile.jsx` |
| `financeos-landing` | constante `SITE_KEY` en `turnstile.js` | vacía = sin widget |
| `invest-web` | constante `SITE_KEY` en `turnstile.js` | vacía = sin widget; el login de `/app` también la usa (Supabase Auth es el mismo proyecto) |

Con la clave vacía todo sigue funcionando: los formularios van a `lead-submit` sin token y el
login no manda `captchaToken`. CSP: `script-src` y `frame-src` con `https://challenges.cloudflare.com`.

## Pasos pendientes (en orden)

1. **Walter** — crear el widget en Cloudflare (no se pudo desde el agente: el navegador está
   logueado en la cuenta personal `Walterlamadriz@gmail.com's Account`, que no tiene
   `moyiq.app`; entrar a la cuenta de la empresa pide contraseña).
   Cloudflare → cuenta de la empresa → Protect & connect → Turnstile → **Add widget manually**:
   nombre `moyiq-forms`, hostnames `moyiq.app`, `app.moyiq.app`, `demo.moyiq.app`,
   `invest.moyiq.app`, Widget mode **Managed**, pre-clearance **No** → Create.
   Anotar la site key en este archivo.
2. **Cargar el secreto sin verlo** (Walter o un agente con la página del widget abierta):
   botón **Copy** junto a "Secret Key", y en la terminal:
   ```bash
   pbpaste | wc -c        # solo el largo (unos 35)
   umask 077; f=$(mktemp); printf 'TURNSTILE_SECRET_KEY=%s\n' "$(pbpaste)" > "$f"
   supabase secrets set --env-file "$f" --project-ref nelwgbcddwiaimzbcuas; rm -f "$f"; printf '' | pbcopy
   ```
   **No** definir `TURNSTILE_ENFORCE` todavía: con el secreto solo, el servidor observa y no bloquea.
3. **Tanda frontend** — widget en cada formulario (landing, Invest, app/demo) con la site key,
   pasar a `lead-submit` y mandar `turnstileToken` en `send-feedback`. Mirar en los logs de
   `lead-submit` / `send-feedback` que aparezca `turnstile (observar): válido`.
4. **Prender y cerrar** — cuando los 4 sitios estén desplegados:
   `supabase secrets set TURNSTILE_ENFORCE=1 --project-ref nelwgbcddwiaimzbcuas` y una migración
   que revoque `EXECUTE` de `anon, authenticated` en las 7 RPC de la tabla (dejando
   `service_role`), aplicada con `supabase db query --linked -f` + `migration repair`.
   Probar: un POST a `lead-submit` sin token → 403; uno directo a `/rest/v1/rpc/register_*`
   con la clave publicable → 401/42501.

## Login (SEG-7): CAPTCHA de Supabase Auth

Supabase Auth soporta Turnstile de forma nativa. **No está prendido**: si se prende antes de
que la app mande `captchaToken`, nadie puede entrar ni registrarse.

Orden para la tanda frontend:

1. La app agrega el widget (misma site key `moyiq-forms`) en login, registro, magic link y
   recuperar contraseña, y pasa el token en `options.captchaToken`:
   `supabase.auth.signInWithPassword({ email, password, options: { captchaToken } })`,
   igual en `signUp`, `signInWithOtp` y `resetPasswordForEmail`. Resetear el widget después de
   cada intento. Desplegar app y demo.
2. Recién entonces: Supabase Dashboard → proyecto `financeos-prod` → **Authentication →
   Attack Protection** (antes "Bot and Abuse Protection") → **Enable Captcha protection** →
   provider **Cloudflare Turnstile** → pegar la **secret key** del widget → Save.
   (Equivalente por API: `PATCH /v1/projects/nelwgbcddwiaimzbcuas/config/auth` con
   `security_captcha_enabled: true`, `security_captcha_provider: "turnstile"`,
   `security_captcha_secret`.) No usar `supabase config push`: `supabase/config.toml` solo
   admite `verify_jwt` (ver `_shared/verifyJwtConfig.test.ts`).
3. Probar en producción: login sin token → error `captcha protection: request disallowed`;
   con el widget → entra.
