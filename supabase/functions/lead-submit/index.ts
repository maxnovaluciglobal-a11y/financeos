// lead-submit (auditoría 360, SEG-1). Ver ./leadSubmitLogic.ts y docs/turnstile.md.
// Deploy: supabase functions deploy lead-submit --project-ref nelwgbcddwiaimzbcuas --use-api --no-verify-jwt
// verify_jwt=false (supabase/config.toml): formulario público, sin sesión.
// Errores: 400 invalid_request · 403 captcha_failed · 503 captcha_unavailable ·
// 502 upstream_*; el resto es la respuesta de la RPC tal cual.
import { parseLeadRequest, callLeadRpc, MAX_BODY_BYTES } from "./leadSubmitLogic.ts";
import { corsHeaders } from "./cors.ts";
import { checkTurnstile, clientIp, extractTurnstileToken, turnstileConfigFromEnv, turnstileErrorBody } from "../_shared/turnstile.ts";
import { withErrorReporting } from "../_shared/errorReport.ts";

const rpcConfig = {
  supabaseUrl: Deno.env.get("SUPABASE_URL")!,
  serviceRole: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
};

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } });
}

Deno.serve(withErrorReporting("lead-submit", async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, origin);

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return json({ ok: false, error: "invalid_request" }, 400, origin);
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { body = null; }
  const lead = parseLeadRequest(body);
  if (!lead) return json({ ok: false, error: "invalid_request" }, 400, origin);

  const ip = clientIp(req.headers);
  const captcha = await checkTurnstile(extractTurnstileToken(body, req.headers), turnstileConfigFromEnv((n) => Deno.env.get(n)), ip);
  if (!captcha.allow) {
    console.warn(`lead-submit: ${lead.rpc} rechazado (${captcha.reason}${captcha.codes?.length ? ` ${captcha.codes.join(",")}` : ""})`);
    return json(turnstileErrorBody(captcha), captcha.status, origin);
  }

  const out = await callLeadRpc(lead, ip, rpcConfig);
  return json(out.body, out.status, origin);
}));
