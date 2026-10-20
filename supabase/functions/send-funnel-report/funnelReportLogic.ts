// supabase/functions/send-funnel-report/funnelReportLogic.ts
//
// Reporte semanal de los 6 números del embudo (auditoría 360, EST-9): visitas,
// altas, activas, pruebas, pagos y bajas de la semana que terminó, con la
// variación contra la anterior y la meta a 90 días de cada número (OKR aprobados por Walter). Va SOLO a
// la cuenta de empresa (REPORT_TO, constante: no hay forma de pedir otro
// destinatario). Los números salen de la RPC funnel_report_data (migración
// 20261020060000), sin cuentas internas ni de prueba.
//
// Modos (todos con x-cron-secret): "cron" manda solo si en Chile son las 12 y
// la semana no se envió; "dry_run" devuelve los datos y el asunto sin mandar;
// "preview" manda una copia marcada como vista previa sin registrar la semana.
import { emailLayout, EMAIL_BRAND, EMAIL_FONTS, EMAIL_MUTED_STYLE } from "../_shared/emailLayout.ts";

export const REPORT_TO = "maxnovaluciglobal@gmail.com";
export const REPORT_TZ = "America/Santiago";
export const REPORT_HOUR = 12;

export type MetricKey = "visitas" | "altas" | "activas" | "pruebas" | "pagos" | "bajas";
export type Metrics = Record<MetricKey, number | null>;

export interface LeadRow { etapa: string; emails: number; confirmados: number }

export interface ReportData {
  week_start: string;
  current: Metrics;
  previous: Metrics;
  previous_is_snapshot: boolean;
  already_sent: boolean;
  leads: LeadRow[];
  leads_previous: LeadRow[];
}

export interface ReportConfig {
  supabaseUrl: string;
  serviceRole: string;
  resendApiKey?: string;
  fromEmail: string;
  cronSecret?: string;
}

