// @ts-check
// src/utils/autoEntry.js — "Gastos que se registran solos", fase 1 (19-nov-2026).
//
// Contrato de URL para que otra fuente (el Atajo de iOS que corre al pagar con
// Apple Pay, un widget, la futura app nativa) abra el alta rápida con el
// movimiento ya escrito. La persona SIEMPRE confirma con un toque: cualquiera
// puede armar este enlace y mandarlo (riesgo tipo CSRF), así que nunca se
// guarda solo. Contrato completo y límites: docs/registro-automatico.md.
//
//   https://app.moyiq.app/app/?add=gasto&monto=12500&comercio=Lider&moneda=CLP&fuente=applepay
//   moyiq://add?add=gasto&monto=…   (app nativa, fase 2: mismos parámetros)
//
// Parámetros (todos opcionales salvo `add`; cualquier otro se ignora):
//   add       gasto | ingreso (también expense | income). Sin esto no hay alta.
//   monto     el monto tal como lo escribe el Atajo: "12500", "$12.500",
//             "12,50 €", "CLP 12.500", "US$ 5.99". Negativo, cero o ilegible: vacío.
//   comercio  nombre del comercio → descripción (texto plano, máx. 60 caracteres).
//   moneda    código ISO 4217 de 3 letras. Manda sobre el símbolo del monto.
//   fuente    applepay | atajo | widget | app (otro valor: "otra"). Solo para el aviso.
//   fecha     AAAA-MM-DD. Una fecha futura o inválida se ignora (queda hoy).
//
// Lógica pura salvo captureIntake(), que recibe window/history/storage.

import { readNumber } from './quickLine.js'
import { currencyDecimals } from './keypad.js'
import { localeForCurrency } from './index.js'

export const INTAKE_PARAMS = ['add', 'monto', 'comercio', 'moneda', 'fuente', 'fecha']
export const INTAKE_KEY = 'fnos_intake_pending'          // sessionStorage (la pestaña), no viaja con la cuenta
export const INTAKE_TTL_MS = 15 * 60 * 1000              // sobrevive al login, no a una sesión vieja
export const MAX_MERCHANT = 60
export const MAX_AMOUNT_TEXT = 40
export const MAX_AMOUNT = 1e11
const MAX_RAW = 300                                      // antes de cualquier regex

const TYPES = { gasto: 'expense', expense: 'expense', egreso: 'expense', ingreso: 'income', income: 'income' }
const SOURCES = new Set(['applepay', 'atajo', 'widget', 'app'])

// Símbolos y códigos que pueden venir pegados al monto (el Atajo lo formatea
// con la región del iPhone). "$" solo no dice qué moneda es: queda null.
/** @type {Array<[RegExp, string]>} */
const MARKS = [
  [/^us\$|us\$$|^u\$s|u\$s$/i, 'USD'], [/^r\$|r\$$/i, 'BRL'], [/^s\/|s\/$/i, 'PEN'],
  [/^bs\.?|bs\.?$/i, 'VES'], [/€/, 'EUR'], [/£/, 'GBP'],
]

