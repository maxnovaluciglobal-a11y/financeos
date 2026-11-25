// @ts-check
// src/utils/categoryGroups.js — "moyiq propone, tú confirmas" (24-nov-2026).
//
// Agrupa los movimientos que siguen sin categoría (o esperan revisión) y que
// parecen del mismo comercio, y propone una categoría: "Estos 3 movimientos
// parecen de Delivery: ¿los categorizo?". Sin servidor ni modelo de lenguaje:
// reglas fijas, deterministas y en el teléfono, en este orden:
//   1. rule     una regla de la persona (categoryRules.js);
//   2. history  lo que la persona ya eligió para ese comercio: la categoría más
//               usada en sus movimientos revisados con la misma palabra clave
//               (al menos 2 y sin empate);
//   3. learned  lo aprendido al guardar en el alta rápida (merchantRules).
// Si ninguna da categoría, igual se agrupan (mismo comercio, 2 o más) y se
// pregunta cuál ponerles. Nada se cambia sin el toque de la persona, y el
// cambio se puede deshacer (la propuesta guarda los registros originales).
// "Mismo comercio" = la misma primera palabra significativa del detalle
// (sin "COMPRA", "PAGO", números…: categoryRules.significantWords).

import { findRule, recordText, sanitizeRules, significantWords } from './categoryRules.js'
import { isUncategorized, needsReview, markReviewed } from './review.js'
import { isSetAside } from './setAside.js'

/** Mínimo de movimientos para proponer un grupo. */
export const GROUP_MIN = 2
/** Mínimo de movimientos revisados para usar lo que la persona ya eligió. */
export const HISTORY_MIN = 2

/** Palabra clave del comercio de un registro, o ''. */
export const merchantKey = (rec) => significantWords(recordText(rec))[0] || ''

const open = (rec) => !!rec && !rec.inv && !isSetAside(rec) && (needsReview(rec) || isUncategorized(rec))

/** Lo que la persona ya eligió por comercio: { 'expense|uber': { Transporte: 3 } }. */
export function historyIndex({ incomes = [], expenses = [] } = {}) {
  const idx = new Map()
  const add = (list, kind) => {
    for (const rec of Array.isArray(list) ? list : []) {
      if (!rec || open(rec) || rec.inv || isSetAside(rec) || !rec.category) continue
      const key = merchantKey(rec)
      if (!key) continue
      const k = `${kind}|${key}`
      if (!idx.has(k)) idx.set(k, {})
      const m = idx.get(k)
      m[rec.category] = (m[rec.category] || 0) + 1
    }
  }
  add(expenses, 'expense')
  add(incomes, 'income')
  return idx
}

/** La categoría más usada (≥ HISTORY_MIN, sin empate) o null. */
export function topChoice(counts) {
  const rows = Object.entries(counts || {}).sort((a, b) => b[1] - a[1])
  if (!rows.length || rows[0][1] < HISTORY_MIN) return null
  if (rows[1] && rows[1][1] === rows[0][1]) return null
  return rows[0][0]
}

/**
 * Propuestas para la bandeja y el asistente, de la más grande a la más chica.
 * Cada una: { id, kind, key, category|null, reason, items: [{kind, rec}] }.
 * reason: 'rule' | 'history' | 'learned' | 'merchant' (sin categoría: preguntar).
 * @param {{ incomes?: any[], expenses?: any[] }} data
 * @param {{ rules?: any[], merchantRules?: Record<string,string>, allowedFor?: (kind:string)=>string[]|null, min?: number }} [opts]
 */
export function proposeGroups(data = {}, { rules = [], merchantRules = {}, allowedFor = () => null, min = GROUP_MIN } = {}) {
  const ruleList = sanitizeRules(rules)
  const history = historyIndex(data)
  const groups = new Map()
  const scan = (list, kind) => {
    for (const rec of Array.isArray(list) ? list : []) {
      if (!open(rec)) continue
      const key = merchantKey(rec)
      if (!key) continue
      const allowed = allowedFor(kind)
      const ok = (c) => !!c && (!allowed || allowed.includes(c))
      let category = null, reason = 'merchant'
      const rule = findRule(recordText(rec), ruleList, { kind, allowed })
      if (rule) { category = rule.category; reason = 'rule' }
      if (!category) { const h = topChoice(history.get(`${kind}|${key}`)); if (ok(h)) { category = h; reason = 'history' } }
      if (!category && merchantRules && typeof merchantRules === 'object') {
        const learned = Object.entries(merchantRules).find(([k, c]) => significantWords(k)[0] === key && ok(c))
        if (learned) { category = learned[1]; reason = 'learned' }
      }
      // Ya tiene esa categoría y solo espera confirmación: igual entra (se confirma en grupo).
      const id = `${kind}|${key}|${category || ''}`
      if (!groups.has(id)) groups.set(id, { id, kind, key, category, reason, items: [] })
      groups.get(id).items.push({ kind, rec })
    }
  }
  scan(data.expenses, 'expense')
  scan(data.incomes, 'income')
  const rank = { rule: 0, history: 1, learned: 2, merchant: 3 }
  return [...groups.values()]
    .filter(g => g.items.length >= min)
    .sort((a, b) => b.items.length - a.items.length || rank[a.reason] - rank[b.reason] || (a.id < b.id ? -1 : 1))
}

/**
 * Los registros de un grupo ya categorizados y revisados (lo que se guarda al
 * confirmar) y los originales (para "Deshacer").
 * @param {{ items: Array<{kind:string, rec:any}> }} group @param {string} category
 */
export function applyGroup(group, category) {
  const items = Array.isArray(group?.items) ? group.items : []
  return {
    next: items.map(({ kind, rec }) => ({ kind, rec: markReviewed(rec, { category }) })),
    prev: items.map(({ kind, rec }) => ({ kind, rec })),
  }
}
