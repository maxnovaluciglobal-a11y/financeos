// FinanceOS — Webhook de Stripe → emite licencia en Supabase + envía email
// Supabase Edge Function (Deno). SIN SDK de Stripe: verifica la firma con Web Crypto
// (evita el shim de Node de esm.sh que rompe en el runtime nuevo de Supabase/Deno 2).
//
// La lógica (firma, plan, guards, llamadas a Supabase/Resend) vive en
// ./webhookLogic.ts — sin esa separación no se puede testear con vitest, porque
// este archivo lee Deno.env.get() a nivel de módulo y revienta si se importa
// desde Node. Este archivo es solo wiring: arma la config y el handler HTTP.
//
// Secrets necesarios (Supabase → Edge Functions → Secrets):
//   STRIPE_WEBHOOK_SECRET   (whsec_...)   ← obligatorio
//   NURTURE_RESEND_API_KEY (o RESEND_API_KEY como respaldo), FROM_EMAIL ← opcional (email de la clave).
//     Con RESEND_API_KEY sola, el correo de la licencia da 403 desde @moyiq.app: ver
//     ../_shared/resendKey.ts (auditoría 360, C-05)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ← los inyecta Supabase solo
//
//   STRIPE_PORTAL_URL                     ← opcional (link del Customer Portal en los emails de prueba)
//
// Stripe → Developers → Webhooks → endpoint:
//   https://<PROYECTO>.supabase.co/functions/v1/stripe-webhook
//   eventos: checkout.session.completed, checkout.session.async_payment_succeeded,
//   charge.refunded, charge.dispute.created, invoice.payment_succeeded,
//   y desde T10 (2026-10-08): customer.subscription.deleted,
//   customer.subscription.trial_will_end, invoice.payment_failed;
//   desde C-13 (19-oct-2026): customer.subscription.updated.
//   Ver docs/billing-trial-runbook.md.
//
// Logs: sin emails ni nombres (auditoría 360, C-13). Para correlacionar
// alcanzan session, subscription y payment_intent.

import {
  verifyStripeSignature, generateKey, planFromSession, isTestModeCheckout, checkoutSkipReason,
  extractPaymentIntent, issueLicense, sessionAlreadyProcessed, sendKeyEmail, langFromStripeSession,
  notifyKeyDeliveryFailure, notifyNewProPurchase, CHECKOUT_EVENT_TYPES, subscriptionIntervalFromSession,
  subscriptionIdFromSession, initialExpiryFromSession, isTrialCheckout, trialBillingFromSession,
  notifyUnmappedTrialCheckout, handleBillingEvent, TRIAL_DAYS, attachLicenseToAccount, type WebhookConfig, type HandlerResult,
} from "./webhookLogic.ts";
import { userIdFromClientReference } from "../_shared/emailLang.ts";
import { subscribeToNewsletter, autoSubscribeEnabled } from "../_shared/newsletterSubscribe.ts";
import { resolveResendApiKey } from "../_shared/resendKey.ts";

const NEWSLETTER_PROXY_URL = Deno.env.get("NEWSLETTER_PROXY_URL");
const NEWSLETTER_PROXY_TOKEN = Deno.env.get("NEWSLETTER_PROXY_TOKEN");
// Doble opt-in (oct-2026): suscribir a cada comprador Pro al newsletter sin
// consentimiento solo cabe en la excepción de clientes (§ 7 Abs. 3 UWG) si el
// checkout lo avisa y permite oponerse — no verificado. Apagado salvo
// NEWSLETTER_AUTO_SUBSCRIBE_PRO=true.
const NEWSLETTER_AUTO_SUBSCRIBE_PRO = autoSubscribeEnabled(Deno.env.get("NEWSLETTER_AUTO_SUBSCRIBE_PRO"));

// Acepta firma de TEST y de LIVE: prueba contra ambos secrets (los que existan).
const WEBHOOK_SECRETS = [
  Deno.env.get("STRIPE_WEBHOOK_SECRET"),       // test (o el principal)
  Deno.env.get("STRIPE_WEBHOOK_SECRET_LIVE"),  // live
].filter((s): s is string => !!s);