// Texto plano y corto: sin etiquetas, sin caracteres de control ni de
// dirección (U+202E invierte el texto en pantalla), espacios colapsados.
export function cleanText(value, max) {
  let s = String(value ?? '').slice(0, MAX_RAW)
  try { s = s.normalize('NFC') } catch { /* normalize no disponible: se sigue con el texto tal cual */ }
  s = s.replace(/<[^>]*>?/g, ' ')
    .replace(/[<>"`\\{}]/g, '')
    // eslint-disable-next-line no-control-regex -- quitar control y bidi es justo el objetivo
    .replace(/[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const chars = Array.from(s)                              // no cortar un emoji por la mitad
  return chars.length > max ? chars.slice(0, max).join('').trim() : s
}

// "$12.500" → { amount: 12500, currency: null, status: 'ok' }.
// status: ok | missing | negative | unreadable | ambiguous (con options).
export function parseIntakeAmount(raw, { currency = null, fallbackCurrency = 'CLP', lang = 'es' } = {}) {
  const text = cleanText(raw, MAX_AMOUNT_TEXT)
  if (!text) return { amount: null, currency, status: 'missing', text }
  let s = text.replace(/[\s\u00A0\u202F']/g, '')
  if (/^[-−‐–(]|[-−)]$/.test(s) || /^[A-Za-z$€£/.]*[-−]/.test(s)) return { amount: null, currency, status: 'negative', text }
  let found = null
  for (const [re, code] of MARKS) if (re.test(s)) { found = code; s = s.replace(re, ''); break }
  // Código ISO pegado delante o detrás ("CLP12.500", "12,50EUR"). Sin lookbehind: Safari < 16.4.
  const iso = /^([A-Za-z]{3})(\d.*)$/.exec(s) || /^(.*\d)([A-Za-z]{3})$/.exec(s)
  if (iso) {
    const lead = /^[A-Za-z]{3}$/.test(iso[1])
    found = found || (lead ? iso[1] : iso[2]).toUpperCase()
    s = lead ? iso[2] : iso[1]
  }
  s = s.replace(/^\$|\$$/, '').replace(/^\+/, '')
  const code = currency || found
  if (!/^\d[\d.,]*$/.test(s) || /[.,]$/.test(s)) return { amount: null, currency: code, status: 'unreadable', text }
  const dec = code || fallbackCurrency
  const read = readNumber(s, { decimals: currencyDecimals(dec), locale: localeForCurrency(dec, lang) })
  if (read.options) return { amount: null, currency: code, status: 'ambiguous', options: read.options, text }
  const v = read.value
  if (read.unreadable || !Number.isFinite(v)) return { amount: null, currency: code, status: 'unreadable', text }
  if (v <= 0 || v > MAX_AMOUNT) return { amount: null, currency: code, status: 'unreadable', text }
  return { amount: Math.round(v * 100) / 100, currency: code, status: 'ok', text }
}

const isIsoDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

function params(search) {
  try { return new URLSearchParams(String(search || '').slice(0, 4096)) } catch { return null }
}

// ¿La URL pide un alta? (aunque después los valores no sirvan: igual se limpia)
export function hasIntake(search) {
  const p = params(search)
  return !!p && p.has('add')
}

/**
 * Lee y sanea la URL. null si no pide un alta válida.
 * @returns {null | { type: 'expense'|'income', amount: number|null, amountStatus: string,
 *   amountText: string, options?: number[], merchant: string, currency: string|null,
 *   source: string, date: string|null }}
 * @param {*} search
 * @param {{ today?: string, fallbackCurrency?: string, lang?: string }} [opts]
 */
export function parseIntake(search, { today, fallbackCurrency = 'CLP', lang = 'es' } = {}) {
  const p = params(search)
  if (!p || !p.has('add')) return null
  const type = TYPES[cleanText(p.get('add'), 10).toLowerCase()]
  if (!type) return null
  const isoParam = cleanText(p.get('moneda'), 5).toUpperCase()
  const currency = /^[A-Z]{3}$/.test(isoParam) ? isoParam : null
  const a = parseIntakeAmount(p.get('monto'), { currency, fallbackCurrency, lang })
  const src = cleanText(p.get('fuente'), 20).toLowerCase()
  const day = cleanText(p.get('fecha'), 10)
  const limit = today || new Date().toISOString().slice(0, 10)
  return {
    type,
    amount: a.amount,
    amountStatus: a.status,
    amountText: a.text,
    ...(a.options ? { options: a.options } : {}),
    merchant: cleanText(p.get('comercio'), MAX_MERCHANT),
    currency: a.currency || null,
    source: SOURCES.has(src) ? src : 'otra',
    date: isIsoDate(day) && day <= limit ? day : null,
  }
}

// La URL sin los parámetros del alta (el resto, p. ej. ?demo=true, se queda).
export function stripIntakeParams(href) {
  try {
    const u = new URL(href)
    for (const k of INTAKE_PARAMS) u.searchParams.delete(k)
    return u.pathname + (u.searchParams.toString() ? `?${u.searchParams}` : '') + u.hash
  } catch { return null }
}

export function stashIntake(intake, storage, now = Date.now()) {
  try { if (intake) storage?.setItem(INTAKE_KEY, JSON.stringify({ ...intake, at: now })) } catch { /* modo privado: se pierde el alta, nada más */ }
}

// Una sola vez: se borra al leerla. Vieja o rota: null.
export function takeIntake(storage, now = Date.now()) {
  let raw = null
  try { raw = storage?.getItem(INTAKE_KEY) ?? null; storage?.removeItem(INTAKE_KEY) } catch { return null }
  if (!raw) return null
  try {
    const rec = JSON.parse(raw)
    if (!rec || typeof rec !== 'object' || !(now - Number(rec.at) < INTAKE_TTL_MS) || Number(rec.at) > now) return null
    if (rec.type !== 'expense' && rec.type !== 'income') return null
    // Lo guardado pasa otra vez por el saneado: el almacenamiento no es de fiar.
    const amount = Number.isFinite(rec.amount) && rec.amount > 0 && rec.amount <= MAX_AMOUNT ? rec.amount : null
    return {
      type: rec.type,
      amount,
      amountStatus: amount ? 'ok' : (typeof rec.amountStatus === 'string' ? cleanText(rec.amountStatus, 12) : 'missing'),
      amountText: cleanText(rec.amountText, MAX_AMOUNT_TEXT),
      merchant: cleanText(rec.merchant, MAX_MERCHANT),
      currency: /^[A-Z]{3}$/.test(rec.currency || '') ? rec.currency : null,
      source: SOURCES.has(rec.source) ? rec.source : 'otra',
      date: typeof rec.date === 'string' && isIsoDate(rec.date) ? rec.date : null,
    }
  } catch { return null }
}

// main.jsx, antes del primer render: guarda el alta para cuando la app esté
// lista (puede faltar el login) y limpia la URL para que recargar o compartir
// la pestaña no la repita.
/** @param {{ location?: any, history?: any, storage?: any, now?: number, lang?: string }} [opts] */
export function captureIntake({ location, history, storage, now = Date.now(), lang = 'es' } = {}) {
  try {
    if (!location || !hasIntake(location.search)) return null
    const today = (() => { const d = new Date(now), p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` })()
    const intake = parseIntake(location.search, { today, lang })
    if (intake) stashIntake(intake, storage, now)
    const clean = stripIntakeParams(location.href)
    if (clean) history?.replaceState?.(history.state, '', clean)
    return intake
  } catch { return null }
}

// ENG-N1 (auditoría 19-nov-2026): main.jsx lee la URL antes de que carguen los
// ajustes, así que un monto sin moneda explícita ("$4.99", "12,50", "4.99") se
// leyó con las reglas de CLP. Al abrir la hoja ya se sabe la moneda de la
// cuenta: se vuelve a leer el texto crudo con ella. Si el alta trae su moneda
// (parámetro `moneda` o símbolo inequívoco), se respeta lo ya leído.
export function reparseIntake(intake, { currency, lang = 'es' } = {}) {
  if (!intake || intake.currency || !intake.amountText || !/^[A-Z]{3}$/.test(currency || '')) return intake
  const a = parseIntakeAmount(intake.amountText, { fallbackCurrency: currency, lang })
  if (a.currency) return intake          // el texto sí traía la moneda: no cambia nada
  const out = { ...intake, amount: a.amount, amountStatus: a.status }
  if (a.options) out.options = a.options; else delete out.options
  return out
}

// Qué rellena en el formulario. La moneda del alta solo se usa si es la de la
// persona, o US$ con una tasa guardada (se escribe en "Escribir en US$").
// note: null | 'foreign' | 'ambiguous' | 'unreadable' | 'negative' | 'missing'
/** @param {*} rawIntake @param {{ currency?: string, rate?: number, lang?: string }} [opts] */
export function intakeFormValues(rawIntake, { currency, rate = 0, lang = 'es' } = {}) {
  if (!rawIntake) return null
  const intake = reparseIntake(rawIntake, { currency, lang })
  const out = { type: intake.type, desc: intake.merchant || '', date: intake.date, amount: null, usd: false, note: null, code: null }
  const code = intake.currency
  if (intake.amount == null) { out.note = intake.amountStatus === 'ok' ? 'missing' : intake.amountStatus; return out }
  if (!code || code === currency) { out.amount = intake.amount; return out }
  if (code === 'USD' && rate > 0) { out.amount = intake.amount; out.usd = true; return out }
  out.note = 'foreign'; out.code = code
  return out
}

// ¿Esta pestaña es Safari en un iPhone/iPad y no la app instalada? Ahí los
// datos son los de Safari, no los de la app de la pantalla de inicio (iOS
// separa el almacenamiento de cada app web instalada).
export function isIosSafariTab(nav, matchStandalone = false) {
  if (!nav) return false
  const ua = String(nav.userAgent || '')
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && Number(nav.maxTouchPoints) > 1)
  return ios && nav.standalone !== true && !matchStandalone
}
