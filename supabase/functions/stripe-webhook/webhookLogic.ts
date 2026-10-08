// supabase/functions/stripe-webhook/webhookLogic.ts
//
// Lógica del webhook extraída de index.ts para poder testearla con vitest —
// index.ts vive en runtime Deno (usa `Deno.env.get` a nivel de módulo), lo
// que revienta con "Deno is not defined" apenas se importa desde Node. Este
// archivo NO referencia `Deno.*`: la config (URLs, keys) se recibe como
// parámetro en vez de leerse de env, así que corre igual en Deno (importado
// desde index.ts) y en Node (importado desde webhookLogic.test.ts).
// Ningún comportamiento cambia respecto del index.ts anterior — es solo la
// misma lógica movida, para poder blindarla con tests antes de tocarla de
// nuevo (ver PLAN_REMEDIACION_TECNICA_CARLOS_FINANCEOS.md, punto 2).

const enc = new TextEncoder();

// Verifica la firma del webhook de Stripe (esquema t=...,v1=...) con HMAC-SHA256.
// Prueba contra varios secrets (test + live) y acepta si alguno coincide.
import { type EmailLang, INTL_LOCALE, langFromStripeSession, langFromStripeSubscription } from "../_shared/emailLang.ts";
export { langFromStripeSession, langFromStripeSubscription };

export async function verifyStripeSignature(rawBody: string, sigHeader: string, secrets: string[]): Promise<boolean> {
  if (!sigHeader || secrets.length === 0) return false;
  const parts = sigHeader.split(",").map((p) => p.trim());
  const t = parts.find((p) => p.startsWith("t="))?.slice(2);
  const v1s = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || v1s.length === 0) return false;

  // tolerancia de 5 min contra replay
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(t)) > 300) return false;

  for (const secret of secrets) {
    const key = await crypto.subtle.importKey(
      "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${rawBody}`));
    const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
    if (v1s.includes(expected)) return true;
  }
  return false;
}

export function generateKey(): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin I,O,0,1
  const rnd = crypto.getRandomValues(new Uint8Array(12));
  let out = "";
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) out += "-";
    out += charset[rnd[i] % charset.length];
  }
  return `FNOS-${out}`;
}

export function planFromAmount(amountTotal: number | null): "personal" | "pro" {
  // centavos. Personal US$19 (1900) / Pro US$29 (2900) → umbral 2400.
  return (amountTotal ?? 0) >= 2400 ? "pro" : "personal";
}

// ── Prueba de Pro por 14 días CON tarjeta (T10, fase 4 · 2026-10-08) ───────
// Walter crea en Stripe dos Payment Links NUEVOS (Pro mensual y anual) con
// trial_period_days=14 y payment_method_collection=always, y pega acá sus ids
// plink_... (ver docs/billing-trial-runbook.md). Mientras sigan en null, un
// checkout de prueba ($0) NO emite licencia: checkoutSkipReason() lo descarta
// como "zero_amount_unknown_link" y avisa a ALERT_EMAIL. Es a propósito: este
// endpoint puede recibir eventos de otros productos de la cuenta de Stripe, y
// una suscripción de $0 ajena no debe mintear una licencia de MOY IQ.
// No inventar ids: solo pegar los que muestra el dashboard de Stripe.
export const TRIAL_LINK_MONTHLY_TODO: string | null = null; // TODO(Walter): plink_... del link de prueba Pro mensual
export const TRIAL_LINK_ANNUAL_TODO: string | null = null;  // TODO(Walter): plink_... del link de prueba Pro anual

// Debe coincidir con config.pricing.trialDays de la app (src/config.js) y con
// trial_period_days de los Payment Links. Se duplica acá porque la Edge
// Function no puede importar src/ (Supabase solo empaqueta supabase/functions).
export const TRIAL_DAYS = 14;

// Precio de lista de Pro en centavos de USD, igual que config.pricing
// (proMonthly 4.99 / proAnnual 39.99). Solo se usa como respaldo en los emails
// de prueba cuando el evento no trae el precio real de la suscripción.
export const PRO_LIST_PRICE_CENTS: Record<"month" | "year", number> = { month: 499, year: 3999 };

function trialLinkEntries<T>(value: T | ((interval: "month" | "year") => T)): Record<string, T> {
  const out: Record<string, T> = {};
  const pairs: Array<[string | null, "month" | "year"]> = [
    [TRIAL_LINK_MONTHLY_TODO, "month"],
    [TRIAL_LINK_ANNUAL_TODO, "year"],
  ];
  for (const [link, interval] of pairs) {
    if (link) out[link] = typeof value === "function" ? (value as (i: "month" | "year") => T)(interval) : value;
  }
  return out;
}

// Payment Links reales de producción (dashboard.stripe.com → Payment Links,
// ambos "Active" desde 12-jul-2026). Clasificar por acá primero es lo que de
// verdad habilita precio regional LATAM: un precio nuevo o un monto convertido
// a otra moneda para el MISMO Payment Link sigue resolviendo al plan correcto
// sin importar cuánto termine cobrándose — el umbral fijo en centavos de
// planFromAmount (arriba) rompía justo eso. Si se crea un Payment Link nuevo
// (otra región/moneda), agregarlo acá; hasta entonces cae al fallback de monto.
export const PAYMENT_LINK_PLAN: Record<string, "personal" | "pro"> = {
  plink_1TsMlSRxn4y6AU3r6CkGfuhO: "personal", // https://buy.stripe.com/dRmeVf64WdSR85HgvD3wQ02 (pago único, en retiro)
  plink_1TsMlpRxn4y6AU3rcPN5urIw: "pro",      // https://buy.stripe.com/fZu5kFctk5ml1Hj3IR3wQ03 (pago único, en retiro)
  plink_1UEfHBRxn4y6AU3r2Cd9SAmi: "pro",      // https://buy.stripe.com/00w8wR3WOcON85Ha7f3wQ04 Pro mensual US$4.99 (cuenta compartida Maxnova Luci, en retiro 12-sep — separación de cuentas Stripe)
  plink_1UEfI7Rxn4y6AU3rgSX3eaOQ: "pro",      // https://buy.stripe.com/6oU5kF3WO2a90Dfa7f3wQ05 Pro anual US$39.99 (cuenta compartida Maxnova Luci, en retiro 12-sep)
  plink_1UEgvJ2L52ZuuTMr1Agq0t4b: "pro",      // https://buy.stripe.com/6oU9AM8Ht3aggzi8qZfnO00 Pro mensual US$4.99 (cuenta propia MOY IQ, acct_1UEffP2L52ZuuTMr — activo desde 12-sep)
  plink_1UEgve2L52ZuuTMrdS1OE9fh: "pro",      // https://buy.stripe.com/3cI14gbTF7qwbeYaz7fnO01 Pro anual US$39.99 (cuenta propia MOY IQ — activo desde 12-sep)
  ...trialLinkEntries("pro"),
};

