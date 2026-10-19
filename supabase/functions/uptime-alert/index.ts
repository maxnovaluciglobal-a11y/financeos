// uptime-alert (auditoría 360, C-11 / OPS-2). La llama pg_cron cada 5 min desde
// public.uptime_tick() con x-cron-secret. Lee los chequeos que ya evaluó la base
// (uptime_checks), mantiene uptime_state y avisa a la casilla de la empresa:
// caída tras 2 fallas seguidas, recordatorio cada 6 h y recuperación.
//   { "mode": "cron" }   → decide, manda y guarda.
//   { "mode": "check" }  → solo devuelve lo que haría (sin correos ni escrituras).
// Secrets: CRON_SECRET, NURTURE_RESEND_API_KEY (SUPABASE_URL y la service role
// los inyecta Supabase). Ver docs/monitoreo.md.
import { runUptimeAlert } from "./uptimeAlertLogic.ts";
import { secretEquals } from "../_shared/secretEquals.ts";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  if (!secretEquals(req.headers.get("x-cron-secret"), Deno.env.get("CRON_SECRET"))) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  let payload: { mode?: unknown } | null = null;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }
  const mode = payload?.mode;
  if (mode !== "cron" && mode !== "check") return json({ ok: false, error: "invalid_mode" }, 400);
  try {
    const sites = await runUptimeAlert(
      {
        supabaseUrl: Deno.env.get("SUPABASE_URL")!,
        serviceRole: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        getEnv: (n) => Deno.env.get(n),
      },
      new Date(),
      { dryRun: mode === "check" },
    );
    return json({ ok: true, mode, sites }, 200);
  } catch (e) {
    console.error(`uptime-alert: ${e instanceof Error ? e.message : String(e)}`);
    return json({ ok: false, error: "internal_error" }, 500);
  }
});
