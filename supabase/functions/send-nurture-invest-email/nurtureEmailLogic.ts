// supabase/functions/send-nurture-invest-email/nurtureEmailLogic.ts
//
// Lógica pura de la secuencia de 3 emails de nurture para el lead magnet de
// Invest ("Perfil de Inversor", perfil-inversor.html → invest_leads) —
// pedido explícito de Walter, 14-sep-2026, calcada de
// send-nurture-starter-email/nurtureEmailLogic.ts. Quien recibe esto es un
// lead (no todavía usuario de Invest) que ya sabe su perfil de riesgo — el
// objetivo del email 1 es que cree cuenta en /app, no repetirle el quiz.
//
// Separada de index.ts por el mismo motivo que las otras nurture: index.ts
// lee Deno.env.get() a nivel de módulo y no se puede importar desde
// Node/vitest.
//
// Remitente: "MOY IQ Invest <invest@moyiq.app>" — mismo dominio raíz
// (moyiq.app) ya verificado en Resend, usado hoy por auth-email-hook. No
// hace falta configurar nada nuevo ahí.
//
// Secret de Resend: usa NURTURE_RESEND_API_KEY (mismo secret que usan
// send-nurture-starter-email y send-nurture-diagnostico-email) — NO
// RESEND_API_KEY, que está scopeado a otro remitente y devuelve 403 (ver
// comentario en supabase/functions/auth-email-hook/index.ts).
//
// consent_marketing: desde el relanzamiento v2 (migración 20261009000100) el
// default es false y register_invest_lead guarda la casilla del quiz
// (p_consent_marketing). Los correos 2 y 3 (marketing, cron) exigen
// consent_marketing=true; el correo 1 ("welcome", el RESULTADO del quiz que
// la persona pidió) es transaccional y se manda siempre. Los leads anteriores
// al 2026-10-08 quedaron marcados como enviados y sin consentimiento.

export type NurtureMode = "welcome" | "day2" | "day5";
export type Perfil = "conservador" | "moderado" | "agresivo";

export interface InvestLead {
  id: string;
  email: string;
  perfil: Perfil | null;
}

export interface NurtureEmailConfig {
  supabaseUrl: string;
  serviceRole: string;
  resendApiKey?: string;
  fromEmail: string; // "MOY IQ Invest <invest@moyiq.app>"
  cronSecret?: string;
  landingUrl: string; // "https://invest.moyiq.app" — para armar el link de unsubscribe
}

export function unsubscribeUrl(config: NurtureEmailConfig, leadId: string): string {
  // t=invest selecciona el RPC unsubscribe_invest_lead en unsubscribe.html
  // (mismo patrón multi-tabla que ya soporta starter/diagnostico).
  return `${config.landingUrl.replace(/\/$/, "")}/unsubscribe.html?id=${encodeURIComponent(leadId)}&t=invest`;
}

// Paleta oscura/dorada de Invest (NO la paleta clara de MOY IQ).
const BG = "#12161F";
const CARD = "#181D29";
const TEXT = "#FAF8F2";
const MUTED = "#9C9686";
const GOLD = "#CC9A52";

// Línea legal fija en el pie de los 3 correos (relanzamiento v2, oct-2026).
export const DISCLAIMER = "Herramienta educativa. No es asesoría financiera ni ejecuta órdenes.";

function wrapHtml(bodyHtml: string, unsubUrl: string): string {
  return `
    <div style="background:${BG};padding:32px 16px">
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;background:${CARD};color:${TEXT};line-height:1.55;padding:32px;border-radius:12px;border:1px solid #232838">
        ${bodyHtml}
        <p style="color:${MUTED};font-size:11px;margin-top:32px;border-top:1px solid #232838;padding-top:12px">
          ${DISCLAIMER}<br>
          MOY IQ Invest · MAXNOVA &amp; Luci Global LLC.
          <a href="${unsubUrl}" style="color:${MUTED}">Darme de baja de estos correos</a>.
        </p>
      </div>
    </div>`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
}

// Relanzamiento v2 (beta pública gratuita, oct-2026): el copy describe el
// perfil según las respuestas del quiz, sin sugerir un mix ni recomendar
// activos. Nada de planes pagos, precios, "tiempo real" ni puntajes.
const PROFILE_COPY: Record<Perfil, { name: string; desc: string }> = {
  conservador: {
    name: "Conservador",
    desc: "Según tus respuestas, priorizas preservar tu capital por sobre el crecimiento y toleras poco las caídas de valor.",
  },
  moderado: {
    name: "Moderado",
    desc: "Según tus respuestas, buscas un balance entre crecimiento y estabilidad y toleras caídas de valor moderadas.",
  },
  agresivo: {
    name: "Agresivo",
    desc: "Según tus respuestas, priorizas el crecimiento, tienes un horizonte largo y toleras caídas de valor más fuertes.",
  },
};

