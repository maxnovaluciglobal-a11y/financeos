// invest-handoff: "Abrir Invest" desde MOY IQ con la sesión iniciada. Ver ./investHandoffLogic.ts.
// Deploy: supabase functions deploy invest-handoff --project-ref nelwgbcddwiaimzbcuas --use-api --no-verify-jwt
// verify_jwt=false (supabase/config.toml): el JWT se verifica acá contra Auth,
// así el preflight y un token vencido reciben una respuesta con CORS.
// Frontend: src/core/investHandoff.js → POST con Authorization: Bearer <sesión>.
// Respuesta: { ok, token_hash, uid }, con Cache-Control: no-store.
// Errores: 403 origin_not_allowed · 401 session_required · 422 no_email · 502 link_failed.
// El token nunca se escribe en un log ni en el reporte de errores.
import { createHandoff, type HandoffConfig } from "./investHandoffLogic.ts";
import { corsHeaders, isAllowedOrigin } from "./cors.ts";
import { withErrorReporting } from "../_shared/errorReport.ts";

const config: HandoffConfig = {
  supabaseUrl: Deno.env.get("SUPABASE_URL")!,
  serviceRole: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
};

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders(origin) },
  });
}

Deno.serve(withErrorReporting("invest-handoff", async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, origin);
  if (!isAllowedOrigin(origin)) return json({ ok: false, error: "origin_not_allowed" }, 403, origin);

  const result = await createHandoff(req.headers.get("Authorization"), config);
  if (result.status === 502) console.error("invest-handoff: link_failed");
  return json(result.body, result.status, origin);
}));