export function planFromSession(session: { payment_link?: string | null; amount_total?: number | null }): "personal" | "pro" {
  const byLink = session.payment_link ? PAYMENT_LINK_PLAN[session.payment_link] : undefined;
  return byLink ?? planFromAmount(session.amount_total ?? null);
}

// Solo para decidir el texto del email de bienvenida (mensual/anual/pago único)
// y, si hace falta, un fallback de expiración inicial — el vencimiento real
// SIEMPRE lo fija extendLicenseExpiry() desde invoice.payment_succeeded, esto
// es solo cosmético/best-effort mientras esa invoice llega (segundos después).
const SUBSCRIPTION_INTERVAL: Record<string, "month" | "year"> = {
  plink_1UEfHBRxn4y6AU3r2Cd9SAmi: "month",
  plink_1UEfI7Rxn4y6AU3rgSX3eaOQ: "year",
  plink_1UEgvJ2L52ZuuTMr1Agq0t4b: "month",
  plink_1UEgve2L52ZuuTMrdS1OE9fh: "year",
  ...trialLinkEntries<"month" | "year">((interval) => interval),
};

export function subscriptionIntervalFromSession(session: { payment_link?: string | null }): "month" | "year" | null {
  return session.payment_link ? SUBSCRIPTION_INTERVAL[session.payment_link] ?? null : null;
}

export function subscriptionIdFromSession(session: { subscription?: string | { id?: string } | null }): string | null {
  const sub = session?.subscription;
  if (typeof sub === "string") return sub;
  return sub?.id ?? null;
}

// Versión de la API de Stripe: el código no fija ninguna (no usa SDK) — los
// eventos llegan con la versión configurada en el endpoint del dashboard, que
// no está en el repo. Desde la API 2025-03-31 ("basil") la invoice ya no trae
// `subscription` en la raíz: pasó a `parent.subscription_details.subscription`
// (y en cada línea a `parent.subscription_item_details.subscription`). Con la
// versión vieja, subscriptionIdFromSession(invoice) alcanzaba; con basil
// devolvía null y invoice.payment_succeeded nunca fijaba expires_at. Se leen
// las dos formas, en orden, para no depender de la versión del endpoint.
type SubRef = string | { id?: string } | null | undefined;
function subRefId(ref: SubRef): string | null {
  if (typeof ref === "string") return ref;
  return ref?.id ?? null;
}
export function subscriptionIdFromInvoice(invoice: {
  subscription?: SubRef;
  parent?: { subscription_details?: { subscription?: SubRef } | null } | null;
  lines?: { data?: Array<{ subscription?: SubRef; parent?: { subscription_item_details?: { subscription?: SubRef } | null } | null }> };
}): string | null {
  const direct = subRefId(invoice?.subscription) ?? subRefId(invoice?.parent?.subscription_details?.subscription);
  if (direct) return direct;
  for (const line of invoice?.lines?.data ?? []) {
    const id = subRefId(line?.parent?.subscription_item_details?.subscription) ?? subRefId(line?.subscription);
    if (id) return id;
  }
  return null;
}

// Prueba de Pro: Stripe manda checkout.session.completed con amount_total=0 y
// payment_status "paid" (no hay nada que cobrar todavía; la tarjeta queda
// guardada y se cobra al terminar la prueba).
export function isTrialCheckout(session: { mode?: string; payment_status?: string; amount_total?: number | null }): boolean {
  return session?.mode === "subscription" && session?.payment_status === "paid" && (session?.amount_total ?? 0) <= 0;
}

function addUtcMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

// Vencimiento inicial de una licencia de suscripción, fijado AL EMITIRLA.
// Antes una suscripción se emitía con expires_at NULL (= licencia permanente)
// y dependía de que invoice.payment_succeeded llegara DESPUÉS para fijarlo. Si
// la invoice llegaba antes (Stripe no garantiza orden), extend_license_expiry
// actualizaba 0 filas y la licencia quedaba Pro para siempre. Con la prueba de
// 14 días ese caso se vuelve normal (la invoice de $0 sale al mismo tiempo que
// el checkout). Ahora:
//   - prueba: created + TRIAL_DAYS (Stripe calcula trial_end desde la creación
//     de la suscripción, segundos/minutos después de session.created).
//   - suscripción paga con intervalo conocido: created + 1 mes / 1 año.
//   - suscripción con intervalo desconocido: created + 35 días (tope acotado;
//     la invoice lo corrige hacia arriba).
// La migración 20261008000000 completa el arreglo del lado SQL: si la invoice
// llega primero queda guardada en subscription_expiry_pending e issue_license
// la toma, y extend_license_expiry solo mueve expires_at hacia adelante.
// Pago único (sin suscripción): null, como siempre (licencia perpetua).
export function initialExpiryFromSession(
  session: { mode?: string; subscription?: SubRef; created?: number | null; payment_status?: string; amount_total?: number | null; payment_link?: string | null },
  nowMs: number = Date.now(),
): string | null {
  const isSubscription = session?.mode === "subscription" || !!subRefId(session?.subscription);
  if (!isSubscription) return null;
  const base = typeof session?.created === "number" ? new Date(session.created * 1000) : new Date(nowMs);
  if (isTrialCheckout({ mode: "subscription", payment_status: session?.payment_status, amount_total: session?.amount_total })) {
    return new Date(base.getTime() + TRIAL_DAYS * 86400 * 1000).toISOString();
  }
  const interval = subscriptionIntervalFromSession(session);
  if (interval === "month") return addUtcMonths(base, 1).toISOString();
  if (interval === "year") return addUtcMonths(base, 12).toISOString();
  return new Date(base.getTime() + 35 * 86400 * 1000).toISOString();
}

// Blindaje: solo eventos LIVE reales emiten licencia. Un evento de TEST (o un
// endpoint de test todavía conectado) NO debe mintear una clave real en
// producción. CHECKOUT_EVENT_TYPES cubre los dos tipos que pueden emitir
// licencia — quedó desincronizado una vez ya (auditoría 2026-09-01: se agregó
// async_payment_succeeded a la lista de eventos que emiten sin agregarlo acá),
// de ahí el test que cubre ambos tipos explícitamente.
export const CHECKOUT_EVENT_TYPES = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];

export function isTestModeCheckout(event: { type?: string; livemode?: boolean }): boolean {
  return CHECKOUT_EVENT_TYPES.includes(event?.type as string) && event?.livemode !== true;
}

