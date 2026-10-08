# Runbook · Prueba de Pro por 14 días con tarjeta (T10, fase 4)

Rama `ux/f4-billing`. Decisión D2 (07-oct-2026): prueba de 14 días **con tarjeta**, se mantiene la "garantía técnica".

El código ya está listo pero apagado. Nada de esto se activa solo: sin los ids de los links, sin la migración y sin `trialEnabled`, el comportamiento en producción es el de hoy.

**Orden obligatorio.** Respetar la secuencia de abajo. El paso que más importa: **migración (paso 4) antes del deploy de la función (paso 5)**. La función nueva manda `p_expires_at` a `issue_license` para las suscripciones; si la migración no está aplicada, la RPC no existe con ese parámetro y la emisión de licencias de suscripción falla con 500. Los pagos únicos no se ven afectados.

---

## 0. Antes de empezar

- [ ] Cláusula de prueba en `terms.html` (legal, la escribe Walter): duración, que se pide tarjeta, que se cobra automáticamente al terminar salvo cancelación, cómo cancelar y su relación con la garantía técnica. **No anunciar la prueba en ningún lado antes de esto.** Corregir también `docs/faq-pricing.html` de la landing para que coincida con los términos (D2).
- [ ] Revisar en la documentación de Stripe la regla vigente de las redes de tarjetas sobre avisos antes del primer cobro de una prueba. El webhook manda su propio aviso con `customer.subscription.trial_will_end`, que Stripe dispara **3 días** antes del fin de la prueba. Si la regla vigente pide más antelación (por ejemplo 7 días), activar además el aviso propio de Stripe (Settings → Billing → Subscriptions and emails → recordatorio de fin de prueba). Esto no se verificó en esta sesión.

## 1. Crear los 2 Payment Links de prueba (Stripe, cuenta MOY IQ)

Dashboard de la cuenta propia de MOY IQ (`acct_1UEffP2L52ZuuTMr`), en **modo test primero** (paso 6) y después en live. **No borrar ni desactivar** los links actuales.

Para cada uno (Pro mensual US$4.99 y Pro anual US$39.99, los mismos precios recurrentes que los links actuales):

1. Payment Links → New → producto MOY IQ Pro con el precio recurrente correspondiente.
2. Activar la prueba gratuita: **14 días** (`subscription_data.trial_period_days = 14`).
3. Exigir método de pago al empezar: **`payment_method_collection = always`**. En el dashboard es la opción que pide la tarjeta aunque el total de hoy sea 0.
4. "Allow promotion codes": **apagado** (igual que los links actuales).
5. Confirmación: la misma que los links actuales.

Equivalente por API, como referencia (lo corre Walter, no está automatizado):

```bash
stripe payment_links create \
  -d "line_items[0][price]=<price_id_pro_mensual>" -d "line_items[0][quantity]=1" \
  -d "subscription_data[trial_period_days]=14" \
  -d "payment_method_collection=always"
```

Anotar de cada link: el id `plink_...` y la URL `https://buy.stripe.com/...`.

Nota: los Payment Links no limitan una prueba por cliente. Alguien puede cancelar y volver a empezar otra prueba con otro email. Si eso pasa a ser un problema, la solución es Checkout Sessions creadas desde un backend, fuera del alcance de esta fase.

## 2. Pegar los ids en el webhook

En `supabase/functions/stripe-webhook/webhookLogic.ts`:

```ts
export const TRIAL_LINK_MONTHLY_TODO: string | null = "plink_...";  // el del link mensual
export const TRIAL_LINK_ANNUAL_TODO: string | null = "plink_...";   // el del link anual
```

Con eso, los dos links quedan en `PAYMENT_LINK_PLAN` (plan `pro`) y en `SUBSCRIPTION_INTERVAL` (`month`/`year`).

Actualizar el test que fija los placeholders vacíos (`webhookLogic.test.ts`, "los links de prueba siguen sin pegar"): `toBeNull()` pasa a los ids reales y `toHaveLength(6)` pasa a `8`. Correr:

```bash
npx vitest run supabase/functions/stripe-webhook
npm test
```

