// src/utils/quickAdd.js
// Lógica pura del alta rápida v2 (B4a/B4b, nov-2026). Sin React ni DOM: la
// usa QuickAddForm.jsx y se prueba en Node (quickAdd.test.js).
//
//   ruleKey              llave normalizada comercio→categoría (settings.merchantRules)
//   suggestCategory      categoría aprendida para lo que se está escribiendo
//   nextAutoCategory     si corresponde aplicarla sin pisar una elección manual
//   topRepeats           los 3 movimientos más frecuentes (90 días) para "Repetir"
//   fromUsd / buildUsdNote   "Escribir en US$": conversión y nota del registro
//   keyToKeypad / isTextEntryTarget   teclado físico en escritorio
//   buildDetailedPrefill contrato con el formulario de gasto detallado

import { KEY_BACKSPACE, KEY_DECIMAL } from './keypad.js'

// Normaliza un comercio para usarlo como llave de regla (minúsculas, sin
// acentos ni espacios extra). Misma llave con la que se aprende al guardar.
export const ruleKey = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

// Mínimo de letras para sugerir por prefijo (con "su" no se adivina nada).
export const SUGGEST_MIN_PREFIX = 3

// Categoría aprendida para la descripción `desc`, o null.
// 1) coincidencia exacta con una llave aprendida;
// 2) si no, prefijo de al menos 3 letras, solo cuando TODAS las llaves que
//    empiezan así apuntan a la misma categoría (sin ambigüedad).
// `allowed` (opcional) limita a las categorías válidas del tipo activo: las
// reglas de ingresos y gastos comparten el mismo mapa.
export function suggestCategory(desc, rules, allowed = null) {
  const k = ruleKey(desc)
  if (!k || !rules || typeof rules !== 'object') return null
  const ok = (c) => typeof c === 'string' && c && (!allowed || allowed.includes(c))
  if (Object.prototype.hasOwnProperty.call(rules, k)) return ok(rules[k]) ? rules[k] : null
  if (k.length < SUGGEST_MIN_PREFIX) return null
  const cats = new Set()
  for (const [key, c] of Object.entries(rules)) if (key.startsWith(k) && ok(c)) cats.add(c)
  return cats.size === 1 ? [...cats][0] : null
}

// ¿Qué categoría dejar mientras se escribe? Devuelve la sugerida solo si el
// usuario no eligió una a mano en esta apertura (`manual`) y si cambia algo;
// si no, null (no tocar).
export function nextAutoCategory({ desc, rules, allowed = null, manual = false, current = '' }) {
  if (manual) return null
  const s = suggestCategory(desc, rules, allowed)
  return s && s !== current ? s : null
}

// "YYYY-MM-DD" menos `days` días, en hora local (sin pasar por UTC).
function isoMinusDays(iso, days) {
  const [y, m, d] = String(iso).split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, (d || 1) - days)
  const p = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

const newer = (a, b) => (a.date || '') > (b.date || '') ||
  ((a.date || '') === (b.date || '') && (a.createdAt || '') > (b.createdAt || ''))

// "Repetir" (B4b): los `limit` movimientos más frecuentes de los últimos
// `days` días, agrupados por descripción (normalizada) + categoría; a igual
// frecuencia, el más reciente primero. Cada uno trae el monto, la descripción
// y la categoría de su ocurrencia más reciente. Sin nada en la ventana, cae al
// último movimiento de todos ("Repetir último" no se pierde).
export function topRepeats(records, { today, days = 90, limit = 3 } = {}) {
  const valid = (records || []).filter(r => r && Number(r.amount) > 0)
  if (valid.length === 0) return []
  const since = today ? isoMinusDays(today, days) : ''
  const groups = new Map()
  for (const r of valid) {
    if (since && (r.date || '') < since) continue
    if (today && (r.date || '') > today) continue
    const label = r.description || r.source || ''
    const key = `${ruleKey(label)}\u0000${r.category || ''}`
    const g = groups.get(key)
    if (!g) groups.set(key, { count: 1, last: r })
    else { g.count++; if (newer(r, g.last)) g.last = r }
  }
  const pick = (r, count) => ({
    key: `${ruleKey(r.description || r.source || '')}\u0000${r.category || ''}`,
    description: r.description || r.source || '',
    category: r.category || '',
    amount: Number(r.amount),
    count,
  })
  if (groups.size === 0) {
    let best = null
    for (const r of valid) if (!best || newer(r, best)) best = r
    return [pick(best, 1)]
  }
  return [...groups.values()]
    .sort((a, b) => (b.count - a.count) || (newer(a.last, b.last) ? -1 : newer(b.last, a.last) ? 1 : 0))
    .slice(0, limit)
    .map(g => pick(g.last, g.count))
}

