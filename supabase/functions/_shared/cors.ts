// supabase/functions/_shared/cors.ts
//
// CORS común de las funciones que se llaman desde un navegador (app, demo,
// landing). supabase-js y los fetch de la app mandan `apikey` y
// `Authorization` (y supabase-js también `x-client-info`): si el preflight no
// los permite, el navegador bloquea la llamada sin que la función se entere.
// Pasó en producción (oct-2026): las nurture devolvían solo
// "Content-Type, x-cron-secret" y el email de bienvenida de Starter no salía.
// Cada función conserva su propia lista de orígenes (su cors.ts) y agrega
// encabezados extra si los necesita (x-cron-secret para el cron).

export const BROWSER_ALLOWED_HEADERS = ["authorization", "apikey", "content-type", "x-client-info"] as const;

export function makeCorsHeaders(
  allowedOrigins: readonly string[],
  fallbackOrigin: string,
  extraHeaders: readonly string[] = [],
): (origin: string | null) => Record<string, string> {
  const set = new Set(allowedOrigins);
  const headers = [...BROWSER_ALLOWED_HEADERS, ...extraHeaders].join(", ");
  return (origin) => ({
    "Access-Control-Allow-Origin": origin && set.has(origin) ? origin : fallbackOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": headers,
    Vary: "Origin",
  });
}
