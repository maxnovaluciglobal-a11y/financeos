# Activación de licencias escalables (Stripe + Supabase) — Plan v2.0

Estado: **groundwork listo y commiteado, INERTE.** Producción sigue con el validador
offline (funciona). Nada cambia para los usuarios hasta el **Paso 6**.

Archivos creados por Claude:
- `supabase-licenses.sql` — tabla `licenses` + RPC `validate_license` + `issue_license`
- `supabase/functions/stripe-webhook/index.ts` — webhook que emite y envía la licencia
- `src/utils/licenseValidator.supabase.js` — validador v2.0 (preparado, NO wired)

---

## Lo que hace Claude (ya hecho)
- [x] SQL de tabla + RPC (con hash server-side, RLS, solo accesible vía RPC)
- [x] Webhook de Stripe (genera clave, guarda hash, envía email)
- [x] Validador v2.0 con fix de bypass + migración v1→v2 + TTL
- [x] Esta guía

## Lo que debes hacer tú (en orden)

### Paso 1 — Crear la RPC en Supabase
1. Supabase Dashboard → tu proyecto → **SQL Editor** → **New Query**.
2. Pega TODO el contenido de `supabase-licenses.sql` y pulsa **Run**.
3. Verifica en una query nueva:
   ```sql
   select public.validate_license('FNOS-TEST-TEST-TEST');
   ```
   Debe devolver `{"valid": false}` (no un error de "function does not exist").

### Paso 2 — Configurar secrets del webhook (Supabase CLI)
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...        # lo da Stripe en el Paso 4
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...          # Dashboard → Settings → API → service_role
supabase secrets set RESEND_API_KEY=re_...                  # tu cuenta Resend (envío de email)
supabase secrets set FROM_EMAIL="MOY IQ <licencias@moyiq.app>"
```
> `SUPABASE_URL` ya lo inyecta Supabase automáticamente en Edge Functions.
> Si no usas Resend, deja `RESEND_API_KEY` sin setear: la clave se genera y guarda igual,
> pero tendrás que enviarla por tu medio actual (revisar logs de la función).

### Paso 3 — Desplegar el webhook
```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```
URL resultante: `https://<TU-PROYECTO>.supabase.co/functions/v1/stripe-webhook`

### Paso 4 — Conectar Stripe
1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
2. URL: la del Paso 3. Evento: **`checkout.session.completed`**.
3. Copia el **Signing secret** (`whsec_...`) y setéalo en el Paso 2 (`STRIPE_WEBHOOK_SECRET`),
   luego redeploy: `supabase functions deploy stripe-webhook --no-verify-jwt`.
4. (Ajuste de plan) El webhook decide Personal/Pro por monto: `>= US$25 → Pro`.
   Si tus precios cambian, ajusta `planFromAmount()` en el `index.ts`.

### Paso 5 — Probar de punta a punta (modo test de Stripe)
1. Haz una compra de prueba con tarjeta de test de Stripe.
2. Revisa que llegue el email con la clave `FNOS-...`.
3. Verifica en Supabase: `select * from public.licenses;` (verás el hash, plan, email).
4. Avisa a Claude → valida la RPC desde el navegador (como se hizo en la auditoría).

### Paso 6 — Activar el validador v2.0 (lo hace Claude, tras tu OK del Paso 5)
Solo cuando el Paso 5 pase:
1. Claude reemplaza `src/utils/licenseValidator.js` por el contenido de
   `licenseValidator.supabase.js`.
2. Build + deploy. Verifica activación con una clave real.
3. La migración v1→v2 mantiene logueados a los usuarios ya activados.

---

## Notas de seguridad
- Solo se guarda el **hash SHA-256** de la clave, nunca el texto plano.
- La tabla `licenses` no es accesible por `anon`; solo la RPC `validate_license` (security definer).
- `issue_license` solo la puede llamar `service_role` (el webhook), nunca el cliente.
- Datos financieros del usuario siguen **100% locales** — esto valida licencia, no sube datos.

## Pendiente separado (Fase 2, opcional)
Cloud backup Pro (`CLOUD_ENABLED=true` en `supabase.js` + `ProGate` + `cloudPush/Pull`).
No bloquea las ventas. Ver [project-deferred-v20] en memoria.
