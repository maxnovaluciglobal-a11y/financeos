// send-feedback (auditoría 360, C-39 / PRD-5). Ver ./feedbackLogic.ts.
// Deploy: supabase functions deploy send-feedback --project-ref nelwgbcddwiaimzbcuas --use-api --no-verify-jwt
// verify_jwt=false (supabase/config.toml): el JWT se verifica acá contra Auth.
// Frontend: src/components/FeedbackSheet.jsx. Errores: 400 invalid_feedback ·
// 401 session_required · 409 already_answered (NPS automático, una vez por
// cuenta) · 429 rate_limited · 503 claim_failed · 502 resend_*.
import { parseFeedback, bearerToken, getAuthUser, claimFeedback, claimNps, sendFeedbackEmail, type FeedbackConfig } from "./feedbackLogic.ts";
import { corsHeaders } from "./cors.ts";
import { resolveResendApiKey } from "../_shared/resendKey.ts";
import { withErrorReporting } from "../_shared/errorReport.ts";

const config: FeedbackConfig = {
  supabaseUrl: Deno.env.get("SUPABASE_URL")!,
  serviceRole: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  resendApiKey: resolveResendApiKey((n) => Deno.env.get(n)),
  supportEmail: Deno.env.get("SUPPORT_EMAIL") ?? "support@moyiq.app",
  fromEmail: "MOY IQ <hola@moyiq.app>",
};

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } });
}

Deno.serve(withErrorReporting("send-feedback", async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, origin);

  let body: unknown = null;
  try { body = await req.json(); } catch { body = null; }
  const input = parseFeedback(body);
  if (!input) return json({ ok: false, error: "invalid_feedback" }, 400, origin);

  const token = bearerToken(req.headers.get("Authorization"));
  const user = token ? await getAuthUser(token, config) : null;
  if (!user) return json({ ok: false, error: "session_required" }, 401, origin);

  if (input.kind === "nps") {
    const nps = await claimNps(user.id, config);
    if (nps === "already_answered") return json({ ok: false, error: "already_answered" }, 409, origin);
    if (nps !== "ok") return json({ ok: false, error: "claim_failed" }, 503, origin);
  }

  const claim = await claimFeedback(user.id, config);
  if (claim === "rate_limited") return json({ ok: false, error: "rate_limited" }, 429, origin);
  if (claim !== "ok") return json({ ok: false, error: "claim_failed" }, 503, origin);

  const sent = await sendFeedbackEmail(input, user, config);
  if (!sent.ok) console.error(`send-feedback: ${sent.error}`);
  return json(sent.ok ? { ok: true } : { ok: false, error: sent.error }, sent.ok ? 200 : 502, origin);
}));
