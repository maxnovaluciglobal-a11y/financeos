// src/pages/Movements/movementsList.js — lógica pura de la lista de gastos (UI-M3)
// Búsqueda, filtros (categoría, fijo/único) y agrupación por día con subtotal.
// Sin React; testeado en movementsList.test.js.

// Fijo = vino de una regla de movimientos fijos (suscripción, cuota o fijo
// manual confirmado): lleva recurringId. Único = todo lo demás.
export const isFixed = (e) => !!e?.recurringId

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// query busca en descripción, categoría (canónica y traducida), subcategoría y notas.
// catNameOf: (categoría) => nombre traducido.
export function filterMovements(list, { query = '', category = null, kind = 'all', catNameOf = (c) => c } = {}) {
  const q = norm(query.trim())
  return (Array.isArray(list) ? list : []).filter((e) => {
    if (!e) return false
    if (category && (e.category || '') !== category) return false
    if (kind === 'fixed' && !isFixed(e)) return false
    if (kind === 'oneoff' && isFixed(e)) return false
    if (!q) return true
    return [e.description, e.category, catNameOf(e.category), e.subcategory, e.notes].some((f) => norm(f).includes(q))
  })
}

// [{ date: 'YYYY-MM-DD', total, items }] del día más reciente al más viejo;
// dentro del día, el orden que trae la lista (más reciente primero).
export function groupByDay(list) {
  const map = new Map()
  for (const e of Array.isArray(list) ? list : []) {
    const d = String(e?.date || '').slice(0, 10)
    if (!map.has(d)) map.set(d, { date: d, total: 0, items: [] })
    const g = map.get(d)
    g.total += Number(e.amount) || 0
    g.items.push(e)
  }
  return [...map.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

// Categorías presentes en la lista, de mayor a menor gasto (para los chips).
export function categoriesByAmount(list) {
  const map = new Map()
  for (const e of Array.isArray(list) ? list : []) {
    const c = e?.category || ''
    map.set(c, (map.get(c) || 0) + (Number(e.amount) || 0))
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)
}

// Encabezado de día: "Hoy", "Ayer" o "mié, 15 oct" en el idioma de la interfaz.
export function dayLabel(iso, { today, locale = 'es-CL', t = (k) => k } = {}) {
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return String(iso || '')
  const date = new Date(y, m - 1, d)
  if (today) {
    const [ty, tm, td] = String(today).split('-').map(Number)
    const diff = Math.round((new Date(ty, tm - 1, td) - date) / 86_400_000)
    if (diff === 0) return t('movl.day.today')
    if (diff === 1) return t('movl.day.yesterday')
  }
  try {
    return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(date)
  } catch {
    return `${d}/${m}`
  }
}
