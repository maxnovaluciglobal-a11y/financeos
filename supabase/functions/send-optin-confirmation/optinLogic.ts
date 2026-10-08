// supabase/functions/send-optin-confirmation/optinLogic.ts
//
// Doble opt-in para correos de marketing (§ 7 Abs. 2 UWG, RGPD art. 7.1:
// hay que poder demostrar el consentimiento). Quien marca la casilla de
// marketing en el signup Starter (LicenseGate), el gate del demo (DemoGate) o
// el diagnóstico (diagnostico.html / en/score-check.html) queda con
// consent_marketing = true y un consent_token, pero SIN consent_confirmed_at.
// Esta función le manda el correo con el enlace de confirmación
// (confirmar.html / en/confirm.html → RPC confirm_marketing_consent). Hasta
// que hace clic, las funciones de nurture no le mandan marketing.
//
// Flujo (mismo patrón que send-cancellation-confirmation): el cliente llama
// a la RPC register_* (que NO devuelve el token: si lo devolviera, el
// navegador podría confirmarse solo y el doble opt-in no probaría nada) y,
// si marcó la casilla, llama a esta función con { source, id }. La función
// lee la fila con service role y manda el correo a la dirección de la fila.
//
// Idempotencia y abuso: un correo por fila (optin_email_sent_at, reclamado
// con PATCH condicional y liberado si Resend falla), nada si la fila ya está
// confirmada, y como mucho 3 correos de confirmación a la misma dirección en
// 24 h por tabla — la RPC de registro es pública, así que sin tope alguien
// podría usarla para mandar estos correos a terceros.
//
// El correo es solo la confirmación: sin publicidad (un correo de
// confirmación con publicidad ya es publicidad no consentida).
//
// Separada de index.ts por el mismo motivo que el resto de funciones del
// repo: index.ts lee Deno.env.get() y no se puede importar desde vitest.

import { type EmailLang, pickLang } from "../_shared/emailLang.ts";

export const SOURCES = {
  starter: "starter_leads",
  diagnostico: "diagnostico_leads",
  demo: "demo_leads",
} as const;
export type OptinSource = keyof typeof SOURCES;

export interface OptinRow {
  id: string;
  email: string;
  lang?: string | null;
  consent_marketing?: boolean | null;
  consent_token?: string | null;
  consent_confirmed_at?: string | null;
  optin_email_sent_at?: string | null;
}

export interface OptinConfig {
  supabaseUrl: string;
  serviceRole: string;
  resendApiKey?: string;
  fromEmail: string; // "MOY IQ <hola@moyiq.app>"
  replyTo: string; // support@moyiq.app
  landingUrl: string; // https://moyiq.app
}

export type OptinResult =
  | { ok: true; state: "sent" | "already_sent" | "already_confirmed" }
  | { ok: false; error: string };

// --- Textos -----------------------------------------------------------------

interface Copy {
  subject: string;
  intro: string;
  cta: string;
  button: string;
  ignore: string;
  unsubscribe: string;
}

