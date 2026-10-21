// cron-health-alert (auditoría 360, C-12 parte b / OPS-3). La llama pg_cron una
// vez por día (cron-health-alert-daily, 15:03 UTC) con x-cron-secret. Si algún
// job no corrió, falló o su llamada HTTP devolvió ≠ 2xx en 24 h, manda un correo
// a la casilla de la empresa.
//   { "mode": "cron" }  → revisa y avisa si hay problemas.
//   { "mode": "check" } → solo devuelve el informe (sin correo).
// Secrets: CRON_SECRET, NURTURE_RESEND_API_KEY. Ver docs/monitoreo.md.
import { runCronHealth } from "./cronHealthLogic.ts";
import { secretEquals } from "../_shared/secretEquals.ts";
import { withErrorReporting } from "../_shared/errorReport.ts";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(withErrorReporting("cron-health-alert", async (req) => {
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
    const result = await runCronHealth(
      {
        supabaseUrl: Deno.env.get("SUPABASE_URL")!,
        serviceRole: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        getEnv: (n) => Deno.env.get(n),
      },
      new Date(),
      { dryRun: mode === "check" },
    );
    return json({ ok: true, mode, ...result }, 200);
  } catch (e) {
    console.error(`cron-health-alert: ${e instanceof Error ? e.message : String(e)}`);
    return json({ ok: false, error: "internal_error" }, 500);
  }
}));
