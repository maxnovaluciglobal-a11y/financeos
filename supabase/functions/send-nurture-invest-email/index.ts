// FinanceOS/MOY IQ — Envío de la secuencia nurture para el lead magnet de
// Invest (perfil-inversor.html → invest_leads). Supabase Edge Function
// (Deno). Calcada de send-nurture-starter-email/ — mismas dos formas de
// invocarla:
//
// 1. Público, desde el navegador (perfil-inversor.html, justo después de
//    que register_invest_lead responde ok:true con el id): { mode:
//    "welcome", leadId } — manda el email 1 inmediato. CORS restringido a
//    los orígenes de Invest.
//
// 2. Cron (pg_cron + pg_net, ver migración 20260918000900): { mode: "cron" }
//    con header x-cron-secret. Sin ese secreto no procesa nada.
//
// La lógica vive en ./nurtureEmailLogic.ts — index.ts es solo wiring y NO se
// testea (lee Deno.env.get(), no importable desde Node).
//
// Secrets necesarios (Supabase → Edge Functions → Secrets):
//   NURTURE_RESEND_API_KEY                  ← MISMO secret que usan las otras nurture — NO RESEND_API_KEY (ese devuelve 403, ver auth-email-hook/index.ts)
//   NURTURE_FROM_EMAIL_INVEST                ← "MOY IQ Invest <invest@moyiq.app>" (fallback hardcodeado si no está seteado)
//   CRON_SECRET                             ← mismo secreto compartido (private.get_secret('cron_secret'))
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
  resendApiKey: Deno.env.get("NURTURE_RESEND_API_KEY"),
  fromEmail: Deno.env.get("NURTURE_FROM_EMAIL_INVEST") ?? "MOY IQ Invest <invest@moyiq.app>",
  cronSecret: Deno.env.get("CRON_SECRET"),
  landingUrl: Deno.env.get("INVEST_LANDING_URL") ?? "https://invest.moyiq.app",
};

const ALLOWED_ORIGINS = new Set([
  "https://invest.moyiq.app",
  "https://www.invest.moyiq.app",
  "https://invest.financeospro.com",
  "http://localhost:4323",
  "http://localhost:5173",
]);

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://invest.moyiq.app";
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
