// CORS de send-feedback (separado de index.ts para poder testearlo).
import { makeCorsHeaders, NATIVE_APP_ORIGINS } from "../_shared/cors.ts";

export const ALLOWED_ORIGINS = [
  ...NATIVE_APP_ORIGINS,
  "https://app.moyiq.app",
] as const;

export const FALLBACK_ORIGIN = "https://app.moyiq.app";

export const corsHeaders = makeCorsHeaders(ALLOWED_ORIGINS, FALLBACK_ORIGIN);

// V-NAT FN-1 (revisión pre-tiendas, 23-nov-2026): la app de tienda no puede
// mostrar el widget de Turnstile (su origen capacitor://localhost o
// https://localhost no es un hostname del widget `moyiq-forms`). Para esos
// orígenes, send-feedback se apoya en lo que ya exige a todos: la sesión
// verificada contra Auth y el tope por cuenta (claimFeedback / claimNps), el
// mismo criterio que delete-account, que no usa Turnstile. El encabezado Origin
// se puede falsificar fuera de un navegador, pero sin una sesión válida la
// función responde 401 antes de llegar acá, y el tope sigue valiendo.
export function captchaExempt(origin: string | null | undefined): boolean {
  return (NATIVE_APP_ORIGINS as readonly string[]).includes(String(origin || ""));
}
