// Copy de los tres correos de la prueba de 14 días de Pro SIN tarjeta (modelo A,
// decisión D3 del 26-nov-2026) en los 4 idiomas de la app. No hablan de cobros:
// la prueba no pide tarjeta ni se convierte sola en pago. Voz de producto: sin
// exclamaciones ni emoji, sin voseo, alemán de "Sie", los 4 igual de secos.
import type { EmailLang } from "../_shared/emailLang.ts";

export type ProTrialStep = "welcome" | "day10" | "ended";
export const PRO_TRIAL_STEPS: ProTrialStep[] = ["welcome", "day10", "ended"];

export interface StepCopy { subject: string; paragraphs: string[]; cta: string }
export interface ProTrialCopy {
  welcome: (endDate: string) => StepCopy;
  day10: (daysLeft: number, endDate: string) => StepCopy;
  ended: StepCopy;
  why: string;
}

export const PRO_TRIAL_TEMPLATES: Record<EmailLang, ProTrialCopy> = {
  es: {
    welcome: (d) => ({
      subject: "Tu prueba de moyiq Pro está activa",
      paragraphs: [
        `Tienes Pro hasta el ${d}, sin tarjeta y sin ningún cobro. Al terminar, tu cuenta vuelve a Starter y tus datos siguen en tu dispositivo.`,
        "Para aprovecharla: activa la sincronización entre tus dispositivos, abre Modo Asesor con el mes en curso y prueba la herramienta fiscal de tu país.",
      ],
      cta: "Abrir moyiq",
    }),
    day10: (n, d) => ({
      subject: `Te quedan ${n} días de moyiq Pro`,
      paragraphs: [
        `Tu prueba de Pro termina el ${d}. Ese día tu cuenta vuelve a Starter sin perder nada: no se cobra nada y tus datos siguen aquí.`,
        "Si quieres seguir con Pro, puedes elegir un plan en la versión web de la app, en Ajustes › Suscripción y plan.",
      ],
      cta: "Ver Pro",
    }),
    ended: {
      subject: "Volviste a Starter; tus datos siguen aquí",
      paragraphs: [
        "Terminaron tus 14 días de Pro y no se cobró nada. Todo lo que anotaste sigue en la app y Starter es gratis para siempre.",
        "Para volver a Pro, abre la versión web de la app y entra a Ajustes › Suscripción y plan.",
      ],
      cta: "Pasar a Pro",
    },
    why: "Recibes este correo porque empezaste la prueba de Pro en tu cuenta de moyiq.",
  },
  en: {
    welcome: (d) => ({
      subject: "Your moyiq Pro trial is active",
      paragraphs: [
        `You have Pro until ${d}, with no card and no charge at all. When it ends, your account goes back to Starter and your data stays on your device.`,
        "To make the most of it: turn on sync between your devices, open Advisor Mode with the current month and try the tax tool for your country.",
      ],
      cta: "Open moyiq",
    }),
    day10: (n, d) => ({
      subject: `${n} days of moyiq Pro left`,
      paragraphs: [
        `Your Pro trial ends on ${d}. That day your account goes back to Starter without losing anything: nothing is charged and your data stays here.`,
        "If you want to keep Pro, you can choose a plan in the web version of the app, under Settings › Subscription and plan.",
      ],
      cta: "See Pro",
    }),
    ended: {
      subject: "You are back on Starter; your data is still here",
      paragraphs: [
        "Your 14 days of Pro have ended and nothing was charged. Everything you recorded is still in the app, and Starter is free forever.",
        "To go back to Pro, open the web version of the app and go to Settings › Subscription and plan.",
      ],
      cta: "Upgrade to Pro",
    },
    why: "You are receiving this email because you started the Pro trial on your moyiq account.",
  },
  pt: {
    welcome: (d) => ({
      subject: "Seu teste do moyiq Pro está ativo",
      paragraphs: [
        `Você tem o Pro até ${d}, sem cartão e sem nenhuma cobrança. Ao terminar, sua conta volta ao Starter e seus dados continuam no seu dispositivo.`,
        "Para aproveitar: ative a sincronização entre seus dispositivos, abra o Modo Consultor com o mês atual e experimente a ferramenta fiscal do seu país.",
      ],
      cta: "Abrir o moyiq",
    }),
    day10: (n, d) => ({
      subject: `Faltam ${n} dias de moyiq Pro`,
      paragraphs: [
        `Seu teste do Pro termina em ${d}. Nesse dia sua conta volta ao Starter sem perder nada: nada é cobrado e seus dados continuam aqui.`,
        "Se quiser continuar com o Pro, você pode escolher um plano na versão web do app, em Configurações › Assinatura e plano.",
      ],
      cta: "Ver o Pro",
    }),
    ended: {
      subject: "Você voltou ao Starter; seus dados continuam aqui",
      paragraphs: [
        "Seus 14 dias de Pro terminaram e nada foi cobrado. Tudo o que você anotou continua no app, e o Starter é gratuito para sempre.",
        "Para voltar ao Pro, abra a versão web do app e vá em Configurações › Assinatura e plano.",
      ],
      cta: "Passar para o Pro",
    },
    why: "Você recebe este e-mail porque começou o teste do Pro na sua conta do moyiq.",
  },
  de: {
    welcome: (d) => ({
      subject: "Ihr Test von moyiq Pro ist aktiv",
      paragraphs: [
        `Sie haben Pro bis zum ${d}, ohne Karte und ohne jede Abbuchung. Danach wechselt Ihr Konto zu Starter, und Ihre Daten bleiben auf Ihrem Gerät.`,
        "So nutzen Sie den Test: Schalten Sie die Synchronisierung zwischen Ihren Geräten ein, öffnen Sie den Beratermodus mit dem laufenden Monat und probieren Sie das Steuerwerkzeug für Ihr Land.",
      ],
      cta: "moyiq öffnen",
    }),
    day10: (n, d) => ({
      subject: `Noch ${n} Tage moyiq Pro`,
      paragraphs: [
        `Ihr Pro-Test endet am ${d}. An diesem Tag wechselt Ihr Konto zu Starter, ohne dass etwas verloren geht: Es wird nichts berechnet, und Ihre Daten bleiben erhalten.`,
        "Wenn Sie Pro behalten möchten, können Sie in der Webversion der App unter Einstellungen › Abo und Tarif einen Tarif wählen.",
      ],
      cta: "Pro ansehen",
    }),
    ended: {
      subject: "Sie nutzen wieder Starter; Ihre Daten sind noch da",
      paragraphs: [
        "Ihre 14 Tage Pro sind vorbei, berechnet wurde nichts. Alles, was Sie erfasst haben, bleibt in der App, und Starter ist dauerhaft kostenlos.",
        "Um wieder zu Pro zu wechseln, öffnen Sie die Webversion der App und gehen Sie zu Einstellungen › Abo und Tarif.",
      ],
      cta: "Zu Pro wechseln",
    },
    why: "Sie erhalten diese E-Mail, weil Sie den Pro-Test in Ihrem moyiq-Konto gestartet haben.",
  },
};
