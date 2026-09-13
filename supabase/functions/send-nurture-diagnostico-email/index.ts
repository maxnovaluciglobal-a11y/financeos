// FinanceOS/MOY IQ — Envío de la secuencia nurture post-Diagnóstico Exprés.
// Supabase Edge Function (Deno). Dos formas de invocarla:
//
// 1. Público, desde el navegador (diagnostico.html, justo después de que
//    register_diagnostico_lead responde ok:true): { mode: "welcome", leadId }
//    — manda el email 1 inmediato. CORS restringido a los orígenes de la
//    landing/app, igual criterio que send-report-email.
//
// 2. Cron (pg_cron + pg_net, ver migración 20260913173000): { mode: "cron" }
//    con header x-cron-secret. Sin ese secreto no procesa nada — evita que
//    cualquiera dispare un envío masivo pegándole al endpoint público.
//
// La lógica vive en ./nurtureEmailLogic.ts — mismo motivo que
// reportEmailLogic.ts: este archivo lee Deno.env.get() a nivel de módulo.
//
// Secrets necesarios (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY                          ← ya configurado, se reusa
//   NURTURE_FROM_EMAIL                      ← "MOY IQ <hola@moyiq.app>", nuevo, ver reporte
//   CRON_SECRET                             ← nuevo, generar con `openssl rand -hex 32`
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ← los inyecta Supabase solo

import {
  runCronBatch,
  renderEmail,
  sendViaResend,
  fetchLeadById,
  markSent,
  type NurtureEmailConfig,
} from "./nurtureEmailLogic.ts";

const config: NurtureEmailConfig = {
  supabaseUrl: Deno.env.get("SUPABASE_URL")!,
  serviceRole: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  // Key propia, NO la RESEND_API_KEY compartida con stripe-webhook/send-report-email:
  // esa está scoped en Resend a financeospro.com/dypos.app y devuelve 403 al mandar
  // desde moyiq.app (encontrado y verificado en vivo el 13-sep-2026 al probar el
  // envío end-to-end). moyiq-nurture es una key nueva, "Sending access" scoped
  // específicamente a moyiq.app, creada en Resend en esta misma sesión.
  resendApiKey: Deno.env.get("NURTURE_RESEND_API_KEY"),
  fromEmail: Deno.env.get("NURTURE_FROM_EMAIL") ?? "MOY IQ <hola@moyiq.app>",
  cronSecret: Deno.env.get("CRON_SECRET"),
  landingUrl: Deno.env.get("LANDING_URL") ?? "https://moyiq.app",
};

const ALLOWED_ORIGINS = new Set([
  "https://moyiq.app",
  "https://www.moyiq.app",
  "https://app.moyiq.app",
  "https://financeospro.com",
  "https://www.financeospro.com",
  "http://localhost:4323",
  "http://localhost:5173",
]);

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://moyiq.app";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-cron-secret",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, origin);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400, origin);
  }

  const mode = payload?.mode;

  if (mode === "cron") {
    const secret = req.headers.get("x-cron-secret");
    if (!config.cronSecret || !secret || secret !== config.cronSecret) {
      return json({ ok: false, error: "unauthorized" }, 401, origin);
    }
    const result = await runCronBatch(config);
    return json({ ok: true, result }, 200, origin);
  }

  if (mode === "welcome") {
    const leadId = payload?.leadId;
    if (typeof leadId !== "string" || !UUID_RE.test(leadId)) {
      return json({ ok: false, error: "invalid_lead_id" }, 400, origin);
    }
    const lead = await fetchLeadById(leadId, config);
    if (!lead) {
      return json({ ok: false, error: "lead_not_found" }, 404, origin);
    }
    const rendered = renderEmail("welcome", lead, config);
    const result = await sendViaResend(lead.email, rendered, config);
    if (result.ok) {
      await markSent(lead.id, "welcome", config);
    }
    return json(result, result.ok ? 200 : 502, origin);
  }

  return json({ ok: false, error: "invalid_mode" }, 400, origin);
});
