// supabase/functions/send-cancellation-confirmation/index.ts
//
// Llamada pública desde la landing (cancelar.html, en/cancel.html,
// de/kuendigen.html y — desistimiento, kind 'withdrawal' — de/widerrufen.html,
// todas vía /cancel-form.js) justo después de que la RPC
// submit_cancellation_request responde ok: POST { id }.
//
// Deploy SIN verificación de JWT, igual que las funciones de nurture que
// llama la landing (el navegador no manda Authorization):
//   supabase functions deploy send-cancellation-confirmation --no-verify-jwt --project-ref nelwgbcddwiaimzbcuas
// No hace falta secreto: la función solo actúa sobre una fila ya existente
// (el id lo devuelve la RPC, que valida y limita por email/hora) y cada correo
// sale una sola vez por fila (flags *_sent_at), así que llamarla con un id
// ajeno o repetido no manda nada nuevo.
//
// La lógica vive en ./cancellationLogic.ts (testeada con vitest); este
// archivo es solo wiring.
//
// Secrets (todos ya existen, reusados de las funciones de nurture/alertas):
//   NURTURE_RESEND_API_KEY (o RESEND_API_KEY) ← key de Resend scoped a moyiq.app
//   NURTURE_FROM_EMAIL                         ← "MOY IQ <hola@moyiq.app>"
//   ALERT_EMAIL                                ← copia interna (default maxnovaluciglobal@gmail.com)
//   SUPPORT_EMAIL (opcional)                   ← default support@moyiq.app
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY    ← los inyecta Supabase

import { processCancellation, type CancellationConfig } from "./cancellationLogic.ts";
import { corsHeaders } from "./cors.ts";

const SUPPORT = Deno.env.get("SUPPORT_EMAIL") ?? "support@moyiq.app";

const config: CancellationConfig = {
  supabaseUrl: Deno.env.get("SUPABASE_URL")!,
  serviceRole: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  resendApiKey: Deno.env.get("NURTURE_RESEND_API_KEY") ?? Deno.env.get("RESEND_API_KEY"),
  fromEmail: Deno.env.get("NURTURE_FROM_EMAIL") ?? "MOY IQ <hola@moyiq.app>",
  replyTo: SUPPORT,
  internalTo: [SUPPORT, Deno.env.get("ALERT_EMAIL") ?? "maxnovaluciglobal@gmail.com"],
};

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, origin);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400, origin);
  }

  try {
    const result = await processCancellation(payload?.id, config);
    const status = result.ok
      ? 200
      : result.error === "invalid_id"
        ? 400
        : result.error === "not_found"
          ? 404
          : 502;
    return json(result, status, origin);
  } catch (e) {
    console.error(`send-cancellation-confirmation: ${e}`);
    return json({ ok: false, error: "internal" }, 500, origin);
  }
});
