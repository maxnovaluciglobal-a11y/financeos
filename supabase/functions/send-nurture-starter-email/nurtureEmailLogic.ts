// supabase/functions/send-nurture-starter-email/nurtureEmailLogic.ts
//
// Lógica pura de la secuencia de 3 emails de nurture para quien elige
// "Starter" (cuenta gratis, sin clave) — pedido explícito de Walter,
// 14-sep-2026, calcado del patrón de send-nurture-diagnostico-email/. La
// diferencia de fondo con esa secuencia: quien recibe esto YA ES usuario
// Starter con cuenta activa, no un lead que "podría" registrarse. El
// objetivo es activación (que use Dashboard/Movimientos/Presupuestos con
// datos reales) y, en el email 3, upsell a Pro — nunca "crea tu cuenta".
//
// Separada de index.ts por el mismo motivo que en send-nurture-diagnostico-
// email/: index.ts lee Deno.env.get() a nivel de módulo y no se puede
// importar desde Node/vitest.
//
// Remitente: mismo "MOY IQ <hola@moyiq.app>" ya verificado en Resend para
// nurture — no hace falta configurar nada nuevo ahí (ver reporte de la
// sesión del 13-sep que armó send-nurture-diagnostico-email).
//
// consent_marketing: starter_leads no tenía esta columna — el signup de
// Starter no pide opt-in explícito de marketing hoy, a diferencia del
// formulario de Diagnóstico Exprés. Se agregó consent_marketing boolean not
// null default true en la migración 20260918000500 (ver esa migración para
// el razonamiento completo). El filtro de elegibilidad de acá exige
// consent_marketing = true, igual que diagnóstico — hoy es un no-op porque
// todos entran en true por default, pero deja el gate simétrico y listo
// para un futuro checkbox de opt-in sin tocar este archivo.
//
// Idioma (09-oct-2026): el copy de los 4 idiomas vive en nurtureTemplates.ts
// y se elige por starter_leads.lang (pickLang, fallback español). Ver
// supabase/migrations/20261009000000_leads_lang.sql.

import { type EmailLang, pickLang as pickFromCandidates } from "../_shared/emailLang.ts";
import { STARTER_TEMPLATES, UNSUBSCRIBE_LABEL } from "./nurtureTemplates.ts";

export type NurtureMode = "welcome" | "day2" | "day5";
export const NURTURE_MODES: NurtureMode[] = ["welcome", "day2", "day5"];

export interface StarterLead {
  id: string;
  email: string;
  // Idioma del lead (migración 20261009000000_leads_lang.sql). Opcional: antes
  // de esa migración la columna no existe y el campo simplemente no viene.
  lang?: string | null;
}

export interface NurtureEmailConfig {
  supabaseUrl: string;
  serviceRole: string;
  resendApiKey?: string;
  fromEmail: string; // "MOY IQ <hola@moyiq.app>"
  cronSecret?: string;
  landingUrl: string; // "https://moyiq.app" — para armar el link de unsubscribe
}

// Idioma de la plantilla: el lang del lead si es es/en/pt/de, si no español
// (null, columna inexistente, 'fr', basura).
export function pickLang(lang: unknown): EmailLang {
  return pickFromCandidates(lang);
}

export function unsubscribeUrl(config: NurtureEmailConfig, leadId: string): string {
  // t=starter selecciona el RPC unsubscribe_starter_lead en unsubscribe.html
  // (ver financeos-landing/unsubscribe.html, actualizado en esta misma tarea
  // para aceptar ambas tablas).
  return `${config.landingUrl.replace(/\/$/, "")}/unsubscribe.html?id=${encodeURIComponent(leadId)}&t=starter`;
}

