// lead-unsubscribe (auditoría 360, C-35 / COM-9): destino de la cabecera
// List-Unsubscribe de los nurtures.
//   POST ?t=<tabla>&id=<uuid>  → baja con un clic (RFC 8058): llama al mismo
//                                RPC unsubscribe_* que usa unsubscribe.html.
//   GET  ?t=<tabla>&id=<uuid>  → 303 a la página de baja de la landing, que
//                                hace lo mismo y muestra el resultado.
// Mismo nivel de acceso que la página de baja: el id del lead (uuid) es la
// credencial, y los RPC ya son públicos.
import { UNSUBSCRIBE_TABLES, type UnsubscribeTable } from "../_shared/marketingEmail.ts";

export const RPC_BY_TABLE: Record<UnsubscribeTable, string> = {
  starter: "unsubscribe_starter_lead",
  diagnostico: "unsubscribe_diagnostico_lead",
  invest: "unsubscribe_invest_lead",
  demo: "unsubscribe_demo_lead",
  trial: "unsubscribe_trial_activation",
};

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseTarget(url: string): { table: UnsubscribeTable; id: string } | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const table = u.searchParams.get("t") ?? "";
  const id = u.searchParams.get("id") ?? "";
  if (!(UNSUBSCRIBE_TABLES as readonly string[]).includes(table) || !UUID_RE.test(id)) return null;
  return { table: table as UnsubscribeTable, id };
}

// La página de baja de la landing no conoce la secuencia de la prueba: esa
// baja se muestra en la app (?unsub=trial&id=…).
export const APP_UNSUBSCRIBE_URL = "https://app.moyiq.app/app/";

export function landingUnsubscribeUrl(landingUrl: string, table: UnsubscribeTable, id: string): string {
  if (table === "trial") return `${APP_UNSUBSCRIBE_URL}?unsub=trial&id=${encodeURIComponent(id)}`;
  return `${landingUrl.replace(/\/$/, "")}/unsubscribe.html?id=${encodeURIComponent(id)}&t=${table}`;
}

export async function unsubscribeLead(
  table: UnsubscribeTable,
  id: string,
  config: { supabaseUrl: string; serviceRole: string },
): Promise<boolean> {
  const res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${RPC_BY_TABLE[table]}`, {
    method: "POST",
    headers: {
      apikey: config.serviceRole,
      Authorization: `Bearer ${config.serviceRole}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_id: id }),
  });
  if (!res.ok) return false;
  const data = await res.json().catch(() => null);
  return data?.ok === true;
}
