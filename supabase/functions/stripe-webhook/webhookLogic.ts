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
import { type EmailLang, INTL_LOCALE, langFromStripeSession, langFromStripeSubscription, pickLang } from "../_shared/emailLang.ts";
import { secretEquals } from "../_shared/secretEquals.ts";
import { appLink } from "../_shared/appLinks.ts";
export { langFromStripeSession, langFromStripeSubscription };

export const SIGNATURE_TOLERANCE_SECONDS = 300;

export async function verifyStripeSignature(rawBody: string, sigHeader: string, secrets: string[]): Promise<boolean> {
  if (!sigHeader || secrets.length === 0) return false;
  const parts = sigHeader.split(",").map((p) => p.trim());
  const t = parts.find((p) => p.startsWith("t="))?.slice(2);
  const v1s = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || v1s.length === 0) return false;

  // Tolerancia de 5 min contra replay. Un t no numérico daba NaN y
  // `NaN > 300` es false: pasaba el control de tiempo (auditoría 360, C-13).
  if (!/^\d{1,12}$/.test(t)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(t)) > SIGNATURE_TOLERANCE_SECONDS) return false;

  for (const secret of secrets) {
    const key = await crypto.subtle.importKey(
      "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${rawBody}`));
    const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
    if (v1s.some((v1) => secretEquals(v1, expected))) return true;
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

// ── Prueba de Pro por 14 días CON tarjeta (T10, fase 4 · 2026-10-08) ───────
// Walter crea en Stripe dos Payment Links NUEVOS (Pro mensual y anual) con
// trial_period_days=14 y payment_method_collection=always, y pega acá sus ids
// plink_... (ver docs/billing-trial-runbook.md). Mientras sigan en null, un
// checkout de prueba ($0) NO emite licencia: checkoutSkipReason() lo descarta
// como "zero_amount_unknown_link" y avisa a ALERT_EMAIL. Es a propósito: este
// endpoint puede recibir eventos de otros productos de la cuenta de Stripe, y
// una suscripción de $0 ajena no debe mintear una licencia de MOY IQ.
// No inventar ids: solo pegar los que muestra el dashboard de Stripe.
export const TRIAL_LINK_MONTHLY_TODO: string | null = "plink_1UOR0c2L52ZuuTMrpgyjokRi"; // https://buy.stripe.com/fZudR2f5R26c96Qaz7fnO04 Pro mensual con prueba de 14 días (08-oct-2026)
export const TRIAL_LINK_ANNUAL_TODO: string | null = "plink_1UOR1S2L52ZuuTMrZXDa0fNY";  // https://buy.stripe.com/cNi4gs8Ht8uAfvecHffnO05 Pro anual con prueba de 14 días (08-oct-2026)

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

// Payment Links de la cuenta de Stripe de MOY IQ (acct_1UEffP2L52ZuuTMr). Es
// la ÚNICA fuente del plan: un checkout cuyo Payment Link no está acá no emite
// licencia (auditoría 360, C-13 / FN-1). Antes caía a un umbral por monto y
// cualquier checkout firmado con un secreto aceptado —por ejemplo uno de la
// cuenta de DypOS, que compartía el secreto de junio— generaba una licencia.
// Los links de la cuenta compartida (…Rxn4y6AU3r, hoy de DypOS) se retiraron
// el 12-sep y sus productos se borraron el 10-oct: quedan en
// RETIRED_PAYMENT_LINKS solo para que el log diga qué eran. Un Payment Link
// nuevo (otra región o moneda) se agrega acá antes de publicarlo.
export const PAYMENT_LINK_PLAN: Record<string, "personal" | "pro"> = {
  plink_1UEgvJ2L52ZuuTMr1Agq0t4b: "pro",      // https://buy.stripe.com/6oU9AM8Ht3aggzi8qZfnO00 Pro mensual US$4.99 (activo desde 12-sep)
  plink_1UEgve2L52ZuuTMrdS1OE9fh: "pro",      // https://buy.stripe.com/3cI14gbTF7qwbeYaz7fnO01 Pro anual US$39.99 (activo desde 12-sep)
  ...trialLinkEntries("pro"),
};

export const RETIRED_PAYMENT_LINKS: readonly string[] = [
  "plink_1TsMlSRxn4y6AU3r6CkGfuhO", // Personal pago único (cuenta compartida)
  "plink_1TsMlpRxn4y6AU3rcPN5urIw", // Pro pago único (cuenta compartida)
  "plink_1UEfHBRxn4y6AU3r2Cd9SAmi", // Pro mensual (cuenta compartida)
  "plink_1UEfI7Rxn4y6AU3rgSX3eaOQ", // Pro anual (cuenta compartida)
];

export function planFromSession(session: { payment_link?: string | null }): "personal" | "pro" | null {
  return session?.payment_link ? PAYMENT_LINK_PLAN[session.payment_link] ?? null : null;
}

// Solo para decidir el texto del email de bienvenida (mensual/anual/pago único)
// y, si hace falta, un fallback de expiración inicial — el vencimiento real
// SIEMPRE lo fija extendLicenseExpiry() desde invoice.payment_succeeded, esto
// es solo cosmético/best-effort mientras esa invoice llega (segundos después).
const SUBSCRIPTION_INTERVAL: Record<string, "month" | "year"> = {
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

// Solo checkouts pagados de un Payment Link de MOY IQ emiten licencia.
//   - "unpaid": payment_status distinto de "paid" (OXXO/boleto pendientes:
//     llega después como async_payment_succeeded).
//   - "no_payment_link": checkout fuera de Payment Links (otro producto de la
//     cuenta, p. ej. Invest). Se ignora sin aviso.
//   - "unknown_payment_link": link que no está en PAYMENT_LINK_PLAN. Puede ser
//     un link nuevo de MOY IQ sin cargar acá (el cliente pagó y no tiene
//     clave) o uno ajeno: index.ts avisa a ALERT_EMAIL.
//   - "zero_amount": $0 que no es una prueba de suscripción.
// Una prueba de Pro llega con amount_total=0 y payment_status "paid" y se
// acepta si el link es conocido. Ya no hay fallback por monto (C-13).
export type CheckoutSkipReason = "unpaid" | "no_payment_link" | "unknown_payment_link" | "zero_amount";

export function checkoutSkipReason(
  session: { payment_status?: string; amount_total?: number | null; mode?: string; payment_link?: string | null },
): CheckoutSkipReason | null {
  if (session.payment_status !== "paid") return "unpaid";
  if (!session.payment_link) return "no_payment_link";
  if (!planFromSession(session)) return "unknown_payment_link";
  if ((session.amount_total ?? 0) > 0) return null;
  return session.mode === "subscription" ? null : "zero_amount";
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
    console.error(`CRITICO: ni NURTURE_RESEND_API_KEY ni RESEND_API_KEY están configuradas — el cliente pago y NO recibio su clave. session=${sessionRef}`);
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
    : `<p>${T.purchase(plan === "pro" ? "Pro" : "Starter")}</p>`;
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
  // C-35 (auditoría 360, COM-10 / META-4)
  paymentFailedSubject: string;
  paymentFailedIntro: string;
  paymentFailedPortal: (portal: string, support: string) => string;
  paymentFailedNoPortal: (support: string) => string;
  paymentFailedAfter: string;
  proEndedSubject: string;
  proEndedIntro: string;
  proEndedData: string;
  proEndedBack: string;
  proEndedButton: string;
  questions: (support: string) => string;
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
    paymentFailedSubject: "No se pudo cobrar tu suscripción de MOY IQ Pro",
    paymentFailedIntro: "El cobro de tu suscripción de MOY IQ Pro no se pudo hacer con la tarjeta registrada. Stripe lo va a reintentar en los próximos días.",
    paymentFailedPortal: (portal, sup) => `Para que Pro siga activo, actualiza tu método de pago desde <a href="${portal}">tu portal de facturación</a> o escribe a ${sup}.`,
    paymentFailedNoPortal: (sup) => `Para que Pro siga activo, escribe a ${sup} y te ayudamos a actualizar el método de pago.`,
    paymentFailedAfter: "Si los reintentos no funcionan, la suscripción se cancela y la cuenta vuelve a Starter. Tus datos siguen en tu dispositivo.",
    proEndedSubject: "Tu MOY IQ Pro terminó. Tus datos siguen ahí",
    proEndedIntro: "Tu suscripción de MOY IQ Pro se canceló, así que las funciones de Pro ya no están activas en tu cuenta.",
    proEndedData: "No se borró nada: tus movimientos, presupuestos y metas siguen en tu dispositivo, y puedes seguir usándolos con las funciones gratuitas de Starter.",
    proEndedBack: "Si quieres volver a Pro, puedes hacerlo cuando quieras desde la app.",
    proEndedButton: "Volver a Pro",
    questions: (sup) => `Si tienes dudas, escribe a ${sup}.`,
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
    paymentFailedSubject: "Your MOY IQ Pro payment didn't go through",
    paymentFailedIntro: "We couldn't charge your MOY IQ Pro subscription to the card on file. Stripe will retry over the next few days.",
    paymentFailedPortal: (portal, sup) => `To keep Pro active, update your payment method from <a href="${portal}">your billing portal</a> or write to ${sup}.`,
    paymentFailedNoPortal: (sup) => `To keep Pro active, write to ${sup} and we'll help you update your payment method.`,
    paymentFailedAfter: "If the retries don't work, the subscription is canceled and the account goes back to Starter. Your data stays on your device.",
    proEndedSubject: "Your MOY IQ Pro ended. Your data is still there",
    proEndedIntro: "Your MOY IQ Pro subscription was canceled, so the Pro features are no longer active on your account.",
    proEndedData: "Nothing was deleted: your transactions, budgets and goals are still on your device, and you can keep using them with the free Starter features.",
    proEndedBack: "If you want to go back to Pro, you can do it at any time from the app.",
    proEndedButton: "Go back to Pro",
    questions: (sup) => `If you have questions, write to ${sup}.`,
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
    paymentFailedSubject: "Não foi possível cobrar sua assinatura do MOY IQ Pro",
    paymentFailedIntro: "A cobrança da sua assinatura do MOY IQ Pro não pôde ser feita no cartão cadastrado. O Stripe vai tentar de novo nos próximos dias.",
    paymentFailedPortal: (portal, sup) => `Para que o Pro continue ativo, atualize sua forma de pagamento no <a href="${portal}">seu portal de cobrança</a> ou escreva para ${sup}.`,
    paymentFailedNoPortal: (sup) => `Para que o Pro continue ativo, escreva para ${sup} e ajudamos você a atualizar a forma de pagamento.`,
    paymentFailedAfter: "Se as novas tentativas não funcionarem, a assinatura é cancelada e a conta volta ao Starter. Seus dados continuam no seu dispositivo.",
    proEndedSubject: "Seu MOY IQ Pro terminou. Seus dados continuam aí",
    proEndedIntro: "Sua assinatura do MOY IQ Pro foi cancelada, então as funções do Pro não estão mais ativas na sua conta.",
    proEndedData: "Nada foi apagado: seus movimentos, orçamentos e metas continuam no seu dispositivo, e você pode seguir usando-os com as funções gratuitas do Starter.",
    proEndedBack: "Se quiser voltar ao Pro, pode fazer isso quando quiser pelo app.",
    proEndedButton: "Voltar ao Pro",
    questions: (sup) => `Se tiver dúvidas, escreva para ${sup}.`,
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
    paymentFailedSubject: "Ihr MOY IQ Pro-Abonnement konnte nicht abgebucht werden",
    paymentFailedIntro: "Die Zahlung für Ihr MOY IQ Pro-Abonnement konnte nicht von der hinterlegten Karte abgebucht werden. Stripe versucht es in den nächsten Tagen erneut.",
    paymentFailedPortal: (portal, sup) => `Damit Pro aktiv bleibt, aktualisieren Sie Ihre Zahlungsmethode in <a href="${portal}">Ihrem Abrechnungsportal</a> oder schreiben Sie an ${sup}.`,
    paymentFailedNoPortal: (sup) => `Damit Pro aktiv bleibt, schreiben Sie an ${sup}; wir helfen Ihnen, die Zahlungsmethode zu aktualisieren.`,
    paymentFailedAfter: "Wenn die weiteren Versuche nicht funktionieren, wird das Abonnement gekündigt und das Konto kehrt zu Starter zurück. Ihre Daten bleiben auf Ihrem Gerät.",
    proEndedSubject: "Ihr MOY IQ Pro ist beendet. Ihre Daten sind noch da",
    proEndedIntro: "Ihr MOY IQ Pro-Abonnement wurde gekündigt, daher sind die Pro-Funktionen in Ihrem Konto nicht mehr aktiv.",
    proEndedData: "Es wurde nichts gelöscht: Ihre Buchungen, Budgets und Ziele bleiben auf Ihrem Gerät, und Sie können sie mit den kostenlosen Starter-Funktionen weiter nutzen.",
    proEndedBack: "Wenn Sie zu Pro zurückkehren möchten, können Sie das jederzeit in der App tun.",
    proEndedButton: "Zurück zu Pro",
    questions: (sup) => `Bei Fragen schreiben Sie an ${sup}.`,
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
    console.error("sendTrialEndingEmail: ni NURTURE_RESEND_API_KEY ni RESEND_API_KEY están configuradas");
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

// ── C-35 (auditoría 360, COM-10 / META-4): correos del ciclo de pago ───────
// Transaccionales (no piden opt-in): cobro fallido con el portal para
// actualizar la tarjeta, y "tu Pro terminó, tus datos siguen" al revocar.

async function sendCustomerEmail(to: string, subject: string, html: string, config: WebhookConfig, tag: string): Promise<boolean> {
  if (!config.resendApiKey) {
    console.error(`${tag}: ni NURTURE_RESEND_API_KEY ni RESEND_API_KEY están configuradas`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config.fromEmail, to, reply_to: SUPPORT_EMAIL, subject, html }),
    });
    if (!res.ok) {
      console.error(`${tag}: Resend error ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`${tag}: fallo de red`, err);
    return false;
  }
}

export function renderPaymentFailedEmail(config: WebhookConfig, lang: EmailLang = "es"): { subject: string; html: string } {
  const T = MAIL[lang] ?? MAIL.es;
  const support = `<a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>`;
  const html = `
    <div lang="${lang}" style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#14213D">${T.paymentFailedSubject}</h2>
      <p>${T.paymentFailedIntro}</p>
      <p>${config.portalUrl ? T.paymentFailedPortal(config.portalUrl, support) : T.paymentFailedNoPortal(support)}</p>
      <p>${T.paymentFailedAfter}</p>
      <p style="color:#888;font-size:12px">${T.privacy}</p>
    </div>`;
  return { subject: T.paymentFailedSubject, html };
}

export function renderProEndedEmail(lang: EmailLang = "es"): { subject: string; html: string } {
  const T = MAIL[lang] ?? MAIL.es;
  const support = `<a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>`;
  const html = `
    <div lang="${lang}" style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#14213D">${T.proEndedSubject}</h2>
      <p>${T.proEndedIntro}</p>
      <p>${T.proEndedData}</p>
      <p>${T.proEndedBack}</p>
      <p><a href="${appLink("upgrade", "pro-ended")}" style="display:inline-block;background:#14213D;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${T.proEndedButton}</a></p>
      <p style="color:#888;font-size:12px">${T.questions(support)}</p>
    </div>`;
  return { subject: T.proEndedSubject, html };
}

// Idioma de una invoice: metadata de la suscripción si viene (no hay otro
// dato de idioma en el evento). Sin señal, español.
export function langFromInvoice(invoice: any): EmailLang {
  return pickLang(
    invoice?.parent?.subscription_details?.metadata?.lang,
    invoice?.subscription_details?.metadata?.lang,
  );
}

// Un checkout de un Payment Link que no está en PAYMENT_LINK_PLAN no emite
// licencia (ver checkoutSkipReason). Si es un link de MOY IQ sin cargar, el
// cliente queda sin clave: se avisa para resolverlo a mano.
export async function notifyUnmappedTrialCheckout(
  details: { sessionRef: string | null; email: string | null; paymentLink: string | null },
  config: WebhookConfig,
): Promise<void> {
  if (!config.resendApiKey || !config.alertEmail) return;
  const html = `
    <div style="font-family:system-ui,sans-serif">
      <p><strong>Checkout pagado de un Payment Link que no es de MOY IQ: no se emitió licencia.</strong></p>
      <ul>
        <li>session: ${details.sessionRef ?? "(sin session)"}</li>
        <li>email del cliente: ${details.email ?? "(sin email)"}</li>
        <li>payment_link: ${details.paymentLink ?? "(sin payment_link)"}</li>
      </ul>
      <p>Si es un link de MOY IQ, falta agregarlo a PAYMENT_LINK_PLAN (webhookLogic.ts) y emitir la licencia a mano. Si es un link retirado o de otro producto, revisar en Stripe de qué cuenta vino el evento.</p>
    </div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: config.fromEmail, to: config.alertEmail,
        subject: "MOY IQ: checkout sin licencia (Payment Link desconocido)", html,
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
// Si revocó una licencia de MOY IQ, avisa "tu Pro terminó, tus datos siguen"
// (C-35). Best-effort: la revocación ya está hecha y un reintento de Stripe
// encontraría la licencia revocada (revoked=0) y no reenviaría el correo.
export async function handleSubscriptionDeleted(subscription: any, config: WebhookConfig): Promise<HandlerResult> {
  const subscriptionId = subRefId(subscription?.id);
  if (!subscriptionId) return { status: 200, body: { received: true, ignored: "no_subscription_id" } };
  const result = await revokeLicenseBySubscription(subscriptionId, config);
  console.log(`customer.subscription.deleted: subscription=${subscriptionId} revoke_result=${JSON.stringify(result)}`);
  if (!result.ok && typeof result.error === "string" && result.error.startsWith("http_")) {
    return { status: 500, body: { error: "error revoking subscription" } };
  }
  if (result.ok && (result.revoked ?? 0) > 0) {
    try {
      const license = await findLicenseBySubscription(subscriptionId, config);
      if (license?.email) {
        const mail = renderProEndedEmail(langFromStripeSubscription(subscription));
        const sent = await sendCustomerEmail(license.email, mail.subject, mail.html, config, "pro_ended");
        console.log(`pro_ended: subscription=${subscriptionId} enviado=${sent}`);
      }
    } catch (err) {
      console.error(`pro_ended: no se pudo avisar subscription=${subscriptionId}`, err);
    }
  }
  return { status: 200, body: { received: true } };
}

// invoice.payment_failed: no se revoca nada acá. Stripe reintenta el cobro
// (Smart Retries / dunning) y, si se agotan los intentos, cancela la
// suscripción → customer.subscription.deleted → revoca. Desde C-35, en el
// PRIMER intento fallido se avisa a la persona con el portal para actualizar
// la tarjeta (los reintentos siguientes no repiten el correo; Stripe además
// manda los suyos si están activados en Billing → Revenue recovery).
export async function handleInvoicePaymentFailed(invoice: any, config: WebhookConfig): Promise<HandlerResult> {
  const subscriptionId = subscriptionIdFromInvoice(invoice ?? {});
  const attempt = typeof invoice?.attempt_count === "number" ? invoice.attempt_count : null;
  console.warn(`invoice.payment_failed: subscription=${subscriptionId ?? "(sin suscripción)"} attempt_count=${attempt ?? "?"} billing_reason=${invoice?.billing_reason ?? "?"}`);
  if (!subscriptionId || attempt !== 1) return { status: 200, body: { received: true } };
  let license: Awaited<ReturnType<typeof findLicenseBySubscription>>;
  try {
    license = await findLicenseBySubscription(subscriptionId, config);
  } catch (err) {
    console.error("invoice.payment_failed: no se pudo buscar la licencia", err);
    return { status: 500, body: { error: "license lookup failed" } };
  }
  if (!license) return { status: 200, body: { received: true, ignored: "not_moyiq_subscription" } };
  if (license.status !== "active" || !license.email) return { status: 200, body: { received: true, ignored: "inactive_or_no_email" } };
  const mail = renderPaymentFailedEmail(config, langFromInvoice(invoice));
  const sent = await sendCustomerEmail(license.email, mail.subject, mail.html, config, "payment_failed");
  if (!sent) return { status: 500, body: { error: "payment failed email not sent" } };
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

  const sent = await sendTrialEndingEmail(license.email, billing, config, langFromStripeSubscription(sub));
  if (!sent) return { status: 500, body: { error: "trial reminder not sent" } };
  console.log(`trial_will_end enviado: event=${event?.id ?? "-"} subscription=${subscriptionId} trial_end=${billing.endsAt}`);
  return { status: 200, body: { received: true } };
}

// Fin del período pagado de una suscripción. API vieja: current_period_end en
// la raíz; desde basil (2025-03-31) vive en cada item. Se toma el máximo.
export function periodEndFromSubscription(sub: any): string | null {
  const ends: number[] = [];
  if (typeof sub?.current_period_end === "number") ends.push(sub.current_period_end);
  for (const item of sub?.items?.data ?? []) {
    if (typeof item?.current_period_end === "number") ends.push(item.current_period_end);
  }
  if (ends.length === 0) return null;
  return new Date(Math.max(...ends) * 1000).toISOString();
}

// Estados de Stripe que terminan el acceso de inmediato. "unpaid" no está a
// propósito: llega después de agotar los reintentos, cuando expires_at (el fin
// del último período pagado) ya pasó, y una revocación no se deshace sola si
// la persona paga la factura pendiente y la suscripción vuelve a "active".
export const REVOKING_SUBSCRIPTION_STATUSES = ["canceled", "incomplete_expired"];

// customer.subscription.updated (auditoría 360, META-4 / C-13): cambio de plan
// o de intervalo en el portal, renovación, cancelación al final del período o
// paso a un estado terminal. El acceso lo manda expires_at:
//   - active / trialing: se lleva expires_at al fin del período vigente (solo
//     hacia adelante, extend_license_expiry nunca lo acorta). Cubre el cambio
//     de mensual a anual sin esperar a la próxima invoice.
//   - canceled / incomplete_expired: revoca, igual que subscription.deleted.
//   - past_due, unpaid, paused, incomplete: solo log; Stripe sigue cobrando o
//     expires_at vence solo.
// La tabla licenses no guarda plan por intervalo (todas las suscripciones son
// "pro"), así que no hay plan que actualizar.
export async function handleSubscriptionUpdated(sub: any, config: WebhookConfig): Promise<HandlerResult> {
  const subscriptionId = subRefId(sub?.id);
  const status = typeof sub?.status === "string" ? sub.status : null;
  if (!subscriptionId || !status) return { status: 200, body: { received: true, ignored: "no_subscription_or_status" } };
  if (REVOKING_SUBSCRIPTION_STATUSES.includes(status)) {
    return handleSubscriptionDeleted(sub, config);
  }
  if (status === "active" || status === "trialing") {
    const periodEnd = periodEndFromSubscription(sub);
    if (!periodEnd) return { status: 200, body: { received: true, ignored: "no_period_end" } };
    try {
      const r = await extendLicenseExpiry(subscriptionId, periodEnd, config);
      console.log(`customer.subscription.updated: subscription=${subscriptionId} status=${status} expires_at=${periodEnd} updated=${r.updated ?? "?"} cancel_at_period_end=${sub?.cancel_at_period_end === true}`);
      return { status: 200, body: { received: true } };
    } catch (err) {
      console.error("customer.subscription.updated: error fijando el vencimiento", err);
      return { status: 500, body: { error: "error extending subscription" } };
    }
  }
  console.log(`customer.subscription.updated sin cambio de acceso: subscription=${subscriptionId} status=${status}`);
  return { status: 200, body: { received: true } };
}

// charge.refunded / charge.dispute.created (FISC-1): revoca la licencia de
// pago único asociada al payment_intent, si la hay. "not_found" es normal
// (licencia vieja sin payment_intent guardado, o ya revocada).
export async function handleChargeReversal(eventType: string, charge: any, config: WebhookConfig): Promise<HandlerResult> {
  const paymentIntent = extractPaymentIntent(charge ?? {});
  if (!paymentIntent) {
    console.warn(`${eventType} sin payment_intent en el payload, no se puede revocar automáticamente: charge=${charge?.id ?? "-"}`);
    return { status: 200, body: { received: true, ignored: "no_payment_intent" } };
  }
  const result = await revokeLicense(paymentIntent, config);
  console.log(`${eventType}: payment_intent=${paymentIntent} revoke_result=${JSON.stringify(result)}`);
  if (!result.ok && typeof result.error === "string" && result.error.startsWith("http_")) {
    return { status: 500, body: { error: "error revoking license" } };
  }
  return { status: 200, body: { received: true } };
}

// Idempotencia por event.id (auditoría 360, C-13) para todos los eventos que
// no son de checkout; el checkout ya es idempotente por session id
// (sessionAlreadyProcessed). Stripe puede reentregar un evento aunque haya
// recibido 2xx; con esto ningún correo ni cambio se aplica dos veces. Si el
// handler falla (5xx o excepción), se libera el evento para que el reintento
// de Stripe lo procese. Si la tabla no responde, fail-open (ver claimWebhookEvent).
export async function runOnce(
  event: any, config: WebhookConfig, handler: () => Promise<HandlerResult>,
): Promise<HandlerResult> {
  const eventId = typeof event?.id === "string" && event.id ? event.id : null;
  const claim = eventId ? await claimWebhookEvent(eventId, String(event?.type ?? ""), config) : "unknown";
  if (claim === "duplicate") {
    console.log(`Evento ya procesado, reentrega ignorada: event=${eventId} type=${event?.type}`);
    return { status: 200, body: { received: true, ignored: "duplicate_event" } };
  }
  let result: HandlerResult;
  try {
    result = await handler();
  } catch (err) {
    console.error(`Error procesando event=${eventId ?? "-"} type=${event?.type}:`, err);
    result = { status: 500, body: { error: "handler failed" } };
  }
  if (result.status >= 500 && claim === "claimed" && eventId) await releaseWebhookEvent(eventId, config);
  return result;
}

export const BILLING_EVENT_TYPES = [
  "charge.refunded", "charge.dispute.created", "invoice.payment_succeeded", "invoice.payment_failed",
  "customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.trial_will_end",
];

// Enrutador de los eventos que no son de checkout. null = tipo no manejado.
export async function handleBillingEvent(event: any, config: WebhookConfig): Promise<HandlerResult | null> {
  const type = event?.type;
  if (!BILLING_EVENT_TYPES.includes(type)) return null;
  const obj = event?.data?.object ?? {};
  return runOnce(event, config, async () => {
    switch (type) {
      case "charge.refunded":
      case "charge.dispute.created":
        return handleChargeReversal(type, obj, config);
      case "invoice.payment_succeeded":
        return handleInvoicePaid(obj, config);
      case "invoice.payment_failed":
        return handleInvoicePaymentFailed(obj, config);
      case "customer.subscription.updated":
        return handleSubscriptionUpdated(obj, config);
      case "customer.subscription.deleted":
        return handleSubscriptionDeleted(obj, config);
      default:
        return handleTrialWillEnd(event, config);
    }
  });
}
