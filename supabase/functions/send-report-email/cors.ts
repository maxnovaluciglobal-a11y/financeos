// CORS de send-report-email: orígenes permitidos de esta función + encabezados comunes
// de navegador (ver ../_shared/cors.ts). Separado de index.ts para poder
// testearlo (index.ts lee Deno.env y no se importa desde vitest).
import { makeCorsHeaders } from "../_shared/cors.ts";

export const ALLOWED_ORIGINS = [
  "https://app.moyiq.app",
  "https://demo.moyiq.app",
  "https://app.financeospro.com",
  "https://demo.financeospro.com",
  "http://localhost:5173",
  "http://localhost:4323",
] as const;

export const FALLBACK_ORIGIN = "https://app.moyiq.app";
export const EXTRA_HEADERS = [] as const;

export const corsHeaders = makeCorsHeaders(ALLOWED_ORIGINS, FALLBACK_ORIGIN, EXTRA_HEADERS);
