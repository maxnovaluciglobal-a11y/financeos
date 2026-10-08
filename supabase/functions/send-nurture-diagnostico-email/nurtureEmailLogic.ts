// supabase/functions/send-nurture-diagnostico-email/nurtureEmailLogic.ts
//
// Lógica pura de la secuencia de 4 emails de nurture post-Diagnóstico Exprés
// (ver financeos-landing/marketing/nurture-diagnostico-3-emails.md — ahí está
// el copy exacto de donde sale este contenido). Separada de index.ts por el
// mismo motivo que reportEmailLogic.ts: index.ts lee Deno.env.get() a nivel
// de módulo y no se puede importar desde Node/vitest.
//
// Revisión 18-sep-2026: copy reforzado (asuntos con más tensión, miga de pan
// entre email 1→2, email 3 recortado) + email 4 nuevo de reactivación (día
// 12, solo para quien no convirtió en ninguno de los 3 anteriores). Ver el
// .md para el detalle de qué cambió y por qué en cada email.
//
// Remitente: MOY IQ <hola@moyiq.app> — separado a propósito del transaccional
// (licencias@moyiq.app, usado por stripe-webhook y send-report-email). Es
// marketing/nurture, no transaccional; mezclar los dos golpea la reputación
// de entrega del remitente que sí importa para logins/recibos. Mismo dominio
// moyiq.app ya verificado en Resend — un alias nuevo no necesita verificación
// DNS adicional, solo darlo de alta como "From" en Resend (ver reporte final
// de esta sesión para el paso manual pendiente si no se pudo confirmar).
//
// A/B de asunto: el .md da 2 variantes de asunto por email. Sin infraestructura
// de A/B testing en este envío (no hay tracking de qué variante ganó ni forma
// de medirlo todavía), se fija SIEMPRE la variante A. Documentado acá porque
// es una decisión de producto, no un detalle de implementación.
//
// Idioma (09-oct-2026): el copy de los 4 idiomas vive en nurtureTemplates.ts
// y se elige por diagnostico_leads.lang (pickLang, fallback español). Ver
// supabase/migrations/20261009000000_leads_lang.sql.

import { type EmailLang, pickLang as pickFromCandidates } from "../_shared/emailLang.ts";
import { DIAGNOSTICO_TEMPLATES, UNSUBSCRIBE_LABEL } from "./nurtureTemplates.ts";

export type NurtureMode = "welcome" | "day2" | "day5" | "day12";
export const NURTURE_MODES: NurtureMode[] = ["welcome", "day2", "day5", "day12"];

export interface DiagnosticoLead {
  id: string;
  email: string;
  score: number | null;
  label: string | null;
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

// --- Personalización del email 1 --------------------------------------------
//
// El diagnóstico corre 100% client-side en diagnostico.html y hoy solo manda
// al servidor `score` y `label` (Excelente/Bueno/Regular/Crítico) — el
// desglose por factor (flujo de caja / colchón de emergencia / carga de
// deuda / metas), que sería el dato ideal para saber el "hallazgo dominante",
// se calcula en el navegador pero nunca se persiste. Portarlo requeriría
// tocar el schema de diagnostico_leads y el flujo de captura de la landing,
// fuera del alcance de esta entrega (que es activar el envío, no rediseñar
// la captura de datos).
//
// Fallback implementado: se usa `label` como proxy del hallazgo dominante.
// Un label "Crítico" o "Regular" es, en la enorme mayoría de los casos que
// arma este cálculo (pesos: flujo 30, emergencia 20, deuda 20, metas 15),
// resultado de un flujo de caja negativo o ajustado — así que se apunta al
// mismo feature que el email 2 profundiza (Dashboard + Movimientos). No es
// tan preciso como saber el factor exacto, pero es consistente con lo que
// la app puede después mostrar con datos reales (regla explícita del .md:
// no prometer una recomendación que la app no pueda sostener).
// Los bloques por label (en los 4 idiomas) viven en nurtureTemplates.ts
// (ACTION_BLOCKS / actionBlock).

export function unsubscribeUrl(config: NurtureEmailConfig, leadId: string): string {
  return `${config.landingUrl.replace(/\/$/, "")}/unsubscribe.html?id=${encodeURIComponent(leadId)}`;
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

// day12 (reactivación, revisión 18-sep) no repite el pitch de Starter/Pro y
// menciona el unsubscribe en el cuerpo, no solo en el footer legal — ver las
// plantillas.
export function renderEmail(mode: NurtureMode, lead: DiagnosticoLead, config: NurtureEmailConfig): RenderedEmail {
  const lang = pickLang(lead.lang);
  const unsub = unsubscribeUrl(config, lead.id);
  const copy = DIAGNOSTICO_TEMPLATES[lang][mode]({
    score: lead.score ?? null,
    label: lead.label ?? null,
    unsubUrl: unsub,
    landingUrl: config.landingUrl.replace(/\/$/, ""),
  });
  return { subject: copy.subject, html: wrapHtml(copy.body, unsub, lang) };
}

// --- Envío con reintento (mismo patrón que reportEmailLogic.sendReportEmail) --

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
    console.warn(`send-nurture-diagnostico-email: intento 1 falló (${res.status}) — reintentando`);
    res = await attempt();
  }
  if (!res.ok) {
    const text = await res.text();
    console.error(`send-nurture-diagnostico-email: Resend error tras reintento: ${res.status} ${text}`);
    return { ok: false, error: `resend_${res.status}` };
  }
  return { ok: true };
}

