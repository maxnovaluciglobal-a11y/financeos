// invest-alerts-check (Inversiones F4, 20-nov-2026): revisa las alertas de
// precio activas (public.invest_alerts) y avisa por Web Push a los dispositivos
// de la cuenta. La programa pg_cron (o cualquier scheduler) con POST y el header
// x-cron-secret: ver supabase/functions/README.md. Sin CORS: no es para navegadores.
//
// Lee con service role (salta RLS a propósito: revisa las alertas de todas las
// cuentas), pide los precios en lotes de 10 a la API de Invest (/api/quote, los
// mismos endpoints que usa la app), busca a quién avisar, marca
// last_triggered_at por RPC (no repite antes de 24 h) y manda el aviso con el
// mismo Web Push de send-push (_shared/webPush.ts). Si un aviso no llega a
// ningún dispositivo por la red, un 5xx o falta de tiempo, se devuelve y queda
// primero para la próxima corrida. Precios y envíos tienen presupuestos
// separados (alertLogic.ts). Suscripciones con 404/410/400/403 se borran.
// Requiere las migraciones 20261120000100 y 20261123000000 (rotación).
//   cuerpo opcional { "mode": "check" } → solo cuenta, sin marcar ni avisar.
// Secrets: CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// (los mismos de send-push), INVEST_API_URL opcional (por defecto
// https://invest.moyiq.app). SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase.
import { FETCH_TIMEOUT_MS, guardAlertsRequest, runAlertsCheck, runFailed } from "./alertLogic.ts";
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
    sendPush: (sub, payload) => sendWebPush(sub, payload, vapid, fetch, FETCH_TIMEOUT_MS),
    dryRun: mode === "check",
  });
  // Con errores del sistema (precios, RPC, reclamo, devolución, falta de
  // tiempo, clave VAPID) o más de la mitad de los envíos fallidos responde 502:
  // withErrorReporting deja la fila en edge_function_errors y uptime-alert
  // avisa. Un dispositivo roto de una persona no cuenta (se limpia solo).
  const failed = runFailed(result);
  return json({ ok: !failed, mode, ...result }, failed ? 502 : 200);
}));
