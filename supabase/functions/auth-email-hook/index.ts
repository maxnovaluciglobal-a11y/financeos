// supabase/functions/auth-email-hook/index.ts
// Supabase Auth "Send Email Hook" — reemplaza el envío nativo de Supabase
// (plantilla genérica, sin marca) para TODOS los correos de auth del
// proyecto compartido MOY IQ + Invest. Configurado en el dashboard
// (Authentication → Hooks → Send Email) apuntando a esta función, con el
// secreto SEND_EMAIL_HOOK_SECRET generado ahí mismo.
//
// La lógica vive en ./emailHookLogic.ts — index.ts es solo wiring y NO se
// testea (lee Deno.env.get(), no importable desde Node), mismo patrón que
// send-nurture-diagnostico-email/index.ts.
import { Webhook } from 'npm:standardwebhooks@^1';
import { detectBrand, buildActionUrl, renderEmail, sendViaResend } from './emailHookLogic.ts';

// RESEND_API_KEY (el secret genérico) devuelve 403 al mandar desde
// hola@moyiq.app / invest@moyiq.app — parece estar scopeada a otro
// remitente (licencias@moyiq.app, usada por stripe-webhook). Se reusa
// NURTURE_RESEND_API_KEY, ya verificada funcionando con hola@moyiq.app
// (send-nurture-diagnostico-email).
const RESEND_API_KEY = Deno.env.get('NURTURE_RESEND_API_KEY') ?? Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const HOOK_SECRET = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? '').replace('v1,whsec_', '');

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  let verified: any;
  try {
    const wh = new Webhook(HOOK_SECRET);
    verified = wh.verify(payload, headers);
  } catch (err) {
    // Firma inválida: NUNCA mandar el correo sin verificar — cualquiera
    // podría spamear a un email arbitrario con nuestro remitente verificado.
    console.error('auth-email-hook: firma inválida', err);
    return Response.json({ error: { message: 'invalid signature' } }, { status: 401 });
  }

  const { user, email_data } = verified;
  const brand = detectBrand(email_data?.redirect_to);
  const actionUrl = buildActionUrl(
    { supabaseUrl: SUPABASE_URL },
    email_data.token_hash,
    email_data.email_action_type,
    email_data.redirect_to,
  );
  const rendered = renderEmail(brand, email_data.email_action_type, actionUrl);

  const sent = await sendViaResend(user.email, rendered, RESEND_API_KEY);
  if (!sent.ok) {
    // Supabase reintenta el hook si devolvemos error — no devolver 200 en
    // falso ante un fallo real de envío.
    return Response.json({ error: { message: sent.error ?? 'send_failed' } }, { status: 500 });
  }
  return Response.json({});
});
