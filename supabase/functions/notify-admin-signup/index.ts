// supabase/functions/notify-admin-signup/index.ts
// Dos formas de llamarla:
//   1. Trigger SQL (pg_net.http_post) al registrarse un Starter — ver
//      sync_starter_lead_to_crm() en supabase/migrations/*_starter_notify.sql
//   2. Directo desde el cliente de invest-web, justo después de un signUp()
//      exitoso (no hay tabla server-side propia de Invest que distinga
//      "es un signup nuevo" del resto de auth.users, igual limitación que
//      la detección de marca del auth-email-hook — ver ese archivo).
// Autenticación: header x-internal-secret contra el mismo cron_secret ya
// guardado en private.app_secrets — reusado, no es un secreto nuevo que
// mantener. No usa verify_jwt porque el caller es SQL (pg_net) o un cliente
// anon, ninguno de los dos trae un JWT de servicio.
import { sendAdminNotify, type SignupEvent, type SignupDetails } from './notifyLogic.ts';

const RESEND_API_KEY = Deno.env.get('NURTURE_RESEND_API_KEY') ?? Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL = Deno.env.get('NURTURE_FROM_EMAIL') ?? 'MOY IQ <hola@moyiq.app>';
const ALERT_EMAIL = Deno.env.get('ALERT_EMAIL') ?? 'maxnovaluciglobal@gmail.com';
const INTERNAL_SECRET = Deno.env.get('CRON_SECRET') ?? '';

const VALID_EVENTS: SignupEvent[] = ['starter_signup', 'invest_signup'];

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const provided = req.headers.get('x-internal-secret') ?? '';
  if (!INTERNAL_SECRET || provided !== INTERNAL_SECRET) {
    return Response.json({ error: { message: 'unauthorized' } }, { status: 401 });
  }

  let body: { event?: string; email?: string; fuente?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: { message: 'invalid json' } }, { status: 400 });
  }

  if (!body.event || !VALID_EVENTS.includes(body.event as SignupEvent) || !body.email) {
    return Response.json({ error: { message: 'missing event or email' } }, { status: 400 });
  }

  const details: SignupDetails = { email: body.email, fuente: body.fuente ?? null };
  const sent = await sendAdminNotify(body.event as SignupEvent, details, {
    resendApiKey: RESEND_API_KEY,
    fromEmail: FROM_EMAIL,
    alertEmail: ALERT_EMAIL,
  });
  if (!sent.ok) return Response.json({ error: { message: sent.error ?? 'send_failed' } }, { status: 500 });
  return Response.json({});
});
