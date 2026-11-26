// Copy de la secuencia de activación de la prueba (C-35 / COM-10) en los 4
// idiomas de la app. Voz de producto: sin exclamaciones ni emoji, sin voseo,
// la app no se personifica; los 4 idiomas igual de secos.
import type { EmailLang } from "../_shared/emailLang.ts";

export type TrialStep = "day1" | "day3" | "day10";

export interface StepCopy {
  subject: string;
  preheader: string; // línea junto al asunto en la bandeja; suma un dato, no repite
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
      subject: "Tu primer paso con moyiq Pro",
      preheader: "Carga el último mes desde el archivo de tu banco; la app sugiere las categorías.",
      paragraphs: [
        "Tu prueba de Pro ya está activa. El paso que más ayuda al principio es cargar tus movimientos.",
        "Importa la cartola de tu banco (CSV o Excel): la app sugiere la categoría de cada movimiento y tú la confirmas. Los datos se quedan en tu dispositivo.",
      ],
      cta: "Importar movimientos",
    },
    day3: {
      subject: "Lo que muestra Modo Asesor con tus datos",
      preheader: "Un diagnóstico del mes en cuatro factores, resumido en el IQ Score y exportable en PDF.",
      paragraphs: [
        "Con algunos movimientos cargados, Modo Asesor arma un diagnóstico del mes: flujo de caja, colchón de emergencia, carga de deuda y avance de tus metas, resumidos en el IQ Score.",
        "Puedes exportarlo en PDF para revisarlo con calma o compartirlo con quien te asesora.",
      ],
      cta: "Abrir Modo Asesor",
    },
    day10: (d) => ({
      subject: "Quedan 4 días de tu prueba de moyiq Pro",
      preheader: `Tu prueba termina el ${d}. Antes, conviene revisar el resumen del mes.`,
      paragraphs: [
        `Tu prueba de Pro termina el ${d}. Si sigues, se cobra el plan que elegiste al empezar.`,
        "Antes de esa fecha conviene revisar tu resumen del mes y el IQ Score: es lo que Pro sigue calculando cada mes.",
      ],
      cta: "Ver mi resumen del mes",
    }),
    cancelPortal: (p) => `Si prefieres no seguir, cancela antes de esa fecha desde <a href="${p}">tu portal de facturación</a> y no se cobra nada. Tus datos se quedan en tu dispositivo en cualquier caso.`,
    cancelNoPortal: "Si prefieres no seguir, escribe a support@moyiq.app antes de esa fecha y no se cobra nada. Tus datos se quedan en tu dispositivo en cualquier caso.",
    why: "Recibes este correo porque empezaste una prueba de moyiq Pro.",
    unsubscribe: "No recibir más correos de la prueba",
  },
  en: {
    day1: {
      subject: "Your first step with moyiq Pro",
      preheader: "Load last month from your bank file; the app suggests the categories.",
      paragraphs: [
        "Your Pro trial is active. The step that helps most at the start is loading your transactions.",
        "Import your bank statement (CSV or Excel): the app suggests a category for each transaction and you confirm it. Your data stays on your device.",
      ],
      cta: "Import transactions",
    },
    day3: {
      subject: "What Advisor Mode shows with your data",
      preheader: "A diagnosis of the month in four factors, summed up in the IQ Score and exportable as PDF.",
      paragraphs: [
        "With some transactions loaded, Advisor Mode builds a diagnosis of your month: cash flow, emergency cushion, debt load and progress on your goals, summarized in the IQ Score.",
        "You can export it as a PDF to review it calmly or share it with your advisor.",
      ],
      cta: "Open Advisor Mode",
    },
    day10: (d) => ({
      subject: "4 days left in your moyiq Pro trial",
      preheader: `Your trial ends on ${d}. Before then, it is worth checking the month summary.`,
      paragraphs: [
        `Your Pro trial ends on ${d}. If you continue, the plan you chose at the start is charged.`,
        "Before that date, it is worth reviewing your monthly summary and IQ Score: that is what Pro keeps calculating every month.",
      ],
      cta: "See my month summary",
    }),
    cancelPortal: (p) => `If you would rather not continue, cancel before that date from <a href="${p}">your billing portal</a> and nothing is charged. Your data stays on your device either way.`,
    cancelNoPortal: "If you would rather not continue, write to support@moyiq.app before that date and nothing is charged. Your data stays on your device either way.",
    why: "You are receiving this email because you started a moyiq Pro trial.",
    unsubscribe: "Stop trial emails",
  },
  pt: {
    day1: {
      subject: "Seu primeiro passo com o moyiq Pro",
      preheader: "Carregue o último mês com o arquivo do seu banco; o app sugere as categorias.",
      paragraphs: [
        "Seu teste do Pro já está ativo. O passo que mais ajuda no começo é carregar seus movimentos.",
        "Importe o extrato do seu banco (CSV ou Excel): o app sugere a categoria de cada movimento e você confirma. Os dados ficam no seu dispositivo.",
      ],
      cta: "Importar movimentos",
    },
    day3: {
      subject: "O que o Modo Consultor mostra com seus dados",
      preheader: "Um diagnóstico do mês em quatro fatores, resumido no IQ Score e exportável em PDF.",
      paragraphs: [
        "Com alguns movimentos carregados, o Modo Consultor monta um diagnóstico do mês: fluxo de caixa, reserva de emergência, peso das dívidas e avanço das suas metas, resumidos no IQ Score.",
        "Você pode exportá-lo em PDF para revisar com calma ou compartilhar com quem orienta você.",
      ],
      cta: "Abrir o Modo Consultor",
    },
    day10: (d) => ({
      subject: "Faltam 4 dias para o fim do seu teste do moyiq Pro",
      preheader: `Seu teste termina em ${d}. Antes disso, vale revisar o resumo do mês.`,
      paragraphs: [
        `Seu teste do Pro termina em ${d}. Se você continuar, é cobrado o plano que escolheu no início.`,
        "Antes dessa data, vale revisar seu resumo do mês e o IQ Score: é o que o Pro continua calculando todo mês.",
      ],
      cta: "Ver meu resumo do mês",
    }),
    cancelPortal: (p) => `Se preferir não continuar, cancele antes dessa data pelo <a href="${p}">seu portal de cobrança</a> e nada é cobrado. Seus dados ficam no seu dispositivo de qualquer forma.`,
    cancelNoPortal: "Se preferir não continuar, escreva para support@moyiq.app antes dessa data e nada é cobrado. Seus dados ficam no seu dispositivo de qualquer forma.",
    why: "Você recebe este e-mail porque começou um teste do moyiq Pro.",
    unsubscribe: "Não receber mais e-mails do teste",
  },
  de: {
    day1: {
      subject: "Ihr erster Schritt mit moyiq Pro",
      preheader: "Laden Sie den letzten Monat aus der Datei Ihrer Bank; die App schlägt die Kategorien vor.",
      paragraphs: [
        "Ihre Pro-Testphase ist aktiv. Am Anfang hilft am meisten, Ihre Buchungen zu laden.",
        "Importieren Sie Ihren Kontoauszug (CSV oder Excel): Die App schlägt für jede Buchung eine Kategorie vor, die Sie bestätigen. Ihre Daten bleiben auf Ihrem Gerät.",
      ],
      cta: "Buchungen importieren",
    },
    day3: {
      subject: "Was der Beratermodus mit Ihren Daten zeigt",
      preheader: "Eine Diagnose des Monats in vier Faktoren, zusammengefasst im IQ Score und als PDF exportierbar.",
      paragraphs: [
        "Mit einigen erfassten Buchungen erstellt der Beratermodus eine Diagnose Ihres Monats: Cashflow, Notgroschen, Schuldenlast und Fortschritt Ihrer Ziele, zusammengefasst im IQ Score.",
        "Sie können sie als PDF exportieren, um sie in Ruhe zu prüfen oder mit Ihrer Beratung zu teilen.",
      ],
      cta: "Beratermodus öffnen",
    },
    day10: (d) => ({
      subject: "Noch 4 Tage in Ihrer Testphase von moyiq Pro",
      preheader: `Ihre Testphase endet am ${d}. Vorher lohnt sich ein Blick auf die Monatsübersicht.`,
      paragraphs: [
        `Ihre Pro-Testphase endet am ${d}. Wenn Sie fortfahren, wird der Tarif berechnet, den Sie zu Beginn gewählt haben.`,
        "Vor diesem Datum lohnt sich ein Blick auf Ihre Monatsübersicht und den IQ Score: Das berechnet Pro jeden Monat weiter.",
      ],
      cta: "Meine Monatsübersicht ansehen",
    }),
    cancelPortal: (p) => `Wenn Sie nicht fortfahren möchten, kündigen Sie vor diesem Datum über <a href="${p}">Ihr Abrechnungsportal</a>; es wird nichts berechnet. Ihre Daten bleiben in jedem Fall auf Ihrem Gerät.`,
    cancelNoPortal: "Wenn Sie nicht fortfahren möchten, schreiben Sie vor diesem Datum an support@moyiq.app; es wird nichts berechnet. Ihre Daten bleiben in jedem Fall auf Ihrem Gerät.",
    why: "Sie erhalten diese E-Mail, weil Sie eine Testphase von moyiq Pro begonnen haben.",
    unsubscribe: "Keine E-Mails zur Testphase mehr erhalten",
  },
};