// --- Consultas contra diagnostico_leads (service role, REST) -----------------

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

// select=* (no select=id,email,score,label,lang) a propósito: PostgREST
// responde 400 si se pide una columna que no existe, y `lang` recién existe
// después de la migración 20261009000000_leads_lang.sql. Con * la función
// sirve igual antes y después: sin columna, lead.lang es undefined y
// renderEmail cae a español. Se lee con service role, una fila por lead.
export async function fetchLeadById(id: string, config: NurtureEmailConfig): Promise<DiagnosticoLead | null> {
  const rows = await restGet<DiagnosticoLead[]>(
    `diagnostico_leads?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
    config,
  );
  return rows[0] ?? null;
}

const BATCH_LIMIT = 200; // tope por corrida del cron — este volumen de leads nunca se acerca a esto hoy, es una salvaguarda contra un bug de filtro, no una expectativa de tráfico.

// Email 2: sin edad mínima a propósito (ver nota de diseño anti-spam en la
// migración) — se manda una sola vez a quien todavía no lo tenga marcado.
export async function fetchEligibleForEmail2(config: NurtureEmailConfig): Promise<DiagnosticoLead[]> {
  return restGet<DiagnosticoLead[]>(
    `diagnostico_leads?select=*` +
      `&unsubscribed_at=is.null&consent_marketing=is.true&account_created_at=is.null&email2_sent_at=is.null` +
      `&limit=${BATCH_LIMIT}`,
    config,
  );
}

// Email 3: solo si ya se mandó el 2 y pasaron >= 3 días desde ESE envío (no
// desde la creación del lead) — así nunca se manda 2 y 3 en la misma corrida.
export async function fetchEligibleForEmail3(config: NurtureEmailConfig): Promise<DiagnosticoLead[]> {
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  return restGet<DiagnosticoLead[]>(
    `diagnostico_leads?select=*` +
      `&unsubscribed_at=is.null&consent_marketing=is.true&account_created_at=is.null` +
      `&email3_sent_at=is.null&email2_sent_at=not.is.null&email2_sent_at=lte.${cutoff}` +
      `&limit=${BATCH_LIMIT}`,
    config,
  );
}

// Email 4 (reactivación): solo si ya se mandó el 3 y pasaron >= 7 días desde
// ESE envío (5+7=12, respeta el timing día 12 del plan). Mismo filtro común
// que 2/3 — ver nota de diseño arriba sobre por qué no distingue apertura.
export async function fetchEligibleForEmail4(config: NurtureEmailConfig): Promise<DiagnosticoLead[]> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return restGet<DiagnosticoLead[]>(
    `diagnostico_leads?select=*` +
      `&unsubscribed_at=is.null&consent_marketing=is.true&account_created_at=is.null` +
      `&email4_sent_at=is.null&email3_sent_at=not.is.null&email3_sent_at=lte.${cutoff}` +
      `&limit=${BATCH_LIMIT}`,
    config,
  );
}

export async function markSent(leadId: string, mode: NurtureMode, config: NurtureEmailConfig): Promise<void> {
  const column =
    mode === "welcome" ? "email1_sent_at" :
    mode === "day2"    ? "email2_sent_at" :
    mode === "day5"    ? "email3_sent_at" :
                          "email4_sent_at";
  await restPatch(`diagnostico_leads?id=eq.${encodeURIComponent(leadId)}`, { [column]: new Date().toISOString() }, config);
}

export interface CronRunResult {
  email2: { attempted: number; sent: number; failed: number };
  email3: { attempted: number; sent: number; failed: number };
  email4: { attempted: number; sent: number; failed: number };
}

// Corre el batch de emails 2, 3 y 4. Se llama desde index.ts en modo "cron"
// (autenticado con CRON_SECRET, no con la llamada pública del navegador).
export async function runCronBatch(config: NurtureEmailConfig): Promise<CronRunResult> {
  const result: CronRunResult = {
    email2: { attempted: 0, sent: 0, failed: 0 },
    email3: { attempted: 0, sent: 0, failed: 0 },
    email4: { attempted: 0, sent: 0, failed: 0 },
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
      console.error(`send-nurture-diagnostico-email: día2 falló para lead ${lead.id}: ${sent.error}`);
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
      console.error(`send-nurture-diagnostico-email: día5 falló para lead ${lead.id}: ${sent.error}`);
    }
  }

  const leads4 = await fetchEligibleForEmail4(config);
  result.email4.attempted = leads4.length;
  for (const lead of leads4) {
    const rendered = renderEmail("day12", lead, config);
    const sent = await sendViaResend(lead.email, rendered, config);
    if (sent.ok) {
      await markSent(lead.id, "day12", config);
      result.email4.sent++;
    } else {
      result.email4.failed++;
      console.error(`send-nurture-diagnostico-email: día12 falló para lead ${lead.id}: ${sent.error}`);
    }
  }

  return result;
}