export const COPY: Record<EmailLang, Copy> = {
  es: {
    subject: "Confirma que quieres recibir correos de MOY IQ",
    intro: "Pediste recibir por correo consejos y novedades de MOY IQ en esta dirección.",
    cta: "Para confirmarlo, abre este enlace:",
    button: "Confirmar suscripción",
    ignore:
      "Si no fuiste tú, ignora este correo: sin confirmación no te enviamos correos de marketing, y el enlace deja de funcionar a los 30 días.",
    unsubscribe: "Puedes darte de baja cuando quieras desde el enlace al pie de cada correo.",
  },
  en: {
    subject: "Confirm that you want emails from MOY IQ",
    intro: "You asked to receive MOY IQ tips and updates by email at this address.",
    cta: "To confirm, open this link:",
    button: "Confirm subscription",
    ignore:
      "If this was not you, ignore this email: without confirmation we send you no marketing emails, and the link stops working after 30 days.",
    unsubscribe: "You can unsubscribe at any time from the link at the bottom of every email.",
  },
  pt: {
    subject: "Confirme que quer receber e-mails do MOY IQ",
    intro: "Você pediu para receber por e-mail dicas e novidades do MOY IQ neste endereço.",
    cta: "Para confirmar, abra este link:",
    button: "Confirmar inscrição",
    ignore:
      "Se não foi você, ignore este e-mail: sem confirmação não enviamos e-mails de marketing, e o link deixa de funcionar em 30 dias.",
    unsubscribe: "Você pode cancelar quando quiser pelo link no rodapé de cada e-mail.",
  },
  de: {
    subject: "Bitte bestätigen Sie Ihre Anmeldung für E-Mails von MOY IQ",
    intro: "Sie haben angefordert, Tipps und Neuigkeiten von MOY IQ per E-Mail an diese Adresse zu erhalten.",
    cta: "Zur Bestätigung öffnen Sie bitte diesen Link:",
    button: "Anmeldung bestätigen",
    ignore:
      "Falls Sie das nicht waren, ignorieren Sie diese E-Mail: Ohne Bestätigung senden wir Ihnen keine Werbe-E-Mails, und der Link wird nach 30 Tagen ungültig.",
    unsubscribe: "Sie können sich jederzeit über den Link am Ende jeder E-Mail abmelden.",
  },
};

// Página de confirmación por idioma. Solo existen confirmar.html (es) y
// en/confirm.html (en): pt va a la española (más cercana) y de a la inglesa
// hasta que la landing alemana tenga la suya.
const CONFIRM_PATH: Record<EmailLang, string> = {
  es: "/confirmar.html",
  pt: "/confirmar.html",
  en: "/en/confirm.html",
  de: "/en/confirm.html",
};

export function confirmUrl(landingUrl: string, lang: EmailLang, token: string): string {
  return `${landingUrl.replace(/\/$/, "")}${CONFIRM_PATH[lang]}?t=${encodeURIComponent(token)}`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const FOOTER = "MOY IQ · MAXNOVA & LUCI Global LLC · support@moyiq.app";

export function renderOptinEmail(row: OptinRow, config: OptinConfig): RenderedEmail {
  const lang = pickLang(row.lang);
  const c = COPY[lang];
  const url = confirmUrl(config.landingUrl, lang, row.consent_token ?? "");
  const u = escapeHtml(url);
  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#14213D;line-height:1.55">
<p>${escapeHtml(c.intro)}</p>
<p>${escapeHtml(c.cta)}</p>
<p><a href="${u}" style="display:inline-block;background:#14213D;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(c.button)}</a></p>
<p style="font-size:13px;color:#5F5236;word-break:break-all">${u}</p>
<p style="font-size:13px;color:#5F5236">${escapeHtml(c.ignore)}</p>
<p style="font-size:13px;color:#5F5236">${escapeHtml(c.unsubscribe)}</p>
<p style="color:#8B7A55;font-size:11px;margin-top:32px;border-top:1px solid #E4DFD1;padding-top:12px">${escapeHtml(FOOTER)}</p>
</div>`;
  const text = [c.intro, "", c.cta, `${c.button}: ${url}`, "", c.ignore, c.unsubscribe, "", FOOTER].join("\n");
  return { subject: c.subject, html, text };
}

// --- Red --------------------------------------------------------------------

function headers(config: OptinConfig, extra: Record<string, string> = {}) {
  return { apikey: config.serviceRole, Authorization: `Bearer ${config.serviceRole}`, ...extra };
}

async function fetchRow(table: string, id: string, config: OptinConfig): Promise<OptinRow | null> {
  const res = await fetch(`${config.supabaseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, {
    headers: headers(config),
  });
  if (!res.ok) throw new Error(`rest_get_failed_${res.status}`);
  const rows = (await res.json()) as OptinRow[];
  return rows[0] ?? null;
}

export const RATE_LIMIT_PER_DAY = 3;

async function recentSends(table: string, email: string, config: OptinConfig): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `${config.supabaseUrl}/rest/v1/${table}?select=id&email=eq.${encodeURIComponent(email)}` +
      `&optin_email_sent_at=gte.${encodeURIComponent(since)}&limit=${RATE_LIMIT_PER_DAY}`,
    { headers: headers(config) },
  );
  if (!res.ok) throw new Error(`rest_get_failed_${res.status}`);
  const rows = (await res.json()) as unknown[];
  return Array.isArray(rows) ? rows.length : 0;
}

