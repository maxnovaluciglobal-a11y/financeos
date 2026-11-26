// supabase/functions/auth-email-hook/emailHookLogic.ts
//
// Lógica pura del Auth "Send Email Hook" compartido entre moyiq e Invest
// (mismo proyecto Supabase, mismo auth.users — ver CLAUDE.md de invest-web,
// sección "Infraestructura compartida con moyiq"). Sin este hook, Supabase
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
// (signup) llegaría marcado como moyiq sin importar de qué app vino.
import type { EmailLang } from '../_shared/emailLang.ts';
export { pickLang } from '../_shared/emailLang.ts';
import { emailButton, emailHeading, emailLayout, EMAIL_MUTED_STYLE } from '../_shared/emailLayout.ts';
import { htmlToText } from '../_shared/emailText.ts';
import { INVEST_LABEL, INVEST_SENDER_NAME, SENDER_NAME, SUPPORT_REPLY_TO, investSiteName } from '../_shared/emailSender.ts';

export type Brand = 'moyiq' | 'invest';

export function detectBrand(redirectTo: string | null | undefined): Brand {
  const url = String(redirectTo || '');
  // invest.moyiq.app es el único dominio de Invest (el anterior de FinanceOS
  // se desconectó el 20-oct-2026).
  if (/invest\.moyiq\.app/i.test(url)) return 'invest';
  return 'moyiq'; // default: Moyiq es el producto primario, con más usuarios reales
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

// Sistema visual único de los correos (BRD-5): las dos marcas usan el layout
// compartido (_shared/emailLayout.ts); Invest se distingue por la etiqueta
// junto al logo y conserva su remitente propio.
interface BrandTheme {
  fromEmail: string;
  tag?: string;
  footer: string;
}

const THEMES: Record<Brand, BrandTheme> = {
  moyiq: {
    fromEmail: `${SENDER_NAME} <hola@moyiq.app>`,
    footer: 'moyiq · MAXNOVA &amp; LUCI Global LLC.',
  },
  invest: {
    fromEmail: `${INVEST_SENDER_NAME} <invest@moyiq.app>`, // mismo dominio raíz ya verificado en Resend, sin trabajo de DNS nuevo
    tag: 'Invest', // se reemplaza por el nombre de la sección en el idioma del correo (INVEST_LABEL)
    footer: 'moyiq · Inversiones · MAXNOVA &amp; LUCI Global LLC.',
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
// Ningún asunto empieza con el nombre en minúscula ("moyiq — verificación"):
// la frase empieza por el verbo y el nombre va dentro.
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
    magiclink: (p) => ({ subject: `Tu enlace de acceso a ${p}`, heading: 'Entra a tu cuenta', body: `Usa el enlace de abajo para entrar a ${p}. Vence pronto y solo se puede usar una vez.`, cta: 'Entrar a mi cuenta' }),
    email_change: (p) => ({ subject: 'Confirma tu nuevo email', heading: 'Confirma tu nuevo email', body: `Pediste cambiar el email de tu cuenta de ${p}.`, cta: 'Confirmar nuevo email', afterCta: 'Si no pediste este cambio, puedes ignorar este correo.' }),
    invite: (p) => ({ subject: `Te invitaron a ${p}`, heading: 'Te invitaron', body: `Te invitaron a crear una cuenta en ${p}.`, cta: 'Aceptar invitación' }),
    reauthentication: (p) => ({ subject: `Verifica tu cuenta de ${p}`, heading: 'Verificación de cuenta', body: `Completa este paso para tu cuenta de ${p}.`, cta: 'Verificar mi cuenta' }),
    default: (p) => ({ subject: `Verifica tu cuenta de ${p}`, heading: 'Verificación de cuenta', body: `Completa este paso para tu cuenta de ${p}.`, cta: 'Verificar mi cuenta' }),
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
    magiclink: (p) => ({ subject: `Your ${p} sign-in link`, heading: 'Sign in to your account', body: `Use the link below to sign in to ${p}. It expires soon and works only once.`, cta: 'Sign in to my account' }),
    email_change: (p) => ({ subject: 'Confirm your new email', heading: 'Confirm your new email', body: `You asked to change the email on your ${p} account.`, cta: 'Confirm new email', afterCta: "If you didn't ask for this change, you can ignore this email." }),
    invite: (p) => ({ subject: `You've been invited to ${p}`, heading: "You've been invited", body: `You've been invited to create an account on ${p}.`, cta: 'Accept invitation' }),
    reauthentication: (p) => ({ subject: `Verify your ${p} account`, heading: 'Account verification', body: `Complete this step for your ${p} account.`, cta: 'Verify my account' }),
    default: (p) => ({ subject: `Verify your ${p} account`, heading: 'Account verification', body: `Complete this step for your ${p} account.`, cta: 'Verify my account' }),
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
    magiclink: (p) => ({ subject: `Seu link de acesso ao ${p}`, heading: 'Entre na sua conta', body: `Use o link abaixo para entrar no ${p}. Ele expira em breve e só pode ser usado uma vez.`, cta: 'Entrar na minha conta' }),
    email_change: (p) => ({ subject: 'Confirme seu novo e-mail', heading: 'Confirme seu novo e-mail', body: `Você pediu para alterar o e-mail da sua conta ${p}.`, cta: 'Confirmar novo e-mail', afterCta: 'Se não pediu esta alteração, pode ignorar este e-mail.' }),
    invite: (p) => ({ subject: `Você foi convidado para o ${p}`, heading: 'Você foi convidado', body: `Você foi convidado a criar uma conta no ${p}.`, cta: 'Aceitar convite' }),
    reauthentication: (p) => ({ subject: `Verifique sua conta ${p}`, heading: 'Verificação da conta', body: `Conclua este passo para sua conta ${p}.`, cta: 'Verificar minha conta' }),
    default: (p) => ({ subject: `Verifique sua conta ${p}`, heading: 'Verificação da conta', body: `Conclua este passo para sua conta ${p}.`, cta: 'Verificar minha conta' }),
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
    magiclink: (p) => ({ subject: `Ihr Anmeldelink für ${p}`, heading: 'Bei Ihrem Konto anmelden', body: `Melden Sie sich über den Link unten bei ${p} an. Er läuft bald ab und funktioniert nur einmal.`, cta: 'Bei meinem Konto anmelden' }),
    email_change: (p) => ({ subject: 'Bestätigen Sie Ihre neue E-Mail-Adresse', heading: 'Bestätigen Sie Ihre neue E-Mail-Adresse', body: `Sie haben beantragt, die E-Mail-Adresse Ihres ${p}-Kontos zu ändern.`, cta: 'Neue E-Mail bestätigen', afterCta: 'Wenn Sie diese Änderung nicht beantragt haben, können Sie diese E-Mail ignorieren.' }),
    invite: (p) => ({ subject: `Sie wurden zu ${p} eingeladen`, heading: 'Sie wurden eingeladen', body: `Sie wurden eingeladen, ein Konto bei ${p} zu erstellen.`, cta: 'Einladung annehmen' }),
    reauthentication: (p) => ({ subject: `Kontobestätigung für ${p}`, heading: 'Kontobestätigung', body: `Schließen Sie diesen Schritt für Ihr ${p}-Konto ab.`, cta: 'Konto bestätigen' }),
    default: (p) => ({ subject: `Kontobestätigung für ${p}`, heading: 'Kontobestätigung', body: `Schließen Sie diesen Schritt für Ihr ${p}-Konto ab.`, cta: 'Konto bestätigen' }),
  },
};

// Preheader (línea junto al asunto en la bandeja): qué pasa si no fue la
// persona, o cuánto dura el enlace. Suma al asunto, no lo repite.
const PREHEADER: Record<EmailLang, Record<EmailActionType | 'default', string>> = {
  es: {
    recovery: 'Si no lo pediste, ignora este correo: tu contraseña actual sigue funcionando.',
    signup: 'Un clic en el botón y tu cuenta queda activa.',
    magiclink: 'El enlace vence pronto y solo se puede usar una vez.',
    email_change: 'Si no pediste el cambio, ignora este correo.',
    invite: 'Acepta la invitación para crear tu cuenta.',
    reauthentication: 'Un paso de seguridad para tu cuenta.',
    default: 'Un paso de seguridad para tu cuenta.',
  },
  en: {
    recovery: "If you didn't ask for this, ignore this email: your current password still works.",
    signup: 'One click on the button and your account is active.',
    magiclink: 'The link expires soon and works only once.',
    email_change: "If you didn't ask for the change, ignore this email.",
    invite: 'Accept the invitation to create your account.',
    reauthentication: 'A security step for your account.',
    default: 'A security step for your account.',
  },
  pt: {
    recovery: 'Se não foi você, ignore este e-mail: sua senha atual continua funcionando.',
    signup: 'Um clique no botão e sua conta fica ativa.',
    magiclink: 'O link expira em breve e só pode ser usado uma vez.',
    email_change: 'Se não pediu a alteração, ignore este e-mail.',
    invite: 'Aceite o convite para criar sua conta.',
    reauthentication: 'Um passo de segurança para sua conta.',
    default: 'Um passo de segurança para sua conta.',
  },
  de: {
    recovery: 'Wenn Sie das nicht angefordert haben, ignorieren Sie diese E-Mail: Ihr aktuelles Passwort gilt weiter.',
    signup: 'Ein Klick auf die Schaltfläche, und Ihr Konto ist aktiv.',
    magiclink: 'Der Link läuft bald ab und funktioniert nur einmal.',
    email_change: 'Wenn Sie die Änderung nicht beantragt haben, ignorieren Sie diese E-Mail.',
    invite: 'Nehmen Sie die Einladung an, um Ihr Konto zu erstellen.',
    reauthentication: 'Ein Sicherheitsschritt für Ihr Konto.',
    default: 'Ein Sicherheitsschritt für Ihr Konto.',
  },
};

export function preheaderFor(actionType: EmailActionType, lang: EmailLang = 'es'): string {
  const table = PREHEADER[lang] ?? PREHEADER.es;
  return table[actionType] ?? table.default;
}

export function copyFor(brand: Brand, actionType: EmailActionType, lang: EmailLang = 'es'): Copy {
  const productName = brand === 'invest' ? investSiteName(lang) : SENDER_NAME;
  const table = COPY[lang] ?? COPY.es;
  return (table[actionType] ?? table.default)(productName);
}

export interface RenderedEmail {
  subject: string;
  html: string;
  // Parte de texto plano, derivada del HTML (_shared/emailText.ts).
  text: string;
  fromEmail: string;
}

export function renderEmail(brand: Brand, actionType: EmailActionType, actionUrl: string, lang: EmailLang = 'es'): RenderedEmail {
  const theme = THEMES[brand];
  const copy = copyFor(brand, actionType, lang);
  const html = emailLayout({
    lang,
    tag: theme.tag ? INVEST_LABEL[lang] ?? INVEST_LABEL.es : undefined,
    bodyHtml: `${emailHeading(copy.heading)}
        <p>${copy.body}</p>
        ${emailButton(actionUrl, `${copy.cta} →`)}
        ${copy.afterCta ? `<p style="${EMAIL_MUTED_STYLE}">${copy.afterCta}</p>` : ''}`,
    footerHtml: brand === 'invest' ? `${investSiteName(lang)} · MAXNOVA &amp; LUCI Global LLC.` : theme.footer,
    preheader: preheaderFor(actionType, lang),
    title: copy.subject,
  });
  return { subject: copy.subject, html, text: htmlToText(html), fromEmail: theme.fromEmail };
}

export async function sendViaResend(
  to: string,
  rendered: RenderedEmail,
  resendApiKey: string,
): Promise<{ ok: boolean; error?: string }> {
  const body = { from: rendered.fromEmail, to, reply_to: SUPPORT_REPLY_TO, subject: rendered.subject, html: rendered.html, text: rendered.text ?? htmlToText(rendered.html) };
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
