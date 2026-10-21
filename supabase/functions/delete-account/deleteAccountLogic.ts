// delete-account (auditoría 360, C-22 / SEG-5): borrado de la cuenta por
// autoservicio desde Ajustes. index.ts solo lee Deno.env y conecta; la lógica
// vive acá para testearla desde vitest con fetch mockeado.
//
// Orden: 1) la sesión se verifica contra Auth (el id y el email salen del
// token, nunca del body); 2) delete_account_data borra en una transacción las
// filas de la cuenta en todas las tablas (ver la migración
// 20261020000000_account_self_deletion.sql); 3) se borra auth.users con la API
// de administración. Si el paso 3 falla, los datos ya no están y un reintento
// lo completa (los dos pasos son idempotentes).
// Las suscripciones de Stripe activas se cancelan solas si existe
// STRIPE_RESTRICTED_KEY (ver ./stripeCancel.ts, SEG-5). Lo que no se pudo hacer
// solo (una cancelación que falló o sin clave, quitar el contacto del newsletter
// en Resend) se avisa a soporte sin bloquear el borrado.

import { cancelSubscriptions, pendingSubscriptions, type CancelOutcome, type StripeDeps } from "./stripeCancel.ts";

export const CONFIRM_WORD = "DELETE";

export interface DeleteConfig {
  supabaseUrl: string;
  serviceRole: string;
}

export interface DeleteResult {
  ok: boolean;
  status: number;
  error?: string;
  stripeSubscriptions?: string[];
  /** Cancelada/s en Stripe por la función (SEG-5). */
  stripeCanceled?: string[];
  /** true si se intentó cancelar en Stripe y alguna falló. */
  stripeAutoFailed?: boolean;
  newsletterFollowup?: boolean;
}

export function bearerToken(header: string | null | undefined): string | null {
  const m = typeof header === "string" ? header.match(/^Bearer\s+(\S+)$/i) : null;
  return m ? m[1] : null;
}

export function isConfirmed(body: unknown): boolean {
  return !!body && typeof body === "object" && (body as { confirm?: unknown }).confirm === CONFIRM_WORD;
}

export async function getAuthUser(
  token: string,
  config: DeleteConfig,
): Promise<{ id: string; email: string | null } | null> {
  if (!token) return null;
  try {
    const res = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: config.serviceRole, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = await res.json();
    if (typeof user?.id !== "string" || !user.id) return null;
    return { id: user.id, email: typeof user.email === "string" && user.email ? user.email : null };
  } catch {
    return null;
  }
}

function serviceHeaders(config: DeleteConfig) {
  return {
    apikey: config.serviceRole,
    Authorization: `Bearer ${config.serviceRole}`,
    "Content-Type": "application/json",
  };
}

export async function deleteAccount(
  user: { id: string; email: string | null },
  config: DeleteConfig,
): Promise<DeleteResult> {
  let data: { ok?: boolean; stripe_subscriptions?: unknown; newsletter_followup?: unknown } | null = null;
  try {
    const res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/delete_account_data`, {
      method: "POST",
      headers: serviceHeaders(config),
      body: JSON.stringify({ p_user_id: user.id, p_email: user.email }),
    });
    if (!res.ok) return { ok: false, status: 503, error: "data_delete_failed" };
    data = await res.json();
  } catch {
    return { ok: false, status: 503, error: "data_delete_failed" };
  }
  if (!data || data.ok !== true) return { ok: false, status: 503, error: "data_delete_failed" };

  try {
    const res = await fetch(`${config.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
      method: "DELETE",
      headers: serviceHeaders(config),
    });
    if (!res.ok && res.status !== 404) return { ok: false, status: 503, error: "auth_delete_failed" };
  } catch {
    return { ok: false, status: 503, error: "auth_delete_failed" };
  }

  const subs = Array.isArray(data.stripe_subscriptions)
    ? data.stripe_subscriptions.filter((s): s is string => typeof s === "string" && s.length > 0)
    : [];
  return { ok: true, status: 200, stripeSubscriptions: subs, newsletterFollowup: data.newsletter_followup === true };
}

// SEG-5: con la clave restringida de Stripe, cancela las suscripciones activas
// que devolvió delete_account_data. Cada fallo se informa con onFailure (en
// index.ts: log + edge_function_errors) y queda en stripeSubscriptions para el
// aviso a soporte. Sin clave, no toca nada (paso manual como antes).
export async function cancelStripeAfterDelete(
  result: DeleteResult,
  stripeKey: string | null | undefined,
  onFailure: (o: CancelOutcome) => void | Promise<void>,
  deps: StripeDeps = {},
): Promise<DeleteResult> {
  const subs = result.stripeSubscriptions ?? [];
  if (!result.ok || subs.length === 0 || !stripeKey) return result;
  const outcomes = await cancelSubscriptions(subs, stripeKey, deps);
  for (const o of outcomes) {
    if (o.result === "failed") await onFailure(o);
    else console.log(`delete-account: Stripe ${o.id} → ${o.result}`);
  }
  const pending = pendingSubscriptions(outcomes);
  return {
    ...result,
    stripeSubscriptions: pending,
    stripeCanceled: outcomes.filter((o) => o.result !== "failed").map((o) => o.id),
    stripeAutoFailed: pending.length > 0,
  };
}

// Aviso a soporte solo cuando queda un paso manual. Lleva el email solo si hay
// que quitarlo del newsletter (no hay otra forma de encontrar el contacto en
// Resend); para Stripe alcanza con el id de la suscripción.
export function followupMessage(
  result: DeleteResult,
  email: string | null,
): { subject: string; text: string } | null {
  const subs = result.stripeSubscriptions ?? [];
  const news = result.newsletterFollowup === true && !!email;
  if (!result.ok || (subs.length === 0 && !news)) return null;
  const lines = ["Una cuenta de MOY IQ se borró desde Ajustes. Los datos del servidor ya no están; falta:", ""];
  if (subs.length) {
    lines.push(result.stripeAutoFailed
      ? "- La cancelación automática en Stripe falló (ver edge_function_errors). Cancelar a mano, sin reembolso salvo pedido:"
      : "- Cancelar en Stripe (cuenta MOY IQ) estas suscripciones, sin reembolso salvo pedido:");
    for (const s of subs) lines.push(`    ${s}`);
  }
  if (news) lines.push(`- Quitar del newsletter (Resend) el contacto: ${email}`);
  lines.push("", "Después de hacerlo, borrar este correo.");
  return { subject: "MOY IQ · borrado de cuenta: paso manual pendiente", text: lines.join("\n") };
}
