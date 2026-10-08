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
// pasar por la UI. Por eso checkProLicense() vuelve a validar server-side
// contra la misma RPC validate_license que ya usa el resto del sync — no se
// confía en que el cliente diga "soy Pro".

const MAX_PDF_BYTES = 8 * 1024 * 1024; // 8MB — un reporte de 1-2 páginas nunca se acerca a esto; el límite es contra abuso, no contra uso real.

import { type EmailLang, INTL_LOCALE } from "../_shared/emailLang.ts";
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

export async function checkProLicense(
  licenseKey: string,
  config: EmailConfig,
): Promise<{ ok: boolean; plan?: string }> {
  if (!licenseKey) return { ok: false };
  const res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/validate_license`, {
    method: "POST",
    headers: {
      apikey: config.serviceRole,
      Authorization: `Bearer ${config.serviceRole}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_key: licenseKey }),
  });
  if (!res.ok) return { ok: false };
  const data = await res.json();
  const plan = data?.plan as string | undefined;
  return { ok: data?.valid === true && (plan === "pro" || plan === "enterprise"), plan };
}

export interface SendReportParams {
  to: string;
  clientName: string;
  month: string;
  pdfBase64: string;
  filename: string;
  lang?: EmailLang; // el idioma de la app de quien envía (ver index.ts)
}

// Textos del correo en los 4 idiomas de la app. Voz seca, sin exclamaciones;
// alemán con "Sie".
const REPORT_TEXT: Record<EmailLang, { title: string; body: (month: string) => string; notice: string; subject: (month: string) => string }> = {
  es: {
    title: "Reporte financiero",
    body: (m) => `Adjunto encontrarás el diagnóstico financiero de ${m}, generado con MOY IQ Modo Asesor.`,
    notice: "Este correo puede contener información financiera personal. Si no esperabas recibirlo, ignóralo y avisa a quien te lo envió.",
    subject: (m) => `Reporte financiero — ${m}`,
  },
  en: {
    title: "Financial report",
    body: (m) => `Attached is the financial diagnosis for ${m}, generated with MOY IQ Advisor Mode.`,
    notice: "This email may contain personal financial information. If you weren't expecting it, ignore it and let the sender know.",
    subject: (m) => `Financial report — ${m}`,
  },
  pt: {
    title: "Relatório financeiro",
    body: (m) => `Em anexo está o diagnóstico financeiro de ${m}, gerado com o Modo Assessor do MOY IQ.`,
    notice: "Este e-mail pode conter informações financeiras pessoais. Se não esperava recebê-lo, ignore-o e avise quem o enviou.",
    subject: (m) => `Relatório financeiro — ${m}`,
  },
  de: {
    title: "Finanzbericht",
    body: (m) => `Im Anhang finden Sie die Finanzdiagnose für ${m}, erstellt mit dem Beratungsmodus von MOY IQ.`,
    notice: "Diese E-Mail kann persönliche Finanzinformationen enthalten. Wenn Sie sie nicht erwartet haben, ignorieren Sie sie und informieren Sie den Absender.",
    subject: (m) => `Finanzbericht – ${m}`,
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

// Igual patrón que sendKeyEmail (webhookLogic.ts): reintenta una vez ante un
// fallo transitorio de Resend antes de darlo por perdido. A diferencia de la
// clave de licencia, acá SÍ es aceptable loguear el destinatario/asunto en un
// error (no es secreto derivable de una clave criptográfica) — nunca el PDF.
export async function sendReportEmail(
  params: SendReportParams,
  config: EmailConfig,
): Promise<{ ok: boolean; error?: string }> {
  if (!config.resendApiKey) return { ok: false, error: "resend_not_configured" };

  const lang: EmailLang = params.lang ?? "es";
  const T = REPORT_TEXT[lang] ?? REPORT_TEXT.es;
  const month = formatReportMonth(params.month, lang);
  const html = `
    <div lang="${lang}" style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto">
      <h2 style="color:#14213D">${T.title}${params.clientName ? " — " + escapeHtml(params.clientName) : ""}</h2>
      <p>${T.body(escapeHtml(month))}</p>
      <p style="color:#888;font-size:12px">${T.notice}</p>
    </div>`;

  const body = {
    from: config.fromEmail,
    to: params.to,
    subject: T.subject(month),
    html,
    attachments: [{ filename: params.filename, content: params.pdfBase64 }],
  };

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
