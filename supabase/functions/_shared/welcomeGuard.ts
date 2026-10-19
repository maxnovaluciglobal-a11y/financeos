// Tope de bienvenidas por dirección (auditoría 360, C-19 / SEG-1). Antes la
// bienvenida salía una vez por FILA y las filas se creaban sin límite: con un
// ciclo register_* → welcome se mandaban correos ilimitados a cualquiera desde
// @moyiq.app. Ahora sale una sola vez por dirección y tabla, nunca a quien se
// dio de baja con esa dirección, y la fila se "reclama" antes de mandar
// (PATCH condicional) para que dos llamadas simultáneas no manden dos.

export interface WelcomeRow {
  id: string;
  email1_sent_at: string | null;
  unsubscribed_at: string | null;
}

export type WelcomeDecision = "send" | "already_sent" | "unsubscribed" | "address_already_welcomed";

export function decideWelcome(lead: WelcomeRow, sameAddress: WelcomeRow[]): WelcomeDecision {
  if (lead.email1_sent_at) return "already_sent";
  if (lead.unsubscribed_at || sameAddress.some((r) => r.unsubscribed_at)) return "unsubscribed";
  if (sameAddress.some((r) => r.id !== lead.id && r.email1_sent_at)) return "address_already_welcomed";
  return "send";
}

// Patrón de PostgREST `ilike` que coincide con la dirección exacta sin
// distinguir mayúsculas: `_` y `%` son comodines de LIKE y se escapan.
export function ilikeExact(email: string): string {
  return email.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
}

export interface GuardConfig {
  supabaseUrl: string;
  serviceRole: string;
  fetchImpl?: typeof fetch;
}

function headers(config: GuardConfig, extra: Record<string, string> = {}) {
  return { apikey: config.serviceRole, Authorization: `Bearer ${config.serviceRole}`, ...extra };
}

export async function welcomeGate(
  table: string,
  lead: WelcomeRow & { email: string },
  config: GuardConfig,
): Promise<WelcomeDecision> {
  const f = config.fetchImpl ?? fetch;
  const res = await f(
    `${config.supabaseUrl}/rest/v1/${table}?select=id,email1_sent_at,unsubscribed_at` +
      `&email=ilike.${encodeURIComponent(ilikeExact(lead.email))}&limit=50`,
    { headers: headers(config) },
  );
  if (!res.ok) throw new Error(`rest_get_failed_${res.status}`);
  const decision = decideWelcome(lead, (await res.json()) as WelcomeRow[]);
  if (decision !== "send") return decision;

  const claim = await f(
    `${config.supabaseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(lead.id)}&email1_sent_at=is.null`,
    {
      method: "PATCH",
      headers: headers(config, { "Content-Type": "application/json", Prefer: "return=representation" }),
      body: JSON.stringify({ email1_sent_at: new Date().toISOString() }),
    },
  );
  if (!claim.ok) throw new Error(`rest_patch_failed_${claim.status}`);
  const rows = (await claim.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0 ? "send" : "already_sent";
}

// Si el envío falla, se libera la fila para que un reintento pueda mandarla.
export async function releaseWelcome(table: string, id: string, config: GuardConfig): Promise<void> {
  const f = config.fetchImpl ?? fetch;
  try {
    await f(`${config.supabaseUrl}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: headers(config, { "Content-Type": "application/json", Prefer: "return=minimal" }),
      body: JSON.stringify({ email1_sent_at: null }),
    });
  } catch (e) {
    console.error(`welcomeGuard: no se pudo liberar ${table}/${id}: ${e}`);
  }
}