const config: WebhookConfig = {
  supabaseUrl: Deno.env.get("SUPABASE_URL")!,
  serviceRole: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  resendApiKey: resolveResendApiKey((name) => Deno.env.get(name)),
  fromEmail: Deno.env.get("FROM_EMAIL") ?? "MOY IQ <licencias@moyiq.app>",
  alertEmail: Deno.env.get("ALERT_EMAIL") ?? "maxnovaluciglobal@gmail.com",
  portalUrl: Deno.env.get("STRIPE_PORTAL_URL") || undefined,
};

// Solo para probar el flujo completo con Stripe en modo test contra un stack
// LOCAL (supabase start + functions serve, ver docs/billing-trial-runbook.md).
// Nunca tiene efecto en el proyecto hosteado: se ignora si SUPABASE_URL es
// *.supabase.co, aunque alguien cargue el secret por error.
const ALLOW_TEST_EVENTS = Deno.env.get("STRIPE_ALLOW_TEST_EVENTS") === "true"
  && !/\.supabase\.co/i.test(config.supabaseUrl ?? "");

const json = (r: HandlerResult) => new Response(JSON.stringify(r.body), {
  status: r.status, headers: { "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature") ?? "";
  const raw = await req.text();

  const ok = await verifyStripeSignature(raw, sig, WEBHOOK_SECRETS);
  if (!ok) {
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  let event: any;
  try { event = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

  if (isTestModeCheckout(event) && !ALLOW_TEST_EVENTS) {
    console.warn(`Evento de TEST ignorado (no se emite licencia): type=${event?.type} session=${event?.data?.object?.id}`);
    return new Response(JSON.stringify({ received: true, ignored: "test_event" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Auditoría externa 2026-09-01: faltaba "checkout.session.async_payment_succeeded".
  // Un Payment Link con OXXO/boleto/SEPA débito habilitado (métodos recomendados por
  // Stripe para LATAM/Alemania) dispara primero "completed" con payment_status:'unpaid'
  // (se ignora abajo, correcto) y solo emite la licencia cuando compensa el pago async
  // días después — evento que este webhook nunca escuchaba. El cliente pagaba y nunca
  // recibía su clave, sin ningún error visible. sessionAlreadyProcessed() ya protege
  // contra procesar dos veces si algún evento llegara duplicado.
  if (CHECKOUT_EVENT_TYPES.includes(event?.type)) {
    const session = event.data?.object ?? {};
    const skipReason = checkoutSkipReason(session);
    if (skipReason) {
      console.warn(`Checkout ignorado (${skipReason}): payment_status=${session.payment_status} amount=${session.amount_total ?? 0} mode=${session.mode} payment_link=${session.payment_link ?? "-"} session=${session.id}`);
      if (skipReason === "unknown_payment_link") {
        // Link sin mapear: si es de MOY IQ, el cliente pagó (o dejó su
        // tarjeta) y no recibió clave. Aviso best-effort, no cambia el 200.
        notifyUnmappedTrialCheckout({
          sessionRef: session.id ?? null,
          email: session.customer_details?.email ?? session.customer_email ?? null,
          paymentLink: session.payment_link ?? null,
        }, config).catch(() => {});
      }
      return new Response(JSON.stringify({ received: true, ignored: skipReason }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    // Idempotencia: si esta sesión ya generó una licencia (reintento de Stripe),
    // no volver a intentarlo — ver sessionAlreadyProcessed().
    if (session.id && await sessionAlreadyProcessed(session.id, config)) {
      console.log(`Sesión ya procesada, reintento de Stripe ignorado: session=${session.id}`);
      return new Response(JSON.stringify({ received: true, ignored: "already_processed" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    const email = session.customer_details?.email ?? session.customer_email ?? null;
    const plan = planFromSession(session) ?? "pro";
    const key = generateKey();
    // session.payment_intent viene en el propio evento para checkouts de pago
    // único (mode:'payment') — se guarda para poder revocar más adelante si
    // Stripe manda un charge.refunded/charge.dispute.created (ver revokeLicense).
    // Para mode:'subscription' viene null (la suscripción no tiene payment_intent
    // propio, cada invoice tiene el suyo) — subscriptionId cubre ese caso.
    const paymentIntent = extractPaymentIntent(session);
    const subscriptionId = subscriptionIdFromSession(session);
    const interval = subscriptionIntervalFromSession(session);
    // T10: una suscripción nunca se emite con expires_at NULL (= Pro
    // permanente). Ver initialExpiryFromSession() y la migración 20261008000000.
    const expiresAt = initialExpiryFromSession(session);
    const trial = isTrialCheckout(session) && expiresAt ? trialBillingFromSession(session, expiresAt) : null;
    try {
      await issueLicense(key, plan, email, session.id ?? null, paymentIntent, config, subscriptionId, expiresAt);
      // C-39 / PRD-2: compra iniciada desde la app con sesión → Pro queda en la cuenta.
      const accountId = userIdFromClientReference(session.client_reference_id);
      const attached = accountId ? await attachLicenseToAccount(accountId, key, config) : null;
      if (attached && !attached.ok) console.warn(`Licencia no asociada a la cuenta (${attached.error}) session=${session.id}`);
      // Idioma del correo: client_reference_id 'lang_xx' del Payment Link (la app
      // lo agrega), session.locale o el customer si viene expandido; si no, es.
      const emailSent = email ? await sendKeyEmail(email, key, plan, session.id ?? null, config, interval, trial, langFromStripeSession(session), attached?.ok === true) : false;
      // Sin `key` a propósito — ver el comentario de sendKeyEmail(). session.id
      // identifica la fila igual de bien y no es material criptografico.
      console.log(`Licencia emitida: plan=${plan} con_email=${!!email} session=${session.id} payment_intent=${paymentIntent} subscription=${subscriptionId ?? "-"} expires_at=${expiresAt ?? "null"} prueba=${!!trial} email_enviado=${emailSent}`);
      // Fire-and-forget: una falla acá no debe tumbar la respuesta 200 a
      // Stripe (eso sí reintenta el webhook entero, con riesgo de doble
      // emisión pese a sessionAlreadyProcessed).
      notifyNewProPurchase({ email, plan, interval: trial ? `${interval ?? "?"} (prueba de ${TRIAL_DAYS} días, sin cobro todavía)` : interval }, config).catch(() => {});
      // Pedido de Walter 21-sep-2026: todo plan pago (Personal/Starter y Pro)
      // se suscribe también a la publication MOY IQ del newsletter semanal —
      // antes nadie quedaba suscrito automáticamente al pagar.
      // Desde oct-2026 solo con NEWSLETTER_AUTO_SUBSCRIBE_PRO=true (ver arriba).
      if (NEWSLETTER_AUTO_SUBSCRIBE_PRO) {
        subscribeToNewsletter(email, "moyiq", {
          proxyUrl: NEWSLETTER_PROXY_URL,
          proxyToken: NEWSLETTER_PROXY_TOKEN,
        }).catch(() => {});
      }
      if (!emailSent) {
        // Antes esto era invisible: la licencia quedaba emitida, el webhook
        // devolvia 200 y nadie se enteraba de que el cliente no tenia su clave.
        // El log se mantiene (primera línea de diagnóstico); notifyKeyDeliveryFailure
        // agrega la alerta real para no depender de que alguien mire el dashboard.
        console.error(`CRITICO: licencia emitida pero el cliente NO recibio su clave. session=${session.id} con_email=${!!email} payment_intent=${paymentIntent} — la clave original NO es recuperable (el servidor solo guarda su hash): resolver reemitiendo una licencia nueva.`);
        await notifyKeyDeliveryFailure({ sessionRef: session.id ?? null, email, plan, paymentIntent }, config);
      }
    } catch (err) {
      console.error("Error emitiendo licencia:", err);
      return new Response("error issuing license", { status: 500 });
    }
  }

  // Reembolsos, disputas, invoices y ciclo de la suscripción, con
  // idempotencia por event.id (ver handleBillingEvent en webhookLogic.ts).
  const billing = await handleBillingEvent(event, config);
  if (billing) return json(billing);

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