// Solo checkouts realmente pagados y con un monto válido (evita $0 / pruebas).
// Antes descartaba en silencio cualquier pago menor a US$19 en centavos fijos
// — con planFromSession clasificando por Payment Link, un precio regional más
// bajo para el mismo plan ya no debe perderse acá. Sigue rechazando $0 (link
// con cupón 100% u otro caso degenerado, ninguno esperado hoy: "Allow
// promotion codes" está apagado en los 2 Payment Links reales).
//
// T10 (2026-10-08): una prueba de Pro llega con amount_total=0 y
// payment_status "paid". Ese caso ya NO se descarta si es una suscripción de
// un Payment Link conocido de MOY IQ (PAYMENT_LINK_PLAN, que incluye los
// TRIAL_LINK_*). Un $0 de un link desconocido se sigue descartando, como
// antes: puede ser la prueba de otro producto de la cuenta de Stripe, o un
// link de prueba cuyo id todavía no se pegó acá (en ese caso index.ts avisa a
// ALERT_EMAIL para que no pase en silencio).
export type CheckoutSkipReason = "unpaid" | "zero_amount" | "zero_amount_unknown_link";

export function checkoutSkipReason(
  session: { payment_status?: string; amount_total?: number | null; mode?: string; payment_link?: string | null },
): CheckoutSkipReason | null {
  if (session.payment_status !== "paid") return "unpaid";
  const amount = session.amount_total ?? 0;
  if (amount > 0) return null;
  if (session.mode !== "subscription") return "zero_amount";
  const known = !!session.payment_link && session.payment_link in PAYMENT_LINK_PLAN;
  return known ? null : "zero_amount_unknown_link";
}

export function shouldSkipCheckout(
  session: { payment_status?: string; amount_total?: number | null; mode?: string; payment_link?: string | null },
): boolean {
  return checkoutSkipReason(session) !== null;
}

// session.payment_intent / charge.payment_intent vienen como string simple o
// como objeto expandido según cómo Stripe armó el evento — mismo patrón en
// los dos lugares que lo leen (checkout y charge.refunded/dispute).
export function extractPaymentIntent(obj: { payment_intent?: string | { id?: string } | null }): string | null {
  const pi = obj?.payment_intent;
  if (typeof pi === "string") return pi;
  return pi?.id ?? null;
}

export interface WebhookConfig {
  supabaseUrl: string;
  serviceRole: string;
  resendApiKey?: string;
  fromEmail: string;
  alertEmail?: string;
  // URL del Customer Portal de Stripe (secret STRIPE_PORTAL_URL). Opcional:
  // si está, los emails de prueba la ofrecen para cancelar; si no, solo el
  // email de soporte.
  portalUrl?: string;
}

const SUPPORT_EMAIL = "support@moyiq.app";

function serviceHeaders(config: WebhookConfig): Record<string, string> {
  return {
    apikey: config.serviceRole,
    Authorization: `Bearer ${config.serviceRole}`,
    "Content-Type": "application/json",
  };
}

// Alerta real para el caso "pagó y no recibió su clave" (ver punto 4 del
// plan) — hasta ahora solo quedaba el CRITICO en el log de Supabase, así que
// el único mecanismo de detección era un reclamo del cliente. Reutiliza el
// mismo Resend ya configurado, sin integraciones nuevas. Best-effort a
// propósito: la licencia ya se emitió y Stripe ya recibió 200, así que un
// fallo acá (Resend caído, o sin red) se loguea pero nunca debe tumbar el
// webhook — de ahí el try/catch en vez de dejar que rechace.
export async function notifyKeyDeliveryFailure(
  details: { sessionRef: string | null; email: string | null; plan: string; paymentIntent: string | null },
  config: WebhookConfig,
): Promise<void> {
  if (!config.resendApiKey || !config.alertEmail) return;
  const html = `
    <div style="font-family:system-ui,sans-serif">
      <p><strong>Licencia emitida pero el cliente no recibió su clave.</strong></p>
      <ul>
        <li>session: ${details.sessionRef ?? "(sin session)"}</li>
        <li>email del cliente: ${details.email ?? "(sin email)"}</li>
        <li>plan: ${details.plan}</li>
        <li>payment_intent: ${details.paymentIntent ?? "(sin payment_intent)"}</li>
      </ul>
      <p>La clave original no es recuperable (el servidor solo guarda su hash) — resolver reemitiendo una licencia nueva.</p>
    </div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: config.fromEmail, to: config.alertEmail,
        subject: "MOY IQ: cliente pagó y no recibió su clave", html,
      }),
    });
    if (!res.ok) console.error(`notifyKeyDeliveryFailure: Resend error ${res.status} ${await res.text()}`);
  } catch (err) {
    console.error("notifyKeyDeliveryFailure: fallo de red", err);
  }
}

// Notificación de venta (distinta de notifyKeyDeliveryFailure, que solo
// avisa cuando algo salió MAL). Pedido de Walter 14-sep-2026: no le llegaba
// ninguna señal de altas nuevas — Pro es la única de las tres (Starter, Pro,
// Invest) que ya tenía un canal de alerta armado (config.alertEmail), solo
// faltaba usarlo también en el camino feliz.
export async function notifyNewProPurchase(
  details: { email: string | null; plan: string; interval: string | null },
  config: WebhookConfig,
): Promise<void> {
  if (!config.resendApiKey || !config.alertEmail) return;
  const html = `
    <div style="font-family:system-ui,sans-serif">
      <p><strong>Nueva compra Pro en MOY IQ.</strong></p>
      <ul>
        <li>email: ${details.email ?? "(sin email)"}</li>
        <li>plan: ${details.plan}</li>
        <li>intervalo: ${details.interval ?? "(pago único)"}</li>
      </ul>
      <p style="color:#888;font-size:12px">Panel CRM: <a href="https://app.moyiq.app/app/?admin=crm">app.moyiq.app/app/?admin=crm</a></p>
    </div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: config.fromEmail, to: config.alertEmail,
        subject: "MOY IQ: nueva compra Pro", html,
      }),
    });
    if (!res.ok) console.error(`notifyNewProPurchase: Resend error ${res.status} ${await res.text()}`);
  } catch (err) {
    console.error("notifyNewProPurchase: fallo de red", err);
  }
}

