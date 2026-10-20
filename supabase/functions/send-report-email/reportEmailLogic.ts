// supabase/functions/send-report-email/reportEmailLogic.ts
//
// Lógica del envío por correo del reporte PDF de Modo Asesor, separada de
// index.ts por el mismo motivo que webhookLogic.ts (ver ese archivo): index.ts
// corre en Deno y lee `Deno.env.get` a nivel de módulo, lo que rompe si se
// importa desde Node/vitest. Este archivo no referencia `Deno.*` — la config
// se recibe como parámetro.
//
// Modo Asesor es Pro-gated en el frontend (ProGate), pero eso NO es un límite
// de seguridad real — cualquiera podría llamar a este endpoint directo sin
// pasar por la UI. Por eso el servidor exige la sesión y valida licencia,
// dueño y tope diario en report_email_claim (ver más abajo).

const MAX_PDF_BYTES = 8 * 1024 * 1024; // 8MB — un reporte de 1-2 páginas nunca se acerca a esto; el límite es contra abuso, no contra uso real.

import { type EmailLang, INTL_LOCALE } from "../_shared/emailLang.ts";
import { emailLayout, EMAIL_MUTED_STYLE } from "../_shared/emailLayout.ts";
export { pickLang } from "../_shared/emailLang.ts";

export interface EmailConfig {
  supabaseUrl: string;
  serviceRole: string;
  resendApiKey?: string;
  fromEmail: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && email.length <= 254 && EMAIL_RE.test(email);
}

// Tamaño en bytes de un string base64 (sin decodificarlo) — suficiente para
// rechazar payloads gigantes antes de gastar CPU en decodificar nada.
export function base64ByteLength(b64: string): number {
  const clean = b64.replace(/=+$/, "");
  return Math.floor((clean.length * 3) / 4);
}

export function isPdfSizeOk(pdfBase64: unknown): pdfBase64 is string {
  return typeof pdfBase64 === "string" && pdfBase64.length > 0 && base64ByteLength(pdfBase64) <= MAX_PDF_BYTES;
}

// ── C-20 (auditoría 360, SEG-8): sesión de la cuenta dueña + tope diario ────
// Con solo conocer una clave Pro cualquiera mandaba PDFs a cualquier
// destinatario desde @moyiq.app, sin límite. Ahora: JWT de la sesión,
// verificado contra Auth; la cuenta tiene que ser la dueña de la licencia, y
// hay un tope de envíos por licencia en 24 h (report_email_claim, migración
// 20261019200000).
export const DEFAULT_DAILY_LIMIT = 20;

export function dailyLimitFrom(envValue: string | null | undefined): number {
  const n = Number(envValue);
  return Number.isInteger(n) && n > 0 && n <= 500 ? n : DEFAULT_DAILY_LIMIT;
}

export function bearerToken(header: string | null | undefined): string | null {
  const m = typeof header === "string" ? header.match(/^Bearer\s+(\S+)$/i) : null;
  return m ? m[1] : null;
}

// La cuenta de la sesión según Supabase Auth (equivale a getUser()). Un token
// vencido, inválido o de otro proyecto devuelve null.
export async function getAuthUser(
  token: string,
  config: EmailConfig,
): Promise<{ id: string; email: string | null } | null> {
  if (!token) return null;
  try {
    const res = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: config.serviceRole, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = await res.json();
    if (typeof user?.id !== "string" || !user.id) return null;
    return { id: user.id, email: typeof user.email === "string" && user.email ? user.email : null };
  } catch {
    return null;
  }
}

export type ClaimError = "license_required" | "not_owner" | "daily_limit" | "claim_failed";

export async function claimReportSend(
  userId: string,
  licenseKey: string,
  config: EmailConfig,
  dailyLimit: number = DEFAULT_DAILY_LIMIT,
): Promise<{ ok: true; remaining: number | null } | { ok: false; error: ClaimError }> {
  if (!licenseKey) return { ok: false, error: "license_required" };
  let res: Response;
  try {
    res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/report_email_claim`, {
      method: "POST",
      headers: {
        apikey: config.serviceRole,
        Authorization: `Bearer ${config.serviceRole}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_user_id: userId, p_key: licenseKey, p_daily_limit: dailyLimit }),
    });
  } catch {
    return { ok: false, error: "claim_failed" };
  }
  if (!res.ok) {
    console.error(`send-report-email: report_email_claim ${res.status}`);
    return { ok: false, error: "claim_failed" };
  }
  const data = await res.json();
  if (data?.ok === true) return { ok: true, remaining: typeof data.remaining === "number" ? data.remaining : null };
  const err = data?.error;
  if (err === "not_owner" || err === "daily_limit") return { ok: false, error: err };
  return { ok: false, error: "license_required" };
}

// Código HTTP de cada rechazo, para index.ts.
export const CLAIM_STATUS: Record<ClaimError, number> = {
  license_required: 403,
  not_owner: 403,
  daily_limit: 429,
  claim_failed: 503,
};