Mientras estos ids sigan en `null`, un checkout de prueba **no emite licencia** (se descarta como `zero_amount_unknown_link`) y llega un aviso a `ALERT_EMAIL` ("checkout de prueba sin licencia"). Es intencional: este endpoint puede recibir eventos de otros productos de la cuenta y una suscripción de $0 ajena no debe emitir una licencia de MOY IQ.

## 3. Customer Portal

1. Stripe → Settings → Billing → Customer portal: activar. Permitir **cancelar suscripción** (recomendado: al final del período) y **actualizar método de pago**.
2. Activar el link de inicio de sesión del portal y copiar la URL (`https://billing.stripe.com/p/login/...`).
3. Cargarla como secret de la función:

```bash
supabase secrets set STRIPE_PORTAL_URL="https://billing.stripe.com/p/login/..." --project-ref nelwgbcddwiaimzbcuas
```

Sin este secret los emails de prueba ofrecen solo `support@moyiq.app` para cancelar.

Cancelar desde el portal "al final del período" durante la prueba dispara `customer.subscription.deleted` cuando termina la prueba, y la licencia se revoca en ese momento. Una cancelación inmediata (desde el dashboard) revoca de inmediato.

## 4. Aplicar la migración

Archivo: `supabase/migrations/20261008000000_trial_subscription_billing.sql`. **No está aplicada.**

1. Verificar producción antes (regla del repo):

```bash
supabase db query --linked --project-ref nelwgbcddwiaimzbcuas \
  "select oid::regprocedure, pg_get_functiondef(oid) from pg_proc where proname in ('issue_license','extend_license_expiry','revoke_license')"
```

   Debe coincidir con `20260912010312_add_subscription_support.sql`. Si alguien la cambió a mano, parar y reconciliar primero.

2. Revisar permisos actuales (hallazgo de esta fase, sin verificar en producción): `issue_license` de 6 argumentos y `extend_license_expiry` se crearon sin `revoke ... from anon`. Con los permisos por defecto de Supabase podrían ser ejecutables por `anon` vía PostgREST:

```bash
supabase db query --linked --project-ref nelwgbcddwiaimzbcuas \
  "select oid::regprocedure, has_function_privilege('anon', oid, 'execute') as anon_exec from pg_proc where proname in ('issue_license','extend_license_expiry','revoke_license')"
```

   Si da `true`, es un problema de seguridad hoy (cualquiera con la anon key podría emitir licencias). La migración lo corrige para las funciones que recrea. La sobrecarga vieja `issue_license(text,text,text,text,text)` de `supabase-license-revoke.sql`, si sigue existiendo, no la toca esta migración: revisarla aparte.

3. Aplicar:

```bash
supabase db push --linked --project-ref nelwgbcddwiaimzbcuas
```

4. Verificar: que existan `issue_license(... , timestamptz)`, `extend_license_expiry` devolviendo `jsonb`, `revoke_license_by_subscription(text)`, las tablas `subscription_expiry_pending` y `webhook_events_processed`, y que `anon_exec` dé `false` para las tres funciones.

La migración se probó en esta sesión solo contra un Postgres 16 local descartable (no contra Supabase): aplica limpia dos veces seguidas y cubre la carrera de eventos, el "solo hacia adelante", la revocación y los permisos.

## 5. Desplegar la función

```bash
supabase functions deploy stripe-webhook --no-verify-jwt --project-ref nelwgbcddwiaimzbcuas
```

Después, en Stripe → Developers → Webhooks → el endpoint de `stripe-webhook`, **agregar** estos eventos (sin quitar los actuales):

- `customer.subscription.deleted`
- `customer.subscription.trial_will_end`
- `invoice.payment_failed`

Los actuales, que se mantienen: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, `charge.dispute.created`, `invoice.payment_succeeded`.

Anotar la versión de API del endpoint. El código lee las dos formas de la invoice (anterior a 2025-03-31 y "basil"), así que funciona con cualquiera, pero conviene saberla.

## 6. Probar en modo test de Stripe

La función en producción **ignora los checkouts de modo test** a propósito (`isTestModeCheckout`): no se puede probar la emisión de la licencia contra el proyecto real con eventos de test. Hay dos opciones.

**A. Stack local (recomendado para el flujo completo).**

