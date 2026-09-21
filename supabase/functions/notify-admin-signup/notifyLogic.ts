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
  accent: string; // color de marca del producto de origen
  accentBg: string;
  accentText: string; // variante de texto AA sobre accentBg
}

// Mismas paletas que auth-email-hook/emailHookLogic.ts (navy/papel/latón para
// MOY IQ, oscuro/dorado para Invest) — un admin que ve los dos tipos de
// correo mezclados en su bandeja los reconoce por color sin leer el asunto.
function copyFor(event: SignupEvent): Copy {
  if (event === 'invest_signup') {
    return {
      subject: 'Nuevo registro — Invest',
      eyebrow: 'Nuevo en Invest',
      accent: '#CC9A52',
      accentBg: '#2A2114',
      accentText: '#E3B36B',
    };
  }
  return {
    subject: 'Nuevo Starter — MOY IQ',
    eyebrow: 'Nuevo Starter',
    accent: '#8A6329',
    accentBg: '#F1EEE6',
    accentText: '#8A6329',
  };
}

function fmtNow(): string {
  return new Date().toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Santiago' });
}

export function renderNotifyEmail(event: SignupEvent, details: SignupDetails): { subject: string; html: string } {
  const copy = copyFor(event);
  const html = `
    <div style="background:#F1EEE6;padding:32px 16px;font-family:-apple-system,'IBM Plex Sans',system-ui,sans-serif">
      <div style="max-width:440px;margin:0 auto;background:#FAF8F2;border-radius:14px;overflow:hidden">
        <div style="background:${copy.accentBg};padding:20px 28px">
          <div style="font-weight:700;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:${copy.accentText}">
            MOY <span style="border:1px solid ${copy.accentText};border-radius:3px;padding:1px 4px;font-size:10px;margin:0 2px">IQ</span>
            <span style="opacity:.7;font-weight:500">· Panel admin</span>
          </div>
          <div style="margin-top:10px;display:inline-block;background:rgba(255,255,255,.14);color:${copy.accentText};font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;padding:4px 10px;border-radius:6px">
            ${copy.eyebrow}
          </div>
        </div>
        <div style="padding:24px 28px 28px">
          <div style="font-size:11px;color:#9C9686;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Email</div>
          <div style="font-size:19px;font-weight:600;color:#14213D;word-break:break-all;margin-bottom:${details.fuente ? '16' : '22'}px">${details.email}</div>
          ${details.fuente ? `
          <div style="font-size:11px;color:#9C9686;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Fuente</div>
          <div style="font-size:14px;color:#5F5236;margin-bottom:22px">${details.fuente}</div>
          ` : ''}
          <a href="https://app.moyiq.app/app/?admin=crm" style="display:inline-block;background:#14213D;color:#FAF8F2;font-size:13px;font-weight:600;text-decoration:none;padding:11px 20px;border-radius:8px">Ver en el panel CRM →</a>
          <div style="margin-top:22px;padding-top:16px;border-top:1px solid rgba(20,33,61,.08);font-size:11px;color:#9C9686">
            ${fmtNow()} · MOY IQ, notificación automática
          </div>
        </div>
      </div>
    </div>`;
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
