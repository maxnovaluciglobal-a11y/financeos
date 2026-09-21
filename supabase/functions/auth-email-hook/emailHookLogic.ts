// supabase/functions/auth-email-hook/emailHookLogic.ts
//
// Lógica pura del Auth "Send Email Hook" compartido entre MOY IQ e Invest
// (mismo proyecto Supabase, mismo auth.users — ver CLAUDE.md de invest-web,
// sección "Infraestructura compartida con MOY IQ"). Sin este hook, Supabase
// manda TODOS los correos de auth (reset, confirmación...) con su plantilla
// genérica de default, sin marca — pedido de Walter 14-sep-2026: separar la
// marca por producto en todo el flujo.
//
// Separada de index.ts por el mismo motivo que nurtureEmailLogic.ts:
// index.ts lee Deno.env.get() a nivel de módulo y no se puede importar desde
// Node/vitest.
//
// --- Cómo se detecta la marca -----------------------------------------------
// auth.users es UNA sola tabla para los dos productos — no hay columna de
// "producto" en el usuario. La señal confiable es `email_data.redirect_to`:
// ambas apps arman ese valor con `window.location.origin` (ver
// resetPasswordForEmail en financeos-app/src/core/auth.js e
// invest-web/app/index.html línea ~11284) y a partir de esta tarea TAMBIÉN
// signUp() en las dos, vía `options.emailRedirectTo` — antes solo recovery
// lo pasaba, signup caía al Site URL único del proyecto y hubiera sido
// indistinguible. Sin ese fix, cualquier email de confirmación de cuenta
// (signup) llegaría marcado como MOY IQ sin importar de qué app vino.
export type Brand = 'moyiq' | 'invest';

export function detectBrand(redirectTo: string | null | undefined): Brand {
  const url = String(redirectTo || '');
  // invest.moyiq.app es el dominio real; invest.financeospro.com queda como
  // red de seguridad por si algún link viejo todavía apunta ahí (mismo
  // criterio que el resto del código con el legacy financeospro.com).
  if (/invest\.moyiq\.app|invest\.financeospro\.com/i.test(url)) return 'invest';
  return 'moyiq'; // default: MOY IQ es el producto primario, con más usuarios reales
}

export type EmailActionType =
  | 'signup'
  | 'recovery'
  | 'magiclink'
  | 'email_change'
  | 'invite'
  | 'reauthentication';

export interface EmailHookConfig {
  supabaseUrl: string; // para armar la URL de /auth/v1/verify
  resendApiKey?: string;
}

// Mismo patrón que usa Supabase internamente: no se genera un link propio,
// se apunta al endpoint /auth/v1/verify del proyecto con el token_hash — eso
// es lo que efectivamente crea la sesión y (para "recovery") dispara el
// evento PASSWORD_RECOVERY del lado cliente cuando redirige de vuelta a
// redirect_to (ver App.jsx, que ya escucha ese evento).
export function buildActionUrl(
  config: EmailHookConfig,
  tokenHash: string,
  actionType: EmailActionType,
  redirectTo: string,
): string {
  const base = `${config.supabaseUrl.replace(/\/$/, '')}/auth/v1/verify`;
  const params = new URLSearchParams({ token: tokenHash, type: actionType, redirect_to: redirectTo });
  return `${base}?${params.toString()}`;
}

interface BrandTheme {
  fromEmail: string;
  bg: string;
  card: string;
  text: string;
  text2: string;
  accent: string;
  accentText: string; // color de texto ENCIMA del botón de acento
  wordmarkHtml: string;
  footer: string;
}

const THEMES: Record<Brand, BrandTheme> = {
  moyiq: {
    fromEmail: 'MOY IQ <hola@moyiq.app>',
    bg: '#F1EEE6', // --papel
    card: '#FAF8F2', // --papel-000
    text: '#14213D', // --navy
    text2: '#5F5236', // --ink3
    accent: '#8A6329', // --laton-700 (variante de TEXTO, AA en texto chico)
    accentText: '#FAF8F2',
    wordmarkHtml: 'MOY <span style="border:1px solid #8A6329;border-radius:3px;padding:1px 4px;font-size:11px;letter-spacing:0">IQ</span>',
    footer: 'MOY IQ · MAXNOVA &amp; LUCI Global LLC.',
  },
  invest: {
    fromEmail: 'MOY IQ Invest <invest@moyiq.app>', // mismo dominio raíz ya verificado en Resend, sin trabajo de DNS nuevo
    bg: '#12161F',
    card: '#181D29',
    text: '#FAF8F2', // --bright
    text2: '#9C9686', // --text2
    accent: '#CC9A52', // --grn (dorado de marca Invest)
    accentText: '#14213D', // --on-accent
    wordmarkHtml: 'MOY <span style="border:1px solid #CC9A52;color:#CC9A52;border-radius:3px;padding:1px 4px;font-size:11px;letter-spacing:0">IQ</span> <span style="font-size:12px;color:#9C9686">Invest</span>',
    footer: 'MOY IQ Invest · MAXNOVA &amp; LUCI Global LLC.',
  },
};

