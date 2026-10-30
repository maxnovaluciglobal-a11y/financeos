// src/data/releaseNotes.js — N12 (ola C; patrón "Novedades" de rial), 30-oct-2026.
// Qué cambió, en 2–4 líneas por versión y en los 4 idiomas. La más nueva va
// primero. Se muestra una sola vez a quien ya usaba la app (WhatsNew.jsx).
// Voz de producto: seca, sin exclamaciones, sin voseo.
export const RELEASE_NOTES = [
  {
    id: '2026-10-30',
    items: {
      es: [
        'La variación del mes muestra el monto cuando el porcentaje no informa. En Venezuela, en dólares con la tasa de cada mes.',
        'Presupuestos: reparto del ingreso con ahorro objetivo, y las categorías sin gasto dicen "Sin gasto registrado".',
        'Al guardar un movimiento puedes deshacerlo desde el aviso.',
        'Cuando hay una versión nueva, la app lo avisa.',
      ],
      en: [
        'The month change shows the amount when the percentage says nothing. In Venezuela, in dollars at each month\'s rate.',
        'Budgets: income split with a savings goal, and categories with no spending say "No spending yet".',
        'After saving a transaction you can undo it from the notice.',
        'When a new version is available, the app tells you.',
      ],
      pt: [
        'A variação do mês mostra o valor quando a porcentagem não informa. Na Venezuela, em dólares com a taxa de cada mês.',
        'Orçamentos: divisão da renda com meta de poupança, e categorias sem gasto dizem "Sem gasto registrado".',
        'Depois de salvar um lançamento, você pode desfazê-lo pelo aviso.',
        'Quando há uma versão nova, o app avisa.',
      ],
      de: [
        'Die Monatsveränderung zeigt den Betrag, wenn der Prozentwert nichts aussagt. In Venezuela in Dollar zum Kurs des jeweiligen Monats.',
        'Budgets: Aufteilung des Einkommens mit Sparziel; Kategorien ohne Ausgaben zeigen „Noch keine Ausgaben“.',
        'Nach dem Speichern einer Buchung können Sie sie über den Hinweis rückgängig machen.',
        'Wenn eine neue Version verfügbar ist, zeigt die App es an.',
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
