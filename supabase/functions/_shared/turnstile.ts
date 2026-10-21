// Cloudflare Turnstile del lado del servidor (auditoría 360, SEG-1). Lo usan
// las funciones que reciben formularios públicos: lead-submit (altas de leads,
// score-check, newsletter, Invest, cancelación) y send-feedback.
// Documentación y site key pública: docs/turnstile.md.
//
// Tres modos, según dos secretos de la función:
//   - sin TURNSTILE_SECRET_KEY            → pasa todo, como antes (modo "apagado").
//   - con secreto y TURNSTILE_ENFORCE off → si llega token se verifica y se
//     escribe el resultado en el log, pero nunca se bloquea (modo "observar",
//     para probar el widget del frontend sin cortar formularios).
//   - con secreto y TURNSTILE_ENFORCE=1   → token ausente o inválido: 403;
//     Cloudflare no responde: 503 (fail-closed; withErrorReporting lo registra).
//
// El token llega en el body JSON (`turnstileToken`, o `cf-turnstile-response`,
// el nombre del campo oculto que agrega el widget) o en el encabezado
// `cf-turnstile-response`. Sin referencias a Deno al cargar: se testea con vitest.

export const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const MAX_TOKEN_LENGTH = 2048;

export interface TurnstileConfig {
  secret?: string | null;
  enforce?: boolean;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export type TurnstileReason =
  | "no_secret"
  | "not_enforced"
  | "valid"
  | "missing_token"
  | "invalid_token"
  | "verify_unavailable";

export interface TurnstileDecision {
  allow: boolean;
  /** HTTP a devolver cuando allow = false. */
  status: 200 | 403 | 503;
  reason: TurnstileReason;
  codes?: string[];
}

export function isEnforced(value: string | null | undefined): boolean {
  return /^(1|true|on|yes)$/i.test((value ?? "").trim());
}

export function turnstileConfigFromEnv(get: (name: string) => string | undefined): TurnstileConfig {
  const secret = (get("TURNSTILE_SECRET_KEY") ?? "").trim();
  return { secret: secret || null, enforce: isEnforced(get("TURNSTILE_ENFORCE")) };
}

export function extractTurnstileToken(body: unknown, headers?: Headers | null): string | null {
  let raw: unknown = null;
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    raw = b.turnstileToken ?? b["cf-turnstile-response"] ?? null;
  }
  if ((raw === null || raw === undefined || raw === "") && headers) raw = headers.get("cf-turnstile-response");
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t && t.length <= MAX_TOKEN_LENGTH ? t : null;
}

/** IP del visitante según los encabezados que pone el proxy de Supabase/Cloudflare. */
export function clientIp(headers: Headers): string | null {
  const t = ((headers.get("cf-connecting-ip") ?? "").trim()
    || (headers.get("x-forwarded-for") ?? "").split(",")[0].trim()
    || (headers.get("x-real-ip") ?? "").trim());
  return t && t.length <= 64 ? t : null;
}

interface SiteverifyResult {
  ok: boolean; // false = no se pudo consultar a Cloudflare
  success: boolean;
  codes: string[];
}

export async function siteverify(
  token: string,
  secret: string,
  opts: { remoteip?: string | null; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<SiteverifyResult> {
  const f = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 5000);
  try {
    const form = new URLSearchParams({ secret, response: token });
    if (opts.remoteip) form.set("remoteip", opts.remoteip);
    const res = await f(SITEVERIFY_URL, { method: "POST", body: form, signal: ctrl.signal });
    if (!res.ok) return { ok: false, success: false, codes: [`http_${res.status}`] };
    const data = await res.json() as { success?: unknown; "error-codes"?: unknown };
    const codes = Array.isArray(data?.["error-codes"]) ? data["error-codes"].filter((c): c is string => typeof c === "string") : [];
    // internal-error = falla de Cloudflare, no del visitante.
    if (data?.success !== true && codes.includes("internal-error")) return { ok: false, success: false, codes };
    return { ok: true, success: data?.success === true, codes };
  } catch (e) {
    return { ok: false, success: false, codes: [e instanceof Error && e.name === "AbortError" ? "timeout" : "network_error"] };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkTurnstile(
  token: string | null,
  cfg: TurnstileConfig,
  remoteip?: string | null,
): Promise<TurnstileDecision> {
  if (!cfg.secret) return { allow: true, status: 200, reason: "no_secret" };

  if (!cfg.enforce) {
    if (token) {
      const r = await siteverify(token, cfg.secret, { remoteip, fetchImpl: cfg.fetchImpl, timeoutMs: cfg.timeoutMs });
      console.log(`turnstile (observar): ${r.ok ? (r.success ? "válido" : "inválido") : "sin respuesta"}${r.codes.length ? ` [${r.codes.join(",")}]` : ""}`);
      return { allow: true, status: 200, reason: "not_enforced", codes: r.codes };
    }
    return { allow: true, status: 200, reason: "not_enforced" };
  }

  if (!token) return { allow: false, status: 403, reason: "missing_token" };
  const r = await siteverify(token, cfg.secret, { remoteip, fetchImpl: cfg.fetchImpl, timeoutMs: cfg.timeoutMs });
  if (!r.ok) return { allow: false, status: 503, reason: "verify_unavailable", codes: r.codes };
  if (!r.success) return { allow: false, status: 403, reason: "invalid_token", codes: r.codes };
  return { allow: true, status: 200, reason: "valid" };
}

/** Cuerpo de la respuesta de rechazo (sin detalles internos). */
export function turnstileErrorBody(d: TurnstileDecision): { ok: false; error: string } {
  return { ok: false, error: d.status === 503 ? "captcha_unavailable" : "captcha_failed" };
}
