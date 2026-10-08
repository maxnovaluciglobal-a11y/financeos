// supabase/functions/send-nurture-diagnostico-email/nurtureTemplates.ts
//
// Copy de la secuencia del Diagnóstico Exprés en los 4 idiomas. El español es
// el original (revisión 18-sep, variante A de asunto), sin cambios palabra por
// palabra; en/pt/de dicen lo mismo con el mismo registro seco
// (branding/voz-de-producto.md): sin exclamaciones, sin emoji, la app no
// opina. es en tú, pt-BR en você, de en Sie.
//
// Links: signup/upgrade van a app.moyiq.app (la app muestra el idioma
// elegido), con los mismos ref= en los 4 idiomas. El email 4 vuelve al
// diagnóstico: en inglés existe /en/score-check.html (misma calculadora); en
// pt/de no hay versión propia, así que se deja la página en español. El link
// de baja no cambia.
//
// `label` llega SIEMPRE en español (Excelente/Bueno/Regular/Crítico): la
// landing en inglés (en/score-check.html) lo traduce a español antes de
// mandarlo (LABEL_ES). Por eso los bloques de acción se indexan por el label
// en español y LABEL_DISPLAY lo traduce para mostrarlo.

import type { EmailLang } from "../_shared/emailLang.ts";

export type DiagnosticoStep = "welcome" | "day2" | "day5" | "day12";

export interface DiagnosticoCopyContext {
  score: number | null;
  label: string | null;
  unsubUrl: string;
  landingUrl: string; // sin barra final
}

export interface DiagnosticoCopy {
  subject: string;
  body: string; // HTML interno, sin el wrapper ni el footer
}

const BTN = 'style="display:inline-block;background:#14213D;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600"';

export const UNSUBSCRIBE_LABEL: Record<EmailLang, string> = {
  es: "Darme de baja de estos correos",
  en: "Unsubscribe from these emails",
  pt: "Cancelar o recebimento destes e-mails",
  de: "Diese E-Mails abbestellen",
};

const LABEL_DISPLAY: Record<EmailLang, Record<string, string>> = {
  es: { "Crítico": "Crítico", "Regular": "Regular", "Bueno": "Bueno", "Excelente": "Excelente" },
  en: { "Crítico": "Critical", "Regular": "Fair", "Bueno": "Good", "Excelente": "Excellent" },
  pt: { "Crítico": "Crítico", "Regular": "Regular", "Bueno": "Bom", "Excelente": "Excelente" },
  de: { "Crítico": "Kritisch", "Regular": "Mittel", "Bueno": "Gut", "Excelente": "Ausgezeichnet" },
};

export function displayLabel(lang: EmailLang, label: string | null): string | null {
  if (!label) return null;
  return LABEL_DISPLAY[lang][label] ?? label;
}

const SCORE_FALLBACK: Record<EmailLang, string> = {
  es: "tu resultado",
  en: "your result",
  pt: "seu resultado",
  de: "Ihr Ergebnis",
};

function scoreText(lang: EmailLang, score: number | null): string {
  return score != null ? `${score}/100` : SCORE_FALLBACK[lang];
}

