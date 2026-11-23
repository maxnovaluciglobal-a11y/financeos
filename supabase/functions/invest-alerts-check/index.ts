// invest-alerts-check (Inversiones F4, 20-nov-2026): revisa las alertas de
// precio activas (public.invest_alerts) y avisa por Web Push a los dispositivos
// de la cuenta. La programa pg_cron (o cualquier scheduler) con POST y el header
// x-cron-secret: ver supabase/functions/README.md. Sin CORS: no es para navegadores.
//
// Lee con service role (salta RLS a propósito: revisa las alertas de todas las
// cuentas), pide los precios en lotes de 10 a la API de Invest (/api/quote, los
// mismos endpoints que usa la app), marca last_triggered_at (no repite antes de
// 24 h) y manda el aviso con el mismo Web Push de send-push (_shared/webPush.ts).
//   cuerpo opcional { "mode": "check" } → solo cuenta, sin marcar ni avisar.
// Secrets: CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// (los mismos de send-push), INVEST_API_URL opcional (por defecto
// https://invest.moyiq.app). SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.
import { guardAlertsRequest, runAlertsCheck } from "./alertLogic.ts";
import { withErrorReporting } from "../_shared/errorReport.ts";
import { sendWebPush } from "../_shared/webPush.ts";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(withErrorReporting("invest-alerts-check", async (req) => {
  const denied = guardAlertsRequest(req.method, req.headers.get("x-cron-secret"), Deno.env.get("CRON_SECRET"));
  if (denied) return denied.status === 204 ? new Response(null, { status: 204 }) : json({ ok: false, error: denied.error }, denied.status);

  let mode = "cron";
  try {
    const body = await req.json();
    if (body && body.mode === "check") mode = "check";
  } catch { /* sin cuerpo: corrida normal */ }

  const vapid = {
    publicKey: Deno.env.get("VAPID_PUBLIC_KEY")!,
    privateKey: Deno.env.get("VAPID_PRIVATE_KEY")!,
    subject: Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@moyiq.app",
  };
  const result = await runAlertsCheck({
    supabaseUrl: Deno.env.get("SUPABASE_URL")!,
    serviceRole: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    investApiUrl: (Deno.env.get("INVEST_API_URL") || "https://invest.moyiq.app").replace(/\/$/, ""),
    fetchImpl: fetch,
    sendPush: (sub, payload) => sendWebPush(sub, payload, vapid),
    dryRun: mode === "check",
  });
  return json({ ok: true, mode, ...result }, 200);
}));
