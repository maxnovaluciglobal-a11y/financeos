// send-pro-trial-email (modelo A, D3 del 26-nov-2026). Ver ./proTrialEmailLogic.ts.
// Deploy: supabase functions deploy send-pro-trial-email --no-verify-jwt --use-api --project-ref nelwgbcddwiaimzbcuas
// Modos (todos con header x-cron-secret):
//   { mode: "cron" }                    → manda los correos que tocan (pg_cron cada hora)
//   { mode: "dry_run" }                 → cuenta qué mandaría, sin mandar ni reclamar nada
//   { mode: "preview", to, step, lang } → un paso a la cuenta de empresa (welcome | day10 | ended)
import { resolveResendApiKey } from "../_shared/resendKey.ts";
import { secretEquals } from "../_shared/secretEquals.ts";
import { withErrorReporting } from "../_shared/errorReport.ts";
import { brandedSender } from "../_shared/emailSender.ts";
import { runProTrialCron, sendPreview, type ProTrialConfig } from "./proTrialEmailLogic.ts";

const config: ProTrialConfig = {
  supabaseUrl: Deno.env.get("SUPABASE_URL")!,
  serviceRole: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  resendApiKey: resolveResendApiKey((name) => Deno.env.get(name)),
  // hola@moyiq.app con el nombre de marca que impone _shared/emailSender.ts.
  fromEmail: brandedSender(Deno.env.get("NURTURE_FROM_EMAIL"), "hola@moyiq.app"),
  cronSecret: Deno.env.get("CRON_SECRET"),
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(withErrorReporting("send-pro-trial-email", async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  if (!secretEquals(req.headers.get("x-cron-secret"), config.cronSecret)) return json({ ok: false, error: "unauthorized" }, 401);
  let payload: any;
  try { payload = await req.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }
  try {
    if (payload?.mode === "cron" || payload?.mode === "dry_run") {
      const result = await runProTrialCron(config, { dryRun: payload.mode === "dry_run" });
      return json({ ok: true, result }, 200);
    }
    if (payload?.mode === "preview") {
      const r = await sendPreview(payload.to, payload.step, payload.lang, config);
      return json(r, r.ok ? 200 : r.error === "recipient_not_allowed" || r.error === "invalid_step" ? 400 : 502);
    }
  } catch (e) {
    console.error(`send-pro-trial-email: ${e instanceof Error ? e.message : String(e)}`);
    return json({ ok: false, error: "internal_error" }, 500);
  }
  return json({ ok: false, error: "invalid_mode" }, 400);
}));
