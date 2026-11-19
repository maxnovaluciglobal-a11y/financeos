// CORS de send-feedback (separado de index.ts para poder testearlo).
import { makeCorsHeaders } from "../_shared/cors.ts";

export const ALLOWED_ORIGINS = [
  "https://app.moyiq.app",
] as const;

export const FALLBACK_ORIGIN = "https://app.moyiq.app";

export const corsHeaders = makeCorsHeaders(ALLOWED_ORIGINS, FALLBACK_ORIGIN);
