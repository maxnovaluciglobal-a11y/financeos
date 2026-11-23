// Servicios Web Push a los que las Edge Functions mandan avisos. Es la misma
// lista que public.push_endpoint_allowed (migración 20261123000100): https, sin
// usuario, sin otro puerto que 443 y host de un servicio conocido. send-push la
// usa como segunda barrera (la base ya no guarda otros endpoints) e
// invest-alerts-check agrupa los fallos por proveedor con pushProvider.
// Probado en pushEndpoint.test.ts con los mismos casos que el test SQL.

const HOST_RE = /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)+push\.apple\.com|([a-z0-9-]+\.)+notify\.windows\.com)$/;

export const MAX_PUSH_ENDPOINT = 1024;

export function pushEndpointAllowed(endpoint: unknown): boolean {
  if (typeof endpoint !== "string" || !endpoint || endpoint.length > MAX_PUSH_ENDPOINT) return false;
  if (/[\s\\]/.test(endpoint)) return false;
  const m = /^https:\/\/([^/?#:@]+)(?::443)?\//.exec(endpoint);
  return !!m && HOST_RE.test(m[1].toLowerCase());
}

// Proveedor push de un endpoint. WNS usa un host por nodo
// (wns2-par02p.notify.windows.com) y Apple puede usar varios: se agrupan para
// que un 400/403 se compare con los envíos que sí llegaron al mismo servicio.
export type PushProvider = "fcm" | "mozilla" | "apple" | "wns" | string;
export function pushProvider(endpoint: string): PushProvider {
  let host: string;
  try { host = new URL(endpoint).hostname.toLowerCase(); } catch { return "?"; }
  if (host === "fcm.googleapis.com") return "fcm";
  if (host === "updates.push.services.mozilla.com") return "mozilla";
  if (host === "push.apple.com" || host.endsWith(".push.apple.com")) return "apple";
  if (host === "notify.windows.com" || host.endsWith(".notify.windows.com")) return "wns";
  return host;
}
