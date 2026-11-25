// @ts-check
// src/utils/categoryPrefs.js — categorías en píldoras (24-nov-2026).
//
// Lo que la persona elige para registrar rápido, en `settings.categoryPrefs`:
//   hidden: { expense: string[], income: string[] }   quitadas de las píldoras
//   look:   { [categoría]: { emoji?, slot?, name? } }  emoji, color y nombre propios
// Las categorías nuevas siguen yendo a `settings.categoriesExpense` /
// `categoriesIncome` (el mecanismo de siempre, getCategoriesExpense).
//
// Quitar una categoría NO borra nada: solo la saca de las píldoras del alta.
// Los movimientos, presupuestos y reglas que la usan siguen igual, y sigue en
// "Todas las categorías". El nombre propio es una etiqueta: el valor guardado
// en cada movimiento no cambia (presupuestos, respaldos y sync no se tocan).
// Sin `categoryPrefs` (todo lo anterior) = todas visibles, sin cambios.

import { CAT_EMOJIS, CATS_EXPENSE, CATS_INCOME, catName } from './index.js'

/** Tintes de categoría que se pueden elegir (--cat-n). El 6 es el rojo de error: no. */
export const COLOR_SLOTS = Object.freeze([1, 2, 3, 4, 5, 7, 8])

/** Emoji para elegir en la edición (los de las categorías y algunos más). */
export const EMOJI_CHOICES = Object.freeze([
  '🛒', '🍽️', '☕', '🛵', '🏠', '💡', '🚗', '🚌', '⛽', '⚕️', '💊', '📚', '🎬', '🎮', '👕', '💻',
  '📱', '🐾', '🏃', '✈️', '🎁', '💼', '🧑‍💻', '🔑', '🏦', '🏪', '💰', '📈', '💳', '🧾', '👶', '📦',
])

/** Categorías que se pueden sumar con un toque (todas traducidas en los 4 idiomas). */
export const CATALOG = Object.freeze({
  expense: ['Comida', 'Mascota', 'Propiedad', 'Deudas', 'Ahorro', 'Servicios personales', 'Pago tarjeta crédito'],
  income: ['Pensión', 'Negocio propio', 'Ingreso extra', 'Ventas directas'],
})

const EXTRA_EMOJI = { Comida: '🍽️', Deudas: '🧾', 'Servicios personales': '💇', 'Pago tarjeta crédito': '💳', 'Ingreso extra': '💵', 'Ventas directas': '🏪' }

/** Largo máximo del nombre de una categoría nueva o propia. */
export const NAME_MAX = 28

const str = (v) => (typeof v === 'string' ? v.trim() : '')
const list = (v) => (Array.isArray(v) ? [...new Set(v.map(str).filter(Boolean))] : [])

/** Preferencias limpias (lo malformado se ignora). @param {any} raw */
export function sanitizePrefs(raw) {
  const p = raw && typeof raw === 'object' ? raw : {}
  const hidden = p.hidden && typeof p.hidden === 'object' ? p.hidden : {}
  const look = {}
  for (const [cat, v] of Object.entries(p.look && typeof p.look === 'object' ? p.look : {})) {
    if (!cat || !v || typeof v !== 'object') continue
    const o = {}
    if (str(v.emoji)) o.emoji = str(v.emoji).slice(0, 16)
    if (COLOR_SLOTS.includes(Number(v.slot))) o.slot = Number(v.slot)
    if (str(v.name)) o.name = str(v.name).slice(0, NAME_MAX)
    if (Object.keys(o).length) look[cat] = o
  }
  return { hidden: { expense: list(hidden.expense), income: list(hidden.income) }, look }
}

/** @param {any} settings */
export const prefsOf = (settings) => sanitizePrefs(settings?.categoryPrefs)

const kindKey = (kind) => (kind === 'income' ? 'income' : 'expense')

