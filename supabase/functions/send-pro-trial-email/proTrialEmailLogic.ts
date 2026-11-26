// supabase/functions/send-pro-trial-email/proTrialEmailLogic.ts
// Correos de la prueba de 14 días de Pro SIN tarjeta (modelo A, D3 del
// 26-nov-2026): bienvenida al empezar, aviso a los 10 días (quedan 4) y "volviste
// a Starter" al terminar sin compra. Los decide la base (pro_trial_emails_due,
// migración 20261126000000) y acá solo se arman y se mandan por Resend.
//
// Idempotencia: cada correo se RECLAMA antes de mandarlo (pro_trial_email_claim,
// una fila por cuenta y paso) y se SUELTA si Resend falla, así un reintento o dos
// corridas a la vez nunca mandan el mismo correo dos veces.
//
// Son correos de servicio sobre el plan de la propia cuenta (cuándo empieza y
// cuándo termina algo que la persona activó), sin publicidad ni precios: no
// llevan baja de marketing, igual que el aviso "tu Pro terminó" de stripe-webhook.
//
// Pruebas: mode "dry_run" (no manda ni reclama nada) y mode "preview" (manda un
// paso a la cuenta de empresa). Las dos exigen x-cron-secret. index.ts es wiring.
import { type EmailLang, pickLang } from "../_shared/emailLang.ts";
import { appLink } from "../_shared/appLinks.ts";
import { COMPANY_POSTAL_HTML } from "../_shared/marketingEmail.ts";
import { emailButton, emailLayout } from "../_shared/emailLayout.ts";
import { htmlToText } from "../_shared/emailText.ts";
import { PRO_TRIAL_STEPS, PRO_TRIAL_TEMPLATES, type ProTrialStep } from "./proTrialTemplates.ts";

export type { ProTrialStep };
export { PRO_TRIAL_STEPS };
export const PREVIEW_ALLOWED = ["maxnovaluciglobal@gmail.com"];
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ProTrialRow {
  user_id: string;
  email: string;
  lang?: string | null;
  step: ProTrialStep;
  started_at: string;
  ends_at: string;
}

export interface ProTrialConfig {
  supabaseUrl: string;
  serviceRole: string;
  resendApiKey?: string;
  fromEmail: string;
  cronSecret?: string;
}

export interface RenderedEmail { subject: string; html: string; text: string }

export function formatEndDate(iso: string, lang: EmailLang): string {
  const locale = { es: "es-CL", en: "en-US", pt: "pt-BR", de: "de-DE" }[lang];
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function daysLeft(endsAt: string, now: number = Date.now()): number {
  return Math.max(1, Math.ceil((new Date(endsAt).getTime() - now) / DAY_MS));
}

const STEP_LINK: Record<ProTrialStep, Parameters<typeof appLink>[0]> = { welcome: "dashboard", day10: "upgrade", ended: "upgrade" };

export function renderProTrialEmail(step: ProTrialStep, row: Pick<ProTrialRow, "lang" | "ends_at">, now: number = Date.now()): RenderedEmail {
  const lang = pickLang(row.lang);
  const T = PRO_TRIAL_TEMPLATES[lang];
  const end = formatEndDate(row.ends_at, lang);
  const copy = step === "welcome" ? T.welcome(end) : step === "day10" ? T.day10(daysLeft(row.ends_at, now), end) : T.ended;
  const html = emailLayout({
    lang,
    bodyHtml: `${copy.paragraphs.map((p) => `<p>${p}</p>`).join("\n      ")}
      ${emailButton(appLink(STEP_LINK[step], `pro-trial-${step}`), copy.cta)}`,
    footerHtml: `${T.why} moyiq · ${COMPANY_POSTAL_HTML}.`,
    title: copy.subject,
  });
  return { subject: copy.subject, html, text: htmlToText(html) };
}

function serviceHeaders(config: ProTrialConfig) {
  return { apikey: config.serviceRole, Authorization: `Bearer ${config.serviceRole}`, "Content-Type": "application/json" };
}

async function rpc<T>(name: string, body: unknown, config: ProTrialConfig, fetchImpl: typeof fetch): Promise<T> {
  const res = await fetchImpl(`${config.supabaseUrl}/rest/v1/rpc/${name}`, { method: "POST", headers: serviceHeaders(config), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`rpc_${name}_${res.status}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export async function sendViaResend(to: string, rendered: RenderedEmail, config: ProTrialConfig, fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; error?: string }> {
  if (!config.resendApiKey) return { ok: false, error: "resend_not_configured" };
  const body = JSON.stringify({ from: config.fromEmail, to, subject: rendered.subject, html: rendered.html, text: rendered.text });
  const attempt = () => fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
    body,
  });
  let res = await attempt();
  if (!res.ok) res = await attempt();
  if (!res.ok) return { ok: false, error: `resend_${res.status}` };
  return { ok: true };
}

export interface CronResult { candidates: number; due: Record<ProTrialStep, number>; sent: number; failed: number; skipped: number; dryRun: boolean }

export async function runProTrialCron(config: ProTrialConfig, { dryRun = false, now = Date.now(), fetchImpl = fetch }: { dryRun?: boolean; now?: number; fetchImpl?: typeof fetch } = {}): Promise<CronResult> {
  const rows = await rpc<ProTrialRow[]>("pro_trial_emails_due", { p_now: new Date(now).toISOString() }, config, fetchImpl);
  const result: CronResult = { candidates: rows?.length ?? 0, due: { welcome: 0, day10: 0, ended: 0 }, sent: 0, failed: 0, skipped: 0, dryRun };
  for (const row of rows ?? []) {
    if (!PRO_TRIAL_STEPS.includes(row.step) || !row.email) continue;
    result.due[row.step]++;
    if (dryRun) continue;
    const claimed = await rpc<boolean>("pro_trial_email_claim", { p_user_id: row.user_id, p_step: row.step }, config, fetchImpl);
    if (!claimed) { result.skipped++; continue; }
    const sent = await sendViaResend(row.email, renderProTrialEmail(row.step, row, now), config, fetchImpl);
    if (sent.ok) { result.sent++; continue; }
    result.failed++;
    console.error(`send-pro-trial-email: ${row.step} falló para ${row.user_id}: ${sent.error}`);
    await rpc("pro_trial_email_release", { p_user_id: row.user_id, p_step: row.step }, config, fetchImpl);
  }
  return result;
}

export const PREVIEW_SUBJECT_PREFIX = "[Vista previa] ";

export async function sendPreview(to: unknown, step: unknown, lang: unknown, config: ProTrialConfig, fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<{ ok: boolean; error?: string }> {
  const addr = String(to ?? "").trim().toLowerCase();
  if (!PREVIEW_ALLOWED.includes(addr)) return { ok: false, error: "recipient_not_allowed" };
  if (!PRO_TRIAL_STEPS.includes(step as ProTrialStep)) return { ok: false, error: "invalid_step" };
  const ends = new Date(now + (step === "day10" ? 4 : step === "ended" ? -1 : 14) * DAY_MS).toISOString();
  const r = renderProTrialEmail(step as ProTrialStep, { lang: String(lang ?? "es"), ends_at: ends }, now);
  return sendViaResend(addr, { ...r, subject: PREVIEW_SUBJECT_PREFIX + r.subject }, config, fetchImpl);
}