const BUTTON_STYLE = `display:inline-block;background:${GOLD};color:#12161F;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600`;

export function renderEmail(mode: NurtureMode, lead: InvestLead, config: NurtureEmailConfig): RenderedEmail {
  const unsub = unsubscribeUrl(config, lead.id);
  const profile = PROFILE_COPY[lead.perfil ?? "moderado"];

  if (mode === "welcome") {
    const subject = `Tu perfil: ${profile.name}`;
    const html = wrapHtml(
      `
      <h2 style="color:${GOLD};margin-top:0">Tu perfil es ${profile.name}</h2>
      <p>Hola,</p>
      <p>${profile.desc}</p>
      <p>Es un resultado orientativo, no una recomendación de inversión. Sirve para leer tus propias decisiones con más contexto.</p>
      <p>MOY IQ Invest está abierto como beta pública gratuita. Puedes registrar tus posiciones, ver precios de Yahoo Finance con la hora del último dato y revisar cada indicador con su rango y una lectura simple.</p>
      <p><a href="https://invest.moyiq.app/app?ref=invest-welcome" style="${BUTTON_STYLE}">Abrir MOY IQ Invest</a></p>
      <p style="color:${MUTED};font-size:13px">Durante la beta todas las funciones están abiertas para todos, sin tarjeta.</p>
      `,
      unsub,
    );
    return { subject, html };
  }

  if (mode === "day2") {
    const subject = "Cuánto arriesgar por operación, con tu regla de riesgo";
    const html = wrapHtml(
      `
      <h2 style="color:${GOLD};margin-top:0">Con tu regla de riesgo</h2>
      <p>Hola,</p>
      <p>En el <strong>Position Builder</strong> de MOY IQ Invest ingresas el ticker, tu capital y el precio de tu stop loss. Con tu regla de riesgo, por ejemplo no arriesgar más del 2% del capital en una sola operación, calcula cuántas unidades corresponden para que, si el precio llega al stop, la pérdida no supere ese límite.</p>
      <p>Es un cálculo aritmético: no evalúa si la operación conviene ni sugiere comprar o vender. La decisión es tuya.</p>
      <p><a href="https://invest.moyiq.app/app?ref=invest-d2#position-builder" style="${BUTTON_STYLE}">Abrir el Position Builder</a></p>
      <p style="color:${MUTED};font-size:13px">MOY IQ Invest está en beta pública gratuita. Si todavía no creaste tu cuenta, puedes hacerlo desde el mismo enlace.</p>
      `,
      unsub,
    );
    return { subject, html };
  }

  // day5
  const subject = "Qué incluye la beta pública de MOY IQ Invest";
  const html = wrapHtml(
    `
    <h2 style="color:${GOLD};margin-top:0">Qué puedes usar durante la beta</h2>
    <p>Hola,</p>
    <p>MOY IQ Invest está en beta pública gratuita: todas las funciones están abiertas para todos, sin tarjeta. Esto es lo que puedes usar hoy:</p>
    <p>
    — Seguimiento de tus posiciones<br>
    — Precios de Yahoo Finance con retraso, con la hora del último dato visible<br>
    — Indicadores (RSI, MACD, Bandas de Bollinger), cada uno con su rango y una lectura simple<br>
    — Position Builder con tu regla de riesgo<br>
    — Comparador de activos<br>
    — Alertas de precio</p>
    <p>La herramienta ordena tu información y explica cada dato. No te dice qué comprar ni vender, y no está conectada a ningún broker.</p>
    <p><a href="https://invest.moyiq.app/app?ref=invest-d5" style="${BUTTON_STYLE}">Abrir MOY IQ Invest</a></p>
    <p style="color:${MUTED};font-size:13px">Si no te sirve ahora, puedes darte de baja con el enlace de abajo.</p>
    `,
    unsub,
  );
  return { subject, html };
}

// --- Envío con reintento (mismo patrón que las otras nurture) ---------------

