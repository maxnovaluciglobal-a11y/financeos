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

export type StarterStep = "welcome" | "day2" | "day5";

export interface StarterCopy {
  subject: string;
  body: string; // HTML interno, sin el wrapper ni el footer
}

const BTN = 'style="display:inline-block;background:#14213D;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600"';

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
      body: `
      <h2 style="color:#14213D">Tu cuenta ya está activa</h2>
      <p>Hola,</p>
      <p>Tu cuenta de MOY IQ ya está lista. Sin nada cargado todavía, el Dashboard no tiene mucho que mostrarte — el primer paso que rinde es importar tus movimientos.</p>
      <p>Ve a Movimientos → Importar y sube el archivo que descargues de tu banco (CSV o Excel, la mayoría de los bancos de la región lo dan así). MOY IQ categoriza automáticamente lo que reconoce; lo que no, lo dejas en "Importado" y lo ajustas cuando quieras.</p>
      <p>No hace falta cargar todo el historial. Con el último mes alcanza para que el Dashboard y el IQ Score empiecen a mostrar algo real.</p>
      <p><a href="https://app.moyiq.app/import?ref=starter-welcome" ${BTN}>Importar movimientos →</a></p>
      <p style="color:#666;font-size:13px">Los datos se cifran en tu dispositivo antes de sincronizarse. Nadie del equipo puede ver tus montos ni categorías.</p>
      `,
    },
    day2: {
      subject: "El IQ Score no es un número decorativo",
      body: `
      <h2 style="color:#14213D">Lo que la mayoría no descubre solo</h2>
      <p>Hola,</p>
      <p>Con movimientos ya cargados, hay una parte del Dashboard que suele pasar desapercibida: el IQ Score no es un puntaje genérico — se arma con cinco factores puntuales (flujo de caja, colchón de emergencia, carga de deuda, progreso de metas, consistencia de tus datos), cada uno con su propio peso.</p>
      <p>Toca el score para ver el desglose. Sirve para ubicar dónde está el problema real en vez de adivinar — por ejemplo, un score bajo por flujo de caja negativo pide una acción distinta que uno bajo por falta de colchón de emergencia.</p>
      <p>Presupuestos hace algo parecido en otra sección: se arma solo a partir de lo que ya importaste, sin que tengas que definir categorías ni límites a mano primero.</p>
      <p><a href="https://app.moyiq.app/dashboard?ref=starter-d2" ${BTN}>Ver mi IQ Score →</a></p>
      <p style="color:#666;font-size:13px">Si todavía no importaste movimientos, el score no tiene con qué calcularse — ese es el paso anterior a este.</p>
      `,
    },
    day5: {
      subject: "Qué diferencia a Starter de Pro en la práctica",
      body: `
    <h2 style="color:#14213D">Sin testimonios inventados</h2>
    <p>Hola,</p>
    <p>No te vamos a inventar un testimonio de "Fulano ahorró X% en 3 meses". No tenemos esos casos documentados todavía, y prometer un resultado que no podemos mostrar con datos reales no ayuda a nadie.</p>
    <p>Lo que sí podemos ser específicos es en la diferencia real entre lo que ya estás usando en Starter y lo que suma Pro:</p>
    <p><strong>Starter (lo que ya tienes, sin fecha de vencimiento):</strong><br>
    — Dashboard con IQ Score<br>
    — Movimientos y categorización automática<br>
    — Presupuestos básicos<br>
    — Metas simples</p>
    <p><strong>Pro (US$4.99/mes o US$39.99/año):</strong><br>
    — Coach: recomendaciones que se ajustan con cada movimiento nuevo<br>
    — Advisor: proyección de escenarios antes de tomar una decisión grande<br>
    — Goals con seguimiento de múltiples objetivos y ajuste automático<br>
    — Reports exportables</p>
    <p>Si tu situación es simple, seguir en Starter no te falta nada. Si tienes varias metas corriendo en paralelo o una decisión grande en el horizonte cercano, ahí es donde Pro paga solo.</p>
    <p><a href="https://app.moyiq.app/upgrade?ref=starter-d5" ${BTN}>Ver Pro →</a></p>
    <p style="color:#666;font-size:13px">Si no es para ti, sigues en Starter sin perder nada de lo que ya armaste.</p>
    `,
    },
  },

  en: {
    welcome: {
      subject: "The first thing worth doing with your account",
      body: `
      <h2 style="color:#14213D">Your account is active</h2>
      <p>Hello,</p>
      <p>Your MOY IQ account is ready. With nothing loaded yet, the Dashboard has little to show you — the first step that pays off is importing your transactions.</p>
      <p>Go to Import and upload the file you download from your bank (CSV or Excel; most banks provide it that way). MOY IQ categorizes what it recognizes automatically; anything else stays under "Imported" and you adjust it whenever you want.</p>
      <p>You don't need to load your full history. The last month is enough for the Dashboard and the IQ Score to start showing something real.</p>
      <p><a href="https://app.moyiq.app/import?ref=starter-welcome" ${BTN}>Import transactions →</a></p>
      <p style="color:#666;font-size:13px">Your data is encrypted on your device before it syncs. No one on the team can see your amounts or categories.</p>
      `,
    },
    day2: {
      subject: "The IQ Score is not a decorative number",
      body: `
      <h2 style="color:#14213D">What most people don't find on their own</h2>
      <p>Hello,</p>
      <p>With transactions loaded, there is a part of the Dashboard that tends to go unnoticed: the IQ Score is not a generic score — it is built from five specific factors (cash flow, emergency fund, debt load, goal progress, consistency of your data), each with its own weight.</p>
      <p>Tap the score to see the breakdown. It shows where the real problem is instead of guessing — for example, a low score from negative cash flow calls for a different action than a low score from a missing emergency fund.</p>
      <p>Budgets does something similar in another section: it is built from what you already imported, without you having to define categories or limits by hand first.</p>
      <p><a href="https://app.moyiq.app/dashboard?ref=starter-d2" ${BTN}>See my IQ Score →</a></p>
      <p style="color:#666;font-size:13px">If you haven't imported transactions yet, the score has nothing to be calculated from — that is the step before this one.</p>
      `,
    },
    day5: {
      subject: "What separates Starter from Pro in practice",
      body: `
    <h2 style="color:#14213D">No made-up testimonials</h2>
    <p>Hello,</p>
    <p>We are not going to make up a testimonial like "So-and-so saved X% in 3 months". We don't have those cases documented yet, and promising a result we can't show with real data doesn't help anyone.</p>
    <p>What we can be specific about is the real difference between what you already use in Starter and what Pro adds:</p>
    <p><strong>Starter (what you already have, with no expiry date):</strong><br>
    — Dashboard with IQ Score<br>
    — Transactions and automatic categorization<br>
    — Basic budgets<br>
    — Simple goals</p>
    <p><strong>Pro (US$4.99/month or US$39.99/year):</strong><br>
    — Coach: recommendations that adjust with every new transaction<br>
    — Advisor: scenario projections before a big decision<br>
    — Goals with tracking of multiple objectives and automatic adjustment<br>
    — Exportable reports</p>
    <p>If your situation is simple, staying on Starter leaves nothing missing. If you have several goals running in parallel or a big decision coming up soon, that is where Pro pays for itself.</p>
    <p><a href="https://app.moyiq.app/upgrade?ref=starter-d5" ${BTN}>See Pro →</a></p>
    <p style="color:#666;font-size:13px">If it's not for you, you stay on Starter without losing anything you have set up.</p>
    `,
    },
  },

  pt: {
    welcome: {
      subject: "A primeira coisa que vale a pena fazer com sua conta",
      body: `
      <h2 style="color:#14213D">Sua conta já está ativa</h2>
      <p>Olá,</p>
      <p>Sua conta do MOY IQ já está pronta. Sem nada carregado ainda, o Painel não tem muito para mostrar — o primeiro passo que rende é importar seus movimentos.</p>
      <p>Vá em Importar e envie o arquivo que você baixar do seu banco (CSV ou Excel, a maioria dos bancos fornece assim). O MOY IQ categoriza automaticamente o que reconhece; o que não reconhece fica em "Importado" e você ajusta quando quiser.</p>
      <p>Não é preciso carregar todo o histórico. O último mês basta para que o Painel e o IQ Score comecem a mostrar algo real.</p>
      <p><a href="https://app.moyiq.app/import?ref=starter-welcome" ${BTN}>Importar movimentos →</a></p>
      <p style="color:#666;font-size:13px">Os dados são criptografados no seu dispositivo antes de sincronizar. Ninguém da equipe pode ver seus valores nem categorias.</p>
      `,
    },
    day2: {
      subject: "O IQ Score não é um número decorativo",
      body: `
      <h2 style="color:#14213D">O que a maioria não descobre sozinha</h2>
      <p>Olá,</p>
      <p>Com movimentos já carregados, há uma parte do Painel que costuma passar despercebida: o IQ Score não é uma pontuação genérica — ele é montado com cinco fatores específicos (fluxo de caixa, reserva de emergência, peso da dívida, progresso das metas, consistência dos seus dados), cada um com seu próprio peso.</p>
      <p>Toque no score para ver o detalhamento. Serve para localizar onde está o problema real em vez de adivinhar — por exemplo, um score baixo por fluxo de caixa negativo pede uma ação diferente de um score baixo por falta de reserva de emergência.</p>
      <p>Orçamentos faz algo parecido em outra seção: é montado a partir do que você já importou, sem que você precise definir categorias nem limites à mão antes.</p>
      <p><a href="https://app.moyiq.app/dashboard?ref=starter-d2" ${BTN}>Ver meu IQ Score →</a></p>
      <p style="color:#666;font-size:13px">Se você ainda não importou movimentos, o score não tem com o que ser calculado — esse é o passo anterior a este.</p>
      `,
    },
    day5: {
      subject: "O que diferencia o Starter do Pro na prática",
      body: `
    <h2 style="color:#14213D">Sem depoimentos inventados</h2>
    <p>Olá,</p>
    <p>Não vamos inventar um depoimento do tipo "Fulano economizou X% em 3 meses". Ainda não temos esses casos documentados, e prometer um resultado que não podemos mostrar com dados reais não ajuda ninguém.</p>
    <p>O que podemos detalhar é a diferença real entre o que você já usa no Starter e o que o Pro acrescenta:</p>
    <p><strong>Starter (o que você já tem, sem data de vencimento):</strong><br>
    — Painel com IQ Score<br>
    — Movimentos e categorização automática<br>
    — Orçamentos básicos<br>
    — Metas simples</p>
    <p><strong>Pro (US$4.99/mês ou US$39.99/ano):</strong><br>
    — Coach: recomendações que se ajustam a cada novo movimento<br>
    — Advisor: projeção de cenários antes de uma decisão grande<br>
    — Goals com acompanhamento de vários objetivos e ajuste automático<br>
    — Relatórios exportáveis</p>
    <p>Se a sua situação é simples, ficar no Starter não deixa nada faltando. Se você tem várias metas em paralelo ou uma decisão grande no horizonte próximo, é aí que o Pro se paga.</p>
    <p><a href="https://app.moyiq.app/upgrade?ref=starter-d5" ${BTN}>Ver o Pro →</a></p>
    <p style="color:#666;font-size:13px">Se não for para você, você continua no Starter sem perder nada do que já montou.</p>
    `,
    },
  },

  de: {
    welcome: {
      subject: "Der erste sinnvolle Schritt mit Ihrem Konto",
      body: `
      <h2 style="color:#14213D">Ihr Konto ist aktiv</h2>
      <p>Guten Tag,</p>
      <p>Ihr MOY IQ-Konto ist eingerichtet. Solange noch nichts geladen ist, zeigt das Dashboard wenig — der erste Schritt, der sich lohnt, ist der Import Ihrer Buchungen.</p>
      <p>Öffnen Sie Importieren und laden Sie die Datei hoch, die Sie bei Ihrer Bank herunterladen (CSV oder Excel, die meisten Banken bieten das an). MOY IQ ordnet erkannte Buchungen automatisch einer Kategorie zu; der Rest bleibt unter "Importiert" und lässt sich jederzeit anpassen.</p>
      <p>Die gesamte Historie ist nicht nötig. Der letzte Monat reicht, damit Dashboard und IQ Score etwas Reales zeigen.</p>
      <p><a href="https://app.moyiq.app/import?ref=starter-welcome" ${BTN}>Buchungen importieren →</a></p>
      <p style="color:#666;font-size:13px">Die Daten werden auf Ihrem Gerät verschlüsselt, bevor sie synchronisiert werden. Niemand im Team kann Ihre Beträge oder Kategorien sehen.</p>
      `,
    },
    day2: {
      subject: "Der IQ Score ist keine Dekoration",
      body: `
      <h2 style="color:#14213D">Was die meisten nicht von selbst entdecken</h2>
      <p>Guten Tag,</p>
      <p>Sobald Buchungen geladen sind, wird ein Teil des Dashboards oft übersehen: Der IQ Score ist kein allgemeiner Wert — er setzt sich aus fünf konkreten Faktoren zusammen (Cashflow, Notgroschen, Schuldenlast, Fortschritt der Ziele, Konsistenz Ihrer Daten), jeder mit eigener Gewichtung.</p>
      <p>Tippen Sie auf den Score, um die Aufschlüsselung zu sehen. So lässt sich das eigentliche Problem eingrenzen, statt zu raten — ein niedriger Score wegen negativem Cashflow verlangt zum Beispiel eine andere Maßnahme als einer wegen fehlendem Notgroschen.</p>
      <p>Budgets macht in einem anderen Bereich etwas Ähnliches: Es entsteht aus dem, was Sie bereits importiert haben, ohne dass Sie vorher Kategorien oder Limits von Hand festlegen müssen.</p>
      <p><a href="https://app.moyiq.app/dashboard?ref=starter-d2" ${BTN}>Meinen IQ Score ansehen →</a></p>
      <p style="color:#666;font-size:13px">Wenn Sie noch keine Buchungen importiert haben, fehlt dem Score die Grundlage — das ist der Schritt davor.</p>
      `,
    },
    day5: {
      subject: "Was Starter und Pro in der Praxis unterscheidet",
      body: `
    <h2 style="color:#14213D">Keine erfundenen Erfahrungsberichte</h2>
    <p>Guten Tag,</p>
    <p>Wir erfinden keinen Erfahrungsbericht wie "Person X hat in 3 Monaten X % gespart". Solche Fälle haben wir noch nicht dokumentiert, und ein Ergebnis zu versprechen, das wir nicht mit echten Daten belegen können, hilft niemandem.</p>
    <p>Konkret benennen können wir den tatsächlichen Unterschied zwischen dem, was Sie in Starter bereits nutzen, und dem, was Pro ergänzt:</p>
    <p><strong>Starter (was Sie bereits haben, ohne Ablaufdatum):</strong><br>
    — Dashboard mit IQ Score<br>
    — Buchungen und automatische Kategorisierung<br>
    — Einfache Budgets<br>
    — Einfache Ziele</p>
    <p><strong>Pro (US$4.99/Monat oder US$39.99/Jahr):</strong><br>
    — Coach: Empfehlungen, die sich mit jeder neuen Buchung anpassen<br>
    — Advisor: Szenarien durchrechnen, bevor eine große Entscheidung fällt<br>
    — Goals mit Verfolgung mehrerer Ziele und automatischer Anpassung<br>
    — Exportierbare Berichte</p>
    <p>Wenn Ihre Situation einfach ist, fehlt Ihnen in Starter nichts. Wenn mehrere Ziele parallel laufen oder eine große Entscheidung bevorsteht, rechnet sich Pro.</p>
    <p><a href="https://app.moyiq.app/upgrade?ref=starter-d5" ${BTN}>Pro ansehen →</a></p>
    <p style="color:#666;font-size:13px">Wenn es nicht passt, bleiben Sie bei Starter, ohne etwas von dem zu verlieren, was Sie bereits eingerichtet haben.</p>
    `,
    },
  },
};
