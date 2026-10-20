// send-feedback (auditoría 360, C-39 / PRD-5): "Enviar comentarios" del Menú.
// Texto libre, NPS 0–10 opcional y, si la persona lo marca, el registro técnico
// de la app (errores, versión, idioma, país, plan; nunca montos). Llega a
// soporte por Resend con reply-to al email de la cuenta. Exige la sesión y
// tiene un tope por cuenta (feedback_claim): no guarda el mensaje en la base.
import { escapeHtml } from "../_shared/alertEmail.ts";

export const MAX_MESSAGE = 2000;
export const MAX_LOG = 12000;

export interface FeedbackConfig {
  supabaseUrl: string;
  serviceRole: string;
  resendApiKey?: string;
  supportEmail: string;
  fromEmail: string;
}

export interface FeedbackInput {
  kind?: "nps";
  message: string;
  nps: number | null;
  log: string | null;
  meta: Record<string, string>;
}

const META_KEYS = ["version", "lang", "country", "plan", "screen", "trigger"] as const;

export function parseFeedback(body: unknown): FeedbackInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  // kind "nps" (PRD-5): el NPS automático; el puntaje es obligatorio y el comentario, opcional.
  const isNps = b.kind === "nps";
  const message = typeof b.message === "string" ? b.message.trim() : "";
  if ((!message && !isNps) || message.length > MAX_MESSAGE) return null;
  if (isNps && (b.nps === undefined || b.nps === null)) return null;
  let nps: number | null = null;
  if (b.nps !== undefined && b.nps !== null) {
    if (typeof b.nps !== "number" || !Number.isInteger(b.nps) || b.nps < 0 || b.nps > 10) return null;
    nps = b.nps;
  }
  const log = typeof b.log === "string" && b.log.trim() ? b.log.slice(0, MAX_LOG) : null;
  const meta: Record<string, string> = {};
  const rawMeta = b.meta && typeof b.meta === "object" ? b.meta as Record<string, unknown> : {};
  for (const k of META_KEYS) {
    const v = rawMeta[k];
    if (typeof v === "string" && v.trim()) meta[k] = v.trim().slice(0, 40);
  }
  return isNps ? { kind: "nps", message, nps, log, meta } : { message, nps, log, meta };
}

export function bearerToken(header: string | null | undefined): string | null {
  const m = typeof header === "string" ? header.match(/^Bearer\s+(\S+)$/i) : null;
  return m ? m[1] : null;
}

export async function getAuthUser(token: string, config: FeedbackConfig): Promise<{ id: string; email: string | null } | null> {
  if (!token) return null;
  try {
    const res = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: config.serviceRole, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const u = await res.json();
    if (typeof u?.id !== "string" || !u.id) return null;
    return { id: u.id, email: typeof u.email === "string" && u.email ? u.email : null };
  } catch {
    return null;
  }
}

// Tope por cuenta (RPC feedback_claim, service_role): { ok } o { ok:false, error:'rate_limited' }.
export async function claimFeedback(userId: string, config: FeedbackConfig): Promise<"ok" | "rate_limited" | "claim_failed"> {
  try {
    const res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/feedback_claim`, {
      method: "POST",
      headers: { apikey: config.serviceRole, Authorization: `Bearer ${config.serviceRole}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_user_id: userId }),
    });
    if (!res.ok) return "claim_failed";
    const data = await res.json().catch(() => null);
    if (data?.ok === true) return "ok";
    return data?.error === "rate_limited" ? "rate_limited" : "claim_failed";
  } catch {
    return "claim_failed";
  }
}

// NPS automático: una vez por cuenta (RPC nps_claim, migración 20261020080000).
export async function claimNps(userId: string, config: FeedbackConfig): Promise<"ok" | "already_answered" | "claim_failed"> {
  try {
    const res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/nps_claim`, {
      method: "POST",
      headers: { apikey: config.serviceRole, Authorization: `Bearer ${config.serviceRole}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_user_id: userId }),
    });
    if (!res.ok) return "claim_failed";
    const data = await res.json().catch(() => null);
    if (data?.ok === true) return "ok";
    return data?.error === "already_answered" ? "already_answered" : "claim_failed";
  } catch {
    return "claim_failed";
  }
}

export function renderFeedbackEmail(input: FeedbackInput, from: { email: string | null }): { subject: string; text: string; html: string } {
  const nps = input.nps === null ? "sin NPS" : `NPS ${input.nps}`;
  const metaLine = Object.entries(input.meta).map(([k, v]) => `${k}: ${v}`).join(" · ");
  const auto = input.kind === "nps";
  const lines = [
    auto ? `NPS automático de la app (${nps})` : `Comentario desde la app (${nps})`,
    `Cuenta: ${from.email ?? "(sin email)"}`,
    metaLine ? `App: ${metaLine}` : "",
    "",
    input.message || "(sin comentario)",
  ];
  if (input.log) lines.push("", "Registro técnico adjunto:", input.log);
  const text = lines.filter((l, i) => l !== "" || i > 2).join("\n");
  const html = `<pre style="font-family:ui-monospace,Menlo,monospace;font-size:13px;white-space:pre-wrap">${escapeHtml(text)}</pre>`;
  return { subject: auto ? `MOY IQ · NPS automático (${nps})` : `MOY IQ · comentario de la app (${nps})`, text, html };
}

export async function sendFeedbackEmail(
  input: FeedbackInput, user: { email: string | null }, config: FeedbackConfig,
): Promise<{ ok: boolean; error?: string }> {
  if (!config.resendApiKey) return { ok: false, error: "missing_resend_key" };
  const mail = renderFeedbackEmail(input, user);
  const body: Record<string, unknown> = { from: config.fromEmail, to: [config.supportEmail], subject: mail.subject, text: mail.text, html: mail.html };
  if (user.email) body.reply_to = user.email;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok ? { ok: true } : { ok: false, error: `resend_${res.status}` };
  } catch {
    return { ok: false, error: "resend_network" };
  }
}
