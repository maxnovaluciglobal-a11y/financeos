// src/data/releaseNotes.js — N12 (ola C; patrón "Novedades" de rial), 30-oct-2026.
// Qué cambió, en 2–4 líneas por versión y en los 4 idiomas. La más nueva va
// primero. Se muestra una sola vez a quien ya usaba la app (WhatsNew.jsx).
// Voz de producto: seca, sin exclamaciones, sin voseo.
import { REBRAND_DEPLOY_DATE } from './deployDate.js'

export const RELEASE_NOTES = [
  // Rebranding (Entrega 1). El id es la fecha del despliegue coordinado
  // (data/deployDate.js) y tiene que ser mayor que el de la nota anterior.
  {
    id: REBRAND_DEPLOY_DATE,
    items: {
      es: [
        'MOY IQ ahora es moyiq: cambian el nombre, el logo y los colores. Tus datos, tu cuenta y tu plan siguen igual, y el responsable y el tratamiento de los datos no cambian.',
        'En iPhone, puedes conservar el ícono y el nombre viejos en la pantalla de inicio: la app funciona igual. Si igual quieres el ícono nuevo: 1) crea un respaldo en Más › Ajustes › Respaldo y restauración; 2) borra la app de la pantalla de inicio y vuelve a agregarla (Compartir › Agregar a inicio); 3) ábrela y restaura ese respaldo en el mismo lugar (si lo cifraste, necesitas su contraseña). Sin respaldo no la borres: el iPhone puede borrar los datos guardados en ella.',
        'Invest ahora se llama Inversiones y sigue en Panorama y en Patrimonio.',
      ],
      en: [
        'MOY IQ is now moyiq: the name, logo and colors change. Your data, your account and your plan stay the same, and the controller and the processing of your data do not change.',
        'On iPhone, you can keep the old icon and name on your Home Screen: the app works the same. If you still want the new icon: 1) create a backup in More › Settings › Backup and restore; 2) remove the app from your Home Screen and add it again (Share › Add to Home Screen); 3) open it and restore that backup in the same place (if you encrypted it, you need its password). Do not remove it without a backup: the iPhone can delete the data stored in it.',
        'Invest is now called Investments and is still in Overview and Net worth.',
      ],
      pt: [
        'O MOY IQ agora é moyiq: mudam o nome, o logo e as cores. Seus dados, sua conta e seu plano continuam iguais, e o responsável e o tratamento dos dados não mudam.',
        'No iPhone, você pode manter o ícone e o nome antigos na tela de início: o app funciona igual. Se ainda quiser o ícone novo: 1) crie um backup em Mais › Configurações › Backup e restauração; 2) apague o app da tela de início e adicione de novo (Compartilhar › Adicionar à Tela de Início); 3) abra o app e restaure esse backup no mesmo lugar (se você o criptografou, precisa da senha). Sem backup, não apague: o iPhone pode apagar os dados guardados nele.',
        'O Invest agora se chama Investimentos e continua no Panorama e no Patrimônio.',
      ],
      de: [
        'MOY IQ heißt jetzt moyiq: Name, Logo und Farben ändern sich. Ihre Daten, Ihr Konto und Ihr Tarif bleiben gleich, und der Verantwortliche und die Verarbeitung Ihrer Daten ändern sich nicht.',
        'Auf dem iPhone können Sie das alte Symbol und den alten Namen auf dem Home-Bildschirm behalten: Die App funktioniert unverändert. Wenn Sie trotzdem das neue Symbol möchten: 1) Erstellen Sie eine Sicherung unter Mehr › Einstellungen › Sicherung und Wiederherstellung; 2) entfernen Sie die App vom Home-Bildschirm und fügen Sie sie erneut hinzu (Teilen › Zum Home-Bildschirm); 3) öffnen Sie sie und stellen Sie diese Sicherung an derselben Stelle wieder her (wenn Sie sie verschlüsselt haben, brauchen Sie das Passwort). Ohne Sicherung bitte nicht entfernen: Das iPhone kann die darin gespeicherten Daten löschen.',
        'Invest heißt jetzt Investments und ist weiterhin im Überblick und im Vermögen.',
      ],
    },
  },
  {
    id: '2026-10-30e',
    items: {
      es: [
        'Registra un movimiento en una línea: escribe «pan 1200» o «uber 8,50 ayer» en el alta rápida y los campos se llenan solos. Se interpreta en tu dispositivo y nada se guarda hasta que confirmas.',
        'El mes en palabras: una frase en el Inicio y una lectura más larga en Panorama, con los títulos de Presupuestos y de los gráficos convertidos en conclusiones.',
        'Gasto acumulado contra el ritmo del mes: hoy se ve en el gráfico del Inicio.',
      ],
      en: [
        'Add a transaction in one line: type “bread 12” or “uber 8.50 yesterday” in quick add and the fields fill in. It is interpreted on your device and nothing is saved until you confirm.',
        'The month in words: one sentence on Home and a longer reading in Overview, and Budgets and chart titles now state the conclusion.',
        'Cumulative spending against the pace of the month: it now shows in the Home chart.',
      ],
      pt: [
        'Registre um movimento em uma linha: escreva «pão 12» ou «uber 8,50 ontem» no registro rápido e os campos se preenchem. É interpretado no seu dispositivo e nada é salvo até você confirmar.',
        'O mês em palavras: uma frase no Início e uma leitura mais longa no Panorama, com os títulos de Orçamentos e dos gráficos trazendo a conclusão.',
        'Gasto acumulado em relação ao ritmo do mês: hoje aparece no gráfico do Início.',
      ],
      de: [
        'Buchung in einer Zeile: Geben Sie in der Schnellerfassung „Brot 3“ oder „Uber 8,50 gestern“ ein, die Felder füllen sich von selbst. Die Auswertung erfolgt auf Ihrem Gerät, gespeichert wird erst nach Ihrer Bestätigung.',
        'Der Monat in Worten: ein Satz auf der Startseite und eine längere Auswertung im Überblick; die Titel von Budgets und Diagrammen nennen nun das Ergebnis.',
        'Kumulierte Ausgaben im Vergleich zum Monatstempo: jetzt im Diagramm der Startseite.',
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

// Una cuenta que pasa por el onboarding es nueva: no tiene nada que "ponerse
// al día". Sin esto, quien cargaba los datos de ejemplo o registraba su primer
// movimiento en el onboarding llegaba al Inicio con datos y sin `seen`, y
// pendingNotes() le mostraba la nota del cambio de nombre (19-nov-2026).
export function markNotesSeen(storage = globalThis.localStorage, notes = RELEASE_NOTES) {
  const latest = notes[0]?.id
  if (!latest) return
  try { storage?.setItem(SEEN_KEY, latest) } catch { /* modo privado: a lo sumo se ve la nota una vez */ }
}

// Qué notas mostrar: las de versiones más nuevas que la última vista. Primera
// vez en el dispositivo: si no hay datos propios, se marca como vista sin
// mostrar nada (una cuenta nueva no "vio" la versión anterior).
export function pendingNotes({ seen, hasData, notes = RELEASE_NOTES }) {
  const latest = notes[0]?.id || null
  if (!latest) return { show: [], markSeen: null }
  if (!seen) return hasData ? { show: notes.slice(0, 1), markSeen: latest } : { show: [], markSeen: latest }
  return { show: notes.filter(n => n.id > seen), markSeen: notes.some(n => n.id > seen) ? latest : null }
}
