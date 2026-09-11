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
// NOTA: amount < 1900 descarta EN SILENCIO cualquier pago menor a US$19 — es
// el punto 3 del plan (migrar a price_id), no tocar acá sin ese contexto.
export function shouldSkipCheckout(session: { payment_status?: string; amount_total?: number | null }): boolean {
  const amount = session.amount_total ?? 0;
  return session.payment_status !== "paid" || amount < 1900;
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

export async function issueLicense(
  key: string, plan: string, email: string | null, session: string | null, paymentIntent: string | null,
  config: WebhookConfig,
) {
  const res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/issue_license`, {
    method: "POST",
    headers: {
      apikey: config.serviceRole,
      Authorization: `Bearer ${config.serviceRole}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_key: key, p_plan: plan, p_email: email, p_session: session, p_payment_intent: paymentIntent }),
  });
  if (!res.ok) throw new Error(`issue_license failed: ${res.status} ${await res.text()}`);
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
): Promise<boolean> {
  if (!config.resendApiKey) {
    console.error(`CRITICO: RESEND_API_KEY no configurada — el cliente pago y NO recibio su clave. session=${sessionRef}`);
    return false;
  }
  const appUrl = "https://app.moyiq.app/app/";
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#14213D">Tu licencia de MOY IQ</h2>
      <p>¡Gracias por tu compra! Tu plan: <strong>${plan === "pro" ? "Pro" : "Personal"}</strong>.</p>
      <p>Tu clave de acceso:</p>
      <p style="font-family:monospace;font-size:20px;font-weight:700;background:#f0f7f3;
                padding:14px;border-radius:8px;text-align:center;letter-spacing:2px">${key}</p>
      <p>Actívala aquí: <a href="${appUrl}">${appUrl}</a></p>
      <p style="color:#888;font-size:12px">Tus datos financieros se guardan solo en tu dispositivo.</p>
    </div>`;
  const attempt = async () => fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: config.fromEmail, to, subject: "Tu licencia de MOY IQ 🔑", html }),
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