function wrapHtml(bodyHtml: string, unsubUrl: string, lang: EmailLang = "es"): string {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.55">
      ${bodyHtml}
      <p style="color:#999;font-size:11px;margin-top:32px;border-top:1px solid #eee;padding-top:12px">
        MOY IQ · MAXNOVA &amp; LUCI Global LLC.
        <a href="${unsubUrl}" style="color:#999">${UNSUBSCRIBE_LABEL[lang]}</a>.
      </p>
    </div>`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
}

export function renderEmail(mode: NurtureMode, lead: StarterLead, config: NurtureEmailConfig): RenderedEmail {
  const lang = pickLang(lead.lang);
  const copy = STARTER_TEMPLATES[lang][mode];
  return { subject: copy.subject, html: wrapHtml(copy.body, unsubscribeUrl(config, lead.id), lang) };
}

// --- Envío con reintento (mismo patrón que send-nurture-diagnostico-email) --

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
    console.warn(`send-nurture-starter-email: intento 1 falló (${res.status}) — reintentando`);
    res = await attempt();
  }
  if (!res.ok) {
    const text = await res.text();
    console.error(`send-nurture-starter-email: Resend error tras reintento: ${res.status} ${text}`);
    return { ok: false, error: `resend_${res.status}` };
  }
  return { ok: true };
}

// --- Consultas contra starter_leads (service role, REST) ---------------------

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

// select=* (no select=id,email,lang) a propósito: PostgREST responde 400 si
// se pide una columna que no existe, y `lang` recién existe después de la
// migración 20261009000000_leads_lang.sql. Con * la función sirve igual
// antes y después: sin columna, lead.lang es undefined y renderEmail cae a
// español. Las filas son pocas columnas y se leen con service role.
export async function fetchLeadById(id: string, config: NurtureEmailConfig): Promise<StarterLead | null> {
  const rows = await restGet<StarterLead[]>(
    `starter_leads?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
    config,
  );
  return rows[0] ?? null;
}

const BATCH_LIMIT = 200; // tope por corrida del cron — mismo criterio que diagnóstico: salvaguarda contra un bug de filtro, no una expectativa de tráfico real.

// Email 2: sin edad mínima a propósito (mismo diseño anti-spam retroactivo
// que diagnóstico, ver 20260913173000_diagnostico_nurture_send.sql) — se
// manda una sola vez a quien todavía no lo tenga marcado, sin importar
// cuándo se creó el lead.
export async function fetchEligibleForEmail2(config: NurtureEmailConfig): Promise<StarterLead[]> {
  return restGet<StarterLead[]>(
    `starter_leads?select=*` +
      `&unsubscribed_at=is.null&consent_marketing=is.true&account_created_at=is.null&email2_sent_at=is.null` +
      `&limit=${BATCH_LIMIT}`,
    config,
  );
}

// Email 3: solo si ya se mandó el 2 y pasaron >= 3 días desde ESE envío (no
// desde la creación del lead) — así nunca se manda 2 y 3 en la misma corrida.
export async function fetchEligibleForEmail3(config: NurtureEmailConfig): Promise<StarterLead[]> {
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  return restGet<StarterLead[]>(
    `starter_leads?select=*` +
      `&unsubscribed_at=is.null&consent_marketing=is.true&account_created_at=is.null` +
      `&email3_sent_at=is.null&email2_sent_at=not.is.null&email2_sent_at=lte.${cutoff}` +
      `&limit=${BATCH_LIMIT}`,
    config,
  );
}

export async function markSent(leadId: string, mode: NurtureMode, config: NurtureEmailConfig): Promise<void> {
  const column = mode === "welcome" ? "email1_sent_at" : mode === "day2" ? "email2_sent_at" : "email3_sent_at";
  await restPatch(`starter_leads?id=eq.${encodeURIComponent(leadId)}`, { [column]: new Date().toISOString() }, config);
}

export interface CronRunResult {
  email2: { attempted: number; sent: number; failed: number };
  email3: { attempted: number; sent: number; failed: number };
}

// Corre el batch de emails 2 y 3. Se llama desde index.ts en modo "cron"
// (autenticado con CRON_SECRET, no con la llamada pública del navegador).
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
      console.error(`send-nurture-starter-email: día2 falló para lead ${lead.id}: ${sent.error}`);
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
      console.error(`send-nurture-starter-email: día5 falló para lead ${lead.id}: ${sent.error}`);
    }
  }

  return result;
}