// Metas: OKR a 90 días (19-oct-2026 → 17-ene-2027) del plan de acción de la
// auditoría 360 (32-PLAN-DE-ACCION.md 1.1/3.1; detalle en 10-estrategia §8),
// aprobadas por Walter el 20-oct. Donde el OKR no da número, va el objetivo en texto.
export const GOAL_DEADLINE = "17-ene-2027";
export const METRIC_ROWS: { key: MetricKey; label: string; help: string; goal: string }[] = [
  { key: "visitas", label: "Visitas a la landing", help: "Vercel Web Analytics; la base no las ve", goal: "sin número: encontrar un canal que traiga ≥ 30 % de las altas, con sus horas medidas" },
  { key: "altas", label: "Altas", help: "cuentas nuevas (MOY IQ e Invest comparten cuentas)", goal: "300 cuentas Starter reales (≈ 23 por semana)" },
  { key: "activas", label: "Activas", help: "cuentas con sesión iniciada en la semana", goal: "40 % de las cuentas nuevas con ≥ 10 movimientos en sus primeros 7 días" },
  { key: "pruebas", label: "Pruebas Pro iniciadas", help: "licencias de prueba emitidas", goal: "sin número: el camino a los 10 pagos" },
  { key: "pagos", label: "Pagos", help: "compras directas y pruebas que pasaron a pago", goal: "10 suscriptores Pro con al menos un cobro (con menos de 5, MOY IQ pasa a mantenimiento)" },
  { key: "bajas", label: "Bajas", help: "pedidos de cancelación recibidos", goal: "sin número: conocer el motivo de cada baja" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

// Lunes (UTC) de la semana que terminó antes de `now`: la que se reporta.
export function reportWeekStart(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // lunes = 0
  return new Date(d.getTime() - (dow + 7) * DAY_MS).toISOString().slice(0, 10);
}

export function hourIn(tz: string, now: Date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(now);
  return Number(h) % 24;
}

export function weekLabel(weekStart: string): string {
  const d0 = new Date(`${weekStart}T00:00:00Z`);
  const d1 = new Date(d0.getTime() + 6 * DAY_MS);
  const f = (d: Date) => new Intl.DateTimeFormat("es", { day: "numeric", month: "short", timeZone: "UTC" }).format(d).replace(".", "");
  return `${f(d0)} al ${f(d1)} de ${d1.getUTCFullYear()}`;
}

// "+3 (+50 %)", "−2 (−40 %)", "sin cambio", "s/d".
export function variation(cur: number | null, prev: number | null): string {
  if (cur == null || prev == null) return "s/d";
  const diff = cur - prev;
  if (diff === 0) return "sin cambio";
  const sign = diff > 0 ? "+" : "−";
  const pct = prev > 0 ? ` (${sign}${Math.round(Math.abs(diff) / prev * 100)} %)` : "";
  return `${sign}${Math.abs(diff)}${pct}`;
}

const fmt = (n: number | null) => (n == null ? "s/d" : String(n));

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const TH = `style="text-align:left;padding:8px 10px;border-bottom:2px solid ${EMAIL_BRAND.navy};font-family:${EMAIL_FONTS.body};font-size:12px;letter-spacing:.5px;text-transform:uppercase;color:${EMAIL_BRAND.navy}"`;
const THR = TH.replace("text-align:left", "text-align:right");
const TD = `style="padding:8px 10px;border-bottom:1px solid ${EMAIL_BRAND.papelDeep};vertical-align:top"`;
const TDN = `style="padding:8px 10px;border-bottom:1px solid ${EMAIL_BRAND.papelDeep};text-align:right;font-family:${EMAIL_FONTS.mono};font-variant-numeric:tabular-nums;white-space:nowrap"`;

function varColor(cur: number | null, prev: number | null, key: MetricKey): string {
  if (cur == null || prev == null || cur === prev) return EMAIL_BRAND.muted;
  const up = cur > prev;
  const good = key === "bajas" ? !up : up;
  return good ? EMAIL_BRAND.pos : EMAIL_BRAND.neg;
}

export function renderReport(data: ReportData, opts: { preview?: boolean } = {}): { subject: string; html: string } {
  const label = weekLabel(data.week_start);
  const subject = `${opts.preview ? "[Vista previa] " : ""}MOY IQ · embudo semanal · ${label}`;
  const rows = METRIC_ROWS.map(({ key, label: l, help, goal }) => {
    const cur = data.current[key];
    const prev = data.previous[key];
    return `<tr><td ${TD}><strong style="color:${EMAIL_BRAND.navy}">${l}</strong><br><span style="${EMAIL_MUTED_STYLE}">${help}</span>`
      + `<br><span style="font-size:12px;color:${EMAIL_BRAND.laton700}">Meta al ${GOAL_DEADLINE}: ${goal}</span></td>`
      + `<td ${TDN}>${fmt(cur)}</td><td ${TDN}>${fmt(prev)}</td>`
      + `<td ${TDN}><span style="color:${varColor(cur, prev, key)}">${variation(cur, prev)}</span></td></tr>`;
  }).join("\n");
  const goals = `<tr><td ${TD} colspan="4"><span style="${EMAIL_MUTED_STYLE}">Metas: OKR a 90 días del plan de acción (19-oct-2026 al ${GOAL_DEADLINE}). Además: 300 suscriptores confirmados al newsletter y 30 conversaciones con el segmento "dos monedas" registradas en el CRM.</span></td></tr>`;
  const prevLeads = new Map(data.leads_previous.map((r) => [r.etapa, r]));
  const leadRows = data.leads.length
    ? data.leads.map((r) => `<tr><td ${TD}>${esc(r.etapa)}</td><td ${TDN}>${r.emails}</td><td ${TDN}>${r.confirmados}</td><td ${TDN}>${variation(r.emails, prevLeads.get(r.etapa)?.emails ?? 0)}</td></tr>`).join("\n")
    : `<tr><td ${TD} colspan="4"><span style="${EMAIL_MUTED_STYLE}">Sin leads nuevos esta semana.</span></td></tr>`;
  const body = `
<p style="margin:0 0 4px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${EMAIL_BRAND.laton700};font-weight:600">Reporte semanal</p>
<h1>Embudo del ${label}</h1>
<p>Semana de lunes a domingo (UTC), sin cuentas internas ni de prueba. La variación compara con la semana anterior${data.previous_is_snapshot ? " (foto guardada al enviarla)" : ""}.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:16px 0 8px">
<tr><th ${TH}>Número</th><th ${THR}>Semana</th><th ${THR}>Anterior</th><th ${THR}>Variación</th></tr>
${rows}
${goals}
</table>
<h2>Leads por origen</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:8px 0 16px">
<tr><th ${TH}>Origen</th><th ${THR}>Emails</th><th ${THR}>Confirmados</th><th ${THR}>Variación</th></tr>
${leadRows}
</table>
<p style="${EMAIL_MUTED_STYLE}">"Activas" no es la activación de EST-9 (10 movimientos en 7 días): los movimientos no salen del dispositivo, así que el servidor no puede contarlos. Visitas queda sin dato hasta que Web Analytics esté habilitado y se lea desde Vercel.</p>`;
  const footer = `Reporte interno de MOY IQ, solo para ${REPORT_TO}. Lo envía la función send-funnel-report los lunes a las 12 (hora de Chile).`;
  return { subject, html: emailLayout({ lang: "es", bodyHtml: body, footerHtml: footer, preheader: `Altas ${fmt(data.current.altas)} · Pruebas ${fmt(data.current.pruebas)} · Pagos ${fmt(data.current.pagos)}`, title: subject }) };
}

function serviceHeaders(config: ReportConfig) {
  return { apikey: config.serviceRole, Authorization: `Bearer ${config.serviceRole}`, "Content-Type": "application/json" };
}

async function rpc<T>(name: string, body: unknown, config: ReportConfig, fetchImpl: typeof fetch): Promise<T> {
  const res = await fetchImpl(`${config.supabaseUrl}/rest/v1/rpc/${name}`, { method: "POST", headers: serviceHeaders(config), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`rpc_${name}_${res.status}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export async function sendViaResend(rendered: { subject: string; html: string }, config: ReportConfig, fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; error?: string }> {
  if (!config.resendApiKey) return { ok: false, error: "resend_not_configured" };
  const body = JSON.stringify({ from: config.fromEmail, to: REPORT_TO, subject: rendered.subject, html: rendered.html });
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

export type RunResult =
  | { status: "skipped"; reason: "not_send_hour" | "already_sent"; week_start: string }
  | { status: "dry_run"; week_start: string; subject: string; data: ReportData }
  | { status: "sent"; week_start: string; preview: boolean }
  | { status: "error"; week_start: string; error: string };

export async function runReport(
  mode: "cron" | "dry_run" | "preview",
  config: ReportConfig,
  { now = new Date(), fetchImpl = fetch }: { now?: Date; fetchImpl?: typeof fetch } = {},
): Promise<RunResult> {
  const week = reportWeekStart(now);
  if (mode === "cron" && hourIn(REPORT_TZ, now) !== REPORT_HOUR) return { status: "skipped", reason: "not_send_hour", week_start: week };
  const data = await rpc<ReportData>("funnel_report_data", { p_week_start: week }, config, fetchImpl);
  if (mode === "cron" && data.already_sent) return { status: "skipped", reason: "already_sent", week_start: week };
  const rendered = renderReport(data, { preview: mode === "preview" });
  if (mode === "dry_run") return { status: "dry_run", week_start: week, subject: rendered.subject, data };
  const sent = await sendViaResend(rendered, config, fetchImpl);
  if (!sent.ok) return { status: "error", week_start: week, error: sent.error ?? "send_failed" };
  if (mode === "cron") await rpc<boolean>("funnel_report_mark_sent", { p_week_start: week, p_metrics: data.current }, config, fetchImpl);
  return { status: "sent", week_start: week, preview: mode === "preview" };
}
