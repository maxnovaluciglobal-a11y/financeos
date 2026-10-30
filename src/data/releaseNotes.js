// src/data/releaseNotes.js — N12 (ola C; patrón "Novedades" de rial), 30-oct-2026.
// Qué cambió, en 2–4 líneas por versión y en los 4 idiomas. La más nueva va
// primero. Se muestra una sola vez a quien ya usaba la app (WhatsNew.jsx).
// Voz de producto: seca, sin exclamaciones, sin voseo.
export const RELEASE_NOTES = [
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
