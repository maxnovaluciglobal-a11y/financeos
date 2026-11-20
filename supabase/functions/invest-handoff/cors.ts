// CORS de invest-handoff: solo la app, que es la que tiene sesión. El demo no
// llama a esta función. Separado de index.ts para poder testearlo.
// INV-N13: la app nativa (Capacitor) sirve la web desde capacitor://localhost (iOS)
// y https://localhost (Android, androidScheme: https).
// SEC-N10: los orígenes de desarrollo van en DEV_ORIGINS (ver ../_shared/cors.ts).
import { devOrigins, makeCorsHeaders, withDevOrigins } from "../_shared/cors.ts";

export const ALLOWED_ORIGINS = [
  "https://app.moyiq.app",
  "capacitor://localhost",
  "https://localhost",
] as const;

export const FALLBACK_ORIGIN = "https://app.moyiq.app";

export const corsHeaders = makeCorsHeaders(ALLOWED_ORIGINS, FALLBACK_ORIGIN);

const ALLOWED = withDevOrigins(ALLOWED_ORIGINS, devOrigins());

export function isAllowedOrigin(origin: string | null): boolean {
  return !!origin && ALLOWED.has(origin);
}