// Ver nurtureEmailLogic.ts (comentario "Personalización del email 1") para
// por qué el label se usa como proxy del hallazgo dominante.
const ACTION_BLOCKS: Record<EmailLang, Record<string, string> & { _default: string }> = {
  es: {
    "Crítico": "Con tu resultado, lo más probable es que el problema esté en el flujo de caja del mes a mes — más sale de lo que entra, o casi. Registra tus movimientos de esta semana en MOY IQ: el Dashboard te va a mostrar exactamente en qué categoría se te va la plata, sin que tengas que armar una planilla.",
    "Regular": "Tu resultado está en la zona donde un cambio chico rinde mucho: ordenar el colchón de emergencia o la carga de deuda. Con tus movimientos reales cargados, MOY IQ te muestra cuál de los dos te conviene atacar primero según tu propio flujo de caja.",
    "Bueno": "Ya estás manejando bien lo básico. El siguiente paso es que ese resultado no dependa de que te acuerdes de revisarlo — con tus movimientos importados, el Dashboard te avisa solo cuando algo se corre de lo normal.",
    "Excelente": "Tu resultado ya está en el nivel donde el foco pasa de \"ordenar\" a \"optimizar\" — metas en paralelo, proyección de decisiones grandes. Eso es exactamente lo que hace Goals y Advisor con tus datos reales.",
    _default: "Registra tus movimientos de esta semana en MOY IQ. El Dashboard te muestra en qué categoría se te va más plata cada mes, sin que tengas que actualizar nada a mano.",
  },
  en: {
    "Crítico": "With your result, the problem is most likely in month-to-month cash flow — more goes out than comes in, or nearly. Record this week's transactions in MOY IQ: the Dashboard shows exactly which category your money goes to, without you having to build a spreadsheet.",
    "Regular": "Your result is in the zone where a small change goes a long way: sorting out your emergency fund or your debt load. With your real transactions loaded, MOY IQ shows which of the two to tackle first based on your own cash flow.",
    "Bueno": "You already handle the basics well. The next step is for that result not to depend on you remembering to check it — with your transactions imported, the Dashboard flags it when something moves away from normal.",
    "Excelente": "Your result is already at the level where the focus shifts from \"organizing\" to \"optimizing\" — parallel goals, projecting big decisions. That is exactly what Goals and Advisor do with your real data.",
    _default: "Record this week's transactions in MOY IQ. The Dashboard shows which category takes the most money each month, without you having to update anything by hand.",
  },
  pt: {
    "Crítico": "Com o seu resultado, o mais provável é que o problema esteja no fluxo de caixa do dia a dia — sai mais do que entra, ou quase. Registre os movimentos desta semana no MOY IQ: o Painel mostra exatamente em qual categoria o seu dinheiro vai, sem que você precise montar uma planilha.",
    "Regular": "Seu resultado está na faixa em que uma mudança pequena rende muito: organizar a reserva de emergência ou o peso da dívida. Com seus movimentos reais carregados, o MOY IQ mostra qual dos dois atacar primeiro de acordo com o seu próprio fluxo de caixa.",
    "Bueno": "Você já administra bem o básico. O próximo passo é que esse resultado não dependa de você se lembrar de revisá-lo — com seus movimentos importados, o Painel avisa quando algo sai do normal.",
    "Excelente": "Seu resultado já está no nível em que o foco passa de \"organizar\" para \"otimizar\" — metas em paralelo, projeção de decisões grandes. É exatamente isso que Goals e Advisor fazem com seus dados reais.",
    _default: "Registre os movimentos desta semana no MOY IQ. O Painel mostra em qual categoria vai mais dinheiro a cada mês, sem que você precise atualizar nada à mão.",
  },
  de: {
    "Crítico": "Bei Ihrem Ergebnis liegt das Problem sehr wahrscheinlich im monatlichen Cashflow — es geht mehr hinaus als hereinkommt, oder fast. Erfassen Sie die Buchungen dieser Woche in MOY IQ: Das Dashboard zeigt genau, in welche Kategorie Ihr Geld fließt, ohne dass Sie eine Tabelle anlegen müssen.",
    "Regular": "Ihr Ergebnis liegt in dem Bereich, in dem eine kleine Änderung viel bewirkt: den Notgroschen oder die Schuldenlast ordnen. Mit Ihren echten Buchungen zeigt MOY IQ, welches der beiden Themen Sie nach Ihrem eigenen Cashflow zuerst angehen sollten.",
    "Bueno": "Die Grundlagen haben Sie bereits im Griff. Der nächste Schritt: Dieses Ergebnis soll nicht davon abhängen, dass Sie daran denken, es zu prüfen — mit importierten Buchungen meldet das Dashboard, wenn etwas vom Normalen abweicht.",
    "Excelente": "Ihr Ergebnis liegt bereits auf dem Niveau, auf dem sich der Fokus von \"Ordnen\" zu \"Optimieren\" verschiebt — parallele Ziele, Projektion großer Entscheidungen. Genau das leisten Goals und Advisor mit Ihren echten Daten.",
    _default: "Erfassen Sie die Buchungen dieser Woche in MOY IQ. Das Dashboard zeigt, in welche Kategorie jeden Monat das meiste Geld fließt, ohne dass Sie etwas von Hand aktualisieren müssen.",
  },
};

