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
//   RESEND_API_KEY, FROM_EMAIL            ← opcional (email de la clave)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ← los inyecta Supabase solo
//
// Stripe → Developers → Webhooks → endpoint:
//   https://<PROYECTO>.supabase.co/functions/v1/stripe-webhook
//   evento: checkout.session.completed

import {
  verifyStripeSignature, generateKey, planFromSession, isTestModeCheckout, shouldSkipCheckout,
  extractPaymentIntent, issueLicense, sessionAlreadyProcessed, revokeLicense, sendKeyEmail,
  notifyKeyDeliveryFailure, CHECKOUT_EVENT_TYPES, subscriptionIntervalFromSession,
  subscriptionIdFromSession, extendLicenseExpiry, periodEndFromInvoice, type WebhookConfig,
} from "./webhookLogic.ts";

// Acepta firma de TEST y de LIVE: prueba contra ambos secrets (los que existan).
const WEBHOOK_SECRETS = [
  Deno.env.get("STRIPE_WEBHOOK_SECRET"),       // test (o el principal)
  Deno.env.get("STRIPE_WEBHOOK_SECRET_LIVE"),  // live
].filter((s): s is string => !!s);

const config: WebhookConfig = {
  supabaseUrl: Deno.env.get("SUPABASE_URL")!,
  serviceRole: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  resendApiKey: Deno.env.get("RESEND_API_KEY"),
  fromEmail: Deno.env.get("FROM_EMAIL") ?? "MOY IQ <licencias@moyiq.app>",
  alertEmail: Deno.env.get("ALERT_EMAIL") ?? "maxnovaluciglobal@gmail.com",
};

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature") ?? "";
  const raw = await req.text();

  const ok = await verifyStripeSignature(raw, sig, WEBHOOK_SECRETS);
  if (!ok) {
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  let event: any;
  try { event = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

  if (isTestModeCheckout(event)) {
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
    if (shouldSkipCheckout(session)) {
      console.warn(`Checkout ignorado: payment_status=${session.payment_status} amount=${session.amount_total ?? 0} session=${session.id}`);
      return new Response(JSON.stringify({ received: true, ignored: "unpaid_or_zero" }), {
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
    const plan = planFromSession(session);
    const key = generateKey();
    // session.payment_intent viene en el propio evento para checkouts de pago
    // único (mode:'payment') — se guarda para poder revocar más adelante si
    // Stripe manda un charge.refunded/charge.dispute.created (ver revokeLicense).
    // Para mode:'subscription' viene null (la suscripción no tiene payment_intent
    // propio, cada invoice tiene el suyo) — subscriptionId cubre ese caso.
    const paymentIntent = extractPaymentIntent(session);
    const subscriptionId = subscriptionIdFromSession(session);
    const interval = subscriptionIntervalFromSession(session);
    try {
      await issueLicense(key, plan, email, session.id ?? null, paymentIntent, config, subscriptionId);
      const emailSent = email ? await sendKeyEmail(email, key, plan, session.id ?? null, config, interval) : false;
      // Sin `key` a propósito — ver el comentario de sendKeyEmail(). session.id
      // identifica la fila igual de bien y no es material criptografico.
      console.log(`Licencia emitida: plan=${plan} email=${email ?? "(sin email)"} session=${session.id} payment_intent=${paymentIntent} email_enviado=${emailSent}`);
      if (!emailSent) {
        // Antes esto era invisible: la licencia quedaba emitida, el webhook
        // devolvia 200 y nadie se enteraba de que el cliente no tenia su clave.
        // El log se mantiene (primera línea de diagnóstico); notifyKeyDeliveryFailure
        // agrega la alerta real para no depender de que alguien mire el dashboard.
        console.error(`CRITICO: licencia emitida pero el cliente NO recibio su clave. session=${session.id} email=${email ?? "(sin email)"} payment_intent=${paymentIntent} — la clave original NO es recuperable (el servidor solo guarda su hash): resolver reemitiendo una licencia nueva.`);
        await notifyKeyDeliveryFailure({ sessionRef: session.id ?? null, email, plan, paymentIntent }, config);
      }
    } catch (err) {
      console.error("Error emitiendo licencia:", err);
      return new Response("error issuing license", { status: 500 });
    }
  }

  // FISC-1 — reembolso o disputa: revocar la licencia asociada, si la hay.
  // Silencioso en el caso "not_found" (licencia emitida antes de este fix, sin
  // payment_intent_id guardado, o ya revocada) — no es un error del webhook.
  if (event?.type === "charge.refunded" || event?.type === "charge.dispute.created") {
    const charge = event.data?.object ?? {};
    const paymentIntent = extractPaymentIntent(charge);
    if (paymentIntent) {
      const result = await revokeLicense(paymentIntent, config);
      console.log(`${event.type}: payment_intent=${paymentIntent} revoke_result=${JSON.stringify(result)}`);
    } else {
      console.warn(`${event.type} sin payment_intent en el payload — no se puede revocar automáticamente, charge=${charge.id}`);
    }
  }

  // Suscripciones (MOY IQ Pro mensual/anual, desde 2026-09-12): cada invoice
  // pagada — alta o renovación, mismo handler para las dos — fija hasta cuándo
  // vale el acceso. OJO: este endpoint recibe invoice.payment_succeeded de
  // TODA la cuenta de Stripe compartida (DypOS, Alika, FinanceOS Invest, no
  // solo MOY IQ) — un subscription id que no matchea ninguna licencia nuestra
  // es el caso esperado para esos eventos ajenos, no un error, por eso no hay
  // log de "not found" acá.
  if (event?.type === "invoice.payment_succeeded") {
    const invoice = event.data?.object ?? {};
    const subscriptionId = subscriptionIdFromSession(invoice);
    const periodEnd = periodEndFromInvoice(invoice);
    if (subscriptionId && periodEnd) {
      try {
        await extendLicenseExpiry(subscriptionId, periodEnd, config);
        console.log(`Invoice pagada: subscription=${subscriptionId} expires_at=${periodEnd}`);
      } catch (err) {
        console.error("Error extendiendo vencimiento de suscripción:", err);
        return new Response("error extending subscription", { status: 500 });
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
