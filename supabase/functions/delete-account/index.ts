// delete-account (auditoría 360, C-22 / SEG-5). Ver ./deleteAccountLogic.ts.
// Deploy: supabase functions deploy delete-account --project-ref nelwgbcddwiaimzbcuas --use-api --no-verify-jwt
// verify_jwt=false (supabase/config.toml): el JWT se verifica acá contra Auth,
// así el preflight y un token vencido reciben una respuesta con CORS.
// Frontend: src/core/deleteAccount.js → POST con Authorization: Bearer <sesión>
// y body { confirm: "DELETE" }. Errores: 400 confirmation_required ·
// 401 session_required · 503 data_delete_failed | auth_delete_failed.
// SEG-5: con el secreto STRIPE_RESTRICTED_KEY cancela en Stripe las
// suscripciones activas (./stripeCancel.ts). Si Stripe falla, el borrado igual
// responde 200; el fallo va a edge_function_errors y al aviso a soporte.
import { bearerToken, isConfirmed, getAuthUser, deleteAccount, cancelStripeAfterDelete, followupMessage, type DeleteConfig } from "./deleteAccountLogic.ts";
import { corsHeaders } from "./cors.ts";
import { sendAlertEmail } from "../_shared/alertEmail.ts";
import { withErrorReporting, reportEdgeError } from "../_shared/errorReport.ts";

const config: DeleteConfig = {
  supabaseUrl: Deno.env.get("SUPABASE_URL")!,
  serviceRole: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
};

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

Deno.serve(withErrorReporting("delete-account", async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, origin);

  let body: unknown = null;
  try { body = await req.json(); } catch { body = null; }
  if (!isConfirmed(body)) return json({ ok: false, error: "confirmation_required" }, 400, origin);

  const token = bearerToken(req.headers.get("Authorization"));
  const user = token ? await getAuthUser(token, config) : null;
  if (!user) return json({ ok: false, error: "session_required" }, 401, origin);

  const deleted = await deleteAccount(user, config);
  if (!deleted.ok) {
    console.error(`delete-account: ${deleted.error}`);
    return json({ ok: false, error: deleted.error }, deleted.status, origin);
  }

  const result = await cancelStripeAfterDelete(deleted, Deno.env.get("STRIPE_RESTRICTED_KEY"), async (o) => {
    console.error(`delete-account: no se pudo cancelar ${o.id} en Stripe (${o.error})`);
    await reportEdgeError("delete-account", 502, `stripe_cancel_failed ${o.id}: ${o.error}`, config);
  });

  const msg = followupMessage(result, user.email);
  if (msg) {
    const sent = await sendAlertEmail(msg, (n) => Deno.env.get(n));
    if (!sent.ok) console.error(`delete-account: aviso a soporte no enviado (${sent.error})`);
  }
  return json({ ok: true }, 200, origin);
}));