// expiresAt (T10): vencimiento inicial para suscripciones, ver
// initialExpiryFromSession(). p_expires_at solo se manda cuando no es null:
// un pago único sigue llamando a la RPC con los mismos 6 argumentos de
// siempre, así que no depende de que la migración 20261008000000 esté
// aplicada. Una suscripción SÍ depende: aplicar la migración ANTES de
// desplegar esta función (docs/billing-trial-runbook.md).
export async function issueLicense(
  key: string, plan: string, email: string | null, session: string | null, paymentIntent: string | null,
  config: WebhookConfig, subscriptionId: string | null = null, expiresAt: string | null = null,
) {
  const body: Record<string, unknown> = {
    p_key: key, p_plan: plan, p_email: email, p_session: session,
    p_payment_intent: paymentIntent, p_subscription: subscriptionId,
  };
  if (expiresAt) body.p_expires_at = expiresAt;
  const res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/issue_license`, {
    method: "POST",
    headers: serviceHeaders(config),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`issue_license failed: ${res.status} ${await res.text()}`);
}

// Fija/extiende el vencimiento de una suscripción — se llama desde
// invoice.payment_succeeded, tanto en el alta (primera invoice) como en cada
// renovación. No hay revocación explícita al cancelar: si no llega una
// invoice.payment_succeeded nueva, expires_at ya fijado por la renovación
// anterior vence solo y validate_license empieza a rechazar — no hace falta
// escuchar customer.subscription.deleted para el control de acceso en sí.
// Gap conocido, documentado a propósito: un reembolso de una invoice de
// suscripción no revoca al instante (a diferencia de FISC-1 para pago único)
// porque el charge/payment_intent de una invoice no es el que se guardó en
// checkout — revisar si esto importa una vez haya suscriptores reales.
//
// T10 (2026-10-08): el comentario de arriba sigue valiendo para el control de
// acceso, pero ahora customer.subscription.deleted SÍ revoca (ver
// revokeLicenseBySubscription) — sin eso, cancelar la prueba dejaba la
// licencia viva hasta expires_at y, si expires_at era NULL por la carrera de
// eventos, para siempre. Desde la migración 20261008000000 la RPC devuelve
// {ok, updated, pending}: updated=0 con pending=true significa que la
// licencia todavía no existe (invoice antes que checkout, o una suscripción
// de otro producto) y el vencimiento quedó guardado para que issue_license lo
// tome. Antes de la migración la RPC devolvía void: se tolera un cuerpo vacío.
export async function extendLicenseExpiry(
  subscriptionId: string, expiresAtIso: string, config: WebhookConfig,
): Promise<{ updated: number | null; pending: boolean }> {
  const res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/extend_license_expiry`, {
    method: "POST",
    headers: serviceHeaders(config),
    body: JSON.stringify({ p_subscription: subscriptionId, p_expires_at: expiresAtIso }),
  });
  if (!res.ok) throw new Error(`extend_license_expiry failed: ${res.status} ${await res.text()}`);
  let data: any = null;
  try { data = typeof res.json === "function" ? await res.json() : null; } catch { data = null; }
  const updated = typeof data?.updated === "number" ? data.updated : null;
  return { updated, pending: data?.pending === true };
}

// El campo que de verdad manda para "hasta cuándo vale el acceso" es
// period.end de las líneas de la invoice (unix seconds) — es el mismo en la
// invoice de alta y en cada renovación, así que un solo handler cubre ambos
// casos sin mirar billing_reason. En la invoice de $0 de una prueba, la línea
// cubre la prueba entera: period.end = trial_end. Se toma el máximo entre
// líneas (una invoice con prorrateo trae más de una) — con una sola línea es
// exactamente lines.data[0].period.end, igual que antes.
export function periodEndFromInvoice(invoice: { lines?: { data?: Array<{ period?: { end?: number } }> } }): string | null {
  const ends = (invoice?.lines?.data ?? [])
    .map((l) => l?.period?.end)
    .filter((e): e is number => typeof e === "number");
  if (ends.length === 0) return null;
  return new Date(Math.max(...ends) * 1000).toISOString();
}

// Auditoría 2026-08-27: issue_license NO era idempotente por sesión — un
// reintento de Stripe (timeout, o sendKeyEmail fallando DESPUÉS de que la
// licencia ya se insertó bien) generaba una clave nueva y chocaba contra la
// constraint UNIQUE de stripe_session_id, sin capturar ese conflicto (el
// "on conflict" de issue_license solo cubre key_hash). Postgres tiraba una
// excepción no manejada, la RPC devolvía error, el webhook 500, y Stripe
// reintentaba durante 3 días — un cliente que pagó nunca recibía su clave.
// Fix: chequear ANTES si esta sesión ya se procesó. No se puede reenviar LA
// MISMA clave (el servidor nunca guarda el texto plano, solo el hash — por
// diseño, para que un breach del servidor no filtre claves reales), así que
// un reintento detectado simplemente se reconoce como ya cubierto y no
// vuelve a intentar emitir ni a chocar contra la constraint.
export async function sessionAlreadyProcessed(sessionId: string, config: WebhookConfig): Promise<boolean> {
  const res = await fetch(
    `${config.supabaseUrl}/rest/v1/licenses?stripe_session_id=eq.${encodeURIComponent(sessionId)}&select=key_hash&limit=1`,
    { headers: { apikey: config.serviceRole, Authorization: `Bearer ${config.serviceRole}` } },
  );
  if (!res.ok) {
    // Si el chequeo mismo falla, no bloqueamos la emisión por eso — issue_license
    // sigue protegido por su propio conflict handling para el caso normal.
    console.error(`sessionAlreadyProcessed check failed: ${res.status} ${await res.text()}`);
    return false;
  }
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

// FISC-1 (auditoría 2026-08-21): revoca la licencia asociada a un payment_intent
// cuando Stripe manda charge.refunded o charge.dispute.created. Antes de esto
// ningún evento revocaba nada — ver supabase-license-revoke.sql para el
// detalle de por qué se matchea por payment_intent y no por session id.
export async function revokeLicense(paymentIntent: string, config: WebhookConfig): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/revoke_license`, {
    method: "POST",
    headers: {
      apikey: config.serviceRole,
      Authorization: `Bearer ${config.serviceRole}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_payment_intent: paymentIntent }),
  });
  if (!res.ok) {
    console.error(`revoke_license failed: ${res.status} ${await res.text()}`);
    return { ok: false, error: `http_${res.status}` };
  }
  return await res.json();
}