/** Emoji de una categoría: el propio, el de siempre o uno genérico. */
export function emojiFor(cat, prefs) {
  return prefs?.look?.[cat]?.emoji || CAT_EMOJIS[cat] || EXTRA_EMOJI[cat] || '🏷️'
}

/** Nombre a la vista: el propio o el traducido. */
export function nameFor(cat, prefs, lang) {
  return prefs?.look?.[cat]?.name || catName(cat, lang)
}

/** Tinte propio (1–8) o null para el de siempre. */
export const slotFor = (cat, prefs) => prefs?.look?.[cat]?.slot ?? null

/** ¿La agregó la persona (no está entre las de fábrica)? */
export const isCustom = (cat, kind) => !(kind === 'income' ? CATS_INCOME : CATS_EXPENSE).includes(cat)

/** Las píldoras del alta: las efectivas menos las quitadas, en el mismo orden. */
export function visibleCats(cats, prefs, kind) {
  const hidden = new Set(prefs?.hidden?.[kindKey(kind)] || [])
  return (Array.isArray(cats) ? cats : []).filter(c => c && !hidden.has(c))
}

/**
 * Lo que se puede sumar: las quitadas y las del catálogo que todavía no están.
 * @param {string[]} effective categorías efectivas del tipo (getCategoriesExpense)
 */
export function availableCats(effective, prefs, kind) {
  const hidden = prefs?.hidden?.[kindKey(kind)] || []
  const have = new Set(effective)
  return [...new Set([...hidden.filter(c => have.has(c)), ...CATALOG[kindKey(kind)].filter(c => !have.has(c))])]
}

/**
 * Cambios de settings para quitar una categoría de las píldoras. Nunca deja
 * menos de una visible: devuelve null si es la última.
 */
export function hideCatPatch(settings, cat, kind, effective) {
  const prefs = prefsOf(settings)
  const k = kindKey(kind)
  if (visibleCats(effective, prefs, kind).filter(c => c !== cat).length === 0) return null
  return { categoryPrefs: { ...prefs, hidden: { ...prefs.hidden, [k]: [...new Set([...prefs.hidden[k], cat])] } } }
}

/**
 * Cambios de settings para sumar una categoría: la vuelve a mostrar y, si no
 * existía (catálogo o escrita a mano), la agrega a categoriesExpense/Income.
 * Devuelve null si el nombre no sirve.
 */
export function addCatPatch(settings, rawCat, kind, effective) {
  const cat = str(rawCat).slice(0, NAME_MAX)
  if (!cat) return null
  const prefs = prefsOf(settings)
  const k = kindKey(kind)
  // Misma categoría escrita con otras mayúsculas: se usa la que ya existe.
  const existing = (effective || []).find(c => c.toLocaleLowerCase() === cat.toLocaleLowerCase())
  const value = existing || cat
  const patch = { categoryPrefs: { ...prefs, hidden: { ...prefs.hidden, [k]: prefs.hidden[k].filter(c => c !== value) } } }
  if (!existing) {
    const field = k === 'income' ? 'categoriesIncome' : 'categoriesExpense'
    const extra = Array.isArray(settings?.[field]) ? settings[field] : []
    patch[field] = [...extra, value]
  }
  return { patch, value }
}

/** Cambios de settings para el emoji, el color o el nombre de una categoría. */
export function lookPatch(settings, cat, { emoji, slot, name } = {}) {
  const prefs = prefsOf(settings)
  const o = { ...(prefs.look[cat] || {}) }
  if (emoji !== undefined) { if (str(emoji)) o.emoji = str(emoji); else delete o.emoji }
  if (slot !== undefined) { if (COLOR_SLOTS.includes(Number(slot))) o.slot = Number(slot); else delete o.slot }
  if (name !== undefined) { if (str(name)) o.name = str(name).slice(0, NAME_MAX); else delete o.name }
  const look = { ...prefs.look }
  if (Object.keys(o).length) look[cat] = o
  else delete look[cat]
  return { categoryPrefs: { ...prefs, look } }
}
