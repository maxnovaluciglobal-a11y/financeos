// CORS de send-feedback (separado de index.ts para poder testearlo).
import { makeCorsHeaders, NATIVE_APP_ORIGINS } from "../_shared/cors.ts";

export const ALLOWED_ORIGINS = [
  ...NATIVE_APP_ORIGINS,
  "https://app.moyiq.app",
  "http://localhost:5173",
  "http://localhost:4323",
] as const;

export const FALLBACK_ORIGIN = "https://app.moyiq.app";

export const corsHeaders = makeCorsHeaders(ALLOWED_ORIGINS, FALLBACK_ORIGIN);
