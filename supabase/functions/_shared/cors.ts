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

// Orígenes de la app nativa (Capacitor, repo moyiq-ios-capacitor): la vista web
// sirve el paquete desde capacitor://native.moyiq.app en iOS y
// https://native.moyiq.app en Android. Solo los suman las funciones que llama la
// app (no la landing). Hasta el 24-nov-2026 el hostname era localhost; se cambió
// a un subdominio de moyiq.app para que corra el widget de Turnstile (captcha de
// Supabase Auth). Debe coincidir con capacitor.config.json (server.hostname),
// src/native/platform.js (NATIVE_APP_ORIGINS), api/fixer.js e invest-web
// api/_lib/origin.js. Los datos locales dependen de ese origen: no cambiarlo
// después de publicar la app sin una migración probada.
export const NATIVE_APP_ORIGINS = ["capacitor://native.moyiq.app", "https://native.moyiq.app"] as const;

export const BROWSER_ALLOWED_HEADERS = ["authorization", "apikey", "content-type", "x-client-info"] as const;

// SEC-N10: los orígenes de desarrollo (localhost:5173 de Vite, localhost:4323 de la landing)
// ya no están en las listas de producción. Para probar con `supabase functions serve`, se
// declaran en la variable DEV_ORIGINS, separados por coma (vacía o ausente en producción).
// Solo se aceptan http(s)://localhost o 127.0.0.1 con puerto opcional: un valor mal puesto
// no puede abrir el CORS a otro dominio.
const DEV_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

export function parseDevOrigins(raw: string | null | undefined): string[] {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => DEV_ORIGIN_RE.test(s));
}

export function devOrigins(): string[] {
  // deno-lint-ignore no-explicit-any
  const env = (globalThis as any).Deno?.env;
  let raw: string | undefined;
  try { raw = env?.get?.("DEV_ORIGINS"); } catch { raw = undefined; }
  return parseDevOrigins(raw);
}

// Lista de producción + los de desarrollo de DEV_ORIGINS.
export function withDevOrigins(allowedOrigins: readonly string[], dev: readonly string[] = devOrigins()): Set<string> {
  return new Set([...allowedOrigins, ...dev]);
}

export function makeCorsHeaders(
  allowedOrigins: readonly string[],
  fallbackOrigin: string,
  extraHeaders: readonly string[] = [],
  dev: readonly string[] = devOrigins(),
): (origin: string | null) => Record<string, string> {
  const set = withDevOrigins(allowedOrigins, dev);
  const headers = [...BROWSER_ALLOWED_HEADERS, ...extraHeaders].join(", ");
  return (origin) => ({
    "Access-Control-Allow-Origin": origin && set.has(origin) ? origin : fallbackOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": headers,
    Vary: "Origin",
  });
}
