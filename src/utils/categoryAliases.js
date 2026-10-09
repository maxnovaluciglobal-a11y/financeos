// src/utils/categoryAliases.js — categorías duplicadas que se unifican.
//
// Las categorías se guardan como texto en español (el valor, no la etiqueta).
// Las plantillas de perfil guardaban "Entretenimiento" y la lista canónica
// (CATS_EXPENSE) usa "Entretención": la misma categoría aparecía dos veces en
// gráficos y presupuestos. Walter aprobó unificar (09-oct-2026). El valor
// canónico sigue siendo "Entretención" (es el que ya usan la lista canónica,
// las suscripciones y los datos demo); lo que ve el usuario sale de
// 'cat.Entretención' en i18n.
//
// Se aplica en tres lugares: la migración v5 de IndexedDB (datos ya
// guardados), importAllData (respaldo JSON, sync, copias locales) y la
// importación de archivos. Todas las funciones son puras e idempotentes:
// sobre datos ya unificados no cambian nada.

export const CATEGORY_ALIASES = Object.freeze({ Entretenimiento: 'Entretención' })

const hasAlias = (c) => typeof c === 'string' && Object.prototype.hasOwnProperty.call(CATEGORY_ALIASES, c)
export const canonicalCategory = (c) => (hasAlias(c) ? CATEGORY_ALIASES[c] : c)

// Registros con `category` (gastos, ingresos, reglas de fijos). Devuelve la
// lista nueva y solo los registros que cambiaron (para escribir lo mínimo).
export function unifyRecords(list) {
  if (!Array.isArray(list)) return { list, changed: [] }
  const changed = []
  const out = list.map(r => {
    if (!r || !hasAlias(r.category)) return r
    const next = { ...r, category: canonicalCategory(r.category) }
    changed.push(next)
    return next
  })
  return { list: out, changed }
}

// Presupuestos: uno por categoría (no son por mes). Si existen los dos
// ("Entretenimiento" y "Entretención"), se fusionan en el canónico con la
// SUMA de los límites: antes de unificar, cada presupuesto medía solo su
// parte del gasto; después, el gasto de las dos grafías cae en una sola
// categoría, así que el límite que le corresponde es la suma. Quedarse con
// el mayor achicaría el margen total y dispararía alertas de "excedido" que
// antes no existían. Se conserva el registro canónico (id, campos); el otro
// se borra. Solo se tocan los grupos que tienen una grafía vieja.
export function mergeBudgets(list) {
  if (!Array.isArray(list)) return { list, puts: [], deletes: [] }
  const groups = new Map()
  for (const b of list) {
    if (!b) continue
    const key = canonicalCategory(b.category)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(b)
  }
  const puts = [], deletes = [], replaced = new Map()
  for (const [cat, group] of groups) {
    if (!group.some(b => hasAlias(b.category))) continue
    const keep = group.find(b => !hasAlias(b.category)) || group[0]
    const limit = group.reduce((s, b) => s + (Number(b.limit) || 0), 0)
    const merged = { ...keep, category: cat, limit }
    puts.push(merged)
    replaced.set(keep, merged)
    for (const b of group) if (b !== keep) { deletes.push(b.id); replaced.set(b, null) }
  }
  if (!puts.length) return { list, puts, deletes }
  const out = []
  for (const b of list) {
    if (!replaced.has(b)) { out.push(b); continue }
    const r = replaced.get(b)
    if (r) out.push(r)
  }
  return { list: out, puts, deletes }
}

// Ajustes: listas de categorías de la plantilla, presupuestos sugeridos y
// reglas comercio → categoría. Devuelve null si no hay nada que cambiar.
export function unifySettings(settings) {
  if (!settings || typeof settings !== 'object') return null
  let changed = false
  const next = { ...settings }
  for (const k of ['categoriesExpense', 'categoriesIncome']) {
    const arr = settings[k]
    if (!Array.isArray(arr) || !arr.some(hasAlias)) continue
    next[k] = [...new Set(arr.map(canonicalCategory))]
    changed = true
  }
  if (Array.isArray(settings.templateSuggestedBudgets) && settings.templateSuggestedBudgets.some(b => hasAlias(b?.category))) {
    next.templateSuggestedBudgets = settings.templateSuggestedBudgets.map(b => (b && hasAlias(b.category) ? { ...b, category: canonicalCategory(b.category) } : b))
    changed = true
  }
  const rules = settings.merchantRules
  if (rules && typeof rules === 'object' && Object.values(rules).some(hasAlias)) {
    next.merchantRules = Object.fromEntries(Object.entries(rules).map(([k, v]) => [k, canonicalCategory(v)]))
    changed = true
  }
  return changed ? next : null
}

// Plan completo sobre los datos de las stores (lo usa la migración v5).
export function planCategoryUnification({ incomes, expenses, budgets, recurring, settings } = {}) {
  const inc = unifyRecords(incomes), exp = unifyRecords(expenses), rec = unifyRecords(recurring)
  const bud = mergeBudgets(budgets)
  const nextSettings = unifySettings(settings)
  const puts = { incomes: inc.changed, expenses: exp.changed, recurring: rec.changed, budgets: bud.puts }
  const empty = !nextSettings && !bud.deletes.length && Object.values(puts).every(a => !a.length)
  return { empty, puts, deletes: { budgets: bud.deletes }, settings: nextSettings }
}

// Payload de respaldo / sync (mismo formato que exportAllData). Copia nueva.
export function unifyCategoryPayload(data) {
  if (!data || typeof data !== 'object') return data
  const out = { ...data }
  for (const k of ['incomes', 'expenses', 'recurring']) if (Array.isArray(data[k])) out[k] = unifyRecords(data[k]).list
  if (Array.isArray(data.budgets)) out.budgets = mergeBudgets(data.budgets).list
  if (data.settings) out.settings = unifySettings(data.settings) || data.settings
  return out
}