Ojo: la tabla `licenses` nace en los `.sql` de la raíz (`supabase-licenses.sql`, `supabase-license-revoke.sql`, `supabase-e2e-hardening.sql`), no en `supabase/migrations/`, y la primera migración ya asume que existe. `supabase db reset` solo no alcanza: hay que crear ese esquema base en la base local antes de las migraciones (por ejemplo, correr esos tres archivos con `psql` contra la base local y después `supabase migration up`). Este armado local no se probó en esta sesión.

```bash
supabase start
# crear el esquema base (ver la nota de arriba) y después:
supabase migration up      # aplica las migraciones, incluida la nueva
# .env local de la función: STRIPE_WEBHOOK_SECRET (el whsec que da stripe listen),
# RESEND_API_KEY de prueba (o vacío), STRIPE_ALLOW_TEST_EVENTS=true
supabase functions serve stripe-webhook --no-verify-jwt --env-file <archivo-env-local>
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook
```

`STRIPE_ALLOW_TEST_EVENTS=true` solo tiene efecto si `SUPABASE_URL` **no** es `*.supabase.co`, así que no habilita nada en producción aunque se cargue por error.

Con los links de prueba en **modo test** (sus ids pegados en el paso 2 solo para esta prueba local, o un tercer par de constantes temporales):

1. Abrir el link de prueba mensual, pagar con la tarjeta de test `4242 4242 4242 4242`.
   - Esperado: 1 fila en `licenses` con `plan='pro'`, `stripe_subscription_id` seteado y `expires_at` ≈ hoy + 14 días (nunca NULL). Email "Tu prueba de MOY IQ Pro" con la fecha de fin, US$ 4,99 al mes y cómo cancelar.
2. Carrera de eventos: `stripe events resend <evt_invoice>` de la invoice de $0 y de nuevo el checkout, en distinto orden. `expires_at` nunca queda NULL ni retrocede.
3. Aviso de fin de prueba: con un Test Clock de Stripe, avanzar a 3 días antes del fin. Llega un único email "Tu prueba de MOY IQ Pro termina pronto". Reenviar el mismo evento (`stripe events resend`): no llega un segundo email y hay una fila en `webhook_events_processed`.
4. Cobro al terminar: avanzar el Test Clock al día 15. `invoice.payment_succeeded` mueve `expires_at` al fin del primer mes.
5. Cancelación: con otra suscripción de prueba, cancelar desde el portal (al final del período) y avanzar el reloj. `customer.subscription.deleted` deja la licencia en `status='revoked'`; la fila no se borra.
6. Cobro fallido: tarjeta `4000 0000 0000 0341` (se adjunta pero falla al cobrar). Al día 15 llega `invoice.payment_failed` (solo log). Cuando Stripe agota los reintentos y cancela, la licencia se revoca.
7. Link desconocido: un link de prueba que no esté en `TRIAL_LINK_*` no emite licencia y manda el aviso a `ALERT_EMAIL`.

**B. Solo producción, sin stack local.** Después del deploy, una prueba real en live con una tarjeta propia, cancelando desde el portal antes del día 15, y revisar logs (`supabase functions logs stripe-webhook`) y la fila en `licenses`. Cobra US$0; hay que acordarse de cancelar.

## 7. Encender la prueba en la app

En `src/config.js`:

```js
pricing: {
  proMonthly: 4.99, proAnnual: 39.99, currency: 'USD', trialDays: 14,
  trialEnabled: true,
  trialCheckoutUrl: 'https://buy.stripe.com/...',   // link de prueba Pro mensual (live)
},
```

Actualizar el test `config.pricing es la fuente única` en `src/utils/pricing.test.js`, correr `npm test` y desplegar con `./deploy.sh`.

ProGate muestra "Probar 14 días" (es/en/pt/de) con la nota "Requiere tarjeta. El cobro de US$ 4,99/mes empieza el día 15, salvo que canceles antes." y abre el link de prueba en una pestaña nueva. Si `trialEnabled` es `true` pero falta la URL (o no es https), sigue el CTA de siempre.

## 8. Landing (después, repo `financeos-landing`)