interface Copy {
  subject: string;
  heading: string;
  body: string; // HTML, antes del botón
  cta: string;
  afterCta?: string; // HTML opcional, después del botón (p.ej. aviso de "si no fuiste vos")
}

// Copy en español únicamente — mismo criterio que el resto de correos
// transaccionales de este proyecto (nurture, licencias), que hoy solo
// mandan en español pese a que la UI soporta 4 idiomas (ver
// nurtureEmailLogic.ts, misma limitación documentada ahí).
function copyFor(brand: Brand, actionType: EmailActionType): Copy {
  const productName = brand === 'invest' ? 'MOY IQ Invest' : 'MOY IQ';
  switch (actionType) {
    case 'recovery':
      return {
        subject: 'Restablecé tu contraseña',
        heading: 'Restablecé tu contraseña',
        body: `Recibimos un pedido para cambiar la contraseña de tu cuenta de ${productName}. Si fuiste vos, hacé click abajo para elegir una nueva.`,
        cta: 'Elegir contraseña nueva',
        afterCta: 'Si no pediste esto, podés ignorar este correo — tu contraseña actual sigue funcionando.',
      };
    case 'signup':
      return {
        subject: `Confirmá tu cuenta de ${productName}`,
        heading: 'Confirmá tu email',
        body: `Un paso más para activar tu cuenta de ${productName}.`,
        cta: 'Confirmar email',
      };
    case 'magiclink':
      return {
        subject: `Tu enlace de acceso a ${productName}`,
        heading: 'Entrá a tu cuenta',
        body: `Usá el enlace de abajo para entrar a ${productName}. Vence pronto y solo se puede usar una vez.`,
        cta: 'Entrar',
      };
    case 'email_change':
      return {
        subject: 'Confirmá tu nuevo email',
        heading: 'Confirmá tu nuevo email',
        body: `Pediste cambiar el email de tu cuenta de ${productName}.`,
        cta: 'Confirmar nuevo email',
        afterCta: 'Si no pediste este cambio, podés ignorar este correo.',
      };
    case 'invite':
      return {
        subject: `Te invitaron a ${productName}`,
        heading: 'Te invitaron',
        body: `Te invitaron a crear una cuenta en ${productName}.`,
        cta: 'Aceptar invitación',
      };
    default:
      return {
        subject: `${productName} — verificación`,
        heading: 'Verificación de cuenta',
        body: `Completá este paso para tu cuenta de ${productName}.`,
        cta: 'Continuar',
      };
  }
}

export interface RenderedEmail {
  subject: string;
  html: string;
  fromEmail: string;
}

export function renderEmail(brand: Brand, actionType: EmailActionType, actionUrl: string): RenderedEmail {
  const theme = THEMES[brand];
  const copy = copyFor(brand, actionType);
  const html = `
    <div style="background:${theme.bg};padding:32px 16px;font-family:system-ui,sans-serif">
      <div style="max-width:480px;margin:0 auto;background:${theme.card};border-radius:12px;padding:32px 28px">
        <div style="font-weight:700;font-size:16px;letter-spacing:.04em;text-transform:uppercase;margin-bottom:24px;color:${theme.text}">
          ${theme.wordmarkHtml}
        </div>
        <h1 style="color:${theme.text};font-size:19px;margin:0 0 12px">${copy.heading}</h1>
        <p style="color:${theme.text2};font-size:14px;line-height:1.6;margin:0 0 24px">${copy.body}</p>
        <a href="${actionUrl}" style="display:inline-block;background:${theme.accent};color:${theme.accentText};padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">${copy.cta} →</a>
        ${copy.afterCta ? `<p style="color:${theme.text2};font-size:12px;line-height:1.6;margin:24px 0 0">${copy.afterCta}</p>` : ''}
        <p style="color:${theme.text2};font-size:11px;margin-top:32px;border-top:1px solid rgba(128,128,128,.2);padding-top:12px">
          ${theme.footer}
        </p>
      </div>
    </div>`;
  return { subject: copy.subject, html, fromEmail: theme.fromEmail };
}

export async function sendViaResend(
  to: string,
  rendered: RenderedEmail,
  resendApiKey: string,
): Promise<{ ok: boolean; error?: string }> {
  const body = { from: rendered.fromEmail, to, subject: rendered.subject, html: rendered.html };
  const attempt = () =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  let res = await attempt();
  if (!res.ok) {
    console.warn(`auth-email-hook: intento 1 falló (${res.status}) — reintentando`);
    res = await attempt();
  }
  if (!res.ok) {
    const text = await res.text();
    console.error(`auth-email-hook: Resend error tras reintento: ${res.status} ${text}`);
    return { ok: false, error: `resend_${res.status}` };
  }
  return { ok: true };
}
