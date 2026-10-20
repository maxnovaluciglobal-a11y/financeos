// supabase/functions/send-trial-activation-email/trialActivationLogic.ts
//
// Secuencia de activación durante la prueba de 14 días de Pro (auditoría 360,
// C-35 / COM-10): correos de los días 1, 3 y 10. La licencia queda marcada como
// prueba al emitirla (stripe-webhook → RPC mark_license_trial) y este módulo
// decide qué correo toca a cada fila que devuelve trial_activation_due().
//
// Son correos de servicio de un producto que la persona empezó a usar (cómo
// sacarle provecho a la prueba y cuándo termina), no publicidad; igual llevan
// baja con un clic (List-Unsubscribe) y un enlace de baja en el pie.
//
// Pruebas: mode "dry_run" (no manda nada, devuelve qué mandaría) y mode
// "preview" (manda un paso a una dirección permitida: solo la cuenta de
// empresa). Las dos exigen x-cron-secret. index.ts es solo wiring.
import { type EmailLang, pickLang } from "../_shared/emailLang.ts";
import { appLink } from "../_shared/appLinks.ts";
import { COMPANY_POSTAL_HTML } from "../_shared/marketingEmail.ts";
import { emailButton, emailLayout } from "../_shared/emailLayout.ts";
import { TRIAL_TEMPLATES, type TrialStep } from "./trialTemplates.ts";

export type { TrialStep };
export const TRIAL_STEPS: TrialStep[] = ["day1", "day3", "day10"];
export const STEP_DAY: Record<TrialStep, number> = { day1: 1, day3: 3, day10: 10 };
export const PREVIEW_ALLOWED = ["maxnovaluciglobal@gmail.com"];

export interface TrialRow {
  id: string;
  email: string;
  lang?: string | null;
  trial_started_at: string;
  trial_ends_at: string;
  day1_sent_at?: string | null;
  day3_sent_at?: string | null;
  day10_sent_at?: string | null;
}

export interface TrialConfig {
  supabaseUrl: string;
  serviceRole: string;
  resendApiKey?: string;
  fromEmail: string;
  cronSecret?: string;
  portalUrl?: string;
  appUrl?: string; // https://app.moyiq.app/app/
}

const DAY_MS = 24 * 60 * 60 * 1000;

// El paso que toca hoy: el más avanzado cuyo día ya llegó y que no se mandó.
// Nunca vuelve atrás (si ya salió el del día 3, el del día 1 no sale), así que
// una fila que se atrasó (cron caído) recibe un solo correo, el que corresponde.
export function dueStep(row: TrialRow, now: number = Date.now()): TrialStep | null {
  const start = new Date(row.trial_started_at).getTime();
  const end = new Date(row.trial_ends_at).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || now >= end) return null;
  const sent = { day1: !!row.day1_sent_at, day3: !!row.day3_sent_at, day10: !!row.day10_sent_at };
  for (let i = TRIAL_STEPS.length - 1; i >= 0; i--) {
    const step = TRIAL_STEPS[i];
    if (now < start + STEP_DAY[step] * DAY_MS) continue;
    if (sent[step]) return null;
    if (TRIAL_STEPS.slice(i + 1).some((s) => sent[s])) return null;
    return step;
  }
  return null;
}

