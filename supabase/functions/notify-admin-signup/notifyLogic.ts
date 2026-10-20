// supabase/functions/notify-admin-signup/notifyLogic.ts
//
// Notificación admin de altas nuevas (Starter, Invest) — pedido de Walter
// 14-sep-2026: "no me llega ninguna notificación cuando se registran,
// debería llegarme algo... como cuando alguien se registra para el demo en
// DypOS". Mismo criterio que `notifyKeyDeliveryFailure` en
// stripe-webhook/webhookLogic.ts (que ya cubre la compra Pro, vía
// config.alertEmail = maxnovaluciglobal@gmail.com) — esta función cubre los
// otros dos eventos de alta que no pasan por Stripe.
//
// Separada de index.ts por el mismo motivo que el resto de funciones de este
// repo: index.ts lee Deno.env.get() a nivel de módulo, no importable desde
// Node/vitest.
import { emailButton, emailLayout, EMAIL_BRAND } from '../_shared/emailLayout.ts';

export type SignupEvent = 'starter_signup' | 'invest_signup';

export interface SignupDetails {
  email: string;
  fuente?: string | null; // starter: de dónde vino (UTM); invest: opcional
}

export interface NotifyConfig {
  resendApiKey?: string;
  fromEmail: string; // "MOY IQ <hola@moyiq.app>"
  alertEmail: string; // maxnovaluciglobal@gmail.com — decisión de Walter 14-sep
}

interface Copy {
  subject: string;
  eyebrow: string; // "Nuevo Starter" / "Nuevo en Invest"
  tag: string; // etiqueta junto al logo del layout de marca
}

// Layout de marca compartido (BRD-5) para los dos tipos de alta; el origen
// se distingue por la etiqueta junto al logo ("Invest · Panel admin").
function copyFor(event: SignupEvent): Copy {
  if (event === 'invest_signup') {
    return { subject: 'Nuevo registro — Invest', eyebrow: 'Nuevo en Invest', tag: 'Invest · Panel admin' };
  }
  return { subject: 'Nuevo Starter — MOY IQ', eyebrow: 'Nuevo Starter', tag: 'Panel admin' };
}

function fmtNow(): string {
  return new Date().toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Santiago' });
}

export function renderNotifyEmail(event: SignupEvent, details: SignupDetails): { subject: string; html: string } {
  const copy = copyFor(event);
  const label = `font-size:11px;color:${EMAIL_BRAND.muted};text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px`;
  const html = emailLayout({
    lang: 'es',
    tag: copy.tag,
    bodyHtml: `<p style="margin:0 0 16px;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${EMAIL_BRAND.laton700}">${copy.eyebrow}</p>
          <div style="${label}">Email</div>
          <div style="font-size:19px;font-weight:600;color:${EMAIL_BRAND.navy};word-break:break-all;margin-bottom:${details.fuente ? '16' : '22'}px">${details.email}</div>
          ${details.fuente ? `
          <div style="${label}">Fuente</div>
          <div style="font-size:14px;color:${EMAIL_BRAND.ink};margin-bottom:22px">${details.fuente}</div>
          ` : ''}
          ${emailButton('https://app.moyiq.app/app/?admin=crm', 'Ver en el panel CRM →')}`,
    footerHtml: `${fmtNow()} · MOY IQ, notificación automática`,
  });
  return { subject: copy.subject, html };
}

export async function sendAdminNotify(
  event: SignupEvent,
  details: SignupDetails,
  config: NotifyConfig,
): Promise<{ ok: boolean; error?: string }> {
  if (!config.resendApiKey) return { ok: false, error: 'resend_not_configured' };
  const { subject, html } = renderNotifyEmail(event, details);
  const body = { from: config.fromEmail, to: config.alertEmail, subject, html };
  const attempt = () =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  let res = await attempt();
  if (!res.ok) {
    console.warn(`notify-admin-signup: intento 1 falló (${res.status}) — reintentando`);
    res = await attempt();
  }
  if (!res.ok) {
    const text = await res.text();
    console.error(`notify-admin-signup: Resend error tras reintento: ${res.status} ${text}`);
    return { ok: false, error: `resend_${res.status}` };
  }
  return { ok: true };
}
