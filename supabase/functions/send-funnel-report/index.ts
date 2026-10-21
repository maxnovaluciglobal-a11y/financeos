// send-funnel-report (auditoría 360, EST-9). Ver ./funnelReportLogic.ts.
// Deploy: supabase functions deploy send-funnel-report --no-verify-jwt --use-api --project-ref nelwgbcddwiaimzbcuas
// Modos (todos con header x-cron-secret; el destinatario es fijo, REPORT_TO):
//   { mode: "cron" }     → lunes 12:00 Chile (pg_cron 'funnel-weekly-report'), una vez por semana
//   { mode: "dry_run" }  → devuelve los números y el asunto, sin mandar
//   { mode: "preview" }  → manda una copia marcada como vista previa, sin registrar la semana
import { resolveResendApiKey } from "../_shared/resendKey.ts";
import { secretEquals } from "../_shared/secretEquals.ts";
import { runReport, type ReportConfig } from "./funnelReportLogic.ts";
import { withErrorReporting } from "../_shared/errorReport.ts";

const config: ReportConfig = {
  supabaseUrl: Deno.env.get("SUPABASE_URL")!,
  serviceRole: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  resendApiKey: resolveResendApiKey((name) => Deno.env.get(name)),
  fromEmail: Deno.env.get("NURTURE_FROM_EMAIL") ?? "MOY IQ <hola@moyiq.app>",
  cronSecret: Deno.env.get("CRON_SECRET"),
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(withErrorReporting("send-funnel-report", async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  if (!secretEquals(req.headers.get("x-cron-secret"), config.cronSecret)) return json({ ok: false, error: "unauthorized" }, 401);
  let payload: any;
  try { payload = await req.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }
  const mode = payload?.mode;
  if (mode !== "cron" && mode !== "dry_run" && mode !== "preview") return json({ ok: false, error: "invalid_mode" }, 400);
  try {
    const result = await runReport(mode, config);
    return json({ ok: result.status !== "error", result }, result.status === "error" ? 502 : 200);
  } catch (e) {
    console.error(`send-funnel-report: ${e instanceof Error ? e.message : String(e)}`);
    return json({ ok: false, error: "internal_error" }, 500);
  }
}));
