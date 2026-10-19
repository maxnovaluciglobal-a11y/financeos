// Avisos internos de monitoreo (cron-health-alert, uptime-alert): siempre desde
// MOY IQ <hola@moyiq.app> y solo a la casilla de la empresa. Nunca a terceros.
import { resolveResendApiKey } from "./resendKey.ts";

export const ALERT_FROM = "MOY IQ <hola@moyiq.app>";
export const ALERT_TO = "maxnovaluciglobal@gmail.com";

export interface AlertMessage {
  subject: string;
  text: string;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function sendAlertEmail(
  msg: AlertMessage,
  getEnv: (name: string) => string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const key = resolveResendApiKey(getEnv);
  if (!key) return { ok: false, error: "missing_resend_key" };
  const html = `<pre style="font-family:ui-monospace,Menlo,monospace;font-size:13px;white-space:pre-wrap">${escapeHtml(msg.text)}</pre>`;
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: ALERT_FROM, to: [ALERT_TO], subject: msg.subject, text: msg.text, html }),
    });
    if (!res.ok) return { ok: false, status: res.status, error: `resend_${res.status}` };
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, error: `resend_network: ${e instanceof Error ? e.message : String(e)}` };
  }
}
