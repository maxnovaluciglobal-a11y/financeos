// Máquina de estados de uptime-alert (auditoría 360, C-11 / OPS-2). Pura: recibe
// el estado guardado de un sitio y sus últimos chequeos evaluados (el más nuevo
// primero) y devuelve el estado nuevo y qué correo mandar, si alguno.
//
// - Caída: 2 chequeos seguidos fallidos (status ≠ 200, timeout o sin el marker).
//   Un correo, no uno por chequeo.
// - Mientras siga caído: un recordatorio cada 6 h.
// - Recuperación: el primer chequeo bueno después de una caída avisada.

export const FAILURES_TO_ALERT = 2;
export const REMINDER_EVERY_MS = 6 * 60 * 60 * 1000;

export interface UptimeCheck {
  id: number;
  requested_at: string;
  ok: boolean;
  status_code: number | null;
  timed_out: boolean | null;
  marker_found: boolean | null;
  error_msg: string | null;
}

export interface UptimeState {
  site: string;
  status: "up" | "down";
  consecutive_failures: number;
  down_since: string | null;
  last_alert_at: string | null;
  last_change_at: string | null;
  last_check_id: number | null;
}

export type UptimeAction = "down" | "reminder" | "recovery" | null;

export interface UptimeDecision {
  state: UptimeState;
  action: UptimeAction;
  changed: boolean;
}

export function initialState(site: string): UptimeState {
  return { site, status: "up", consecutive_failures: 0, down_since: null, last_alert_at: null, last_change_at: null, last_check_id: null };
}

function leadingFailures(checks: UptimeCheck[]): UptimeCheck[] {
  const out: UptimeCheck[] = [];
  for (const c of checks) {
    if (c.ok) break;
    out.push(c);
  }
  return out;
}

export function decideUptime(prev: UptimeState | null, site: string, checksNewestFirst: UptimeCheck[], now: Date): UptimeDecision {
  const base = prev ?? initialState(site);
  const newest = checksNewestFirst[0];
  if (!newest || (base.last_check_id !== null && newest.id <= base.last_check_id && base.status === "up")) {
    return { state: base, action: null, changed: false };
  }
  const nowIso = now.toISOString();
  const failing = leadingFailures(checksNewestFirst);
  const next: UptimeState = { ...base, consecutive_failures: failing.length, last_check_id: newest.id };

  if (base.status === "down") {
    if (newest.ok) {
      return {
        state: { ...next, status: "up", down_since: null, last_change_at: nowIso },
        action: "recovery",
        changed: true,
      };
    }
    const lastAlert = base.last_alert_at ? Date.parse(base.last_alert_at) : 0;
    if (now.getTime() - lastAlert >= REMINDER_EVERY_MS) {
      return { state: { ...next, last_alert_at: nowIso }, action: "reminder", changed: true };
    }
    return { state: next, action: null, changed: next.consecutive_failures !== base.consecutive_failures || next.last_check_id !== base.last_check_id };
  }

  if (failing.length >= FAILURES_TO_ALERT) {
    const firstFailure = failing[failing.length - 1];
    return {
      state: { ...next, status: "down", down_since: firstFailure.requested_at, last_alert_at: nowIso, last_change_at: nowIso },
      action: "down",
      changed: true,
    };
  }
  return { state: next, action: null, changed: next.consecutive_failures !== base.consecutive_failures || next.last_check_id !== base.last_check_id };
}

export function describeCheck(c: UptimeCheck | undefined): string {
  if (!c) return "sin chequeos";
  if (c.ok) return `HTTP ${c.status_code}, contenido correcto`;
  if (c.timed_out) return `sin respuesta (timeout)${c.error_msg ? `: ${c.error_msg}` : ""}`;
  if (c.status_code === null) return `error de red${c.error_msg ? `: ${c.error_msg}` : ""}`;
  if (c.status_code !== 200) return `HTTP ${c.status_code}`;
  return `HTTP 200 pero sin el contenido esperado (marker)`;
}

export function uptimeEmail(action: Exclude<UptimeAction, null>, site: string, url: string, state: UptimeState, latest: UptimeCheck | undefined, now: Date) {
  const since = state.down_since ? new Date(state.down_since).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "—";
  const mins = state.down_since ? Math.max(0, Math.round((now.getTime() - Date.parse(state.down_since)) / 60000)) : 0;
  const subject =
    action === "down" ? `[MOY IQ] caída: ${site}`
    : action === "reminder" ? `[MOY IQ] sigue caído: ${site}`
    : `[MOY IQ] recuperado: ${site}`;
  const lines =
    action === "recovery"
      ? [`${site} volvió a responder bien.`, ``, `URL: ${url}`, `Último chequeo: ${describeCheck(latest)}`]
      : [
          action === "down" ? `${site} falló ${state.consecutive_failures} chequeos seguidos.` : `${site} sigue caído (hace ${mins} min).`,
          ``,
          `URL: ${url}`,
          `Caído desde: ${since}`,
          `Último chequeo: ${describeCheck(latest)}`,
          ``,
          `Se vuelve a avisar cada 6 h mientras siga caído, y una vez cuando se recupere.`,
        ];
  lines.push(``, `Monitoreo desde Supabase (pg_cron + pg_net cada 5 min). Estado: select * from public.uptime_status;`, `Cómo pausarlo: financeos-app/docs/monitoreo.md`);
  return { subject, text: lines.join("\n") };
}
