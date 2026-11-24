// CORS de send-feedback (separado de index.ts para poder testearlo).
import { makeCorsHeaders, NATIVE_APP_ORIGINS } from "../_shared/cors.ts";

export const ALLOWED_ORIGINS = [
  ...NATIVE_APP_ORIGINS,
  "https://app.moyiq.app",
] as const;

export const FALLBACK_ORIGIN = "https://app.moyiq.app";

export const corsHeaders = makeCorsHeaders(ALLOWED_ORIGINS, FALLBACK_ORIGIN);

// Turnstile vale para todos los orígenes, también la app de tienda: desde el
// 24-nov-2026 su vista web corre en native.moyiq.app (subdominio del widget) y
// manda el token como la web. La exención por origen de la app nativa
// (V-NAT FN-1, 23-nov) se retiró: el encabezado Origin se falsifica fuera de un
// navegador y dejaba send-feedback sin captcha para quien lo mandara.