async function claim(table: string, id: string, config: OptinConfig): Promise<boolean> {
  const res = await fetch(
    `${config.supabaseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&optin_email_sent_at=is.null`,
    {
      method: "PATCH",
      headers: headers(config, { "Content-Type": "application/json", Prefer: "return=representation" }),
      body: JSON.stringify({ optin_email_sent_at: new Date().toISOString() }),
    },
  );
  if (!res.ok) throw new Error(`rest_patch_failed_${res.status}`);
  const rows = (await res.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

async function release(table: string, id: string, config: OptinConfig): Promise<void> {
  try {
    await fetch(`${config.supabaseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: headers(config, { "Content-Type": "application/json", Prefer: "return=minimal" }),
      body: JSON.stringify({ optin_email_sent_at: null }),
    });
  } catch (e) {
    console.error(`send-optin-confirmation: no se pudo liberar ${table}/${id}: ${e}`);
  }
}

// Un reintento ante error de red, 429 o 5xx; un 4xx distinto de 429 no.
async function sendViaResend(to: string, rendered: RenderedEmail, config: OptinConfig): Promise<{ ok: boolean; error?: string }> {
  const body = JSON.stringify({
    from: config.fromEmail,
    to,
    reply_to: config.replyTo,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
  const attempt = async (): Promise<Response | null> => {
    try {
      return await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
        body,
      });
    } catch {
      return null;
    }
  };
  let res = await attempt();
  if (!res || (!res.ok && (res.status === 429 || res.status >= 500))) res = await attempt();
  if (!res) return { ok: false, error: "resend_network" };
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error(`send-optin-confirmation: Resend ${res.status} ${t}`);
    return { ok: false, error: `resend_${res.status}` };
  }
  return { ok: true };
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function processOptin(payload: unknown, config: OptinConfig): Promise<OptinResult> {
  const p = (payload ?? {}) as { source?: unknown; id?: unknown };
  if (typeof p.source !== "string" || !Object.prototype.hasOwnProperty.call(SOURCES, p.source)) {
    return { ok: false, error: "invalid_source" };
  }
  if (typeof p.id !== "string" || !UUID_RE.test(p.id)) return { ok: false, error: "invalid_id" };
  if (!config.resendApiKey) return { ok: false, error: "resend_not_configured" };

  const table = SOURCES[p.source as OptinSource];
  const row = await fetchRow(table, p.id, config);
  if (!row) return { ok: false, error: "not_found" };
  if (row.consent_marketing !== true || !row.consent_token) return { ok: false, error: "no_consent" };
  if (row.consent_confirmed_at) return { ok: true, state: "already_confirmed" };
  if (row.optin_email_sent_at) return { ok: true, state: "already_sent" };
  if ((await recentSends(table, row.email, config)) >= RATE_LIMIT_PER_DAY) return { ok: false, error: "rate_limited" };
  if (!(await claim(table, row.id, config))) return { ok: true, state: "already_sent" };

  const sent = await sendViaResend(row.email, renderOptinEmail(row, config), config);
  if (!sent.ok) {
    await release(table, row.id, config);
    return { ok: false, error: sent.error ?? "send_failed" };
  }
  return { ok: true, state: "sent" };
}
