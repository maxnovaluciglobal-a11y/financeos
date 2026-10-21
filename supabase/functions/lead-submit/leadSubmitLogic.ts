// lead-submit (auditoría 360, SEG-1 / C-19): puerta de entrada con Turnstile
// para los formularios públicos que hoy llaman a las RPC register_* directo
// por PostgREST con la clave publicable. PostgREST no puede verificar un
// captcha, así que el frontend pasa a llamar a esta función:
//
//   POST /functions/v1/lead-submit
//   { "rpc": "register_diagnostico_lead", "args": { "p_email": ..., ... },
//     "turnstileToken": "<token del widget>" }
//
// La función verifica el token (../_shared/turnstile.ts) y llama a la misma
// RPC con el service role, pasando la IP del visitante en x-moyiq-client-ip
// para que private.lead_rate_ok siga limitando por IP (la migración
// 20261021030000_lead_rate_trusted_client_ip.sql solo confía en ese
// encabezado cuando el rol es service_role). Devuelve el status y el JSON de
// la RPC tal cual, así el frontend solo cambia la URL y suma el token.
//
// Cuando el frontend use esta función y TURNSTILE_ENFORCE esté prendido, se
// revoca EXECUTE de anon/authenticated en estas RPC (docs/turnstile.md).

export const LEAD_RPCS = [
  "register_newsletter_signup",
  "register_diagnostico_lead",
  "register_invest_lead",
  "register_tax_calculator_lead",
  "register_starter_lead",
  "register_demo_lead",
  "submit_cancellation_request",
] as const;
export type LeadRpc = typeof LEAD_RPCS[number];

export const MAX_BODY_BYTES = 8 * 1024;
const ARG_NAME = /^p_[a-z_]{1,40}$/;

export interface LeadRequest {
  rpc: LeadRpc;
  args: Record<string, string | number | boolean | null>;
}

export function parseLeadRequest(body: unknown): LeadRequest | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.rpc !== "string" || !(LEAD_RPCS as readonly string[]).includes(b.rpc)) return null;
  const rawArgs = b.args ?? {};
  if (!rawArgs || typeof rawArgs !== "object" || Array.isArray(rawArgs)) return null;
  const args: LeadRequest["args"] = {};
  const entries = Object.entries(rawArgs as Record<string, unknown>);
  if (entries.length > 12) return null;
  for (const [k, v] of entries) {
    if (!ARG_NAME.test(k)) return null;
    if (v !== null && !["string", "number", "boolean"].includes(typeof v)) return null;
    if (typeof v === "number" && !Number.isFinite(v)) return null;
    args[k] = v as string | number | boolean | null;
  }
  return { rpc: b.rpc as LeadRpc, args };
}

export interface RpcConfig {
  supabaseUrl: string;
  serviceRole: string;
  fetchImpl?: typeof fetch;
}

export async function callLeadRpc(
  req: LeadRequest,
  ip: string | null,
  cfg: RpcConfig,
): Promise<{ status: number; body: unknown }> {
  const f = cfg.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    apikey: cfg.serviceRole,
    Authorization: `Bearer ${cfg.serviceRole}`,
    "Content-Type": "application/json",
  };
  if (ip) headers["x-moyiq-client-ip"] = ip;
  try {
    const res = await f(`${cfg.supabaseUrl}/rest/v1/rpc/${req.rpc}`, {
      method: "POST",
      headers,
      body: JSON.stringify(req.args),
    });
    let body: unknown = null;
    try { body = await res.json(); } catch { body = null; }
    // 5xx de PostgREST se devuelve como 502 (withErrorReporting lo registra).
    if (res.status >= 500) return { status: 502, body: { ok: false, error: "upstream_error" } };
    return { status: res.status, body };
  } catch {
    return { status: 502, body: { ok: false, error: "upstream_unavailable" } };
  }
}
