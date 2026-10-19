// I/O de uptime-alert: lee sitios, estado y chequeos con service_role (REST),
// decide con ../_shared/uptimeState.ts y manda el correo. Si el correo falla no
// guarda el cambio de estado, así la próxima corrida lo vuelve a intentar.
import { decideUptime, uptimeEmail, type UptimeCheck, type UptimeState } from "../_shared/uptimeState.ts";
import { sendAlertEmail } from "../_shared/alertEmail.ts";

export interface UptimeAlertConfig {
  supabaseUrl: string;
  serviceRole: string;
  getEnv: (name: string) => string | undefined;
  fetchImpl?: typeof fetch;
}

export interface SiteResult {
  site: string;
  status: "up" | "down";
  action: string | null;
  sent?: boolean;
  error?: string;
}

const CHECKS_PER_SITE = 6;

function rest(config: UptimeAlertConfig) {
  const f = config.fetchImpl ?? fetch;
  const headers = { apikey: config.serviceRole, Authorization: `Bearer ${config.serviceRole}` };
  return {
    async get<T>(path: string): Promise<T> {
      const res = await f(`${config.supabaseUrl}/rest/v1/${path}`, { headers });
      if (!res.ok) throw new Error(`rest_get_failed_${res.status}`);
      return (await res.json()) as T;
    },
    async upsertState(state: UptimeState): Promise<void> {
      const res = await f(`${config.supabaseUrl}/rest/v1/uptime_state?on_conflict=site`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ ...state, updated_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`rest_upsert_failed_${res.status}`);
    },
  };
}

export async function runUptimeAlert(config: UptimeAlertConfig, now: Date, opts: { dryRun?: boolean } = {}): Promise<SiteResult[]> {
  const db = rest(config);
  const sites = await db.get<{ site: string; url: string }[]>("uptime_sites?enabled=eq.true&select=site,url&order=site");
  const states = await db.get<UptimeState[]>(
    "uptime_state?select=site,status,consecutive_failures,down_since,last_alert_at,last_change_at,last_check_id",
  );
  const bySite = new Map(states.map((s) => [s.site, s]));
  const out: SiteResult[] = [];

  for (const { site, url } of sites) {
    const checks = await db.get<UptimeCheck[]>(
      `uptime_checks?site=eq.${encodeURIComponent(site)}&evaluated_at=not.is.null` +
        `&select=id,requested_at,ok,status_code,timed_out,marker_found,error_msg&order=id.desc&limit=${CHECKS_PER_SITE}`,
    );
    const d = decideUptime(bySite.get(site) ?? null, site, checks, now);
    const r: SiteResult = { site, status: d.state.status, action: d.action };
    if (opts.dryRun) {
      out.push(r);
      continue;
    }
    if (d.action) {
      const sent = await sendAlertEmail(uptimeEmail(d.action, site, url, d.state, checks[0], now), config.getEnv, config.fetchImpl);
      r.sent = sent.ok;
      if (!sent.ok) {
        r.error = sent.error;
        console.error(`uptime-alert: no salió el aviso ${d.action} de ${site}: ${sent.error}`);
        out.push(r);
        continue;
      }
    }
    if (d.changed) await db.upsertState(d.state);
    out.push(r);
  }
  return out;
}