export function actionBlock(lang: EmailLang, label: string | null): string {
  const blocks = ACTION_BLOCKS[lang];
  return (label && blocks[label]) || blocks._default;
}

// Página del diagnóstico para el email 4: versión en inglés donde existe.
function diagnosticoPage(lang: EmailLang, landingUrl: string): string {
  return lang === "en" ? `${landingUrl}/en/score-check.html` : `${landingUrl}/diagnostico.html`;
}

type Render = (ctx: DiagnosticoCopyContext) => DiagnosticoCopy;

export const DIAGNOSTICO_TEMPLATES: Record<EmailLang, Record<DiagnosticoStep, Render>> = {
  es: {
    welcome: (c) => {
      const label = displayLabel("es", c.label);
      return {
        subject: "Tu diagnóstico completo (y el dato que se quedó afuera)",
        body: `
      <h2 style="color:#14213D">Acá está tu diagnóstico completo</h2>
      <p>Hola,</p>
      <p>Acá está tu diagnóstico completo — sin el recorte que viste en el preview.</p>
      <p><strong>Tu puntaje MOY IQ exprés: ${scoreText("es", c.score)}${label ? ` (${label})` : ""}</strong></p>
      <p>Un paso concreto para esta semana, según tu resultado:</p>
      <p>${actionBlock("es", c.label)}</p>
      <p>Este diagnóstico es una foto de un momento. Para ver cómo cambia con cada decisión que tomas, hace falta registrar los movimientos reales — eso es lo que hace la cuenta gratuita.</p>
      <p><a href="https://app.moyiq.app/signup?ref=diagnostico" ${BTN}>Crear cuenta gratis →</a></p>
      <p style="color:#666;font-size:13px">Sin tarjeta, sin trial que vencer. Starter no tiene fecha de corte.</p>
      <p style="color:#666;font-size:13px">En dos días te cuento por qué la mayoría de los presupuestos armados en una hoja de cálculo no llegan al segundo mes — y no es por falta de disciplina.</p>
      `,
      };
    },
    day2: () => ({
      subject: "El presupuesto no falló. El método, sí.",
      body: `
      <h2 style="color:#14213D">El problema no es cuánto ganas</h2>
      <p>Hola,</p>
      <p>Como prometí, acá va el dato que se repite en las encuestas de capacidad financiera de la región: la mayoría de las personas que arman un presupuesto lo dejan de actualizar antes de los 60 días. No por falta de disciplina — porque mantenerlo a mano en una hoja de cálculo es trabajo, y ese trabajo compite con todo lo demás.</p>
      <p>El problema no es el presupuesto. Es que depende de que alguien lo teclee.</p>
      <p>Cuando importas tus movimientos en MOY IQ, no armas el presupuesto — se arma solo a partir de lo que ya gastaste. La sección de Movimientos categoriza automáticamente cada transacción, y el Dashboard te muestra en qué categoría se te fue más plata este mes comparado con el anterior. No hay que actualizar nada a mano para verlo.</p>
      <p>Si tu diagnóstico marcó un puntaje bajo, es probablemente esto: no falta de ingreso, falta de visibilidad de a dónde va.</p>
      <p><a href="https://app.moyiq.app/signup?ref=diagnostico-d2" ${BTN}>Ver mi dashboard →</a></p>
      <p style="color:#666;font-size:13px">Starter incluye Dashboard, Movimientos y Presupuestos sin costo.</p>
      `,
    }),
    day5: () => ({
      subject: "Starter o Pro: la diferencia, sin vueltas",
      body: `
      <h2 style="color:#14213D">Sin testimonios inventados</h2>
      <p>Hola,</p>
      <p>Sin testimonio inventado de "Fulano ahorró X% en 3 meses" — no tenemos ese caso documentado, y prometer un resultado que no podemos mostrar con datos reales no ayuda a nadie.</p>
      <p>La diferencia real entre lo que ya puedes usar gratis y lo que suma Pro:</p>
      <p><strong>Starter (gratis, sin fecha de vencimiento):</strong> Dashboard con IQ Score, Movimientos y categorización automática, Presupuestos básicos, Metas simples.</p>
      <p><strong>Pro (US$4.99/mes o US$39.99/año):</strong> Coach (recomendaciones que se ajustan con cada movimiento nuevo, no una vez al armar el presupuesto), Advisor (proyecta un escenario antes de tomar una decisión grande, no después), Goals con múltiples objetivos en simultáneo, Reports exportables si necesitas mostrarle tus números a otra persona.</p>
      <p>Si tu situación es simple, Starter alcanza. Si tienes varias metas corriendo o una decisión grande cerca, ahí es donde Pro paga solo.</p>
      <p><a href="https://app.moyiq.app/upgrade?ref=diagnostico-d5" ${BTN}>Actualizar a Pro →</a></p>
      <p style="color:#666;font-size:13px">Si no es para ti ahora, sigues en Starter sin perder nada de lo que ya armaste.</p>
      `,
    }),
    day12: (c) => ({
      subject: "Tu IQ Score sigue ahí (no venció)",
      body: `
    <h2 style="color:#14213D">No te escribo por MOY IQ</h2>
    <p>Hola,</p>
    <p>No te vengo a insistir con Starter o Pro — ya te los mostré. Esto es distinto: tu diagnóstico de hace 12 días sigue guardado, pero doce días es tiempo suficiente para que algo haya cambiado — un gasto grande, un ingreso nuevo, una deuda que se movió.</p>
    <p><a href="${diagnosticoPage("es", c.landingUrl)}?ref=diagnostico-d12" ${BTN}>Volver a ver mi diagnóstico →</a></p>
    <p>Si tu situación es la misma, no hace falta que hagas nada — el resultado sigue siendo válido. Si cambió algo, es un buen momento para volver a correrlo y ver qué mueve.</p>
    <p style="color:#666;font-size:13px">Este es el último correo de esta secuencia. Si prefieres no recibir más, date de baja <a href="${c.unsubUrl}" style="color:#666">acá</a> — no hay problema.</p>
    `,
    }),
  },

  en: {
    welcome: (c) => {
      const label = displayLabel("en", c.label);
      return {
        subject: "Your full diagnosis (and the figure that was left out)",
        body: `
      <h2 style="color:#14213D">Here is your full diagnosis</h2>
      <p>Hello,</p>
      <p>Here is your full diagnosis — without the cut you saw in the preview.</p>
      <p><strong>Your MOY IQ express score: ${scoreText("en", c.score)}${label ? ` (${label})` : ""}</strong></p>
      <p>One concrete step for this week, based on your result:</p>
      <p>${actionBlock("en", c.label)}</p>
      <p>This diagnosis is a snapshot of one moment. To see how it changes with each decision you make, you need to record your real transactions — that is what the free account does.</p>
      <p><a href="https://app.moyiq.app/signup?ref=diagnostico" ${BTN}>Create a free account →</a></p>
      <p style="color:#666;font-size:13px">No card, no trial to expire. Starter has no end date.</p>
      <p style="color:#666;font-size:13px">In two days I'll explain why most budgets built in a spreadsheet don't make it to the second month — and it is not a lack of discipline.</p>
      `,
      };
    },
    day2: () => ({
      subject: "The budget didn't fail. The method did.",
      body: `
      <h2 style="color:#14213D">The problem is not how much you earn</h2>
      <p>Hello,</p>
      <p>As promised, here is the finding that repeats across financial capability surveys: most people who set up a budget stop updating it within 60 days. Not for lack of discipline — because keeping it up by hand in a spreadsheet is work, and that work competes with everything else.</p>
      <p>The problem is not the budget. It is that it depends on someone typing it in.</p>
      <p>When you import your transactions into MOY IQ, you don't build the budget — it builds itself from what you already spent. The Transactions section categorizes each transaction automatically, and the Dashboard shows which category took the most money this month compared with the last. Nothing has to be updated by hand to see it.</p>
      <p>If your diagnosis showed a low score, this is probably why: not a lack of income, a lack of visibility into where it goes.</p>
      <p><a href="https://app.moyiq.app/signup?ref=diagnostico-d2" ${BTN}>See my dashboard →</a></p>
      <p style="color:#666;font-size:13px">Starter includes Dashboard, Transactions and Budgets at no cost.</p>
      `,
    }),
    day5: () => ({
      subject: "Starter or Pro: the difference, plainly",
      body: `
      <h2 style="color:#14213D">No made-up testimonials</h2>
      <p>Hello,</p>
      <p>No made-up testimonial like "So-and-so saved X% in 3 months" — we don't have that case documented, and promising a result we can't show with real data doesn't help anyone.</p>
      <p>The real difference between what you can already use for free and what Pro adds:</p>
      <p><strong>Starter (free, with no expiry date):</strong> Dashboard with IQ Score, Transactions and automatic categorization, basic Budgets, simple Goals.</p>
      <p><strong>Pro (US$4.99/month or US$39.99/year):</strong> Coach (recommendations that adjust with every new transaction, not once when the budget is set up), Advisor (projects a scenario before a big decision, not after), Goals with multiple objectives at the same time, exportable Reports if you need to show your numbers to someone else.</p>
      <p>If your situation is simple, Starter is enough. If you have several goals running or a big decision coming up, that is where Pro pays for itself.</p>
      <p><a href="https://app.moyiq.app/upgrade?ref=diagnostico-d5" ${BTN}>Upgrade to Pro →</a></p>
      <p style="color:#666;font-size:13px">If it's not for you right now, you stay on Starter without losing anything you have set up.</p>
      `,
    }),
    day12: (c) => ({
      subject: "Your IQ Score is still there (it didn't expire)",
      body: `
    <h2 style="color:#14213D">This is not about MOY IQ</h2>
    <p>Hello,</p>
    <p>I'm not writing to push Starter or Pro again — you have already seen them. This is different: your diagnosis from 12 days ago is still saved, but twelve days is enough time for something to have changed — a large expense, a new income, a debt that moved.</p>
    <p><a href="${diagnosticoPage("en", c.landingUrl)}?ref=diagnostico-d12" ${BTN}>See my diagnosis again →</a></p>
    <p>If your situation is the same, there is nothing you need to do — the result is still valid. If something changed, it is a good time to run it again and see what moves.</p>
    <p style="color:#666;font-size:13px">This is the last email in this sequence. If you prefer not to receive more, unsubscribe <a href="${c.unsubUrl}" style="color:#666">here</a> — no problem.</p>
    `,
    }),
  },

  pt: {
    welcome: (c) => {
      const label = displayLabel("pt", c.label);
      return {
        subject: "Seu diagnóstico completo (e o dado que ficou de fora)",
        body: `
      <h2 style="color:#14213D">Aqui está seu diagnóstico completo</h2>
      <p>Olá,</p>
      <p>Aqui está seu diagnóstico completo — sem o corte que você viu na prévia.</p>
      <p><strong>Sua pontuação MOY IQ expressa: ${scoreText("pt", c.score)}${label ? ` (${label})` : ""}</strong></p>
      <p>Um passo concreto para esta semana, de acordo com o seu resultado:</p>
      <p>${actionBlock("pt", c.label)}</p>
      <p>Este diagnóstico é uma foto de um momento. Para ver como ele muda com cada decisão que você toma, é preciso registrar os movimentos reais — é isso que a conta gratuita faz.</p>
      <p><a href="https://app.moyiq.app/signup?ref=diagnostico" ${BTN}>Criar conta grátis →</a></p>
      <p style="color:#666;font-size:13px">Sem cartão, sem trial para vencer. O Starter não tem data de término.</p>
      <p style="color:#666;font-size:13px">Em dois dias eu conto por que a maioria dos orçamentos montados em uma planilha não chega ao segundo mês — e não é por falta de disciplina.</p>
      `,
      };
    },
    day2: () => ({
      subject: "O orçamento não falhou. O método, sim.",
      body: `
      <h2 style="color:#14213D">O problema não é quanto você ganha</h2>
      <p>Olá,</p>
      <p>Como prometido, aqui vai o dado que se repete nas pesquisas de capacidade financeira da região: a maioria das pessoas que monta um orçamento deixa de atualizá-lo antes dos 60 dias. Não por falta de disciplina — porque mantê-lo à mão em uma planilha dá trabalho, e esse trabalho compete com todo o resto.</p>
      <p>O problema não é o orçamento. É que ele depende de alguém digitá-lo.</p>
      <p>Quando você importa seus movimentos no MOY IQ, não monta o orçamento — ele se monta sozinho a partir do que você já gastou. A seção de Movimentos categoriza automaticamente cada transação, e o Painel mostra em qual categoria foi mais dinheiro este mês em comparação com o anterior. Não é preciso atualizar nada à mão para ver isso.</p>
      <p>Se o seu diagnóstico marcou uma pontuação baixa, provavelmente é isto: não falta de renda, falta de visibilidade de para onde ela vai.</p>
      <p><a href="https://app.moyiq.app/signup?ref=diagnostico-d2" ${BTN}>Ver meu painel →</a></p>
      <p style="color:#666;font-size:13px">O Starter inclui Painel, Movimentos e Orçamentos sem custo.</p>
      `,
    }),
    day5: () => ({
      subject: "Starter ou Pro: a diferença, sem rodeios",
      body: `
      <h2 style="color:#14213D">Sem depoimentos inventados</h2>
      <p>Olá,</p>
      <p>Sem depoimento inventado do tipo "Fulano economizou X% em 3 meses" — não temos esse caso documentado, e prometer um resultado que não podemos mostrar com dados reais não ajuda ninguém.</p>
      <p>A diferença real entre o que você já pode usar grátis e o que o Pro acrescenta:</p>
      <p><strong>Starter (grátis, sem data de vencimento):</strong> Painel com IQ Score, Movimentos e categorização automática, Orçamentos básicos, Metas simples.</p>
      <p><strong>Pro (US$4.99/mês ou US$39.99/ano):</strong> Coach (recomendações que se ajustam a cada novo movimento, não uma vez ao montar o orçamento), Advisor (projeta um cenário antes de uma decisão grande, não depois), Goals com vários objetivos ao mesmo tempo, Relatórios exportáveis se você precisar mostrar seus números a outra pessoa.</p>
      <p>Se a sua situação é simples, o Starter basta. Se você tem várias metas em andamento ou uma decisão grande por perto, é aí que o Pro se paga.</p>
      <p><a href="https://app.moyiq.app/upgrade?ref=diagnostico-d5" ${BTN}>Atualizar para o Pro →</a></p>
      <p style="color:#666;font-size:13px">Se não for para você agora, você continua no Starter sem perder nada do que já montou.</p>
      `,
    }),
    day12: (c) => ({
      subject: "Seu IQ Score continua aí (não venceu)",
      body: `
    <h2 style="color:#14213D">Não escrevo por causa do MOY IQ</h2>
    <p>Olá,</p>
    <p>Não venho insistir com Starter ou Pro — você já os viu. Isto é diferente: seu diagnóstico de 12 dias atrás continua salvo, mas doze dias é tempo suficiente para algo ter mudado — um gasto grande, uma renda nova, uma dívida que se mexeu.</p>
    <p><a href="${diagnosticoPage("pt", c.landingUrl)}?ref=diagnostico-d12" ${BTN}>Ver meu diagnóstico de novo →</a></p>
    <p>Se a sua situação é a mesma, não é preciso fazer nada — o resultado continua válido. Se algo mudou, é um bom momento para refazê-lo e ver o que muda.</p>
    <p style="color:#666;font-size:13px">Este é o último e-mail desta sequência. Se preferir não receber mais, cancele <a href="${c.unsubUrl}" style="color:#666">aqui</a> — sem problema.</p>
    `,
    }),
  },

  de: {
    welcome: (c) => {
      const label = displayLabel("de", c.label);
      return {
        subject: "Ihre vollständige Auswertung (und die Angabe, die gefehlt hat)",
        body: `
      <h2 style="color:#14213D">Hier ist Ihre vollständige Auswertung</h2>
      <p>Guten Tag,</p>
      <p>Hier ist Ihre vollständige Auswertung — ohne die Kürzung aus der Vorschau.</p>
      <p><strong>Ihr MOY IQ-Express-Score: ${scoreText("de", c.score)}${label ? ` (${label})` : ""}</strong></p>
      <p>Ein konkreter Schritt für diese Woche, abhängig von Ihrem Ergebnis:</p>
      <p>${actionBlock("de", c.label)}</p>
      <p>Diese Auswertung ist eine Momentaufnahme. Um zu sehen, wie sie sich mit jeder Entscheidung verändert, müssen die echten Buchungen erfasst werden — genau das leistet das kostenlose Konto.</p>
      <p><a href="https://app.moyiq.app/signup?ref=diagnostico" ${BTN}>Kostenloses Konto anlegen →</a></p>
      <p style="color:#666;font-size:13px">Keine Karte, keine Testphase, die abläuft. Starter hat kein Enddatum.</p>
      <p style="color:#666;font-size:13px">In zwei Tagen erkläre ich, warum die meisten in einer Tabelle angelegten Budgets den zweiten Monat nicht erreichen — und es liegt nicht an fehlender Disziplin.</p>
      `,
      };
    },
    day2: () => ({
      subject: "Nicht das Budget hat versagt. Die Methode schon.",
      body: `
      <h2 style="color:#14213D">Das Problem ist nicht, wie viel Sie verdienen</h2>
      <p>Guten Tag,</p>
      <p>Wie angekündigt, hier der Befund, der sich in Erhebungen zur finanziellen Kompetenz wiederholt: Die meisten Menschen, die ein Budget anlegen, hören vor Ablauf von 60 Tagen auf, es zu aktualisieren. Nicht aus Mangel an Disziplin — sondern weil die Pflege von Hand in einer Tabelle Arbeit ist, und diese Arbeit mit allem anderen konkurriert.</p>
      <p>Das Problem ist nicht das Budget. Sondern dass es davon abhängt, dass jemand es eintippt.</p>
      <p>Wenn Sie Ihre Buchungen in MOY IQ importieren, legen Sie das Budget nicht an — es entsteht aus dem, was Sie bereits ausgegeben haben. Der Bereich Buchungen ordnet jede Transaktion automatisch einer Kategorie zu, und das Dashboard zeigt, in welche Kategorie in diesem Monat im Vergleich zum Vormonat am meisten Geld geflossen ist. Dafür muss nichts von Hand aktualisiert werden.</p>
      <p>Wenn Ihre Auswertung einen niedrigen Score ergeben hat, liegt es wahrscheinlich daran: nicht an fehlendem Einkommen, sondern an fehlendem Überblick, wohin es geht.</p>
      <p><a href="https://app.moyiq.app/signup?ref=diagnostico-d2" ${BTN}>Mein Dashboard ansehen →</a></p>
      <p style="color:#666;font-size:13px">Starter enthält Dashboard, Buchungen und Budgets ohne Kosten.</p>
      `,
    }),
    day5: () => ({
      subject: "Starter oder Pro: der Unterschied, ohne Umschweife",
      body: `
      <h2 style="color:#14213D">Keine erfundenen Erfahrungsberichte</h2>
      <p>Guten Tag,</p>
      <p>Kein erfundener Erfahrungsbericht wie "Person X hat in 3 Monaten X % gespart" — einen solchen Fall haben wir nicht dokumentiert, und ein Ergebnis zu versprechen, das wir nicht mit echten Daten belegen können, hilft niemandem.</p>
      <p>Der tatsächliche Unterschied zwischen dem, was Sie bereits kostenlos nutzen können, und dem, was Pro ergänzt:</p>
      <p><strong>Starter (kostenlos, ohne Ablaufdatum):</strong> Dashboard mit IQ Score, Buchungen und automatische Kategorisierung, einfache Budgets, einfache Ziele.</p>
      <p><strong>Pro (US$4.99/Monat oder US$39.99/Jahr):</strong> Coach (Empfehlungen, die sich mit jeder neuen Buchung anpassen, nicht nur einmal beim Anlegen des Budgets), Advisor (rechnet ein Szenario vor einer großen Entscheidung durch, nicht danach), Goals mit mehreren Zielen gleichzeitig, exportierbare Berichte, falls Sie Ihre Zahlen jemand anderem zeigen müssen.</p>
      <p>Wenn Ihre Situation einfach ist, reicht Starter. Wenn mehrere Ziele laufen oder eine große Entscheidung bevorsteht, rechnet sich Pro.</p>
      <p><a href="https://app.moyiq.app/upgrade?ref=diagnostico-d5" ${BTN}>Auf Pro upgraden →</a></p>
      <p style="color:#666;font-size:13px">Wenn es gerade nicht passt, bleiben Sie bei Starter, ohne etwas von dem zu verlieren, was Sie bereits eingerichtet haben.</p>
      `,
    }),
    day12: (c) => ({
      subject: "Ihr IQ Score ist noch da (er ist nicht abgelaufen)",
      body: `
    <h2 style="color:#14213D">Es geht nicht um MOY IQ</h2>
    <p>Guten Tag,</p>
    <p>Ich schreibe nicht, um noch einmal auf Starter oder Pro hinzuweisen — die kennen Sie bereits. Hier geht es um etwas anderes: Ihre Auswertung von vor 12 Tagen ist weiterhin gespeichert, aber zwölf Tage reichen aus, damit sich etwas geändert hat — eine große Ausgabe, ein neues Einkommen, eine Schuld, die sich bewegt hat.</p>
    <p><a href="${diagnosticoPage("de", c.landingUrl)}?ref=diagnostico-d12" ${BTN}>Meine Auswertung erneut ansehen →</a></p>
    <p>Wenn Ihre Situation unverändert ist, müssen Sie nichts tun — das Ergebnis bleibt gültig. Wenn sich etwas geändert hat, ist jetzt ein guter Zeitpunkt, sie erneut durchzuführen und zu sehen, was sich verschiebt.</p>
    <p style="color:#666;font-size:13px">Dies ist die letzte E-Mail dieser Reihe. Wenn Sie keine weiteren erhalten möchten, können Sie sich <a href="${c.unsubUrl}" style="color:#666">hier</a> abmelden.</p>
    `,
    }),
  },
};
