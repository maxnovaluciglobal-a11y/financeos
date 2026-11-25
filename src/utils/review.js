// @ts-check
// src/utils/review.js — bandeja "Por revisar" del Inicio (24-nov-2026).
//
// Un movimiento entra a la bandeja cuando nadie lo miró al crearse:
//   recurring  un fijo con registro automático que la app registró sola
//   import     una fila importada (CSV/PDF) con la categoría sugerida o sin categoría
//   applepay   el Atajo de Apple Pay, confirmado con un toque sin elegir categoría
//   link       otro enlace de alta (widget, atajo), igual que applepay
//   voice      un dictado guardado con la categoría que adivinó la app
// El flag es `needsReview: true` en el registro. Sin el flag, el movimiento está
// revisado: así todo lo guardado antes de esta versión (y todo respaldo o blob
// de sync viejo) queda revisado y la bandeja no se llena al actualizar. No hace
// falta un paso en migrations.js: IndexedDB no tiene esquema por registro y no
// hay índice sobre el campo.
//
// Todo es local: el flag viaja dentro del respaldo y del blob cifrado como
// cualquier otro campo del movimiento, nunca en claro al servidor.

import { isSetAside } from './setAside.js'
import { withReview } from './reviewFlags.js'

// withReview y quickAddNeedsReview viven en reviewFlags.js (JS inicial).
export { withReview, quickAddNeedsReview } from './reviewFlags.js'

export const REVIEW_ORIGINS = /** @type {const} */ (['recurring', 'import', 'applepay', 'link', 'voice'])
// Cajón de las filas importadas sin categoría (fileParser.js).
export const UNCATEGORIZED = new Set(['', 'Importado'])
// Filas visibles en el Inicio; el resto está en "Revisar todo".
export const REVIEW_HOME_LIMIT = 3

/** @param {any} rec */
export const isUncategorized = (rec) => UNCATEGORIZED.has(String(rec?.category ?? '').trim())

/** ¿Pide revisión? Solo con el flag explícito: lo viejo cuenta como revisado. @param {any} rec */
export const needsReview = (rec) => !!rec && rec.needsReview === true && !isSetAside(rec)

/** De dónde vino, para la etiqueta de la fila. @param {any} rec */
export function reviewOrigin(rec) {
  if (rec && REVIEW_ORIGINS.includes(rec.origin)) return rec.origin
  if (rec?.importBatchId) return 'import'
  if (rec?.recurringId) return 'recurring'
  return 'link'
}

/** ¿Una fila importada pide revisión? Sugerida o sin categoría. @param {any} row */
export const importNeedsReview = (row) => !!row && (!!row.categorySuggested || isUncategorized(row))

/**
 * La bandeja: ingresos y gastos que piden revisión, del más nuevo al más viejo.
 * @param {{ incomes?: any[], expenses?: any[] }} data
 * @returns {Array<{ key: string, kind: 'income'|'expense', rec: any, name: string, origin: string, uncategorized: boolean }>}
 */
export function reviewQueue({ incomes = [], expenses = [] } = {}) {
  const rows = []
  for (const rec of Array.isArray(incomes) ? incomes : []) {
    if (!needsReview(rec)) continue
    // Las importadas guardan 'csv' en `source`: el nombre real es la descripción.
    const name = rec.source && rec.source !== 'csv' ? rec.source : (rec.description || '')
    rows.push({ key: `i-${rec.id}`, kind: /** @type {const} */ ('income'), rec, name, origin: reviewOrigin(rec), uncategorized: isUncategorized(rec) })
  }
  for (const rec of Array.isArray(expenses) ? expenses : []) {
    if (!needsReview(rec)) continue
    rows.push({ key: `e-${rec.id}`, kind: /** @type {const} */ ('expense'), rec, name: rec.description || '', origin: reviewOrigin(rec), uncategorized: isUncategorized(rec) })
  }
  const stamp = (r) => `${String(r.rec.date || '')}|${String(r.rec.createdAt || '')}`
  return rows.sort((a, b) => (stamp(a) < stamp(b) ? 1 : stamp(a) > stamp(b) ? -1 : 0))
}

/**
 * El registro ya revisado (con la categoría nueva si se cambió). Conserva el
 * origen; solo quita el flag.
 * @param {any} rec @param {{ category?: string }} [patch]
 */
export function markReviewed(rec, patch = {}) {
  const out = { ...rec, ...patch }
  delete out.needsReview
  if (patch.category) delete out.categorySuggested
  return out
}

/**
 * Para el demo: marca hasta 3 movimientos del mes como "por revisar" sin
 * cambiar montos ni fechas (las cuentas del demo y sus tests no se mueven).
 * Un fijo mensual queda como registrado solo; dos gastos únicos, uno del Atajo
 * de Apple Pay y uno importado.
 * @param {any[]} expenses @param {string} month AAAA-MM
 */
export function seedDemoReview(expenses, month) {
  const list = Array.isArray(expenses) ? expenses : []
  const recent = list.filter(r => String(r?.date || '').startsWith(month) && !isSetAside(r))
    .sort((a, b) => (String(a.date) < String(b.date) ? 1 : -1))
  const pick = new Map()
  const oneOff = recent.filter(r => r.recurrence !== 'Mensual')
  const monthly = recent.find(r => r.recurrence === 'Mensual')
  if (oneOff[0]) pick.set(oneOff[0].id, 'applepay')
  if (monthly) pick.set(monthly.id, 'recurring')
  if (oneOff[1]) pick.set(oneOff[1].id, 'import')
  if (!pick.size) return list
  return list.map(r => (pick.has(r.id) ? withReview(r, /** @type {string} */ (pick.get(r.id))) : r))
}