const validRate = (n) => Number.isFinite(Number(n)) && Number(n) > 0

// "Escribir en US$" (B4b): US$ → moneda principal con la tasa de referencia
// (unidades locales por 1 US$), redondeado a los decimales de la moneda.
export function fromUsd(usd, rate, decimals = 2) {
  const u = Number(usd)
  if (!validRate(rate) || !Number.isFinite(u) || u <= 0) return 0
  const f = 10 ** Math.max(0, decimals)
  return Math.round(u * Number(rate) * f) / f
}

// Nota que queda en el registro: "US$12,00 → Bs.10.624,80 (Tasa BCV, 29 oct)".
// Las cifras llegan ya formateadas; sin fecha, la etiqueta "sin fecha".
// Es un dato del registro, no una vista: nunca pasa por "ocultar montos".
export function buildUsdNote({ usdText, localText, source, date }) {
  const meta = [source, date].filter(Boolean).join(', ')
  return `${usdText} → ${localText}${meta ? ` (${meta})` : ''}`
}

// Une la nota existente con la de US$ (sin duplicarla).
export function appendNote(notes, extra) {
  const a = String(notes || '').trim()
  if (!extra) return a
  if (!a) return extra
  return a.includes(extra) ? a : `${a} · ${extra}`
}

// Teclado físico (B4a): tecla de KeyboardEvent → tecla del teclado propio,
// 'save' para Enter, o null si no le corresponde nada. Con una moneda sin
// decimales la coma/punto no hace nada (los ceros se escriben con "0").
export function keyToKeypad(key, decimals = 2) {
  if (typeof key !== 'string') return null
  if (/^\d$/.test(key)) return key
  if (key === ',' || key === '.' || key === 'Decimal') return decimals > 0 ? KEY_DECIMAL : null
  if (key === 'Backspace') return KEY_BACKSPACE
  if (key === 'Enter') return 'save'
  return null
}

// ¿El foco está en un lugar donde la tecla ya tiene dueño? Campos de texto,
// selects y contenteditable escriben ellos mismos (salvo el monto, que es
// readOnly y se maneja con el teclado propio). Para Enter, además, un botón o
// un enlace ya se activa solo con Enter: no se guarda encima.
export function isTextEntryTarget(el, { forEnter = false } = {}) {
  if (!el) return false
  if (el.isContentEditable) return true
  const tag = String(el.tagName || '').toUpperCase()
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag === 'INPUT') {
    if (el.readOnly) return false
    const type = String(el.type || 'text').toLowerCase()
    if (['checkbox', 'radio', 'button', 'submit', 'reset'].includes(type)) return forEnter
    return true
  }
  if (forEnter && (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY')) return true
  return false
}

// "Más detalles" (B4a): contrato con el formulario de gasto detallado de
// Movimientos, que lo lee una vez de sessionStorage y lo borra.
export const DETAILED_PREFILL_KEY = 'fos_detailed_expense_prefill'
export function buildDetailedPrefill({ description, amount, date, category, method }) {
  const a = Number(amount)
  return {
    description: String(description || '').trim(),
    amount: Number.isFinite(a) && a > 0 ? a : '',
    date: date || '',
    category: category || '',
    method: method || '',
  }
}

// Memoria corta del alta rápida: quien carga varios gastos de ayer no vuelve a
// elegir la fecha. Se guarda solo si no es hoy, vence a los 15 minutos y nunca
// devuelve una fecha futura.
export const ENTRY_MEMORY_KEY = 'fos_qa_entry'
export const ENTRY_MEMORY_MS = 15 * 60 * 1000
export function entryMemoryValue(date, today, now) {
  return date && date !== today ? JSON.stringify({ date, at: now }) : null
}
export function readEntryDate(raw, today, now) {
  try {
    const m = JSON.parse(raw)
    if (typeof m?.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(m.date) || m.date > today) return null
    const age = now - Number(m.at)
    return age >= 0 && age <= ENTRY_MEMORY_MS ? m.date : null
  } catch { return null }
}