export function formatEndDate(iso: string, lang: EmailLang): string {
  const locale = { es: "es-CL", en: "en-US", pt: "pt-BR", de: "de-DE" }[lang];
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function oneClickUnsubscribeUrl(supabaseUrl: string, id: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/lead-unsubscribe?t=trial&id=${encodeURIComponent(id)}`;
}

// Enlace visible del pie: la página de baja de la app (no la de la landing,
// que no conoce esta tabla).
export function footerUnsubscribeUrl(appUrl: string, id: string): string {
  return `${appUrl}?unsub=trial&id=${encodeURIComponent(id)}`;
}

const STEP_LINK: Record<TrialStep, Parameters<typeof appLink>[0]> = { day1: "import", day3: "upgrade", day10: "dashboard" };

export interface RenderedEmail { subject: string; html: string; headers: Record<string, string> }

export function renderTrialEmail(step: TrialStep, row: TrialRow, config: TrialConfig): RenderedEmail {
  const lang = pickLang(row.lang);
  const T = TRIAL_TEMPLATES[lang];
  const copy = step === "day10" ? T.day10(formatEndDate(row.trial_ends_at, lang)) : T[step];
  const href = appLink(STEP_LINK[step], `trial-${step}`);
  const cancel = step === "day10" ? `<p>${config.portalUrl ? T.cancelPortal(config.portalUrl) : T.cancelNoPortal}</p>` : "";
  const appUrl = config.appUrl ?? "https://app.moyiq.app/app/";
  const html = emailLayout({
    lang,
    bodyHtml: `${copy.paragraphs.map((p) => `<p>${p}</p>`).join("\n      ")}
      ${emailButton(href, copy.cta)}
      ${cancel}`,
    footerHtml: `${T.why} MOY IQ · ${COMPANY_POSTAL_HTML}.
        <a href="${footerUnsubscribeUrl(appUrl, row.id)}">${T.unsubscribe}</a>.`,
  });
  return {
    subject: copy.subject,
    html,
    headers: {
      "List-Unsubscribe": `<${oneClickUnsubscribeUrl(config.supabaseUrl, row.id)}>, <mailto:support@moyiq.app?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

function serviceHeaders(config: TrialConfig) {
  return { apikey: config.serviceRole, Authorization: `Bearer ${config.serviceRole}`, "Content-Type": "application/json" };
}

async function rpc<T>(name: string, body: unknown, config: TrialConfig, fetchImpl: typeof fetch): Promise<T> {
  const res = await fetchImpl(`${config.supabaseUrl}/rest/v1/rpc/${name}`, { method: "POST", headers: serviceHeaders(config), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`rpc_${name}_${res.status}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export async function sendViaResend(to: string, rendered: RenderedEmail, config: TrialConfig, fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; error?: string }> {
  if (!config.resendApiKey) return { ok: false, error: "resend_not_configured" };
  const body = JSON.stringify({ from: config.fromEmail, to, subject: rendered.subject, html: rendered.html, headers: rendered.headers });
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

export interface CronResult { candidates: number; due: Record<TrialStep, number>; sent: number; failed: number; dryRun: boolean }

export async function runTrialCron(config: TrialConfig, { dryRun = false, now = Date.now(), fetchImpl = fetch }: { dryRun?: boolean; now?: number; fetchImpl?: typeof fetch } = {}): Promise<CronResult> {
  const rows = await rpc<TrialRow[]>("trial_activation_due", { p_now: new Date(now).toISOString() }, config, fetchImpl);
  const result: CronResult = { candidates: rows?.length ?? 0, due: { day1: 0, day3: 0, day10: 0 }, sent: 0, failed: 0, dryRun };
  for (const row of rows ?? []) {
    const step = dueStep(row, now);
    if (!step) continue;
    result.due[step]++;
    if (dryRun) continue;
    const sent = await sendViaResend(row.email, renderTrialEmail(step, row, config), config, fetchImpl);
    if (sent.ok) {
      await rpc("mark_trial_activation_sent", { p_id: row.id, p_step: step }, config, fetchImpl);
      result.sent++;
    } else {
      result.failed++;
      console.error(`send-trial-activation-email: ${step} falló para ${row.id}: ${sent.error}`);
    }
  }
  return result;
}

// Vista previa de un paso para revisar el copy: solo a la cuenta de empresa,
// con una fila de mentira (el enlace de baja no da de baja a nadie real).
export async function sendPreview(
  to: unknown, step: unknown, lang: unknown, config: TrialConfig, fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; error?: string }> {
  if (typeof to !== "string" || !PREVIEW_ALLOWED.includes(to.trim().toLowerCase())) return { ok: false, error: "recipient_not_allowed" };
  if (typeof step !== "string" || !(TRIAL_STEPS as string[]).includes(step)) return { ok: false, error: "invalid_step" };
  const now = Date.now();
  const row: TrialRow = {
    id: "00000000-0000-4000-8000-000000000000",
    email: to.trim().toLowerCase(),
    lang: typeof lang === "string" ? lang : "es",
    trial_started_at: new Date(now - STEP_DAY[step as TrialStep] * DAY_MS).toISOString(),
    trial_ends_at: new Date(now + (14 - STEP_DAY[step as TrialStep]) * DAY_MS).toISOString(),
  };
  return sendViaResend(row.email, renderTrialEmail(step as TrialStep, row, config), config, fetchImpl);
}
