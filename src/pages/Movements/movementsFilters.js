// src/pages/Movements/movementsFilters.js — poda P2 ("densidad"), 30-oct-2026.
// Estado de los filtros de Movimientos después de pasar los chips a una hoja
// "Filtrar": qué filtros están activos (se muestran como chips quitables de un
// toque), cómo se quita uno, cuándo se ve el buscador y qué pasa al tocar una
// porción del donut "Por categoría". Sin React; testeado en movementsFilters.test.js.

// Origen: 'all' | 'oneoff' | 'fixed' (los mismos de filterMovements).
export const ORIGIN_KINDS = ['oneoff', 'fixed']

// Tocar el activo lo apaga (mismo comportamiento que los chips de antes).
export const toggleKind = (cur, k) => (cur === k || !ORIGIN_KINDS.includes(k) ? 'all' : k)
export const toggleCategory = (cur, c) => (!c || cur === c ? null : c)

// Filtros activos, en el orden en que se muestran: origen y luego categoría.
export function activeFilters({ kind = 'all', category = null } = {}) {
  const out = []
  if (ORIGIN_KINDS.includes(kind)) out.push({ id: 'kind', value: kind })
  if (category) out.push({ id: 'category', value: category })
  return out
}

export const hasActiveFilter = (state) => activeFilters(state).length > 0

// Quitar un filtro (chip quitable) o todos (id = 'all').
export function clearFilter(state = {}, id) {
  const next = { kind: state.kind || 'all', category: state.category ?? null }
  if (id === 'kind' || id === 'all') next.kind = 'all'
  if (id === 'category' || id === 'all') next.category = null
  return next
}

// El buscador se abre con la lupa; con una búsqueda escrita sigue visible
// aunque se cierre (no se esconde un filtro que está actuando).
export const searchVisible = ({ open = false, query = '' } = {}) => !!open || String(query || '').trim().length > 0

// La lupa: abre si está cerrada; si está abierta sin texto, cierra; con texto
// no cambia nada (el buscador sigue visible y la búsqueda sigue activa).
export function toggleSearch({ open = false, query = '' } = {}) {
  if (!open) return true
  return String(query || '').trim().length > 0
}

// Tocar una porción del donut (gastos por categoría): filtra la lista por esa
// categoría. Con "Ingresos" elegido pasa a "Gastos" (la categoría es de
// gastos); "Todos" y "Gastos" se respetan. En el calendario vuelve a la lista,
// que es la que filtra por categoría.
export function donutPick({ type = 'all', view = 'list' } = {}, category) {
  return {
    type: type === 'income' ? 'expense' : type,
    view: category ? 'list' : view,
    category: category || null,
  }
}

// Registros del donut: gastos del mes (categoría + monto ya en la lente).
export function donutRecords(monthExpenses, toAmount = (n) => Number(n) || 0) {
  return (Array.isArray(monthExpenses) ? monthExpenses : [])
    .filter((e) => e && Number(e.amount) > 0)
    .map((e) => ({ category: e.category, amount: toAmount(Number(e.amount) || 0) }))
}