// Devuelve true solo si Resend aceptó el envío. La clave NUNCA se imprime en
// logs: de ella se deriva la llave AES-GCM del sync (ver utils/syncCrypto.js,
// deriveKey = SHA-256('fnos-sync:'+clave)), así que un log con la clave permite
// descifrar el blob de synced_data de ese usuario y rompe la promesa E2E que
// declara la política de privacidad. Para correlacionar con la fila alcanza
// stripe_session_id, que es UNIQUE en licenses.
//
// Reintenta UNA vez si Resend falla (timeout/5xx transitorio) antes de darlo
// por perdido — ver PLAN_REMEDIACION_TECNICA_CARLOS_FINANCEOS.md punto 4:
// hasta ahora un fallo transitorio de Resend era indistinguible de una clave
// realmente no entregada, y ambos casos requerían reemitir la licencia a mano.
export async function sendKeyEmail(
  to: string, key: string, plan: string, sessionRef: string | null, config: WebhookConfig,
  interval: "month" | "year" | null = null,
  trial: TrialBilling | null = null,
  lang: EmailLang = "es",
): Promise<boolean> {
  if (!config.resendApiKey) {
    console.error(`CRITICO: RESEND_API_KEY no configurada — el cliente pago y NO recibio su clave. session=${sessionRef}`);
    return false;
  }
  const appUrl = "https://app.moyiq.app/app/";
  // T10: si el checkout fue una prueba, el email no dice "Compra confirmada"
  // (no se cobró nada): dice que la prueba empezó, cuándo termina, qué se
  // cobrará y cómo cancelar antes.
  const T = MAIL[lang] ?? MAIL.es;
  const support = `<a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>`;
  const billingNote = trial
    ? ""
    : interval
      ? `<p>${T.renewalNote(interval, support)}</p>`
      : "";
  const heading = trial ? T.trialSubject : T.licenseSubject;
  const intro = trial
    ? `<p>${T.trialStarted(TRIAL_DAYS, formatDateFor(trial.endsAt, lang))}</p>
      <p>${chargeSentence(trial, lang)}${T.renews(trial.interval)}</p>
      ${cancelSentence(config, lang)}`
    : `<p>${T.purchase(plan === "pro" ? "Pro" : "Personal")}</p>`;
  const subject = heading;
  const html = `
    <div lang="${lang}" style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#14213D">${heading}</h2>
      ${intro}
      <p>${T.keyLabel}</p>
      <p style="font-family:monospace;font-size:20px;font-weight:700;background:#f0f7f3;
                padding:14px;border-radius:8px;text-align:center;letter-spacing:2px">${key}</p>
      <p>${T.activate(`<a href="${appUrl}">${appUrl}</a>`)}</p>
      ${billingNote}
      <p style="color:#888;font-size:12px">${T.privacy}</p>
    </div>`;
  const attempt = async () => fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: config.fromEmail, to, subject, html }),
  });
  let res = await attempt();
  if (!res.ok) {
    console.warn(`Resend intento 1 falló: ${res.status} ${await res.text()} session=${sessionRef} — reintentando`);
    res = await attempt();
  }
  if (!res.ok) {
    console.error(`Resend error tras reintento: ${res.status} ${await res.text()} session=${sessionRef}`);
    return false;
  }
  return true;
}

// ── T10: suscripciones y prueba de Pro (2026-10-08) ─────────────────────────

// customer.subscription.deleted → revoca la licencia de esa suscripción.
// Mismo modelo que revoke_license: solo cambia status a 'revoked', nunca borra
// filas ni datos personales. Necesita la migración 20261008000000 (la RPC
// revoke_license(p_payment_intent) no sirve acá: en una suscripción el
// payment_intent del checkout es null). "not_found_or_already_revoked" es el
// caso esperado para suscripciones de otros productos de la cuenta.
export async function revokeLicenseBySubscription(
  subscriptionId: string, config: WebhookConfig,
): Promise<{ ok: boolean; error?: string; revoked?: number }> {
  const res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/revoke_license_by_subscription`, {
    method: "POST",
    headers: serviceHeaders(config),
    body: JSON.stringify({ p_subscription_id: subscriptionId }),
  });
  if (!res.ok) {
    console.error(`revoke_license_by_subscription failed: ${res.status} ${await res.text()}`);
    return { ok: false, error: `http_${res.status}` };
  }
  return await res.json();
}

// Licencia de MOY IQ asociada a una suscripción (para saber a qué email
// mandar el aviso de fin de prueba: el objeto subscription de Stripe solo
// trae el id del customer, no su email, y este webhook no llama a la API de
// Stripe). Devuelve null si no hay fila (suscripción de otro producto).
// Lanza si la consulta falla: sin email no hay forma de avisar, y conviene
// que Stripe reintente.
export async function findLicenseBySubscription(
  subscriptionId: string, config: WebhookConfig,
): Promise<{ email: string | null; status: string | null; plan: string | null } | null> {
  const res = await fetch(
    `${config.supabaseUrl}/rest/v1/licenses?stripe_subscription_id=eq.${encodeURIComponent(subscriptionId)}&select=email,status,plan&limit=1`,
    { headers: { apikey: config.serviceRole, Authorization: `Bearer ${config.serviceRole}` } },
  );
  if (!res.ok) throw new Error(`license lookup failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = rows[0] ?? {};
  return { email: row.email ?? null, status: row.status ?? null, plan: row.plan ?? null };
}

