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
import type { EmailLang } from '../_shared/emailLang.ts';
export { pickLang } from '../_shared/emailLang.ts';

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
  afterCta?: string; // HTML opcional, después del botón (p.ej. aviso de "si no lo pediste")
}

// Copy en los 4 idiomas de la app (antes solo español). El idioma sale de
// user.user_metadata.lang (ver index.ts y signUpWithPassword en
// financeos-app/src/core/auth.js); sin él, español. Mismo registro seco en los
// cuatro: nada de exclamaciones ni "por favor" (voz-de-producto.md); alemán
// con "Sie".
type CopyFn = (productName: string) => Copy;
const COPY: Record<EmailLang, Record<EmailActionType | 'default', CopyFn>> = {
  es: {
    recovery: (p) => ({
      subject: 'Restablece tu contraseña',
      heading: 'Restablece tu contraseña',
      body: `Recibimos un pedido para cambiar la contraseña de tu cuenta de ${p}. Si lo pediste tú, usa el botón de abajo para elegir una nueva.`,
      cta: 'Elegir contraseña nueva',
      afterCta: 'Si no lo pediste, puedes ignorar este correo. Tu contraseña actual sigue funcionando.',
    }),
    signup: (p) => ({ subject: `Confirma tu cuenta de ${p}`, heading: 'Confirma tu email', body: `Un paso más para activar tu cuenta de ${p}.`, cta: 'Confirmar email' }),
    magiclink: (p) => ({ subject: `Tu enlace de acceso a ${p}`, heading: 'Entra a tu cuenta', body: `Usa el enlace de abajo para entrar a ${p}. Vence pronto y solo se puede usar una vez.`, cta: 'Entrar' }),
    email_change: (p) => ({ subject: 'Confirma tu nuevo email', heading: 'Confirma tu nuevo email', body: `Pediste cambiar el email de tu cuenta de ${p}.`, cta: 'Confirmar nuevo email', afterCta: 'Si no pediste este cambio, puedes ignorar este correo.' }),
    invite: (p) => ({ subject: `Te invitaron a ${p}`, heading: 'Te invitaron', body: `Te invitaron a crear una cuenta en ${p}.`, cta: 'Aceptar invitación' }),
    reauthentication: (p) => ({ subject: `${p} — verificación`, heading: 'Verificación de cuenta', body: `Completa este paso para tu cuenta de ${p}.`, cta: 'Continuar' }),
    default: (p) => ({ subject: `${p} — verificación`, heading: 'Verificación de cuenta', body: `Completa este paso para tu cuenta de ${p}.`, cta: 'Continuar' }),
  },
  en: {
    recovery: (p) => ({
      subject: 'Reset your password',
      heading: 'Reset your password',
      body: `We got a request to change the password for your ${p} account. If it was you, use the button below to choose a new one.`,
      cta: 'Choose a new password',
      afterCta: "If you didn't ask for this, you can ignore this email. Your current password still works.",
    }),
    signup: (p) => ({ subject: `Confirm your ${p} account`, heading: 'Confirm your email', body: `One more step to activate your ${p} account.`, cta: 'Confirm email' }),
    magiclink: (p) => ({ subject: `Your ${p} sign-in link`, heading: 'Sign in to your account', body: `Use the link below to sign in to ${p}. It expires soon and works only once.`, cta: 'Sign in' }),
    email_change: (p) => ({ subject: 'Confirm your new email', heading: 'Confirm your new email', body: `You asked to change the email on your ${p} account.`, cta: 'Confirm new email', afterCta: "If you didn't ask for this change, you can ignore this email." }),
    invite: (p) => ({ subject: `You've been invited to ${p}`, heading: "You've been invited", body: `You've been invited to create an account on ${p}.`, cta: 'Accept invitation' }),
    reauthentication: (p) => ({ subject: `${p} — verification`, heading: 'Account verification', body: `Complete this step for your ${p} account.`, cta: 'Continue' }),
    default: (p) => ({ subject: `${p} — verification`, heading: 'Account verification', body: `Complete this step for your ${p} account.`, cta: 'Continue' }),
  },
  pt: {
    recovery: (p) => ({
      subject: 'Redefina sua senha',
      heading: 'Redefina sua senha',
      body: `Recebemos um pedido para alterar a senha da sua conta ${p}. Se foi você, use o botão abaixo para escolher uma nova.`,
      cta: 'Escolher nova senha',
      afterCta: 'Se não foi você, pode ignorar este e-mail. Sua senha atual continua funcionando.',
    }),
    signup: (p) => ({ subject: `Confirme sua conta ${p}`, heading: 'Confirme seu e-mail', body: `Falta um passo para ativar sua conta ${p}.`, cta: 'Confirmar e-mail' }),
    magiclink: (p) => ({ subject: `Seu link de acesso ao ${p}`, heading: 'Entre na sua conta', body: `Use o link abaixo para entrar no ${p}. Ele expira em breve e só pode ser usado uma vez.`, cta: 'Entrar' }),
    email_change: (p) => ({ subject: 'Confirme seu novo e-mail', heading: 'Confirme seu novo e-mail', body: `Você pediu para alterar o e-mail da sua conta ${p}.`, cta: 'Confirmar novo e-mail', afterCta: 'Se não pediu esta alteração, pode ignorar este e-mail.' }),
    invite: (p) => ({ subject: `Você foi convidado para o ${p}`, heading: 'Você foi convidado', body: `Você foi convidado a criar uma conta no ${p}.`, cta: 'Aceitar convite' }),
    reauthentication: (p) => ({ subject: `${p} — verificação`, heading: 'Verificação da conta', body: `Conclua este passo para sua conta ${p}.`, cta: 'Continuar' }),
    default: (p) => ({ subject: `${p} — verificação`, heading: 'Verificação da conta', body: `Conclua este passo para sua conta ${p}.`, cta: 'Continuar' }),
  },
  de: {
    recovery: (p) => ({
      subject: 'Passwort zurücksetzen',
      heading: 'Passwort zurücksetzen',
      body: `Wir haben eine Anfrage erhalten, das Passwort Ihres ${p}-Kontos zu ändern. Wenn Sie das waren, wählen Sie über die Schaltfläche unten ein neues.`,
      cta: 'Neues Passwort wählen',
      afterCta: 'Wenn Sie das nicht angefordert haben, können Sie diese E-Mail ignorieren. Ihr aktuelles Passwort gilt weiter.',
    }),
    signup: (p) => ({ subject: `Bestätigen Sie Ihr ${p}-Konto`, heading: 'Bestätigen Sie Ihre E-Mail-Adresse', body: `Noch ein Schritt, um Ihr ${p}-Konto zu aktivieren.`, cta: 'E-Mail bestätigen' }),
    magiclink: (p) => ({ subject: `Ihr Anmeldelink für ${p}`, heading: 'Bei Ihrem Konto anmelden', body: `Melden Sie sich über den Link unten bei ${p} an. Er läuft bald ab und funktioniert nur einmal.`, cta: 'Anmelden' }),
    email_change: (p) => ({ subject: 'Bestätigen Sie Ihre neue E-Mail-Adresse', heading: 'Bestätigen Sie Ihre neue E-Mail-Adresse', body: `Sie haben beantragt, die E-Mail-Adresse Ihres ${p}-Kontos zu ändern.`, cta: 'Neue E-Mail bestätigen', afterCta: 'Wenn Sie diese Änderung nicht beantragt haben, können Sie diese E-Mail ignorieren.' }),
    invite: (p) => ({ subject: `Sie wurden zu ${p} eingeladen`, heading: 'Sie wurden eingeladen', body: `Sie wurden eingeladen, ein Konto bei ${p} zu erstellen.`, cta: 'Einladung annehmen' }),
    reauthentication: (p) => ({ subject: `${p} – Bestätigung`, heading: 'Kontobestätigung', body: `Schließen Sie diesen Schritt für Ihr ${p}-Konto ab.`, cta: 'Weiter' }),
    default: (p) => ({ subject: `${p} – Bestätigung`, heading: 'Kontobestätigung', body: `Schließen Sie diesen Schritt für Ihr ${p}-Konto ab.`, cta: 'Weiter' }),
  },
};

export function copyFor(brand: Brand, actionType: EmailActionType, lang: EmailLang = 'es'): Copy {
  const productName = brand === 'invest' ? 'MOY IQ Invest' : 'MOY IQ';
  const table = COPY[lang] ?? COPY.es;
  return (table[actionType] ?? table.default)(productName);
}

export interface RenderedEmail {
  subject: string;
  html: string;
  fromEmail: string;
}

export function renderEmail(brand: Brand, actionType: EmailActionType, actionUrl: string, lang: EmailLang = 'es'): RenderedEmail {
  const theme = THEMES[brand];
  const copy = copyFor(brand, actionType, lang);
  const html = `
    <div lang="${lang}" style="background:${theme.bg};padding:32px 16px;font-family:system-ui,sans-serif">
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