export interface SendReportParams {
  to: string;
  clientName: string;
  month: string;
  pdfBase64: string;
  filename: string;
  lang?: EmailLang; // el idioma de la app de quien envía (ver index.ts)
  // Correo de la cuenta que envía: va como reply_to y en el pie, para que el
  // destinatario sepa quién se lo mandó y le responda a esa persona.
  senderEmail?: string | null;
}

// Textos del correo en los 4 idiomas de la app. Voz seca, sin exclamaciones;
// alemán con "Sie".
const REPORT_TEXT: Record<EmailLang, { title: string; body: (month: string) => string; notice: string; subject: (month: string) => string; sentBy: (email: string) => string }> = {
  es: {
    title: "Reporte financiero",
    body: (m) => `Adjunto encontrarás el diagnóstico financiero de ${m}, generado con MOY IQ Modo Asesor.`,
    notice: "Este correo puede contener información financiera personal. Si no esperabas recibirlo, ignóralo y avisa a quien te lo envió.",
    subject: (m) => `Reporte financiero — ${m}`,
    sentBy: (e) => `Enviado por ${e} con MOY IQ. Si respondes, la respuesta le llega a esa persona.`,
  },
  en: {
    title: "Financial report",
    body: (m) => `Attached is the financial diagnosis for ${m}, generated with MOY IQ Advisor Mode.`,
    notice: "This email may contain personal financial information. If you weren't expecting it, ignore it and let the sender know.",
    subject: (m) => `Financial report — ${m}`,
    sentBy: (e) => `Sent by ${e} with MOY IQ. If you reply, your answer goes to that person.`,
  },
  pt: {
    title: "Relatório financeiro",
    body: (m) => `Em anexo está o diagnóstico financeiro de ${m}, gerado com o Modo Assessor do MOY IQ.`,
    notice: "Este e-mail pode conter informações financeiras pessoais. Se não esperava recebê-lo, ignore-o e avise quem o enviou.",
    subject: (m) => `Relatório financeiro — ${m}`,
    sentBy: (e) => `Enviado por ${e} com o MOY IQ. Se você responder, a resposta chega a essa pessoa.`,
  },
  de: {
    title: "Finanzbericht",
    body: (m) => `Im Anhang finden Sie die Finanzdiagnose für ${m}, erstellt mit dem Beratungsmodus von MOY IQ.`,
    notice: "Diese E-Mail kann persönliche Finanzinformationen enthalten. Wenn Sie sie nicht erwartet haben, ignorieren Sie sie und informieren Sie den Absender.",
    subject: (m) => `Finanzbericht – ${m}`,
    sentBy: (e) => `Gesendet von ${e} mit MOY IQ. Wenn Sie antworten, geht die Antwort an diese Person.`,
  },
};

// 'YYYY-MM' → "septiembre de 2026" / "September 2026"; cualquier otra cosa, tal cual.
export function formatReportMonth(month: string, lang: EmailLang = "es"): string {
  const m = String(month || "").match(/^(\d{4})-(\d{2})$/);
  if (!m) return month;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  return new Intl.DateTimeFormat(INTL_LOCALE[lang], { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

// clientName lo escribe el usuario: se escapa antes de meterlo en el HTML.
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// Render puro del correo (BRD-5: layout de marca compartido). El aviso de
// privacidad va en el pie.
export function renderReportEmail(params: SendReportParams): { subject: string; html: string } {
  const lang: EmailLang = params.lang ?? "es";
  const T = REPORT_TEXT[lang] ?? REPORT_TEXT.es;
  const month = formatReportMonth(params.month, lang);
  const html = emailLayout({
    lang,
    bodyHtml: `<h2>${T.title}${params.clientName ? " — " + escapeHtml(params.clientName) : ""}</h2>
      <p>${T.body(escapeHtml(month))}</p>
      ${params.senderEmail ? `<p style="${EMAIL_MUTED_STYLE}">${T.sentBy(escapeHtml(params.senderEmail))}</p>` : ""}`,
    footerHtml: T.notice,
  });
  return { subject: T.subject(month), html };
}

// Igual patrón que sendKeyEmail (webhookLogic.ts): reintenta una vez ante un
// fallo transitorio de Resend antes de darlo por perdido. Los logs no llevan
// destinatario ni contenido.
export async function sendReportEmail(
  params: SendReportParams,
  config: EmailConfig,
): Promise<{ ok: boolean; error?: string }> {
  if (!config.resendApiKey) return { ok: false, error: "resend_not_configured" };

  const { subject, html } = renderReportEmail(params);

  const body: Record<string, unknown> = {
    from: config.fromEmail,
    to: params.to,
    subject,
    html,
    attachments: [{ filename: params.filename, content: params.pdfBase64 }],
  };
  if (params.senderEmail) body.reply_to = params.senderEmail;

  const attempt = () =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  let res = await attempt();
  if (!res.ok) {
    console.warn(`send-report-email: intento 1 falló (${res.status}) — reintentando`);
    res = await attempt();
  }
  if (!res.ok) {
    const text = await res.text();
    console.error(`send-report-email: Resend error tras reintento: ${res.status} ${text}`);
    return { ok: false, error: `resend_${res.status}` };
  }
  return { ok: true };
}
