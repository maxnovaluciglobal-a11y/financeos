// FinanceOS/MOY IQ — Envío por correo del reporte PDF de Modo Asesor.
// Supabase Edge Function (Deno). A diferencia de stripe-webhook (llamado por
// Stripe, servidor a servidor), este endpoint lo llama el NAVEGADOR del
// usuario directo — por eso necesita CORS, y por eso NUNCA hay que confiar en
// que el cliente diga "soy Pro": el ProGate de la UI es cosmético, la
// autorización real es checkProLicense() contra la misma RPC validate_license
// que ya usa el sync (ver reportEmailLogic.ts).
//
// La lógica vive en ./reportEmailLogic.ts — mismo motivo que webhookLogic.ts:
// este archivo lee Deno.env.get() a nivel de módulo y no se puede importar
// desde Node/vitest.
//
// Secrets necesarios (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY, FROM_EMAIL              ← ya configurados para stripe-webhook, se reusan
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ← los inyecta Supabase solo
//
// Frontend: src/pages/Advisor/ReportePDF.jsx → sendReportePDFByEmail()
//   POST https://<PROYECTO>.supabase.co/functions/v1/send-report-email
//   body: { licenseKey, to, clientName, month, pdfBase64, filename }

import { isValidEmail, isPdfSizeOk, checkProLicense, sendReportEmail, type EmailConfig } from "./reportEmailLogic.ts";

const config: EmailConfig = {
  supabaseUrl: Deno.env.get("SUPABASE_URL")!,
  serviceRole: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  resendApiKey: Deno.env.get("RESEND_API_KEY"),
  fromEmail: Deno.env.get("FROM_EMAIL") ?? "MOY IQ <licencias@moyiq.app>",
};

// Orígenes conocidos del frontend — no es el control de seguridad real (eso
// es checkProLicense), pero evita que cualquier página random del navegador
// dispare este endpoint por error/curiosidad.
const ALLOWED_ORIGINS = new Set([
  "https://app.financeospro.com",
  "https://demo.financeospro.com",
  "http://localhost:5173",
  "http://localhost:4323",
]);

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://app.financeospro.com";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

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

  const { licenseKey, to, clientName, month, pdfBase64, filename } = payload ?? {};

  if (!isValidEmail(to)) {
    return json({ ok: false, error: "invalid_email" }, 400, origin);
  }
  if (!isPdfSizeOk(pdfBase64)) {
    return json({ ok: false, error: "invalid_pdf" }, 400, origin);
  }
  if (typeof filename !== "string" || filename.length === 0 || filename.length > 200) {
    return json({ ok: false, error: "invalid_filename" }, 400, origin);
  }

  const license = await checkProLicense(typeof licenseKey === "string" ? licenseKey : "", config);
  if (!license.ok) {
    return json({ ok: false, error: "license_required" }, 403, origin);
  }

  const result = await sendReportEmail(
    {
      to,
      clientName: typeof clientName === "string" ? clientName.slice(0, 200) : "",
      month: typeof month === "string" ? month.slice(0, 20) : "",
      pdfBase64,
      filename,
    },
    config,
  );

  return json(result, result.ok ? 200 : 502, origin);
});
