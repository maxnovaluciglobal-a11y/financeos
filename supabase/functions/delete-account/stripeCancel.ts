// Cancelación automática en Stripe al borrar la cuenta (auditoría 360, SEG-5).
// Usa STRIPE_RESTRICTED_KEY (clave restringida, solo Subscriptions read/write).
// Sin la clave, el borrado sigue como antes: la suscripción se avisa a soporte
// para cancelarla a mano.
//
// Idempotente: primero lee la suscripción; si ya está cancelada (o no existe)
// no hace nada. Si no, la cancela en el acto (DELETE /v1/subscriptions/:id,
// sin prorrateo ni reembolso). Un fallo nunca frena el borrado: index.ts lo
// registra con errorReport y lo manda en el aviso a soporte.

export const STRIPE_API = "https://api.stripe.com/v1";
const SUB_ID = /^sub_[A-Za-z0-9]{6,64}$/;
const FINAL_STATUSES = new Set(["canceled", "incomplete_expired"]);

export type CancelResult = "canceled" | "already_canceled" | "not_found" | "failed";

export interface CancelOutcome {
  id: string;
  result: CancelResult;
  error?: string;
}

export interface StripeDeps {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

async function stripeCall(
  method: "GET" | "DELETE",
  path: string,
  key: string,
  deps: StripeDeps,
): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const f = deps.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), deps.timeoutMs ?? 8000);
  try {
    const res = await f(`${STRIPE_API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Stripe-Version": "2024-06-20" },
      signal: ctrl.signal,
    });
    let body: Record<string, unknown> | null = null;
    try { body = await res.json(); } catch { body = null; }
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function stripeError(status: number, body: Record<string, unknown> | null): string {
  const err = (body?.error ?? null) as { code?: unknown; type?: unknown } | null;
  const code = typeof err?.code === "string" ? err.code : typeof err?.type === "string" ? err.type : "";
  return `stripe_http_${status}${code ? `_${code}` : ""}`;
}

export async function cancelSubscription(id: string, key: string, deps: StripeDeps = {}): Promise<CancelOutcome> {
  if (!SUB_ID.test(id)) return { id, result: "failed", error: "invalid_subscription_id" };
  const path = `/subscriptions/${encodeURIComponent(id)}`;
  try {
    const got = await stripeCall("GET", path, key, deps);
    if (got.status === 404) return { id, result: "not_found" };
    if (got.status !== 200) return { id, result: "failed", error: stripeError(got.status, got.body) };
    if (FINAL_STATUSES.has(String(got.body?.status ?? ""))) return { id, result: "already_canceled" };

    const del = await stripeCall("DELETE", path, key, deps);
    if (del.status === 200 && FINAL_STATUSES.has(String(del.body?.status ?? ""))) return { id, result: "canceled" };
    if (del.status === 404) return { id, result: "not_found" };
    return { id, result: "failed", error: stripeError(del.status, del.body) };
  } catch (e) {
    return { id, result: "failed", error: e instanceof Error && e.name === "AbortError" ? "stripe_timeout" : "stripe_network_error" };
  }
}

export async function cancelSubscriptions(ids: string[], key: string, deps: StripeDeps = {}): Promise<CancelOutcome[]> {
  const unique = [...new Set(ids)];
  const out: CancelOutcome[] = [];
  for (const id of unique) out.push(await cancelSubscription(id, key, deps));
  return out;
}

/** Suscripciones que siguen pendientes (hay que cancelarlas a mano). */
export function pendingSubscriptions(outcomes: CancelOutcome[]): string[] {
  return outcomes.filter((o) => o.result === "failed").map((o) => o.id);
}
