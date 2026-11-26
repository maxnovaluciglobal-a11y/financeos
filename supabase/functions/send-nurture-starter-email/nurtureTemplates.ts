// supabase/functions/send-nurture-starter-email/nurtureTemplates.ts
//
// Copy de la secuencia Starter en los 4 idiomas de la app. El español es el
// original, sin cambios palabra por palabra; en/pt/de dicen lo mismo con el
// mismo registro seco (branding/voz-de-producto.md): sin exclamaciones, sin
// emoji, la app no opina. es en tú, pt-BR en você, de en Sie.
//
// Links: los botones van a app.moyiq.app, que muestra la app en el idioma que
// el usuario eligió — mismos links y mismos ref= en los 4 idiomas, para que
// la atribución siga siendo comparable. El link de baja no cambia.

import type { EmailLang } from "../_shared/emailLang.ts";
import { appLink } from "../_shared/appLinks.ts";
import { emailButton, EMAIL_MUTED_STYLE } from "../_shared/emailLayout.ts";

export type StarterStep = "welcome" | "day2" | "day5";

export interface StarterCopy {
  subject: string;
  preheader: string; // línea junto al asunto en la bandeja; suma un dato, no repite
  body: string; // HTML interno, sin el wrapper ni el footer
}


// Texto del link de baja del footer.
export const UNSUBSCRIBE_LABEL: Record<EmailLang, string> = {
  es: "Darme de baja de estos correos",
  en: "Unsubscribe from these emails",
  pt: "Cancelar o recebimento destes e-mails",
  de: "Diese E-Mails abbestellen",
};

