// CORS de send-nurture-invest-email: orígenes permitidos de esta función + encabezados comunes
// de navegador (ver ../_shared/cors.ts). Separado de index.ts para poder
// testearlo (index.ts lee Deno.env y no se importa desde vitest).
import { makeCorsHeaders } from "../_shared/cors.ts";

export const ALLOWED_ORIGINS = [
  "https://invest.moyiq.app",
  "https://www.invest.moyiq.app",
  "https://invest.financeospro.com",
  "http://localhost:4323",
  "http://localhost:5173",
] as const;

export const FALLBACK_ORIGIN = "https://invest.moyiq.app";
export const EXTRA_HEADERS = ["x-cron-secret"] as const;

export const corsHeaders = makeCorsHeaders(ALLOWED_ORIGINS, FALLBACK_ORIGIN, EXTRA_HEADERS);
