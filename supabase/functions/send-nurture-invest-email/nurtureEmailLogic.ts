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
// consent_marketing: invest_leads no pedía opt-in explícito — el quiz de
// perfil-inversor.html hoy es "dejá tu email para ver tu resultado", sin
// checkbox de marketing. Se agregó consent_marketing boolean not null
// default true en la migración 20260918000900 (mismo razonamiento que
// 20260918000500 para starter_leads — ver esa migración).

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

function wrapHtml(bodyHtml: string, unsubUrl: string): string {
  return `
    <div style="background:${BG};padding:32px 16px">
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;background:${CARD};color:${TEXT};line-height:1.55;padding:32px;border-radius:12px;border:1px solid #232838">
        ${bodyHtml}
        <p style="color:${MUTED};font-size:11px;margin-top:32px;border-top:1px solid #232838;padding-top:12px">
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

const PROFILE_COPY: Record<Perfil, { name: string; desc: string; mix: string[] }> = {
  conservador: {
    name: "Conservador",
    desc: "Priorizás preservar tu capital por sobre el crecimiento. Un mix con mayor peso en renta fija y efectivo suele ajustarse mejor a tu perfil.",
    mix: ["70-80% renta fija / efectivo", "20-30% renta variable"],
  },
  moderado: {
    name: "Moderado",
    desc: "Buscás un balance entre crecimiento y estabilidad. Un mix diversificado entre renta fija y variable suele ajustarse mejor a tu perfil.",
    mix: ["40-60% renta variable", "40-60% renta fija / efectivo"],
  },
  agresivo: {
    name: "Agresivo",
    desc: "Priorizás el crecimiento por sobre la estabilidad y tenés horizonte largo para absorber caídas. Un mix con mayor peso en renta variable y activos de mayor riesgo suele ajustarse mejor a tu perfil.",
    mix: ["70-90% renta variable / cripto", "10-30% renta fija / efectivo"],
  },
};

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
      <p>Mix sugerido como punto de partida:</p>
      <p>${profile.mix.map((m) => `<span style="display:inline-block;background:#1F2536;color:${TEXT};padding:6px 12px;border-radius:6px;font-size:13px;margin:4px 4px 0 0">${m}</span>`).join("")}</p>
      <p>Esto es un resultado, no un portfolio. Para armar el portfolio real — con precios en tiempo real, indicadores y seguimiento de tus posiciones, no solo un mix teórico — hace falta una cuenta.</p>
      <p><a href="https://invest.moyiq.app/app?ref=invest-welcome" style="display:inline-block;background:${GOLD};color:#12161F;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Armar mi portfolio →</a></p>
      <p style="color:${MUTED};font-size:13px">Plan Free disponible sin tarjeta — 5 posiciones, precios reales, Position Builder.</p>
      `,
      unsub,
    );
    return { subject, html };
  }

  if (mode === "day2") {
    const subject = "El Position Builder aplica la Regla del 2% sola";
    const html = wrapHtml(
      `
      <h2 style="color:${GOLD};margin-top:0">Lo que la mayoría no descubre solo</h2>
      <p>Hola,</p>
      <p>Una de las herramientas de Invest que menos se usa al principio, y más ahorra errores caros, es el <strong>Position Builder</strong>: ingresás ticker, capital disponible y stop loss, y calcula automáticamente el tamaño de posición óptimo aplicando la Regla del 2% — cuánto arriesgar por operación para no comprometer el capital total en una sola posición mala.</p>
      <p>Está disponible desde el plan Free. La mayoría entra a Invest a mirar precios y nunca lo prueba porque no está en el centro de la pantalla — vale la pena buscarlo una vez.</p>
      <p><a href="https://invest.moyiq.app/app?ref=invest-d2#position-builder" style="display:inline-block;background:${GOLD};color:#12161F;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Probar Position Builder →</a></p>
      <p style="color:${MUTED};font-size:13px">Si todavía no creaste tu cuenta, este es el momento — el plan Free no pide tarjeta.</p>
      `,
      unsub,
    );
    return { subject, html };
  }

  // day5
  const subject = "Qué diferencia a Free de Pro en Invest";
  const html = wrapHtml(
    `
    <h2 style="color:${GOLD};margin-top:0">Sin inventar nada que no esté en el sitio</h2>
    <p>Hola,</p>
    <p>La diferencia real entre lo que ya podés usar en Free y lo que suma Pro (US$9.99/mes):</p>
    <p><strong style="color:${TEXT}">Free (sin tarjeta, sin fecha de vencimiento):</strong><br>
    — 5 posiciones en portfolio<br>
    — Precios reales en tiempo real<br>
    — Noticias del mercado<br>
    — 5 indicadores activos<br>
    — Position Builder<br>
    — 3 alertas de precio</p>
    <p><strong style="color:${TEXT}">Pro (US$9.99/mes):</strong><br>
    — Todo lo de Free, sin límites<br>
    — Comparador head-to-head (¿AAPL o MSFT? ¿SPY o QQQ?)<br>
    — Market Sentiment Gauge propio (Fear &amp; Greed calculado con tus datos)<br>
    — Dividend Calendar con proyección a 12 meses<br>
    — Rebalancing Tool<br>
    — Módulo Chile/LATAM + tipo de cambio en tiempo real<br>
    — Indicadores Pro (RSI/MACD/Bandas de Bollinger), Backtesting Engine, export CSV</p>
    <p>Si solo seguís de cerca 3-4 posiciones, Free probablemente te alcanza. Si comparás activos seguido o hacés seguimiento de dividendos, ahí es donde Pro paga solo.</p>
    <p><a href="https://invest.moyiq.app/app?ref=invest-d5#pricing" style="display:inline-block;background:${GOLD};color:#12161F;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Ver planes →</a></p>
    <p style="color:${MUTED};font-size:13px">Si no es para vos ahora, seguís en Free sin perder nada.</p>
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
