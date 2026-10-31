// src/data/releaseNotes.js — N12 (ola C; patrón "Novedades" de rial), 30-oct-2026.
// Qué cambió, en 2–4 líneas por versión y en los 4 idiomas. La más nueva va
// primero. Se muestra una sola vez a quien ya usaba la app (WhatsNew.jsx).
// Voz de producto: seca, sin exclamaciones, sin voseo.
export const RELEASE_NOTES = [
  {
    id: '2026-10-30e',
    items: {
      es: [
        'Registra un movimiento en una línea: escribe «pan 1200» o «uber 8,50 ayer» en el alta rápida y los campos se llenan solos. Se interpreta en tu dispositivo y nada se guarda hasta que confirmas.',
        'El mes en palabras: una frase en el Inicio y una lectura más larga en Panorama, con los títulos de Presupuestos y de los gráficos convertidos en conclusiones.',
        'Nuevo gráfico en Panorama: gasto acumulado contra el ritmo del mes.',
      ],
      en: [
        'Add a transaction in one line: type “bread 12” or “uber 8.50 yesterday” in quick add and the fields fill in. It is interpreted on your device and nothing is saved until you confirm.',
        'The month in words: one sentence on Home and a longer reading in Overview, and Budgets and chart titles now state the conclusion.',
        'New Overview chart: cumulative spending against the pace of the month.',
      ],
      pt: [
        'Registre um movimento em uma linha: escreva «pão 12» ou «uber 8,50 ontem» no registro rápido e os campos se preenchem. É interpretado no seu dispositivo e nada é salvo até você confirmar.',
        'O mês em palavras: uma frase no Início e uma leitura mais longa no Panorama, com os títulos de Orçamentos e dos gráficos trazendo a conclusão.',
        'Novo gráfico no Panorama: gasto acumulado em relação ao ritmo do mês.',
      ],
      de: [
        'Buchung in einer Zeile: Geben Sie in der Schnellerfassung „Brot 3“ oder „Uber 8,50 gestern“ ein, die Felder füllen sich von selbst. Die Auswertung erfolgt auf Ihrem Gerät, gespeichert wird erst nach Ihrer Bestätigung.',
        'Der Monat in Worten: ein Satz auf der Startseite und eine längere Auswertung im Überblick; die Titel von Budgets und Diagrammen nennen nun das Ergebnis.',
        'Neues Diagramm im Überblick: kumulierte Ausgaben im Vergleich zum Monatstempo.',
      ],
    },
  },
  {
    id: '2026-10-30d',
    items: {
      es: [
        'Nuevo módulo Inversiones, gratis y opcional: enciéndelo en Ajustes › Funciones para ver tu portafolio de Invest en Panorama y en Patrimonio.',
        '«Abrir Invest» entra con tu sesión, sin volver a iniciarla. Es información, no asesoría de inversión.',
      ],
      en: [
        'New optional Investments module, free: turn it on in Settings › Features to see your Invest portfolio in Overview and Net worth.',
        '“Open Invest” keeps you signed in. This is information, not investment advice.',
      ],
      pt: [
        'Novo módulo Investimentos, grátis e opcional: ative em Ajustes › Funções para ver seu portfólio do Invest no Panorama e no Patrimônio.',
        '«Abrir o Invest» entra com a sua sessão, sem novo login. É informação, não consultoria de investimentos.',
      ],
      de: [
        'Neues optionales Modul Investments, kostenlos: Schalten Sie es unter Einstellungen › Funktionen ein, um Ihr Invest-Portfolio im Überblick und im Vermögen zu sehen.',
        '„Invest öffnen“ meldet Sie direkt an. Das ist eine Information, keine Anlageberatung.',
      ],
    },
  },
  {
    id: '2026-10-30c',
    items: {
      es: [
        'Inicio más corto: lo que te queda, atajos, un aviso a la vez, los pagos de la semana y el presupuesto en riesgo.',
        'La vista detallada ahora es Panorama, en «Más»: IQ Score, proyección, patrimonio, diagnóstico y gráficos. También se abre desde la fila del IQ.',
        '«Menú» se llama «Más» y tiene 4 grupos. Movimientos y Presupuestos muestran menos cifras a la vez; el resto está a un toque.',
        'Puedes sumar tarjetas al Inicio con «Editar Inicio» y encender o apagar funciones en Ajustes › Funciones.',
      ],
      en: [
        'A shorter Home: what you have left, shortcuts, one notice at a time, this week’s payments and the budgets at risk.',
        'The detailed view is now Overview, under “More”: IQ Score, projection, net worth, diagnosis and charts. The IQ row opens it too.',
        '“Menu” is now “More”, in 4 groups. Transactions and Budgets show fewer numbers at once; the rest is one tap away.',
        'Add cards to Home with “Edit Home” and turn features on or off in Settings › Features.',
      ],
      pt: [
        'Início mais curto: o que sobra, atalhos, um aviso por vez, os pagamentos da semana e o orçamento em risco.',
        'A visão detalhada agora é o Panorama, em «Mais»: IQ Score, projeção, patrimônio, diagnóstico e gráficos. A linha do IQ também o abre.',
        '«Menu» agora se chama «Mais» e tem 4 grupos. Movimentos e Orçamentos mostram menos números de uma vez; o resto está a um toque.',
        'Adicione cartões ao Início com «Editar Início» e ative ou desative funções em Ajustes › Funções.',
      ],
      de: [
        'Ein kürzerer Start: was übrig bleibt, Schnellzugriffe, ein Hinweis nach dem anderen, die Zahlungen der Woche und gefährdete Budgets.',
        'Die Detailansicht heißt jetzt Überblick und liegt unter „Mehr“: IQ Score, Prognose, Vermögen, Diagnose und Diagramme. Die IQ-Zeile öffnet sie auch.',
        '„Menü“ heißt jetzt „Mehr“, in 4 Gruppen. Buchungen und Budgets zeigen weniger Zahlen auf einmal; der Rest ist einen Tipp entfernt.',
        'Mit „Start bearbeiten“ fügen Sie Karten hinzu; unter Einstellungen › Funktionen schalten Sie Funktionen ein oder aus.',
      ],
    },
  },
  {
    id: '2026-10-30b',
    items: {
      es: [
        'Ajustes en pocas filas, con buscador. Todo sigue ahí, agrupado.',
        'Deudas separa "Debo" y "Me deben": lo que te deben cuenta en tu patrimonio y aparece como cobro próximo.',
        'Movimientos tiene vista de calendario, con lo previsto de cada día.',
        'Metas con plantillas, fondo de emergencia siempre a mano y un asistente de presupuesto en 3 pasos.',
      ],
      en: [
        'Settings in a few rows, with search. Everything is still there, grouped.',
        'Debts separates "I owe" and "Owed to me": what you are owed counts in your net worth and shows as an upcoming collection.',
        'Transactions has a calendar view, with what is planned each day.',
        'Goals with templates, an emergency fund always at hand and a 3-step budget assistant.',
      ],
      pt: [
        'Ajustes em poucas linhas, com busca. Tudo continua lá, agrupado.',
        'Dívidas separa "Devo" e "Me devem": o que te devem conta no seu patrimônio e aparece como recebimento próximo.',
        'Movimentos tem visão de calendário, com o previsto de cada dia.',
        'Metas com modelos, fundo de emergência sempre à mão e um assistente de orçamento em 3 passos.',
      ],
      de: [
        'Einstellungen in wenigen Zeilen, mit Suche. Alles ist noch da, gruppiert.',
        'Schulden trennt „Ich schulde“ und „Man schuldet mir“: Forderungen zählen zum Vermögen und erscheinen als anstehender Eingang.',
        'Buchungen hat eine Kalenderansicht mit dem Geplanten pro Tag.',
        'Ziele mit Vorlagen, Notgroschen immer zur Hand und ein Budget-Assistent in 3 Schritten.',
      ],
    },
  },
  {
    id: '2026-10-30',
    items: {
      es: [
        'Movimientos muestra gastos e ingresos juntos, con el mes a la vista y el total de cada uno.',
        'Registrar es más rápido: "Guardar" siempre visible, ✓ en el teclado, categoría sugerida y equivalente en dólares.',
        'Conversor de tasa gratis desde el Inicio, con la tasa, su fuente y su fecha.',
        'Presupuestos muestra cómo se reparte el ingreso, con un ahorro objetivo. El tema puede seguir al del sistema.',
      ],
      en: [
        'Transactions shows expenses and income together, with the month in view and a total for each.',
        'Adding is faster: "Save" always visible, ✓ on the keypad, suggested category and the dollar equivalent.',
        'Free rate converter from Home, with the rate, its source and its date.',
        'Budgets shows how income is split, with a savings goal. The theme can follow the system.',
      ],
      pt: [
        'Movimentos mostra despesas e receitas juntas, com o mês à vista e o total de cada uma.',
        'Registrar ficou mais rápido: "Salvar" sempre visível, ✓ no teclado, categoria sugerida e equivalente em dólares.',
        'Conversor de taxa grátis a partir do Início, com a taxa, a fonte e a data.',
        'Orçamentos mostra como a renda se divide, com uma meta de poupança. O tema pode seguir o do sistema.',
      ],
      de: [
        'Buchungen zeigt Ausgaben und Einnahmen zusammen, mit dem Monat im Blick und der Summe von beiden.',
        'Erfassen geht schneller: „Speichern“ immer sichtbar, ✓ auf der Tastatur, vorgeschlagene Kategorie und Gegenwert in Dollar.',
        'Kostenloser Kursrechner auf der Startseite, mit Kurs, Quelle und Datum.',
        'Budgets zeigt die Aufteilung des Einkommens mit einem Sparziel. Das Design kann dem System folgen.',
      ],
    },
  },
]

export const SEEN_KEY = 'fos_release_seen'

// Qué notas mostrar: las de versiones más nuevas que la última vista. Primera
// vez en el dispositivo: si no hay datos propios, se marca como vista sin
// mostrar nada (una cuenta nueva no "vio" la versión anterior).
export function pendingNotes({ seen, hasData, notes = RELEASE_NOTES }) {
  const latest = notes[0]?.id || null
  if (!latest) return { show: [], markSeen: null }
  if (!seen) return hasData ? { show: notes.slice(0, 1), markSeen: latest } : { show: [], markSeen: latest }
  return { show: notes.filter(n => n.id > seen), markSeen: notes.some(n => n.id > seen) ? latest : null }
}
