// supabase/functions/send-optin-confirmation/index.ts
//
// Correo de doble opt-in para marketing. Lo llaman los clientes justo después
// de que una RPC register_* responde ok con consentimiento marcado:
//   - app (licenseValidator.js): registerStarterLead → { source: "starter", id }
//                                registerDemoLead    → { source: "demo", id }
//   - landing (diagnostico.html, en/score-check.html) → { source: "diagnostico", id }
// POST { source, id }. El enlace del correo lleva a confirmar.html /
// en/confirm.html, que llaman a la RPC confirm_marketing_consent.
//
// Deploy SIN verificación de JWT (el navegador no manda Authorization), igual
// que send-cancellation-confirmation y las funciones de nurture:
//   supabase functions deploy send-optin-confirmation --no-verify-jwt --project-ref nelwgbcddwiaimzbcuas
// Requiere la migración 20261010010000_marketing_double_optin.sql aplicada
// antes (columnas consent_token / consent_confirmed_at / optin_email_sent_at).
// No hace falta secreto: solo actúa sobre una fila existente, manda a la
// dirección guardada en esa fila, una vez por fila y con tope por dirección.
//
// La lógica vive en ./optinLogic.ts (testeada con vitest); este archivo es
// solo wiring.
//
// Secrets (todos ya existen):
//   NURTURE_RESEND_API_KEY (o RESEND_API_KEY) ← key de Resend scoped a moyiq.app
//   NURTURE_FROM_EMAIL                         ← "MOY IQ <hola@moyiq.app>"
//   SUPPORT_EMAIL (opcional)                   ← reply-to, default support@moyiq.app
//   LANDING_URL (opcional)                     ← default https://moyiq.app
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY    ← los inyecta Supabase

import { processOptin, type OptinConfig } from "./optinLogic.ts";
import { corsHeaders } from "./cors.ts";

const config: OptinConfig = {
  supabaseUrl: Deno.env.get("SUPABASE_URL")!,
  serviceRole: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  resendApiKey: Deno.env.get("NURTURE_RESEND_API_KEY") ?? Deno.env.get("RESEND_API_KEY"),
  fromEmail: Deno.env.get("NURTURE_FROM_EMAIL") ?? "MOY IQ <hola@moyiq.app>",
  replyTo: Deno.env.get("SUPPORT_EMAIL") ?? "support@moyiq.app",
  landingUrl: Deno.env.get("LANDING_URL") ?? "https://moyiq.app",
};

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

const STATUS: Record<string, number> = {
  invalid_source: 400,
  invalid_id: 400,
  not_found: 404,
  no_consent: 409,
  rate_limited: 429,
};

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405, origin);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400, origin);
  }

  try {
    const result = await processOptin(payload, config);
    return json(result, result.ok ? 200 : (STATUS[result.error] ?? 502), origin);
  } catch (e) {
    console.error(`send-optin-confirmation: ${e}`);
    return json({ ok: false, error: "internal" }, 500, origin);
  }
});