Recién con todo lo anterior funcionando: los CTA de Pro pasan a "Probar 14 días" con los links nuevos y el texto debajo del tipo "Se cobra al día 15. Cancelas cuando quieras." Fuera del alcance de esta rama.

## Volver atrás

- App: `trialEnabled: false` y deploy. ProGate vuelve al CTA anterior.
- Stripe: desactivar los 2 links de prueba. Las pruebas en curso siguen su curso (se cobran o se cancelan); el webhook las sigue manejando.
- Función: el deploy anterior funciona con la migración aplicada (la migración es compatible hacia atrás). La migración en sí no hace falta revertirla.

## Riesgos conocidos

- `expires_at` inicial de una prueba = creación de la sesión + 14 días. El `trial_end` real de Stripe es unos minutos posterior; la invoice de $0 lo corrige hacia arriba. Igual que hoy, hay un hueco de hasta ~1 hora entre el fin del período y el cobro de la renovación en el que `validate_license` puede rechazar; la app tolera eso con el plan en caché.
- El trigger del CRM (`sync_license_activation_to_crm`) marca como "convertido" a quien empieza una prueba, no solo a quien paga.
- La revocación por reembolso de una invoice de suscripción sigue sin cubrirse (gap documentado en `extendLicenseExpiry`).
- El email del aviso de fin de prueba sale solo en español, igual que el de la licencia.

## Más adelante: guardar el idioma en `licenses.lang`

El aviso de fin de prueba se queda como está mientras la prueba siga apagada: toma el idioma de `langFromStripeSubscription(sub)` (`metadata.lang` de la suscripción o `preferred_locales` del customer expandido) y, si no hay ninguno, manda en español. El evento `customer.subscription.trial_will_end` casi nunca trae esa señal, así que en la práctica sale en español. Cuando se encienda la prueba, la forma de cerrarlo es guardar el idioma en la licencia al emitirla. Mismo patrón que `20261009000000_leads_lang.sql` para los leads:

1. **Migración nueva** (`supabase/migrations/`): `alter table public.licenses add column if not exists lang text;` (nullable, sin default) con check `lang is null or lang in ('es','en','pt','de')`, agregado `not valid` + `validate`. Sumar a `issue_license` un parámetro final opcional `p_lang text default null`, normalizado igual que en las RPC de leads. Hacer `drop` de la firma vieja de 7 argumentos y `create` de la nueva en la misma migración, y repetir el bloque de `20261008000500_lock_license_rpcs_to_service_role.sql` sobre la firma nueva: `revoke ... from public, anon, authenticated` + `grant execute ... to service_role`. Sin ese bloque, la anon key podría emitir licencias. Verificar antes la firma vigente con `pg_get_functiondef`, como dice `CLAUDE.md`.
2. **`stripe-webhook` lo escribe**: en `checkout.session.completed`, el idioma ya se calcula con `langFromStripeSession(session)` (`client_reference_id` `lang_xx` del Payment Link, después `session.locale`, `preferred_locales` y `metadata.lang`). Pasarlo como `p_lang` en la llamada a `/rpc/issue_license` (`webhookLogic.ts`, junto a `p_key`/`p_plan`/...). Opcional: copiarlo también a `subscription_data.metadata.lang` del checkout, para que llegue en los eventos de la suscripción.
3. **El aviso de fin de prueba lo lee**: `findLicenseBySubscription` pasa a pedir `select=*` (no `select=email,status,plan,lang`, porque PostgREST responde 400 si la columna todavía no existe) y devuelve `lang`. `handleTrialWillEnd` elige con `pickLang(license.lang, langFromStripeSubscription(sub))`: primero el idioma guardado, después lo que traiga el evento y, al final, español.
4. **Orden**: migración, después deploy de `stripe-webhook`. El webhook manda `p_lang` solo con la migración aplicada; antes, `issue_license` responde 404 y la licencia no se emite. Por eso este paso no se puede invertir. Las licencias ya emitidas quedan con `lang` null y siguen recibiendo los correos en español.
5. **Tests**: en `webhookLogic.test.ts`, el body de `issue_license` lleva `p_lang` y el aviso de fin de prueba usa `license.lang` cuando existe y cae a español cuando es null o `'fr'`.
