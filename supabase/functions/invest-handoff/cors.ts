// CORS de invest-handoff: solo la app, que es la que tiene sesión. El demo no
// llama a esta función. Separado de index.ts para poder testearlo.
import { makeCorsHeaders } from "../_shared/cors.ts";

export const ALLOWED_ORIGINS = [
  "https://app.moyiq.app",
  "http://localhost:5173",
] as const;

export const FALLBACK_ORIGIN = "https://app.moyiq.app";

export const corsHeaders = makeCorsHeaders(ALLOWED_ORIGINS, FALLBACK_ORIGIN);

export function isAllowedOrigin(origin: string | null): boolean {
  return !!origin && (ALLOWED_ORIGINS as readonly string[]).includes(origin);
}
