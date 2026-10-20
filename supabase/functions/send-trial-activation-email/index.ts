// send-trial-activation-email (auditoría 360, C-35 / COM-10). Ver ./trialActivationLogic.ts.
// Deploy: supabase functions deploy send-trial-activation-email --no-verify-jwt --use-api --project-ref nelwgbcddwiaimzbcuas
// Modos (todos con header x-cron-secret):
//   { mode: "cron" }                      → manda los correos del día (pg_cron diario)
//   { mode: "dry_run" }                   → cuenta qué mandaría, sin mandar nada
//   { mode: "preview", to, step, lang }   → un paso a la cuenta de empresa, para revisar el copy
import { resolveResendApiKey } from "../_shared/resendKey.ts";
import { secretEquals } from "../_shared/secretEquals.ts";
import { runTrialCron, sendPreview, type TrialConfig } from "./trialActivationLogic.ts";

const config: TrialConfig = {
  supabaseUrl: Deno.env.get("SUPABASE_URL")!,
  serviceRole: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  resendApiKey: resolveResendApiKey((name) => Deno.env.get(name)),
  fromEmail: Deno.env.get("NURTURE_FROM_EMAIL") ?? "MOY IQ <hola@moyiq.app>",
  cronSecret: Deno.env.get("CRON_SECRET"),
  portalUrl: Deno.env.get("STRIPE_PORTAL_URL") || undefined,
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  if (!secretEquals(req.headers.get("x-cron-secret"), config.cronSecret)) return json({ ok: false, error: "unauthorized" }, 401);
  let payload: any;
  try { payload = await req.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }
  try {
    if (payload?.mode === "cron" || payload?.mode === "dry_run") {
      const result = await runTrialCron(config, { dryRun: payload.mode === "dry_run" });
      return json({ ok: true, result }, 200);
    }
    if (payload?.mode === "preview") {
      const r = await sendPreview(payload.to, payload.step, payload.lang, config);
      return json(r, r.ok ? 200 : r.error === "recipient_not_allowed" || r.error === "invalid_step" ? 400 : 502);
    }
  } catch (e) {
    console.error(`send-trial-activation-email: ${e instanceof Error ? e.message : String(e)}`);
    return json({ ok: false, error: "internal_error" }, 500);
  }
  return json({ ok: false, error: "invalid_mode" }, 400);
});
