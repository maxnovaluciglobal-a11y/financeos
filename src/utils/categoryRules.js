// @ts-check
// src/utils/categoryRules.js — reglas de categoría locales (24-nov-2026).
//
// "Cuando el detalle contenga X, la categoría es Y." Las crea la persona a
// propósito: desde un movimiento ("Aplicar siempre a 'Uber'"), desde la hoja
// de categoría de Por revisar o en Ajustes › Categorías y reglas. Se aplican al
// alta manual, a la importación de archivos, al Atajo de Apple Pay y al
// dictado. Todo queda en el dispositivo: viven en `settings.categoryRules` y
// viajan dentro del respaldo y del blob cifrado del sync como cualquier ajuste.
//
// Distinto de `settings.merchantRules` (quickAdd.js): ese mapa se aprende solo
// al guardar (comercio exacto → categoría) y su resultado sigue siendo una
// sugerencia. Una regla de acá la escribió la persona, así que la categoría
// que pone cuenta como elegida: el movimiento no entra a Por revisar por su
// categoría (utils/review.js). Lo que entra por otra razón (un fijo que se
// registró solo) sigue entrando.
//
// Forma de una regla (todo opcional salvo match y category; lo viejo o
// malformado se descarta en sanitizeRules, nunca rompe):
//   { id, match: 'uber', category: 'Transporte', kind: 'expense'|'income'|'any',
//     createdAt: ISO, source?: 'user'|'demo' }
// Sin `settings.categoryRules` (respaldos y blobs anteriores) = sin reglas.

import { canonicalCategory } from './categoryAliases.js'
import { isSetAside } from './setAside.js'

/** Mínimo de letras de una regla: con "ub" se categorizaría medio mundo. */
export const RULE_MIN_LENGTH = 3
/** Tope de reglas: es una lista que la persona mantiene a mano. */
export const RULE_MAX = 200
export const RULE_KINDS = /** @type {const} */ (['expense', 'income', 'any'])

// Palabras de cartola que no identifican al comercio (como GENERIC_WORDS de
// fileParser.js): no sirven como texto de una regla sugerida.
const GENERIC = new Set([
  'compra', 'pago', 'pag', 'retiro', 'deposito', 'transferencia', 'transf', 'abono', 'cargo',
  'debito', 'credito', 'cobro', 'giro', 'comision', 'nacional', 'internacional', 'tarjeta', 'tc',
  'purchase', 'payment', 'withdrawal', 'deposit', 'transfer', 'charge', 'fee', 'pos', 'www', 'com',
  'kauf', 'zahlung', 'lastschrift', 'uberweisung', 'compras', 'pagamento',
  'de', 'del', 'la', 'el', 'en', 'por', 'the', 'and', 'und', 'der', 'die', 'das', 'do', 'da',
])

/** Minúsculas, sin acentos, solo letras y números separados por un espacio. */
export function normalizeText(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

/** Palabras que identifican al comercio, en orden. */
export function significantWords(s) {
  return normalizeText(s).split(' ').filter(w => w.length >= RULE_MIN_LENGTH && !/^\d+$/.test(w) && !GENERIC.has(w))
}

/** Texto sugerido para una regla nueva desde un movimiento ("UBER *TRIP 123" → "uber"). */
export function suggestMatch(description) {
  return significantWords(description)[0] || ''
}

const validKind = (k) => (RULE_KINDS.includes(k) ? k : 'any')

/**
 * Lista limpia: descarta lo malformado y lo repetido (mismo texto y tipo: gana
 * la más nueva). Aplica el mismo alias de categorías que importAllData.
 * @param {any} raw @returns {Array<{id:string,match:string,category:string,kind:string,createdAt:string,source?:string}>}
 */
export function sanitizeRules(raw) {
  if (!Array.isArray(raw)) return []
  const byKey = new Map()
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const match = normalizeText(r.match)
    const category = typeof r.category === 'string' ? canonicalCategory(r.category.trim()) : ''
    if (match.length < RULE_MIN_LENGTH || !category) continue
    const rule = {
      id: typeof r.id === 'string' && r.id ? r.id : `cr-${match.replace(/ /g, '-')}`,
      match, category, kind: validKind(r.kind),
      createdAt: typeof r.createdAt === 'string' ? r.createdAt : '',
      ...(r.source === 'demo' ? { source: 'demo' } : {}),
    }
    const key = `${rule.kind}\u0000${match}`
    const prev = byKey.get(key)
    if (!prev || rule.createdAt >= prev.createdAt) byKey.set(key, rule)
  }
  return [...byKey.values()].slice(-RULE_MAX)
}

/** Las reglas guardadas en settings, ya limpias. @param {any} settings */
export const rulesOf = (settings) => sanitizeRules(settings?.categoryRules)

/** ¿La regla aplica a este texto? Coincide por palabra completa al inicio ("uber" sí en "Uber Eats", no en "Suberbio"). */
export function ruleMatches(rule, text) {
  const hay = ` ${normalizeText(text)} `
  const needle = normalizeText(rule?.match)
  return needle.length >= RULE_MIN_LENGTH && hay.includes(` ${needle}`)
}

const kindOk = (rule, kind) => rule.kind === 'any' || !kind || rule.kind === kind

/**
 * La regla que manda para un texto: la de texto más largo (la más específica,
 * "uber eats" antes que "uber"); a igual largo, la más nueva. `allowed` limita
 * a las categorías válidas del tipo activo.
 * @param {string} text @param {any[]} rules
 * @param {{ kind?: string, allowed?: string[]|null }} [opts]
 */
