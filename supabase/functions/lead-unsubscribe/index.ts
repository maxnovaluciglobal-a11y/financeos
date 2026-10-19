// lead-unsubscribe (auditoría 360, C-35 / COM-9). Ver ./unsubscribeLogic.ts.
// Deploy: supabase functions deploy lead-unsubscribe --no-verify-jwt --use-api --project-ref nelwgbcddwiaimzbcuas
import { parseTarget, unsubscribeLead, landingUnsubscribeUrl } from "./unsubscribeLogic.ts";

const config = {
  supabaseUrl: Deno.env.get("SUPABASE_URL")!,
  serviceRole: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
};
const LANDING_URL = Deno.env.get("LANDING_URL") ?? "https://moyiq.app";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const target = parseTarget(req.url);
  if (req.method === "GET") {
    if (!target) return Response.redirect(`${LANDING_URL.replace(/\/$/, "")}/unsubscribe.html`, 303);
    return Response.redirect(landingUnsubscribeUrl(LANDING_URL, target.table, target.id), 303);
  }
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  if (!target) return json({ ok: false, error: "invalid_target" }, 400);
  try {
    const ok = await unsubscribeLead(target.table, target.id, config);
    return json({ ok }, ok ? 200 : 404);
  } catch (e) {
    console.error(`lead-unsubscribe: ${e instanceof Error ? e.message : String(e)}`);
    return json({ ok: false, error: "internal_error" }, 500);
  }
});
