# Primer cobro real de punta a punta (ensayo controlado)

Objetivo: ver pasar **una vez** por producción todo el camino del webhook de Stripe (checkout → licencia atada a la cuenta → primer cobro → reembolso → revocación → cancelación). Hoy ese camino nunca recibió un pago live (`CLAUDE.md`, «Archivos delicados»). Lo ejecuta Walter con su tarjeta; las consultas de solo lectura las corre Claude o Walter con `ops/billing/billing_e2e_check.sql` (repo `financeos-workspace`).

## Por qué con tarjeta real
El webhook ignora eventos de modo prueba (`stripe-webhook/index.ts`, `STRIPE_ALLOW_TEST_EVENTS` no está en `true`), así que el «test mode» de Stripe no ejercita la ruta real. Los Payment Links con prueba de 14 días cobran US$0 al inicio y el primer cargo ocurre al día 14: para no esperar, se «termina la prueba ahora» desde el panel.
Costo: la comisión de Stripe sobre US$4,99, que no se devuelve (monto por confirmar en el panel).

## Precondiciones
1. `STRIPE_RO_KEY` (clave **restringida, solo lectura**, de la cuenta MOY IQ `acct_1UEffP2L52ZuuTMr`) con permisos de Payment Links y Prices. Guardada por Walter en el llavero (`security add-generic-password -U -s moyiq-stripe-ro -a moyiq -w`, sin eco) y en 1Password; nunca por chat.
2. `STRIPE_RO_KEY="$(security find-generic-password -s moyiq-stripe-ro -w)" node scripts/verifyStripePrices.mjs --landing ../financeos-landing` debe terminar en `consistent` (precios, moneda, intervalo y 14 días de prueba iguales en Stripe, `config.js`, `webhookLogic.ts` y la landing).
3. Una **cuenta de prueba distinta de la de dueño** (una licencia = una cuenta): un correo de la LLC, p. ej. `maxnovaluciglobal+prueba1@gmail.com` (nada por el Gmail personal). `webAnalytics.js` ya trata `prueba[0-9]*` como interno.
4. Cupo de correo: el plan de Resend es compartido; comprobar que hay margen del día (si el correo de la licencia no sale, el cliente real se queda sin Pro).

## Pasos (Walter) y qué debe verse (consulta del SQL)
| # | Acción | Debe aparecer |
|---|---|---|
| 0 | Correr el SQL «antes» y anotar los conteos | línea base |
| 1 | Entrar a `app.moyiq.app` con la cuenta de prueba, ir a Pro y empezar la prueba con el plan mensual | `webhook_events`: `checkout.session.completed`; `licenses`: fila nueva `is_trial`, con suscripción; `user_entitlements.plan = pro` **sin pegar ninguna clave** (checkout atado a la cuenta) |
| 2 | Panel de Stripe MOY IQ → la suscripción → «terminar la prueba ahora» | `invoice.payment_succeeded`; `licenses.expires_at` extendido ~1 mes y `payment_intent_id` lleno |
| 3 | Reembolsar el pago en Stripe | `charge.refunded`; `licenses.status = revoked`; `user_entitlements` vuelve a starter |
| 4 | Cancelar la suscripción | `customer.subscription.deleted` |
| 5 | Revisar la bandeja de la cuenta de prueba | bienvenida/licencia, aviso de prueba, factura, reembolso |
| 6 | Borrar la cuenta de prueba desde la app (Ajustes → Eliminar la cuenta) | la cuenta desaparece y no queda suscripción activa (ejercita `delete-account` con una cuenta real) |

Siempre, después de cada paso: la consulta de higiene del SQL (`edge_function_errors` de la última hora) debe estar vacía.

## Si un paso no aparece
| Síntoma | Acción |
|---|---|
| No llega `checkout.session.completed` | Stripe → Developers → Webhooks → entrega del evento: ¿HTTP 4xx/5xx? Verificar `STRIPE_WEBHOOK_SECRET` de MOY IQ |
| Llega pero no hay licencia | `edge_function_errors`; ver `webhookLogic.ts` `checkoutSkipReason` (¿link no listado en `PAYMENT_LINK_PLAN`?) |
| Licencia sin cuenta atada | revisar que el checkout salió con la sesión iniciada (`client_reference_id=u_<uid>_lang_xx`) |
| El reembolso no revoca | solo revoca licencias con `payment_intent_id` (paso 2 debe haberlo llenado) |

## Deshacer si queda a medias
Reembolsar y cancelar desde el panel de Stripe de MOY IQ; si la licencia sigue activa, `revoke_license` desde el CRM; borrar la cuenta de prueba con el autoservicio. No usar el Stripe CLI local: apunta a la cuenta de DypOS.

## Qué pasa si no pagan
Pro vencido = Starter, sin período de gracia explícito (diseño actual; sin cambios en este ensayo).