export async function sendViaResend(
  to: string,
  rendered: RenderedEmail,
  config: NurtureEmailConfig,
): Promise<{ ok: boolean; error?: string }> {
  if (!config.resendApiKey) return { ok: false, error: "resend_not_configured" };

  const body = { from: config.fromEmail, to, subject: rendered.subject, html: rendered.html };
  const attempt = () =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  let res = await attempt();
  if (!res.ok) {
    console.warn(`send-nurture-invest-email: intento 1 falló (${res.status}) — reintentando`);
    res = await attempt();
  }
  if (!res.ok) {
    const text = await res.text();
    console.error(`send-nurture-invest-email: Resend error tras reintento: ${res.status} ${text}`);
    return { ok: false, error: `resend_${res.status}: ${text}` };
  }
  return { ok: true };
}

// --- Consultas contra invest_leads (service role, REST) ----------------------

async function restGet<T>(path: string, config: NurtureEmailConfig): Promise<T> {
  const res = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: config.serviceRole,
      Authorization: `Bearer ${config.serviceRole}`,
    },
  });
  if (!res.ok) throw new Error(`rest_get_failed_${res.status}`);
  return res.json();
}

async function restPatch(path: string, body: unknown, config: NurtureEmailConfig): Promise<void> {
  const res = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey: config.serviceRole,
      Authorization: `Bearer ${config.serviceRole}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`rest_patch_failed_${res.status}`);
}

export async function fetchLeadById(id: string, config: NurtureEmailConfig): Promise<InvestLead | null> {
  const rows = await restGet<InvestLead[]>(
    `invest_leads?id=eq.${encodeURIComponent(id)}&select=id,email,perfil&limit=1`,
    config,
  );
  return rows[0] ?? null;
}

const BATCH_LIMIT = 200; // tope por corrida del cron — salvaguarda, no expectativa de tráfico real.

export async function fetchEligibleForEmail2(config: NurtureEmailConfig): Promise<InvestLead[]> {
  return restGet<InvestLead[]>(
    `invest_leads?select=id,email,perfil` +
      `&unsubscribed_at=is.null&consent_marketing=is.true&account_created_at=is.null&email2_sent_at=is.null` +
      `&limit=${BATCH_LIMIT}`,
    config,
  );
}

// Email 3: solo si ya se mandó el 2 y pasaron >= 3 días desde ESE envío.
export async function fetchEligibleForEmail3(config: NurtureEmailConfig): Promise<InvestLead[]> {
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  return restGet<InvestLead[]>(
    `invest_leads?select=id,email,perfil` +
      `&unsubscribed_at=is.null&consent_marketing=is.true&account_created_at=is.null` +
      `&email3_sent_at=is.null&email2_sent_at=not.is.null&email2_sent_at=lte.${cutoff}` +
      `&limit=${BATCH_LIMIT}`,
    config,
  );
}

export async function markSent(leadId: string, mode: NurtureMode, config: NurtureEmailConfig): Promise<void> {
  const column = mode === "welcome" ? "email1_sent_at" : mode === "day2" ? "email2_sent_at" : "email3_sent_at";
  await restPatch(`invest_leads?id=eq.${encodeURIComponent(leadId)}`, { [column]: new Date().toISOString() }, config);
}

export interface CronRunResult {
  email2: { attempted: number; sent: number; failed: number };
  email3: { attempted: number; sent: number; failed: number };
}

export async function runCronBatch(config: NurtureEmailConfig): Promise<CronRunResult> {
  const result: CronRunResult = {
    email2: { attempted: 0, sent: 0, failed: 0 },
    email3: { attempted: 0, sent: 0, failed: 0 },
  };

  const leads2 = await fetchEligibleForEmail2(config);
  result.email2.attempted = leads2.length;
  for (const lead of leads2) {
    const rendered = renderEmail("day2", lead, config);
    const sent = await sendViaResend(lead.email, rendered, config);
    if (sent.ok) {
      await markSent(lead.id, "day2", config);
      result.email2.sent++;
    } else {
      result.email2.failed++;
      console.error(`send-nurture-invest-email: día2 falló para lead ${lead.id}: ${sent.error}`);
    }
  }

  const leads3 = await fetchEligibleForEmail3(config);
  result.email3.attempted = leads3.length;
  for (const lead of leads3) {
    const rendered = renderEmail("day5", lead, config);
    const sent = await sendViaResend(lead.email, rendered, config);
    if (sent.ok) {
      await markSent(lead.id, "day5", config);
      result.email3.sent++;
    } else {
      result.email3.failed++;
      console.error(`send-nurture-invest-email: día5 falló para lead ${lead.id}: ${sent.error}`);
    }
  }

  return result;
}
