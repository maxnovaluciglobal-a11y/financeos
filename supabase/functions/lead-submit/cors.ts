// CORS de lead-submit: los formularios públicos de la landing, Invest, la app
// y el demo + encabezados comunes de navegador (ver ../_shared/cors.ts).
import { makeCorsHeaders } from "../_shared/cors.ts";

export const ALLOWED_ORIGINS = [
  "https://moyiq.app",
  "https://www.moyiq.app",
  "https://app.moyiq.app",
  "https://demo.moyiq.app",
  "https://invest.moyiq.app",
  "http://localhost:4323",
  "http://localhost:5173",
] as const;

export const FALLBACK_ORIGIN = "https://moyiq.app";
export const EXTRA_HEADERS = ["cf-turnstile-response"] as const;

export const corsHeaders = makeCorsHeaders(ALLOWED_ORIGINS, FALLBACK_ORIGIN, EXTRA_HEADERS);
