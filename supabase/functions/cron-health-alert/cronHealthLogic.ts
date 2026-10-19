// Lógica de cron-health-alert (auditoría 360, C-12 parte b / OPS-3, DAT-13):
// refresca cron_http_log, lee la vista cron_health y las respuestas HTTP ≠ 2xx
// de las últimas 24 h, y arma el aviso. buildCronHealthReport es pura.
import { sendAlertEmail } from "../_shared/alertEmail.ts";

export interface CronHealthRow {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_http_status: number | null;
  problem: string | null;
  ok: boolean;
}

export interface HttpFailure {
  request_id: number;
  jobname: string | null;
  status_code: number | null;
  timed_out: boolean | null;
  error_msg: string | null;
  content_head: string | null;
  responded_at: string;
}

export interface CronHealthReport {
  problems: string[];
  subject: string | null;
  text: string | null;
}

const PROBLEM_TEXT: Record<string, string> = {
  never_ran: "nunca corrió",
  overdue: "no corrió en su horario",
  sql_failed: "la corrida falló en SQL",
  stuck_running: "lleva más de 15 min corriendo",
  no_http_response: "no hay respuesta HTTP registrada de la última corrida",
  http_timeout: "la llamada HTTP no respondió a tiempo",
  http_error: "la llamada HTTP devolvió un error",
};

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "—";
}

export function buildCronHealthReport(rows: CronHealthRow[], failures: HttpFailure[], now: Date): CronHealthReport {
  const problems: string[] = [];
  for (const r of rows) {
    if (r.ok || !r.active) continue;
    const what = PROBLEM_TEXT[r.problem ?? ""] ?? r.problem ?? "estado desconocido";
    const http = r.last_http_status !== null ? `, último HTTP ${r.last_http_status}` : "";
    problems.push(`- ${r.jobname} (${r.schedule}): ${what}. Última corrida ${fmt(r.last_run_at)} (${r.last_run_status ?? "—"}${http}).`);
  }
  for (const f of failures) {
    const code = f.timed_out ? "timeout" : f.status_code === null ? `error de red${f.error_msg ? ` (${f.error_msg})` : ""}` : `HTTP ${f.status_code}`;
    const body = f.content_head ? ` ${f.content_head.replace(/\s+/g, " ").slice(0, 160)}` : "";
    problems.push(`- ${f.jobname ?? "llamada HTTP sin job (trigger)"}: ${code} a las ${fmt(f.responded_at)}.${body}`);
  }
  if (problems.length === 0) return { problems, subject: null, text: null };
  const text = [
    `Revisión diaria de los jobs de Supabase (${fmt(now.toISOString())}): ${problems.length} problema(s) en las últimas 24 h.`,
    ``,
    ...problems,
    ``,
    `pg_cron marca "succeeded" aunque la función responda 401 o 500: este aviso mira la respuesta HTTP.`,
    `Detalle: select public.cron_health_snapshot(); select * from public.cron_health;`,
    `Guía: financeos-app/docs/monitoreo.md`,
  ].join("\n");
  return { problems, subject: `[MOY IQ] cron con problemas: ${problems.length}`, text };
}

export interface CronHealthConfig {
  supabaseUrl: string;
  serviceRole: string;
  getEnv: (name: string) => string | undefined;
  fetchImpl?: typeof fetch;
}

export async function runCronHealth(config: CronHealthConfig, now: Date, opts: { dryRun?: boolean } = {}) {
  const f = config.fetchImpl ?? fetch;
  const headers = { apikey: config.serviceRole, Authorization: `Bearer ${config.serviceRole}`, "Content-Type": "application/json" };
  const snap = await f(`${config.supabaseUrl}/rest/v1/rpc/cron_health_snapshot`, { method: "POST", headers, body: "{}" });
  if (!snap.ok) throw new Error(`snapshot_failed_${snap.status}`);
  const get = async <T>(path: string): Promise<T> => {
    const res = await f(`${config.supabaseUrl}/rest/v1/${path}`, { headers });
    if (!res.ok) throw new Error(`rest_get_failed_${res.status}`);
    return (await res.json()) as T;
  };
  const rows = await get<CronHealthRow[]>(
    "cron_health?select=jobid,jobname,schedule,active,last_run_at,last_run_status,last_http_status,problem,ok&order=jobname",
  );
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const failures = await get<HttpFailure[]>(
    `cron_http_log?responded_at=gte.${encodeURIComponent(since)}` +
      `&or=(status_code.is.null,status_code.lt.200,status_code.gte.300,timed_out.is.true)` +
      `&select=request_id,jobname,status_code,timed_out,error_msg,content_head,responded_at&order=responded_at.desc&limit=50`,
  );
  const report = buildCronHealthReport(rows, failures, now);
  let sent: boolean | null = null;
  if (report.subject && report.text && !opts.dryRun) {
    const r = await sendAlertEmail({ subject: report.subject, text: report.text }, config.getEnv, config.fetchImpl);
    sent = r.ok;
    if (!r.ok) console.error(`cron-health-alert: no salió el aviso: ${r.error}`);
  }
  return { jobs: rows.length, problems: report.problems, sent };
}
