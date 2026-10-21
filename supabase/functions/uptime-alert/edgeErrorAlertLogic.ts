// Aviso de errores de Edge Functions (auditoría 360, C-11 / OPS-2). Corre
// dentro de uptime-alert, cada 5 min: lee public.edge_function_errors sin
// avisar (las guarda _shared/errorReport.ts cuando una función lanza o responde
// 5xx) y manda UN correo con el resumen por función a la casilla de la empresa.
// Como máximo un correo cada 30 min: lo que llega mientras tanto se junta en el
// siguiente. Si el correo falla, las filas quedan sin marcar y se reintenta.
import { sendAlertEmail, type AlertMessage } from "../_shared/alertEmail.ts";

export const EDGE_ALERT_MIN_GAP_MS = 30 * 60 * 1000;
export const EDGE_ALERT_BATCH = 500;

export interface EdgeErrorRow {
  id: number;
  fn: string;
  status: number | null;
  message: string | null;
  created_at: string;
}

export interface EdgeAlertConfig {
  supabaseUrl: string;
  serviceRole: string;
  getEnv: (name: string) => string | undefined;
  fetchImpl?: typeof fetch;
}

export interface EdgeAlertResult {
  pending: number;
  sent?: boolean;
  skipped?: "throttled" | "dry_run";
  error?: string;
}

const fmt = (iso: string) => new Date(iso).toISOString().replace("T", " ").slice(0, 16) + " UTC";

export function edgeErrorEmail(rows: EdgeErrorRow[]): AlertMessage {
  const byFn = new Map<string, EdgeErrorRow[]>();
  for (const r of rows) byFn.set(r.fn, [...(byFn.get(r.fn) ?? []), r]);
  const fns = [...byFn.entries()].sort((a, b) => b[1].length - a[1].length);
  const lines: string[] = [`${rows.length} error(es) en ${fns.length} Edge Function(s) desde el último aviso.`, ``];
  for (const [fn, list] of fns) {
    const statuses = [...new Set(list.map((r) => r.status ?? "?"))].join(", ");
    const last = list[list.length - 1];
    lines.push(
      `• ${fn}: ${list.length} (HTTP ${statuses}), del ${fmt(list[0].created_at)} al ${fmt(last.created_at)}`,
      `  último: ${last.message || "(sin detalle)"}`,
    );
  }
  lines.push(
    ``,
    `Detalle: select * from public.edge_function_errors order by id desc limit 50;`,
    `Logs: Supabase → Edge Functions → <función> → Logs.`,
    `Se avisa como máximo cada 30 min; ver financeos-app/docs/monitoreo.md.`,
  );
  const top = fns.map(([fn]) => fn).slice(0, 3).join(", ");
  return { subject: `[MOY IQ] errores en Edge Functions: ${rows.length} (${top}${fns.length > 3 ? "…" : ""})`, text: lines.join("\n") };
}

export async function runEdgeErrorAlert(config: EdgeAlertConfig, now: Date, opts: { dryRun?: boolean } = {}): Promise<EdgeAlertResult> {
  const f = config.fetchImpl ?? fetch;
  const headers = { apikey: config.serviceRole, Authorization: `Bearer ${config.serviceRole}` };
  const get = async <T>(path: string): Promise<T> => {
    const res = await f(`${config.supabaseUrl}/rest/v1/${path}`, { headers });
    if (!res.ok) throw new Error(`rest_get_failed_${res.status}`);
    return (await res.json()) as T;
  };

  const rows = await get<EdgeErrorRow[]>(
    `edge_function_errors?notified_at=is.null&select=id,fn,status,message,created_at&order=id.asc&limit=${EDGE_ALERT_BATCH}`,
  );
  if (rows.length === 0) return { pending: 0 };
  if (opts.dryRun) return { pending: rows.length, skipped: "dry_run" };

  const last = await get<{ notified_at: string }[]>(
    "edge_function_errors?notified_at=not.is.null&select=notified_at&order=notified_at.desc&limit=1",
  );
  if (last[0] && now.getTime() - Date.parse(last[0].notified_at) < EDGE_ALERT_MIN_GAP_MS) {
    return { pending: rows.length, skipped: "throttled" };
  }

  const sent = await sendAlertEmail(edgeErrorEmail(rows), config.getEnv, config.fetchImpl);
  if (!sent.ok) {
    console.error(`uptime-alert: no salió el aviso de errores de Edge Functions: ${sent.error}`);
    return { pending: rows.length, sent: false, error: sent.error };
  }
  const maxId = rows[rows.length - 1].id;
  const res = await f(`${config.supabaseUrl}/rest/v1/edge_function_errors?id=lte.${maxId}&notified_at=is.null`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ notified_at: now.toISOString() }),
  });
  if (!res.ok) throw new Error(`rest_patch_failed_${res.status}`);
  return { pending: rows.length, sent: true };
}