export function findRule(text, rules, { kind, allowed = null } = {}) {
  if (!text) return null
  let best = null
  for (const r of Array.isArray(rules) ? rules : []) {
    if (!r || !kindOk(r, kind) || (allowed && !allowed.includes(r.category))) continue
    if (!ruleMatches(r, text)) continue
    if (!best || r.match.length > best.match.length || (r.match.length === best.match.length && r.createdAt > best.createdAt)) best = r
  }
  return best
}

/** Texto de un registro contra el que se comparan las reglas. */
export const recordText = (rec) => [rec?.description, rec?.source !== 'csv' ? rec?.source : '', rec?.originalDescription]
  .filter(v => typeof v === 'string' && v).join(' ')

/**
 * Regla nueva (o la misma con otra categoría si ya existía ese texto y tipo).
 * Devuelve la lista nueva y la regla guardada (`replaced`: la que había antes
 * con ese id o ese texto, para deshacer); sin texto válido, null.
 * Editar (con id) busca primero por id. Si el texto nuevo choca con OTRA
 * regla del mismo tipo, no se borra ninguna: devuelve { conflict } y quien
 * llama lo explica.
 * @param {any[]} rules @param {{ id?: string, match: string, category: string, kind?: string }} input
 * @param {{ now?: string, id?: string }} [opts]
 * @returns {{ rules: any[], rule: any, replaced: any | null, conflict?: undefined } | { conflict: any, rules?: undefined, rule?: undefined, replaced?: undefined } | null}
 */
export function upsertRule(rules, input, { now = new Date().toISOString(), id } = {}) {
  const match = normalizeText(input?.match)
  const category = typeof input?.category === 'string' ? input.category.trim() : ''
  if (match.length < RULE_MIN_LENGTH || !category) return null
  const kind = validKind(input.kind)
  const list = sanitizeRules(rules)
  const byId = input.id ? list.find(r => r.id === input.id) || null : null
  const twin = list.find(r => r !== byId && r.match === match && r.kind === kind) || null
  if (byId && twin) return { conflict: twin }
  // Editar: se reemplaza por id. Crear: el mismo texto y tipo se reemplaza.
  const same = byId || twin
  const rule = { id: same?.id || input.id || id || `cr-${Date.now().toString(36)}-${match.replace(/ /g, '-').slice(0, 24)}`, match, category, kind, createdAt: now }
  const rest = list.filter(r => r !== same)
  return { rules: [...rest, rule], rule, replaced: same }
}

/**
 * Deshace un upsertRule sobre las reglas de AHORA: quita la regla guardada y,
 * si reemplazó a otra, la devuelve. Lo que cambió después no se toca.
 * @param {any[]} rules @param {{ rule: any, replaced?: any }} saved
 */
export function undoUpsert(rules, saved) {
  const list = sanitizeRules(rules).filter(r => r.id !== saved?.rule?.id)
  return saved?.replaced ? [...list, saved.replaced] : list
}

/** Sin la regla de ese id. */
export const removeRule = (rules, id) => sanitizeRules(rules).filter(r => r.id !== id)

/**
 * Movimientos guardados a los que la regla también les cambiaría la
 * categoría: los que coinciden, del tipo de la regla, y (por defecto) solo los
 * que siguen sin categoría o esperan revisión. Nunca se tocan sin confirmar.
 * @param {any} rule @param {{ incomes?: any[], expenses?: any[] }} data
 * @param {{ isOpen?: (rec:any) => boolean }} [opts]
 */
export function matchingRecords(rule, { incomes = [], expenses = [] } = {}, { isOpen = () => true } = {}) {
  const out = []
  const scan = (list, kind) => {
    if (!kindOk(rule, kind)) return
    for (const rec of Array.isArray(list) ? list : []) {
      if (!rec || rec.inv || isSetAside(rec) || rec.category === rule.category) continue
      if (!isOpen(rec)) continue
      if (ruleMatches(rule, recordText(rec))) out.push({ kind, rec })
    }
  }
  scan(expenses, 'expense')
  scan(incomes, 'income')
  return out
}

/**
 * Categoría para un alta (manual, Apple Pay, dictado o fila importada).
 * Devuelve { category, rule } o null. La que pone una regla cuenta como
 * elegida por la persona (sin needsReview por la categoría).
 * @param {string} text @param {any} settings @param {{ kind?: string, allowed?: string[]|null }} [opts]
 */
export function categoryByRule(text, settings, opts = {}) {
  const rule = findRule(text, rulesOf(settings), opts)
  return rule ? { category: rule.category, rule } : null
}

/**
 * Filas de la vista previa de importación: las que coinciden con una regla
 * quedan con esa categoría y marcadas `categoryByRule` (no sugeridas: no
 * entran a Por revisar por la categoría). Una fila con categoría propia del
 * archivo no se toca.
 * @param {any[]} rows @param {any[]} rules
 */
export function applyRulesToImportRows(rows, rules) {
  const list = sanitizeRules(rules)
  if (!list.length) return Array.isArray(rows) ? rows : []
  return (Array.isArray(rows) ? rows : []).map(r => {
    if (!r || (r.category && !r.categorySuggested && r.category !== 'Importado')) return r
    const hit = findRule(`${r.description || ''} ${r.originalDescription || ''}`, list, { kind: r.type })
    if (!hit) return r
    return { ...r, category: hit.category, categorySuggested: false, categoryByRule: true }
  })
}