export const STARTER_TEMPLATES: Record<EmailLang, Record<StarterStep, StarterCopy>> = {
  es: {
    welcome: {
      subject: "Lo primero que conviene hacer con tu cuenta",
      preheader: "Con el último mes importado ya hay algo real que ver.",
      body: `
      <h2>Tu cuenta ya está activa</h2>
      <p>Hola,</p>
      <p>Tu cuenta de moyiq ya está lista. Sin nada cargado todavía, el Inicio no tiene mucho que mostrarte — el primer paso que rinde es importar tus movimientos.</p>
      <p>Ve a Movimientos → Importar y sube el archivo que descargues de tu banco (CSV o Excel, la mayoría de los bancos de la región lo dan así). Moyiq reconoce el formato de tu banco. Las reglas de categoría que creas se aplican solas; el resto llega con una categoría sugerida que confirmas en Por revisar.</p>
      <p>No hace falta cargar todo el historial. Con el último mes alcanza para que el Inicio y el IQ Score empiecen a mostrar algo real.</p>
      ${emailButton(appLink("import", "starter-welcome"), `Importar movimientos →`)}
      <p style="${EMAIL_MUTED_STYLE}">Los datos se cifran en tu dispositivo antes de sincronizarse. Nadie del equipo puede ver tus montos ni categorías.</p>
      `,
    },
    day2: {
      subject: "El IQ Score no es un número decorativo",
      preheader: "Cinco factores, cada uno con su peso: cómo leer el desglose.",
      body: `
      <h2>Lo que la mayoría no descubre solo</h2>
      <p>Hola,</p>
      <p>Con movimientos ya cargados, hay una parte del Inicio que suele pasar desapercibida: el IQ Score no es un puntaje genérico — se arma con cinco factores puntuales (flujo de caja, colchón de emergencia, carga de deuda, progreso de metas, consistencia de tus datos), cada uno con su propio peso.</p>
      <p>Toca el score para ver el desglose. Sirve para ubicar dónde está el problema real en vez de adivinar — por ejemplo, un score bajo por flujo de caja negativo pide una acción distinta que uno bajo por falta de colchón de emergencia.</p>
      <p>Presupuestos sigue la misma idea en otra sección: con tus movimientos cargados, muestra cuánto llevas gastado en cada categoría frente al límite que fijaste.</p>
      ${emailButton(appLink("dashboard", "starter-d2"), `Ver mi IQ Score →`)}
      <p style="${EMAIL_MUTED_STYLE}">Si todavía no importaste movimientos, el score no tiene con qué calcularse — ese es el paso anterior a este.</p>
      `,
    },
    day5: {
      subject: "Qué diferencia a Starter de Pro en la práctica",
      preheader: "Lo que suma Pro sobre Starter, sin rodeos, y la prueba de 14 días.",
      body: `
    <h2>Sin testimonios inventados</h2>
    <p>Hola,</p>
    <p>No te vamos a inventar un testimonio de "Fulano ahorró X% en 3 meses". No tenemos esos casos documentados todavía, y prometer un resultado que no podemos mostrar con datos reales no ayuda a nadie.</p>
    <p>Lo que sí podemos mostrar con precisión es la diferencia real entre lo que ya usas en Starter y lo que suma Pro:</p>
    <p><strong>Starter (lo que ya tienes, sin fecha de vencimiento):</strong><br>
    — Inicio con IQ Score<br>
    — Movimientos e importación de extractos<br>
    — Presupuestos, Deudas y Metas</p>
    <p><strong>Pro (US$4.99/mes o US$39.99/año):</strong><br>
    — Modo Asesor: el diagnóstico del mes, exportable en PDF<br>
    — Proyección de flujo y Simulador de deudas<br>
    — Herramientas fiscales de tu país<br>
    — Sincronización cifrada entre tus dispositivos</p>
    <p>Si tu situación es simple, con Starter no te falta nada. Si quieres proyectar tu flujo antes de una decisión grande o usar las herramientas fiscales de tu país, ahí es donde Pro suma.</p>
    <p>Puedes probarlo 14 días gratis y sin tarjeta: la prueba la empiezas tú y, al terminar, vuelves a Starter sin que se cobre nada.</p>
    ${emailButton(appLink("upgrade", "starter-d5"), `Probar Pro 14 días gratis →`)}
    <p style="${EMAIL_MUTED_STYLE}">Si no es para ti, sigues en Starter sin perder nada de lo que ya armaste.</p>
    `,
    },
  },

  en: {
    welcome: {
      subject: "The first thing worth doing with your account",
      preheader: "With last month imported there is already something real to see.",
      body: `
      <h2>Your account is active</h2>
      <p>Hello,</p>
      <p>Your moyiq account is ready. With nothing loaded yet, Home has little to show you — the first step that pays off is importing your transactions.</p>
      <p>Go to Import and upload the file you download from your bank (CSV or Excel; most banks provide it that way). Moyiq recognizes your bank's format. The category rules you create are applied on their own; everything else comes with a suggested category that you confirm in To review.</p>
      <p>You don't need to load your full history. The last month is enough for Home and the IQ Score to start showing something real.</p>
      ${emailButton(appLink("import", "starter-welcome"), `Import transactions →`)}
      <p style="${EMAIL_MUTED_STYLE}">Your data is encrypted on your device before it syncs. No one on the team can see your amounts or categories.</p>
      `,
    },
    day2: {
      subject: "The IQ Score is not a decorative number",
      preheader: "Five factors, each with its own weight: how to read the breakdown.",
      body: `
      <h2>What most people don't find on their own</h2>
      <p>Hello,</p>
      <p>With transactions loaded, there is a part of Home that tends to go unnoticed: the IQ Score is not a generic score — it is built from five specific factors (cash flow, emergency fund, debt load, goal progress, consistency of your data), each with its own weight.</p>
      <p>Tap the score to see the breakdown. It shows where the real problem is instead of guessing — for example, a low score from negative cash flow calls for a different action than a low score from a missing emergency fund.</p>
      <p>Budgets follows the same idea in another section: with your transactions loaded, it shows how much you have spent in each category against the limit you set.</p>
      ${emailButton(appLink("dashboard", "starter-d2"), `See my IQ Score →`)}
      <p style="${EMAIL_MUTED_STYLE}">If you haven't imported transactions yet, the score has nothing to be calculated from — that is the step before this one.</p>
      `,
    },
    day5: {
      subject: "What separates Starter from Pro in practice",
      preheader: "What Pro adds to Starter, plainly, and the 14-day trial.",
      body: `
    <h2>No made-up testimonials</h2>
    <p>Hello,</p>
    <p>We are not going to make up a testimonial like "So-and-so saved X% in 3 months". We don't have those cases documented yet, and promising a result we can't show with real data doesn't help anyone.</p>
    <p>What we can be specific about is the real difference between what you already use in Starter and what Pro adds:</p>
    <p><strong>Starter (what you already have, with no expiry date):</strong><br>
    — Home with IQ Score<br>
    — Transactions and statement import<br>
    — Budgets, Debts and Goals</p>
    <p><strong>Pro (US$4.99/month or US$39.99/year):</strong><br>
    — Advisor Mode: the month's diagnosis, exportable as PDF<br>
    — Cash-flow projection and Debt simulator<br>
    — Tax tools for your country<br>
    — Encrypted sync across your devices</p>
    <p>If your situation is simple, staying on Starter leaves nothing missing. If you want to project your cash flow before a big decision or use the tax tools for your country, that is where Pro adds something.</p>
    <p>You can try it free for 14 days with no card: you start the trial yourself and, when it ends, you go back to Starter with nothing charged.</p>
    ${emailButton(appLink("upgrade", "starter-d5"), `Try Pro free for 14 days →`)}
    <p style="${EMAIL_MUTED_STYLE}">If it's not for you, you stay on Starter without losing anything you have set up.</p>
    `,
    },
  },

  pt: {
    welcome: {
      subject: "A primeira coisa que vale a pena fazer com sua conta",
      preheader: "Com o último mês importado já há algo real para ver.",
      body: `
      <h2>Sua conta já está ativa</h2>
      <p>Olá,</p>
      <p>Sua conta do moyiq já está pronta. Sem nada carregado ainda, o Início não tem muito para mostrar — o primeiro passo que rende é importar seus movimentos.</p>
      <p>Vá em Importar e envie o arquivo que você baixar do seu banco (CSV ou Excel, a maioria dos bancos fornece assim). O moyiq reconhece o formato do seu banco. As regras de categoria que você cria são aplicadas sozinhas; o resto chega com uma categoria sugerida que você confirma em Para revisar.</p>
      <p>Não é preciso carregar todo o histórico. O último mês basta para que o Início e o IQ Score comecem a mostrar algo real.</p>
      ${emailButton(appLink("import", "starter-welcome"), `Importar movimentos →`)}
      <p style="${EMAIL_MUTED_STYLE}">Os dados são criptografados no seu dispositivo antes de sincronizar. Ninguém da equipe pode ver seus valores nem categorias.</p>
      `,
    },
    day2: {
      subject: "O IQ Score não é um número decorativo",
      preheader: "Cinco fatores, cada um com seu peso: como ler o detalhamento.",
      body: `
      <h2>O que a maioria não descobre sozinha</h2>
      <p>Olá,</p>
      <p>Com movimentos já carregados, há uma parte do Início que costuma passar despercebida: o IQ Score não é uma pontuação genérica — ele é montado com cinco fatores específicos (fluxo de caixa, reserva de emergência, peso da dívida, progresso das metas, consistência dos seus dados), cada um com seu próprio peso.</p>
      <p>Toque no score para ver o detalhamento. Serve para localizar onde está o problema real em vez de adivinhar — por exemplo, um score baixo por fluxo de caixa negativo pede uma ação diferente de um score baixo por falta de reserva de emergência.</p>
      <p>Orçamentos segue a mesma ideia em outra seção: com seus movimentos carregados, mostra quanto você já gastou em cada categoria frente ao limite que definiu.</p>
      ${emailButton(appLink("dashboard", "starter-d2"), `Ver meu IQ Score →`)}
      <p style="${EMAIL_MUTED_STYLE}">Se você ainda não importou movimentos, o score não tem com o que ser calculado — esse é o passo anterior a este.</p>
      `,
    },
    day5: {
      subject: "O que diferencia o Starter do Pro na prática",
      preheader: "O que o Pro soma ao Starter, sem rodeios, e o teste de 14 dias.",
      body: `
    <h2>Sem depoimentos inventados</h2>
    <p>Olá,</p>
    <p>Não vamos inventar um depoimento do tipo "Fulano economizou X% em 3 meses". Ainda não temos esses casos documentados, e prometer um resultado que não podemos mostrar com dados reais não ajuda ninguém.</p>
    <p>O que podemos detalhar é a diferença real entre o que você já usa no Starter e o que o Pro acrescenta:</p>
    <p><strong>Starter (o que você já tem, sem data de vencimento):</strong><br>
    — Início com IQ Score<br>
    — Movimentos e importação de extratos<br>
    — Orçamentos, Dívidas e Metas</p>
    <p><strong>Pro (US$4.99/mês ou US$39.99/ano):</strong><br>
    — Modo Consultor: o diagnóstico do mês, exportável em PDF<br>
    — Projeção de fluxo e Simulador de dívidas<br>
    — Ferramentas fiscais do seu país<br>
    — Sincronização criptografada entre seus dispositivos</p>
    <p>Se a sua situação é simples, ficar no Starter não deixa nada faltando. Se você quer projetar seu fluxo antes de uma decisão grande ou usar as ferramentas fiscais do seu país, é aí que o Pro soma.</p>
    <p>Você pode testá-lo por 14 dias grátis e sem cartão: você mesmo começa o teste e, ao terminar, volta ao Starter sem nenhuma cobrança.</p>
    ${emailButton(appLink("upgrade", "starter-d5"), `Testar o Pro grátis por 14 dias →`)}
    <p style="${EMAIL_MUTED_STYLE}">Se não for para você, você continua no Starter sem perder nada do que já montou.</p>
    `,
    },
  },

  de: {
    welcome: {
      subject: "Der erste sinnvolle Schritt mit Ihrem Konto",
      preheader: "Mit dem importierten letzten Monat gibt es schon etwas Echtes zu sehen.",
      body: `
      <h2>Ihr Konto ist aktiv</h2>
      <p>Guten Tag,</p>
      <p>Ihr moyiq-Konto ist eingerichtet. Solange noch nichts geladen ist, zeigt der Start wenig — der erste Schritt, der sich lohnt, ist der Import Ihrer Buchungen.</p>
      <p>Öffnen Sie Importieren und laden Sie die Datei hoch, die Sie bei Ihrer Bank herunterladen (CSV oder Excel, die meisten Banken bieten das an). Moyiq erkennt das Format Ihrer Bank. Die Kategorieregeln, die Sie anlegen, werden von selbst angewendet; alles andere kommt mit einer vorgeschlagenen Kategorie, die Sie unter Zu prüfen bestätigen.</p>
      <p>Die gesamte Historie ist nicht nötig. Der letzte Monat reicht, damit Start und IQ Score etwas Reales zeigen.</p>
      ${emailButton(appLink("import", "starter-welcome"), `Buchungen importieren →`)}
      <p style="${EMAIL_MUTED_STYLE}">Die Daten werden auf Ihrem Gerät verschlüsselt, bevor sie synchronisiert werden. Niemand im Team kann Ihre Beträge oder Kategorien sehen.</p>
      `,
    },
    day2: {
      subject: "Der IQ Score ist keine Dekoration",
      preheader: "Fünf Faktoren, jeder mit eigenem Gewicht: so lesen Sie die Aufschlüsselung.",
      body: `
      <h2>Was die meisten nicht von selbst entdecken</h2>
      <p>Guten Tag,</p>
      <p>Sobald Buchungen geladen sind, wird ein Teil des Starts oft übersehen: Der IQ Score ist kein allgemeiner Wert — er setzt sich aus fünf konkreten Faktoren zusammen (Cashflow, Notgroschen, Schuldenlast, Fortschritt der Ziele, Konsistenz Ihrer Daten), jeder mit eigener Gewichtung.</p>
      <p>Tippen Sie auf den Score, um die Aufschlüsselung zu sehen. So lässt sich das eigentliche Problem eingrenzen, statt zu raten — ein niedriger Score wegen negativem Cashflow verlangt zum Beispiel eine andere Maßnahme als einer wegen fehlendem Notgroschen.</p>
      <p>Budgets folgt in einem anderen Bereich derselben Idee: Mit geladenen Buchungen zeigt es, wie viel Sie in jeder Kategorie im Verhältnis zum festgelegten Limit ausgegeben haben.</p>
      ${emailButton(appLink("dashboard", "starter-d2"), `Meinen IQ Score ansehen →`)}
      <p style="${EMAIL_MUTED_STYLE}">Wenn Sie noch keine Buchungen importiert haben, fehlt dem Score die Grundlage — das ist der Schritt davor.</p>
      `,
    },
    day5: {
      subject: "Was Starter und Pro in der Praxis unterscheidet",
      preheader: "Was Pro gegenüber Starter bietet, ohne Umschweife, und der 14-tägige Test.",
      body: `
    <h2>Keine erfundenen Erfahrungsberichte</h2>
    <p>Guten Tag,</p>
    <p>Wir erfinden keinen Erfahrungsbericht wie "Person X hat in 3 Monaten X % gespart". Solche Fälle haben wir noch nicht dokumentiert, und ein Ergebnis zu versprechen, das wir nicht mit echten Daten belegen können, hilft niemandem.</p>
    <p>Konkret benennen können wir den tatsächlichen Unterschied zwischen dem, was Sie in Starter bereits nutzen, und dem, was Pro ergänzt:</p>
    <p><strong>Starter (was Sie bereits haben, ohne Ablaufdatum):</strong><br>
    — Start mit IQ Score<br>
    — Buchungen und Import von Kontoauszügen<br>
    — Budgets, Schulden und Ziele</p>
    <p><strong>Pro (US$4.99/Monat oder US$39.99/Jahr):</strong><br>
    — Beratermodus: die Diagnose des Monats, als PDF exportierbar<br>
    — Cashflow-Prognose und Schulden-Simulator<br>
    — Steuerwerkzeuge für Ihr Land<br>
    — Verschlüsselte Synchronisierung zwischen Ihren Geräten</p>
    <p>Wenn Ihre Situation einfach ist, fehlt Ihnen in Starter nichts. Wenn Sie Ihren Cashflow vor einer großen Entscheidung durchrechnen oder die Steuerwerkzeuge für Ihr Land nutzen möchten, bringt Pro etwas.</p>
    <p>Sie können Pro 14 Tage kostenlos und ohne Karte testen: Sie starten den Test selbst, und danach wechseln Sie zu Starter zurück, ohne dass etwas berechnet wird.</p>
    ${emailButton(appLink("upgrade", "starter-d5"), `Pro 14 Tage kostenlos testen →`)}
    <p style="${EMAIL_MUTED_STYLE}">Wenn es nicht passt, bleiben Sie bei Starter, ohne etwas von dem zu verlieren, was Sie bereits eingerichtet haben.</p>
    `,
    },
  },
};
