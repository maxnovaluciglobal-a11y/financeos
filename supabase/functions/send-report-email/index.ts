// FinanceOS/MOY IQ — Envío por correo del reporte PDF de Modo Asesor.
// Supabase Edge Function (Deno). A diferencia de stripe-webhook (llamado por
// Stripe, servidor a servidor), este endpoint lo llama el NAVEGADOR del
// usuario directo — por eso necesita CORS, y por eso NUNCA hay que confiar en
// que el cliente diga "soy Pro": el ProGate de la UI es cosmético. La
// autorización real es la sesión verificada contra Auth + report_email_claim
// (licencia válida, cuenta dueña y tope diario; ver reportEmailLogic.ts).
//
// La lógica vive en ./reportEmailLogic.ts — mismo motivo que webhookLogic.ts:
// este archivo lee Deno.env.get() a nivel de módulo y no se puede importar
// desde Node/vitest.
//
// Secrets necesarios (Supabase → Edge Functions → Secrets):
//   NURTURE_RESEND_API_KEY (o RESEND_API_KEY como respaldo), FROM_EMAIL ← los mismos que usa stripe-webhook
//     (ver ../_shared/resendKey.ts: RESEND_API_KEY sola da 403 desde @moyiq.app)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ← los inyecta Supabase solo
//   REPORT_EMAIL_DAILY_LIMIT ← opcional, envíos por licencia en 24 h (default 20)
//
// Frontend: src/pages/Advisor/ReportePDF.jsx → sendReportePDFByEmail()
//   POST https://<PROYECTO>.supabase.co/functions/v1/send-report-email
//   Authorization: Bearer <access_token de la sesión>   (C-20, auditoría 360)
//   body: { licenseKey, to, clientName, month, pdfBase64, filename, lang }
//   Errores: 401 session_required · 403 license_required | not_owner ·
//            429 daily_limit · 503 claim_failed · 502 resend_*
// verify_jwt sigue en false (supabase/config.toml): el JWT se verifica acá
// contra Auth, así un preflight o un token vencido reciben una respuesta con CORS.

import {
  isValidEmail, isPdfSizeOk, sendReportEmail, pickLang, bearerToken, getAuthUser, claimReportSend,
  dailyLimitFrom, CLAIM_STATUS, type EmailConfig,
} from "./reportEmailLogic.ts";
import { corsHeaders } from "./cors.ts";
import { resolveResendApiKey } from "../_shared/resendKey.ts";

const config: EmailConfig = {
  supabaseUrl: Deno.env.get("SUPABASE_URL")!,
  serviceRole: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  resendApiKey: resolveResendApiKey((name) => Deno.env.get(name)),
  fromEmail: Deno.env.get("FROM_EMAIL") ?? "MOY IQ <licencias@moyiq.app>",
};
const DAILY_LIMIT = dailyLimitFrom(Deno.env.get("REPORT_EMAIL_DAILY_LIMIT"));


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

  const { licenseKey, to, clientName, month, pdfBase64, filename, lang } = payload ?? {};

  if (!isValidEmail(to)) {
    return json({ ok: false, error: "invalid_email" }, 400, origin);
  }
  if (!isPdfSizeOk(pdfBase64)) {
    return json({ ok: false, error: "invalid_pdf" }, 400, origin);
  }
  if (typeof filename !== "string" || filename.length === 0 || filename.length > 200) {
    return json({ ok: false, error: "invalid_filename" }, 400, origin);
  }

  const token = bearerToken(req.headers.get("Authorization"));
  const user = token ? await getAuthUser(token, config) : null;
  if (!user) {
    return json({ ok: false, error: "session_required" }, 401, origin);
  }

  const claim = await claimReportSend(user.id, typeof licenseKey === "string" ? licenseKey : "", config, DAILY_LIMIT);
  if (!claim.ok) {
    return json({ ok: false, error: claim.error }, CLAIM_STATUS[claim.error], origin);
  }

  const result = await sendReportEmail(
    {
      to,
      clientName: typeof clientName === "string" ? clientName.slice(0, 200) : "",
      month: typeof month === "string" ? month.slice(0, 20) : "",
      lang: pickLang(lang), // idioma de la app que envía; inválido o ausente → es
      pdfBase64,
      filename,
      senderEmail: user.email,
    },
    config,
  );

  return json(result, result.ok ? 200 : 502, origin);
});