// Idempotencia por event id (tabla webhook_events_processed, migración
// 20261008000000). INSERT ... ON CONFLICT DO NOTHING vía PostgREST:
//   - "claimed": la fila se insertó ahora → este proceso manda el email.
//   - "duplicate": la fila ya existía → otra entrega del mismo evento ya lo
//     mandó (o lo está mandando). Nunca se reenvía.
//   - "unknown": la consulta falló (red, tabla todavía no creada). Fail-open:
//     se manda igual. Stripe solo reintenta un evento si respondimos no-2xx,
//     así que el riesgo de doble envío queda acotado a una base caída.
export async function claimWebhookEvent(
  eventId: string, eventType: string, config: WebhookConfig,
): Promise<"claimed" | "duplicate" | "unknown"> {
  try {
    const res = await fetch(`${config.supabaseUrl}/rest/v1/webhook_events_processed?on_conflict=event_id`, {
      method: "POST",
      headers: { ...serviceHeaders(config), Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify({ event_id: eventId, event_type: eventType }),
    });
    if (!res.ok) {
      console.error(`claimWebhookEvent: ${res.status} ${await res.text()} event=${eventId} — fail-open`);
      return "unknown";
    }
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0 ? "claimed" : "duplicate";
  } catch (err) {
    console.error(`claimWebhookEvent: fallo de red event=${eventId} — fail-open`, err);
    return "unknown";
  }
}

// Si el envío falla después de reclamar el evento, se libera la fila para que
// el reintento de Stripe (respondemos 500) pueda mandarlo. Best-effort.
export async function releaseWebhookEvent(eventId: string, config: WebhookConfig): Promise<void> {
  try {
    const res = await fetch(
      `${config.supabaseUrl}/rest/v1/webhook_events_processed?event_id=eq.${encodeURIComponent(eventId)}`,
      { method: "DELETE", headers: serviceHeaders(config) },
    );
    if (!res.ok) console.error(`releaseWebhookEvent: ${res.status} ${await res.text()} event=${eventId}`);
  } catch (err) {
    console.error(`releaseWebhookEvent: fallo de red event=${eventId}`, err);
  }
}

// Fecha legible en español, en UTC (la que usa Stripe para trial_end).
export function formatDateEs(iso: string | number): string {
  const d = typeof iso === "number" ? new Date(iso * 1000) : new Date(iso);
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

// "US$ 4,99" — mismo formato que la app en español (utils/pricing.js).
export function formatAmountEs(cents: number, currency = "usd"): string {
  const value = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
  const cur = currency.toLowerCase();
  if (cur === "usd") return `US$ ${value}`;
  if (cur === "eur") return `${value} €`;
  return `${value} ${cur.toUpperCase()}`;
}

export interface TrialBilling {
  endsAt: string;                      // ISO
  amountCents: number | null;          // lo que se cobrará al terminar la prueba
  currency: string;
  interval: "month" | "year" | null;
}

// ── Textos de los correos al cliente, en los 4 idiomas de la app ────────────
// El español es el de siempre, palabra por palabra (los tests lo fijan). El
// idioma sale de langFromStripeSession / langFromStripeSubscription
// (_shared/emailLang.ts); sin señal, español. Voz: seca, sin exclamaciones,
// alemán con "Sie" (financeos-workspace/branding/voz-de-producto.md).
type Interval = "month" | "year" | null;
interface MailText {
  licenseSubject: string;
  trialSubject: string;
  trialEndingSubject: string;
  trialEndsOn: (date: string) => string;
  trialStarted: (days: number, date: string) => string;
  charge: (amount: string, interval: Interval) => string;
  chargeNoAmount: string;
  renews: (interval: Interval) => string;
  cancelPortal: (portal: string, support: string) => string;
  cancelNoPortal: (support: string) => string;
  renewalNote: (interval: "month" | "year", support: string) => string;
  purchase: (plan: string) => string;
  keyLabel: string;
  activate: (link: string) => string;
  staySame: string;
  privacy: string;
}
const MAIL: Record<EmailLang, MailText> = {
  es: {
    licenseSubject: "Tu licencia de MOY IQ",
    trialSubject: "Tu prueba de MOY IQ Pro",
    trialEndingSubject: "Tu prueba de MOY IQ Pro termina pronto",
    trialEndsOn: (d) => `Tu prueba de MOY IQ Pro termina el ${d}`,
    trialStarted: (n, d) => `Tu prueba de Pro empezó. Dura ${n} días y termina el ${d}.`,
    charge: (a, i) => `Ese día se cobran ${a}${i === "month" ? " al mes" : i === "year" ? " al año" : ""} en la tarjeta que registraste.`,
    chargeNoAmount: "Ese día se cobra el precio de tu plan en la tarjeta que registraste.",
    renews: (i) => ` Después se renueva automáticamente${i === "year" ? " cada año" : i === "month" ? " cada mes" : ""}.`,
    cancelPortal: (portal, sup) => `Si no quieres seguir, cancela antes de esa fecha desde <a href="${portal}">tu portal de facturación</a> o escribe a ${sup}. No se cobra nada si cancelas durante la prueba.`,
    cancelNoPortal: (sup) => `Si no quieres seguir, escribe a ${sup} antes de esa fecha y se cancela la suscripción. No se cobra nada si cancelas durante la prueba.`,
    renewalNote: (i, sup) => `Es una suscripción con renovación automática ${i === "month" ? "mensual" : "anual"}. Para cancelarla, escribe a ${sup}.`,
    purchase: (p) => `Compra confirmada. Plan: <strong>${p}</strong>.`,
    keyLabel: "Tu clave de acceso:",
    activate: (l) => `Para activarla, abre ${l} e ingresa la clave.`,
    staySame: "Si sigues, no tienes que hacer nada: tu clave de acceso es la misma.",
    privacy: "Tus datos financieros se guardan solo en tu dispositivo.",
  },
  en: {
    licenseSubject: "Your MOY IQ license",
    trialSubject: "Your MOY IQ Pro trial",
    trialEndingSubject: "Your MOY IQ Pro trial ends soon",
    trialEndsOn: (d) => `Your MOY IQ Pro trial ends on ${d}`,
    trialStarted: (n, d) => `Your Pro trial has started. It lasts ${n} days and ends on ${d}.`,
    charge: (a, i) => `On that day, ${a}${i === "month" ? " per month" : i === "year" ? " per year" : ""} is charged to the card you added.`,
    chargeNoAmount: "On that day, your plan's price is charged to the card you added.",
    renews: (i) => ` After that it renews automatically${i === "year" ? " every year" : i === "month" ? " every month" : ""}.`,
    cancelPortal: (portal, sup) => `If you don't want to continue, cancel before that date from <a href="${portal}">your billing portal</a> or write to ${sup}. Nothing is charged if you cancel during the trial.`,
    cancelNoPortal: (sup) => `If you don't want to continue, write to ${sup} before that date and the subscription is canceled. Nothing is charged if you cancel during the trial.`,
    renewalNote: (i, sup) => `This subscription renews automatically every ${i === "month" ? "month" : "year"}. To cancel it, write to ${sup}.`,
    purchase: (p) => `Purchase confirmed. Plan: <strong>${p}</strong>.`,
    keyLabel: "Your access key:",
    activate: (l) => `To activate it, open ${l} and enter the key.`,
    staySame: "If you continue, you don't need to do anything: your access key stays the same.",
    privacy: "Your financial data is stored only on your device.",
  },
  pt: {
    licenseSubject: "Sua licença do MOY IQ",
    trialSubject: "Seu teste do MOY IQ Pro",
    trialEndingSubject: "Seu teste do MOY IQ Pro termina em breve",
    trialEndsOn: (d) => `Seu teste do MOY IQ Pro termina em ${d}`,
    trialStarted: (n, d) => `Seu teste do Pro começou. Dura ${n} dias e termina em ${d}.`,
    charge: (a, i) => `Nesse dia, são cobrados ${a}${i === "month" ? " por mês" : i === "year" ? " por ano" : ""} no cartão que você cadastrou.`,
    chargeNoAmount: "Nesse dia, o preço do seu plano é cobrado no cartão que você cadastrou.",
    renews: (i) => ` Depois, renova automaticamente${i === "year" ? " todo ano" : i === "month" ? " todo mês" : ""}.`,
    cancelPortal: (portal, sup) => `Se não quiser continuar, cancele antes dessa data no <a href="${portal}">seu portal de cobrança</a> ou escreva para ${sup}. Nada é cobrado se você cancelar durante o teste.`,
    cancelNoPortal: (sup) => `Se não quiser continuar, escreva para ${sup} antes dessa data e a assinatura será cancelada. Nada é cobrado se você cancelar durante o teste.`,
    renewalNote: (i, sup) => `É uma assinatura com renovação automática ${i === "month" ? "mensal" : "anual"}. Para cancelar, escreva para ${sup}.`,
    purchase: (p) => `Compra confirmada. Plano: <strong>${p}</strong>.`,
    keyLabel: "Sua chave de acesso:",
    activate: (l) => `Para ativá-la, abra ${l} e insira a chave.`,
    staySame: "Se continuar, não precisa fazer nada: sua chave de acesso é a mesma.",
    privacy: "Seus dados financeiros ficam salvos apenas no seu dispositivo.",
  },
  de: {
    licenseSubject: "Ihre MOY IQ-Lizenz",
    trialSubject: "Ihre Testphase von MOY IQ Pro",
    trialEndingSubject: "Ihre Testphase von MOY IQ Pro endet bald",
    trialEndsOn: (d) => `Ihre Testphase von MOY IQ Pro endet am ${d}`,
    trialStarted: (n, d) => `Ihre Pro-Testphase hat begonnen. Sie dauert ${n} Tage und endet am ${d}.`,
    charge: (a, i) => `An diesem Tag werden ${a}${i === "month" ? " pro Monat" : i === "year" ? " pro Jahr" : ""} von der hinterlegten Karte abgebucht.`,
    chargeNoAmount: "An diesem Tag wird der Preis Ihres Plans von der hinterlegten Karte abgebucht.",
    renews: (i) => ` Danach verlängert sich das Abonnement automatisch${i === "year" ? " jedes Jahr" : i === "month" ? " jeden Monat" : ""}.`,
    cancelPortal: (portal, sup) => `Wenn Sie nicht weitermachen möchten, kündigen Sie vor diesem Datum in <a href="${portal}">Ihrem Abrechnungsportal</a> oder schreiben Sie an ${sup}. Wenn Sie während der Testphase kündigen, wird nichts berechnet.`,
    cancelNoPortal: (sup) => `Wenn Sie nicht weitermachen möchten, schreiben Sie vor diesem Datum an ${sup}; das Abonnement wird dann gekündigt. Wenn Sie während der Testphase kündigen, wird nichts berechnet.`,
    renewalNote: (i, sup) => `Dieses Abonnement verlängert sich automatisch ${i === "month" ? "jeden Monat" : "jedes Jahr"}. Zum Kündigen schreiben Sie an ${sup}.`,
    purchase: (p) => `Kauf bestätigt. Plan: <strong>${p}</strong>.`,
    keyLabel: "Ihr Zugangsschlüssel:",
    activate: (l) => `Zum Aktivieren öffnen Sie ${l} und geben den Schlüssel ein.`,
    staySame: "Wenn Sie weitermachen, müssen Sie nichts tun: Ihr Zugangsschlüssel bleibt gleich.",
    privacy: "Ihre Finanzdaten werden nur auf Ihrem Gerät gespeichert.",
  },
};

// Fecha y monto en el idioma del correo. Español: las funciones de siempre.
export function formatDateFor(iso: string | number, lang: EmailLang = "es"): string {
  if (lang === "es") return formatDateEs(iso);
  const d = typeof iso === "number" ? new Date(iso * 1000) : new Date(iso);
  return new Intl.DateTimeFormat(INTL_LOCALE[lang], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}
export function formatAmountFor(cents: number, currency = "usd", lang: EmailLang = "es"): string {
  if (lang === "es") return formatAmountEs(cents, currency);
  try {
    return new Intl.NumberFormat(INTL_LOCALE[lang], { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
  } catch {
    return formatAmountEs(cents, currency);
  }
}

function chargeSentence(billing: TrialBilling, lang: EmailLang = "es"): string {
  const T = MAIL[lang] ?? MAIL.es;
  if (billing.amountCents == null) return T.chargeNoAmount;
  return T.charge(formatAmountFor(billing.amountCents, billing.currency, lang), billing.interval);
}

function cancelSentence(config: WebhookConfig, lang: EmailLang = "es"): string {
  const T = MAIL[lang] ?? MAIL.es;
  const support = `<a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>`;
  return `<p>${config.portalUrl ? T.cancelPortal(config.portalUrl, support) : T.cancelNoPortal(support)}</p>`;
}

// Datos de cobro de una prueba recién empezada, a partir del checkout. El
// checkout de $0 no trae el precio que se cobrará después (habría que expandir
// line_items con la API de Stripe), así que se usa el precio de lista del
// intervalo del link. El aviso de fin de prueba sí usa el precio real.
export function trialBillingFromSession(
  session: { created?: number | null; payment_link?: string | null; currency?: string | null },
  expiresAt: string,
): TrialBilling {
  const interval = subscriptionIntervalFromSession(session);
  return {
    endsAt: expiresAt,
    amountCents: interval ? PRO_LIST_PRICE_CENTS[interval] : null,
    currency: session?.currency ?? "usd",
    interval,
  };
}

// Datos de cobro desde el objeto subscription (customer.subscription.trial_will_end).
// Lee items.data[0].price (unit_amount × quantity); cae a plan.amount (API vieja)
// y, si tampoco está, al precio de lista del intervalo.
export function trialBillingFromSubscription(sub: any): TrialBilling | null {
  const trialEnd = sub?.trial_end;
  if (typeof trialEnd !== "number") return null;
  const item = sub?.items?.data?.[0];
  const price = item?.price ?? item?.plan ?? sub?.plan ?? null;
  const rawInterval = price?.recurring?.interval ?? price?.interval ?? null;
  const interval = rawInterval === "month" || rawInterval === "year" ? rawInterval : null;
  const unit = typeof price?.unit_amount === "number" ? price.unit_amount : (typeof price?.amount === "number" ? price.amount : null);
  const qty = typeof item?.quantity === "number" && item.quantity > 0 ? item.quantity : 1;
  const amountCents = unit != null ? unit * qty : (interval ? PRO_LIST_PRICE_CENTS[interval] : null);
  return {
    endsAt: new Date(trialEnd * 1000).toISOString(),
    amountCents,
    currency: price?.currency ?? sub?.currency ?? "usd",
    interval,
  };
}

// Aviso previo al cobro (customer.subscription.trial_will_end, Stripe lo manda
// 3 días antes de trial_end). Cubre la regla de las redes de tarjetas de
// avisar antes del primer cobro de una prueba gratis: fecha, monto y cómo
// cancelar. Solo español, igual que el email de la licencia.
export async function sendTrialEndingEmail(to: string, billing: TrialBilling, config: WebhookConfig, lang: EmailLang = "es"): Promise<boolean> {
  if (!config.resendApiKey) {
    console.error("sendTrialEndingEmail: RESEND_API_KEY no configurada");
    return false;
  }
  const T = MAIL[lang] ?? MAIL.es;
  const html = `
    <div lang="${lang}" style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#14213D">${T.trialEndsOn(formatDateFor(billing.endsAt, lang))}</h2>
      <p>${chargeSentence(billing, lang)}${T.renews(billing.interval)}</p>
      ${cancelSentence(config, lang)}
      <p>${T.staySame}</p>
      <p style="color:#888;font-size:12px">${T.privacy}</p>
    </div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config.fromEmail, to, subject: T.trialEndingSubject, html }),
    });
    if (!res.ok) {
      console.error(`sendTrialEndingEmail: Resend error ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("sendTrialEndingEmail: fallo de red", err);
    return false;
  }
}

// Un checkout de prueba ($0) de un Payment Link que no está en
// PAYMENT_LINK_PLAN no emite licencia (ver checkoutSkipReason). Si es un link
// de prueba de MOY IQ cuyo id no se pegó en TRIAL_LINK_*, el cliente queda con
// la tarjeta registrada y sin clave — se avisa para resolverlo a mano.
export async function notifyUnmappedTrialCheckout(
  details: { sessionRef: string | null; email: string | null; paymentLink: string | null },
  config: WebhookConfig,
): Promise<void> {
  if (!config.resendApiKey || !config.alertEmail) return;
  const html = `
    <div style="font-family:system-ui,sans-serif">
      <p><strong>Checkout de suscripción de $0 sin licencia emitida.</strong></p>
      <ul>
        <li>session: ${details.sessionRef ?? "(sin session)"}</li>
        <li>email del cliente: ${details.email ?? "(sin email)"}</li>
        <li>payment_link: ${details.paymentLink ?? "(sin payment_link)"}</li>
      </ul>
      <p>Si es un link de prueba de MOY IQ, falta pegar su id en TRIAL_LINK_MONTHLY_TODO / TRIAL_LINK_ANNUAL_TODO (webhookLogic.ts) y emitir la licencia a mano. Si es de otro producto, ignorar.</p>
    </div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: config.fromEmail, to: config.alertEmail,
        subject: "MOY IQ: checkout de prueba sin licencia", html,
      }),
    });
    if (!res.ok) console.error(`notifyUnmappedTrialCheckout: Resend error ${res.status} ${await res.text()}`);
  } catch (err) {
    console.error("notifyUnmappedTrialCheckout: fallo de red", err);
  }
}

// ── Handlers de eventos (index.ts solo los enruta) ──────────────────────────
// Devuelven el status HTTP y un motivo para el log; no leen Deno.env.

export type HandlerResult = { status: number; body: Record<string, unknown> };

// invoice.payment_succeeded: fija/extiende expires_at. Lanza → 500 → Stripe reintenta.
export async function handleInvoicePaid(invoice: any, config: WebhookConfig): Promise<HandlerResult> {
  const subscriptionId = subscriptionIdFromInvoice(invoice ?? {});
  const periodEnd = periodEndFromInvoice(invoice ?? {});
  if (!subscriptionId || !periodEnd) return { status: 200, body: { received: true, ignored: "no_subscription_or_period" } };
  try {
    const result = await extendLicenseExpiry(subscriptionId, periodEnd, config);
    if (result.updated === 0) {
      // Sin licencia todavía (invoice antes que checkout) o suscripción ajena.
      console.log(`Invoice pagada sin licencia asociada todavía: subscription=${subscriptionId} expires_at=${periodEnd} pending=${result.pending}`);
    } else {
      console.log(`Invoice pagada: subscription=${subscriptionId} expires_at=${periodEnd}`);
    }
    return { status: 200, body: { received: true } };
  } catch (err) {
    console.error("Error extendiendo vencimiento de suscripción:", err);
    return { status: 500, body: { error: "error extending subscription" } };
  }
}

// customer.subscription.deleted: revoca por suscripción. Un fallo de red de
// la RPC devuelve 500 para que Stripe reintente; "not found" es normal.
export async function handleSubscriptionDeleted(subscription: any, config: WebhookConfig): Promise<HandlerResult> {
  const subscriptionId = subRefId(subscription?.id);
  if (!subscriptionId) return { status: 200, body: { received: true, ignored: "no_subscription_id" } };
  const result = await revokeLicenseBySubscription(subscriptionId, config);
  console.log(`customer.subscription.deleted: subscription=${subscriptionId} revoke_result=${JSON.stringify(result)}`);
  if (!result.ok && typeof result.error === "string" && result.error.startsWith("http_")) {
    return { status: 500, body: { error: "error revoking subscription" } };
  }
  return { status: 200, body: { received: true } };
}

// invoice.payment_failed: no se revoca nada acá. Stripe reintenta el cobro
// (Smart Retries / dunning) y, si se agotan los intentos, cancela la
// suscripción → customer.subscription.deleted → revoca. Solo log.
export function handleInvoicePaymentFailed(invoice: any): HandlerResult {
  const subscriptionId = subscriptionIdFromInvoice(invoice ?? {});
  console.warn(`invoice.payment_failed: subscription=${subscriptionId ?? "(sin suscripción)"} attempt_count=${invoice?.attempt_count ?? "?"} billing_reason=${invoice?.billing_reason ?? "?"}`);
  return { status: 200, body: { received: true } };
}

// customer.subscription.trial_will_end: aviso previo al cobro, una sola vez
// por event id.
export async function handleTrialWillEnd(event: any, config: WebhookConfig): Promise<HandlerResult> {
  const sub = event?.data?.object ?? {};
  const subscriptionId = subRefId(sub?.id);
  const billing = trialBillingFromSubscription(sub);
  if (!subscriptionId || !billing) return { status: 200, body: { received: true, ignored: "no_trial_data" } };
  if (sub?.status === "canceled" || sub?.cancel_at_period_end === true) {
    // Ya canceló: no se va a cobrar nada, no corresponde el aviso de cobro.
    return { status: 200, body: { received: true, ignored: "already_canceled" } };
  }

  let license: Awaited<ReturnType<typeof findLicenseBySubscription>>;
  try {
    license = await findLicenseBySubscription(subscriptionId, config);
  } catch (err) {
    console.error("trial_will_end: no se pudo buscar la licencia", err);
    return { status: 500, body: { error: "license lookup failed" } };
  }
  if (!license) return { status: 200, body: { received: true, ignored: "not_moyiq_subscription" } };
  if (license.status !== "active" || !license.email) {
    return { status: 200, body: { received: true, ignored: "inactive_or_no_email" } };
  }

  const eventId = typeof event?.id === "string" ? event.id : null;
  if (eventId) {
    const claim = await claimWebhookEvent(eventId, "customer.subscription.trial_will_end", config);
    if (claim === "duplicate") {
      console.log(`trial_will_end ya enviado: event=${eventId} subscription=${subscriptionId}`);
      return { status: 200, body: { received: true, ignored: "already_sent" } };
    }
  }

  const sent = await sendTrialEndingEmail(license.email, billing, config, langFromStripeSubscription(sub));
  if (!sent) {
    if (eventId) await releaseWebhookEvent(eventId, config);
    return { status: 500, body: { error: "trial reminder not sent" } };
  }
  console.log(`trial_will_end enviado: event=${eventId} subscription=${subscriptionId} trial_end=${billing.endsAt}`);
  return { status: 200, body: { received: true } };
}
