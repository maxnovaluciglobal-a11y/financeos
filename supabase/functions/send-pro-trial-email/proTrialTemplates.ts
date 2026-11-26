// Copy de los tres correos de la prueba de 14 días de Pro SIN tarjeta (modelo A,
// decisión D3 del 26-nov-2026) en los 4 idiomas de la app. No hablan de cobros:
// la prueba no pide tarjeta ni se convierte sola en pago. Voz de producto: sin
// exclamaciones ni emoji, sin voseo, alemán de "Sie", los 4 igual de secos.
import type { EmailLang } from "../_shared/emailLang.ts";

export type ProTrialStep = "welcome" | "day10" | "ended";
export const PRO_TRIAL_STEPS: ProTrialStep[] = ["welcome", "day10", "ended"];

// preheader: la línea que el cliente de correo muestra junto al asunto; suma un
// dato al asunto, no lo repite. cta: un solo botón, que dice adónde lleva.
export interface StepCopy { subject: string; preheader: string; paragraphs: string[]; cta: string }
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
      preheader: `Hasta el ${d}, sin tarjeta. Tres cosas para probar primero.`,
      paragraphs: [
        `Tienes Pro hasta el ${d}, sin tarjeta y sin ningún cobro. Al terminar, tu cuenta vuelve a Starter y tus datos siguen en tu dispositivo.`,
        "Para aprovecharla: activa la sincronización entre tus dispositivos, abre Modo Asesor con el mes en curso y prueba la herramienta fiscal de tu país.",
      ],
      cta: "Abrir Modo Asesor",
    }),
    day10: (n, d) => ({
      subject: `Te quedan ${n} días de moyiq Pro`,
      preheader: `Termina el ${d}. No se cobra nada y tus datos se quedan.`,
      paragraphs: [
        `Tu prueba de Pro termina el ${d}. Ese día tu cuenta vuelve a Starter sin perder nada: no se cobra nada y tus datos siguen aquí.`,
        "Si quieres seguir con Pro, puedes elegir un plan en la versión web de la app, en Ajustes › Suscripción y plan.",
      ],
      cta: "Elegir mi plan",
    }),
    ended: {
      subject: "Volviste a Starter; tus datos siguen aquí",
      preheader: "No se cobró nada. Starter sigue gratis y todo lo que anotaste está en la app.",
      paragraphs: [
        "Terminaron tus 14 días de Pro y no se cobró nada. Todo lo que anotaste sigue en la app y Starter es gratis para siempre.",
        "Para volver a Pro, abre la versión web de la app y entra a Ajustes › Suscripción y plan.",
      ],
      cta: "Ver los planes de Pro",
    },
    why: "Recibes este correo porque empezaste la prueba de Pro en tu cuenta de moyiq.",
  },
  en: {
    welcome: (d) => ({
      subject: "Your moyiq Pro trial is active",
      preheader: `Until ${d}, no card needed. Three things to try first.`,
      paragraphs: [
        `You have Pro until ${d}, with no card and no charge at all. When it ends, your account goes back to Starter and your data stays on your device.`,
        "To make the most of it: turn on sync between your devices, open Advisor Mode with the current month and try the tax tool for your country.",
      ],
      cta: "Open Advisor Mode",
    }),
    day10: (n, d) => ({
      subject: `${n} days of moyiq Pro left`,
      preheader: `It ends on ${d}. Nothing is charged and your data stays.`,
      paragraphs: [
        `Your Pro trial ends on ${d}. That day your account goes back to Starter without losing anything: nothing is charged and your data stays here.`,
        "If you want to keep Pro, you can choose a plan in the web version of the app, under Settings › Subscription and plan.",
      ],
      cta: "Choose my plan",
    }),
    ended: {
      subject: "You are back on Starter; your data is still here",
      preheader: "Nothing was charged. Starter stays free and everything you recorded is in the app.",
      paragraphs: [
        "Your 14 days of Pro have ended and nothing was charged. Everything you recorded is still in the app, and Starter is free forever.",
        "To go back to Pro, open the web version of the app and go to Settings › Subscription and plan.",
      ],
      cta: "See Pro plans",
    },
    why: "You are receiving this email because you started the Pro trial on your moyiq account.",
  },
  pt: {
    welcome: (d) => ({
      subject: "Seu teste do moyiq Pro está ativo",
      preheader: `Até ${d}, sem cartão. Três coisas para experimentar primeiro.`,
      paragraphs: [
        `Você tem o Pro até ${d}, sem cartão e sem nenhuma cobrança. Ao terminar, sua conta volta ao Starter e seus dados continuam no seu dispositivo.`,
        "Para aproveitar: ative a sincronização entre seus dispositivos, abra o Modo Consultor com o mês atual e experimente a ferramenta fiscal do seu país.",
      ],
      cta: "Abrir o Modo Consultor",
    }),
    day10: (n, d) => ({
      subject: `Faltam ${n} dias de moyiq Pro`,
      preheader: `Termina em ${d}. Nada é cobrado e seus dados ficam.`,
      paragraphs: [
        `Seu teste do Pro termina em ${d}. Nesse dia sua conta volta ao Starter sem perder nada: nada é cobrado e seus dados continuam aqui.`,
        "Se quiser continuar com o Pro, você pode escolher um plano na versão web do app, em Configurações › Assinatura e plano.",
      ],
      cta: "Escolher meu plano",
    }),
    ended: {
      subject: "Você voltou ao Starter; seus dados continuam aqui",
      preheader: "Nada foi cobrado. O Starter continua gratuito e tudo o que você anotou está no app.",
      paragraphs: [
        "Seus 14 dias de Pro terminaram e nada foi cobrado. Tudo o que você anotou continua no app, e o Starter é gratuito para sempre.",
        "Para voltar ao Pro, abra a versão web do app e vá em Configurações › Assinatura e plano.",
      ],
      cta: "Ver os planos do Pro",
    },
    why: "Você recebe este e-mail porque começou o teste do Pro na sua conta do moyiq.",
  },
  de: {
    welcome: (d) => ({
      subject: "Ihr Test von moyiq Pro ist aktiv",
      preheader: `Bis zum ${d}, ohne Karte. Drei Dinge, die Sie zuerst ausprobieren können.`,
      paragraphs: [
        `Sie haben Pro bis zum ${d}, ohne Karte und ohne jede Abbuchung. Danach wechselt Ihr Konto zu Starter, und Ihre Daten bleiben auf Ihrem Gerät.`,
        "So nutzen Sie den Test: Schalten Sie die Synchronisierung zwischen Ihren Geräten ein, öffnen Sie den Beratermodus mit dem laufenden Monat und probieren Sie das Steuerwerkzeug für Ihr Land.",
      ],
      cta: "Beratermodus öffnen",
    }),
    day10: (n, d) => ({
      subject: `Noch ${n} Tage moyiq Pro`,
      preheader: `Er endet am ${d}. Es wird nichts berechnet, und Ihre Daten bleiben.`,
      paragraphs: [
        `Ihr Pro-Test endet am ${d}. An diesem Tag wechselt Ihr Konto zu Starter, ohne dass etwas verloren geht: Es wird nichts berechnet, und Ihre Daten bleiben erhalten.`,
        "Wenn Sie Pro behalten möchten, können Sie in der Webversion der App unter Einstellungen › Abo und Tarif einen Tarif wählen.",
      ],
      cta: "Tarif wählen",
    }),
    ended: {
      subject: "Sie nutzen wieder Starter; Ihre Daten sind noch da",
      preheader: "Es wurde nichts berechnet. Starter bleibt kostenlos, und alles Erfasste ist in der App.",
      paragraphs: [
        "Ihre 14 Tage Pro sind vorbei, berechnet wurde nichts. Alles, was Sie erfasst haben, bleibt in der App, und Starter ist dauerhaft kostenlos.",
        "Um wieder zu Pro zu wechseln, öffnen Sie die Webversion der App und gehen Sie zu Einstellungen › Abo und Tarif.",
      ],
      cta: "Pro-Tarife ansehen",
    },
    why: "Sie erhalten diese E-Mail, weil Sie den Pro-Test in Ihrem moyiq-Konto gestartet haben.",
  },
};
