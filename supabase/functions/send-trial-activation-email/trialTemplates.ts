// Copy de la secuencia de activación de la prueba (C-35 / COM-10) en los 4
// idiomas de la app. Voz de producto: sin exclamaciones ni emoji, sin voseo,
// la app no se personifica; los 4 idiomas igual de secos.
import type { EmailLang } from "../_shared/emailLang.ts";

export type TrialStep = "day1" | "day3" | "day10";

export interface StepCopy {
  subject: string;
  paragraphs: string[];
  cta: string;
}

export interface TrialCopy {
  day1: StepCopy;
  day3: StepCopy;
  day10: (endDate: string) => StepCopy;
  cancelPortal: (portal: string) => string;
  cancelNoPortal: string;
  why: string;
  unsubscribe: string;
}

export const TRIAL_TEMPLATES: Record<EmailLang, TrialCopy> = {
  es: {
    day1: {
      subject: "Tu primer paso con MOY IQ Pro",
      paragraphs: [
        "Tu prueba de Pro ya está activa. El paso que más ayuda al principio es cargar tus movimientos.",
        "Importa la cartola de tu banco (CSV o Excel): la app sugiere la categoría de cada movimiento y tú la confirmas. Los datos se quedan en tu dispositivo.",
      ],
      cta: "Importar movimientos",
    },
    day3: {
      subject: "Lo que muestra Modo Asesor con tus datos",
      paragraphs: [
        "Con algunos movimientos cargados, Modo Asesor arma un diagnóstico del mes: flujo de caja, colchón de emergencia, carga de deuda y avance de tus metas, resumidos en el IQ Score.",
        "Puedes exportarlo en PDF para revisarlo con calma o compartirlo con quien te asesora.",
      ],
      cta: "Abrir Modo Asesor",
    },
    day10: (d) => ({
      subject: "Quedan 4 días de tu prueba de MOY IQ Pro",
      paragraphs: [
        `Tu prueba de Pro termina el ${d}. Si sigues, se cobra el plan que elegiste al empezar.`,
        "Antes de esa fecha conviene revisar tu resumen del mes y el IQ Score: es lo que Pro sigue calculando cada mes.",
      ],
      cta: "Ver mi resumen",
    }),
    cancelPortal: (p) => `Si prefieres no seguir, cancela antes de esa fecha desde <a href="${p}">tu portal de facturación</a> y no se cobra nada. Tus datos se quedan en tu dispositivo en cualquier caso.`,
    cancelNoPortal: "Si prefieres no seguir, escribe a support@moyiq.app antes de esa fecha y no se cobra nada. Tus datos se quedan en tu dispositivo en cualquier caso.",
    why: "Recibes este correo porque empezaste una prueba de MOY IQ Pro.",
    unsubscribe: "No recibir más correos de la prueba",
  },
  en: {
    day1: {
      subject: "Your first step with MOY IQ Pro",
      paragraphs: [
        "Your Pro trial is active. The step that helps most at the start is loading your transactions.",
        "Import your bank statement (CSV or Excel): the app suggests a category for each transaction and you confirm it. Your data stays on your device.",
      ],
      cta: "Import transactions",
    },
    day3: {
      subject: "What Advisor Mode shows with your data",
      paragraphs: [
        "With some transactions loaded, Advisor Mode builds a diagnosis of your month: cash flow, emergency cushion, debt load and progress on your goals, summarized in the IQ Score.",
        "You can export it as a PDF to review it calmly or share it with your advisor.",
      ],
      cta: "Open Advisor Mode",
    },
    day10: (d) => ({
      subject: "4 days left in your MOY IQ Pro trial",
      paragraphs: [
        `Your Pro trial ends on ${d}. If you continue, the plan you chose at the start is charged.`,
        "Before that date, it is worth reviewing your monthly summary and IQ Score: that is what Pro keeps calculating every month.",
      ],
      cta: "See my summary",
    }),
    cancelPortal: (p) => `If you would rather not continue, cancel before that date from <a href="${p}">your billing portal</a> and nothing is charged. Your data stays on your device either way.`,
    cancelNoPortal: "If you would rather not continue, write to support@moyiq.app before that date and nothing is charged. Your data stays on your device either way.",
    why: "You are receiving this email because you started a MOY IQ Pro trial.",
    unsubscribe: "Stop trial emails",
  },
  pt: {
    day1: {
      subject: "Seu primeiro passo com o MOY IQ Pro",
      paragraphs: [
        "Seu teste do Pro já está ativo. O passo que mais ajuda no começo é carregar seus movimentos.",
        "Importe o extrato do seu banco (CSV ou Excel): o app sugere a categoria de cada movimento e você confirma. Os dados ficam no seu dispositivo.",
      ],
      cta: "Importar movimentos",
    },
    day3: {
      subject: "O que o Modo Consultor mostra com seus dados",
      paragraphs: [
        "Com alguns movimentos carregados, o Modo Consultor monta um diagnóstico do mês: fluxo de caixa, reserva de emergência, peso das dívidas e avanço das suas metas, resumidos no IQ Score.",
        "Você pode exportá-lo em PDF para revisar com calma ou compartilhar com quem orienta você.",
      ],
      cta: "Abrir o Modo Consultor",
    },
    day10: (d) => ({
      subject: "Faltam 4 dias para o fim do seu teste do MOY IQ Pro",
      paragraphs: [
        `Seu teste do Pro termina em ${d}. Se você continuar, é cobrado o plano que escolheu no início.`,
        "Antes dessa data, vale revisar seu resumo do mês e o IQ Score: é o que o Pro continua calculando todo mês.",
      ],
      cta: "Ver meu resumo",
    }),
    cancelPortal: (p) => `Se preferir não continuar, cancele antes dessa data pelo <a href="${p}">seu portal de cobrança</a> e nada é cobrado. Seus dados ficam no seu dispositivo de qualquer forma.`,
    cancelNoPortal: "Se preferir não continuar, escreva para support@moyiq.app antes dessa data e nada é cobrado. Seus dados ficam no seu dispositivo de qualquer forma.",
    why: "Você recebe este e-mail porque começou um teste do MOY IQ Pro.",
    unsubscribe: "Não receber mais e-mails do teste",
  },
  de: {
    day1: {
      subject: "Ihr erster Schritt mit MOY IQ Pro",
      paragraphs: [
        "Ihre Pro-Testphase ist aktiv. Am Anfang hilft am meisten, Ihre Buchungen zu laden.",
        "Importieren Sie Ihren Kontoauszug (CSV oder Excel): Die App schlägt für jede Buchung eine Kategorie vor, die Sie bestätigen. Ihre Daten bleiben auf Ihrem Gerät.",
      ],
      cta: "Buchungen importieren",
    },
    day3: {
      subject: "Was der Beratermodus mit Ihren Daten zeigt",
      paragraphs: [
        "Mit einigen erfassten Buchungen erstellt der Beratermodus eine Diagnose Ihres Monats: Cashflow, Notgroschen, Schuldenlast und Fortschritt Ihrer Ziele, zusammengefasst im IQ Score.",
        "Sie können sie als PDF exportieren, um sie in Ruhe zu prüfen oder mit Ihrer Beratung zu teilen.",
      ],
      cta: "Beratermodus öffnen",
    },
    day10: (d) => ({
      subject: "Noch 4 Tage in Ihrer Testphase von MOY IQ Pro",
      paragraphs: [
        `Ihre Pro-Testphase endet am ${d}. Wenn Sie fortfahren, wird der Tarif berechnet, den Sie zu Beginn gewählt haben.`,
        "Vor diesem Datum lohnt sich ein Blick auf Ihre Monatsübersicht und den IQ Score: Das berechnet Pro jeden Monat weiter.",
      ],
      cta: "Meine Übersicht ansehen",
    }),
    cancelPortal: (p) => `Wenn Sie nicht fortfahren möchten, kündigen Sie vor diesem Datum über <a href="${p}">Ihr Abrechnungsportal</a>; es wird nichts berechnet. Ihre Daten bleiben in jedem Fall auf Ihrem Gerät.`,
    cancelNoPortal: "Wenn Sie nicht fortfahren möchten, schreiben Sie vor diesem Datum an support@moyiq.app; es wird nichts berechnet. Ihre Daten bleiben in jedem Fall auf Ihrem Gerät.",
    why: "Sie erhalten diese E-Mail, weil Sie eine Testphase von MOY IQ Pro begonnen haben.",
    unsubscribe: "Keine E-Mails zur Testphase mehr erhalten",
  },
};
