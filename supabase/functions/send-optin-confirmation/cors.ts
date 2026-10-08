// CORS de send-optin-confirmation: orígenes permitidos de esta función + encabezados comunes
// de navegador (ver ../_shared/cors.ts). Separado de index.ts para poder
// testearlo (index.ts lee Deno.env y no se importa desde vitest).
import { makeCorsHeaders } from "../_shared/cors.ts";

export const ALLOWED_ORIGINS = [
  "https://moyiq.app",
  "https://www.moyiq.app",
  "https://app.moyiq.app",
  "https://demo.moyiq.app",
  "https://app.financeospro.com",
  "https://demo.financeospro.com",
  "https://financeospro.com",
  "https://www.financeospro.com",
  "http://localhost:4323",
  "http://localhost:5173",
] as const;

export const FALLBACK_ORIGIN = "https://moyiq.app";
export const EXTRA_HEADERS = [] as const;

export const corsHeaders = makeCorsHeaders(ALLOWED_ORIGINS, FALLBACK_ORIGIN, EXTRA_HEADERS);
