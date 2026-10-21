// newsletter-sync (auditoría 360, C-16 / MKT-4). La llama pg_cron cada 10
// minutos (job newsletter-sync) con x-cron-secret:
//   { "mode": "cron" }    → suscribe las direcciones con el doble opt-in
//                           confirmado y marca newsletter_synced_at.
//   { "mode": "dry_run" } → solo cuenta lo pendiente por tabla.
// Lógica en ./syncLogic.ts. Secrets: CRON_SECRET, NEWSLETTER_PROXY_URL,
// NEWSLETTER_PROXY_TOKEN (= SUBSCRIBE_PROXY_TOKEN del proxy en Vercel).
// Deploy: supabase functions deploy newsletter-sync --no-verify-jwt --use-api --project-ref nelwgbcddwiaimzbcuas
import { runNewsletterSync } from "./syncLogic.ts";
import { secretEquals } from "../_shared/secretEquals.ts";
import { withErrorReporting } from "../_shared/errorReport.ts";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(withErrorReporting("newsletter-sync", async (req) => {
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
  if (mode !== "cron" && mode !== "dry_run") return json({ ok: false, error: "invalid_mode" }, 400);
  const proxyUrl = Deno.env.get("NEWSLETTER_PROXY_URL");
  const proxyToken = Deno.env.get("NEWSLETTER_PROXY_TOKEN");
  if (mode === "cron" && (!proxyUrl || !proxyToken)) {
    return json({ ok: false, error: "proxy_not_configured" }, 500);
  }
  try {
    const result = await runNewsletterSync(
      {
        supabaseUrl: Deno.env.get("SUPABASE_URL")!,
        serviceRole: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        proxyUrl,
        proxyToken,
      },
      { dryRun: mode === "dry_run" },
    );
    const failed = Object.values(result.tables).reduce((n, t) => n + t.failed, 0);
    if (failed > 0 || result.errors.length > 0) console.error(`newsletter-sync: ${JSON.stringify(result)}`);
    return json({ ok: result.errors.length === 0, mode, ...result }, result.errors.length === 0 ? 200 : 500);
  } catch (e) {
    console.error(`newsletter-sync: ${e instanceof Error ? e.message : String(e)}`);
    return json({ ok: false, error: "internal_error" }, 500);
  }
}));
