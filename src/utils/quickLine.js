// src/utils/quickLine.js — "Escribir el movimiento en una línea" (#2, 30-oct-2026).
// "pan 1200", "uber 8,50 ayer", "cobré 500000 sueldo", "almuerzo 12 usd". Lógica
// pura y 100 % local: sin red, sin IA, sin React. QuickAddForm.jsx la llama en
// cada tecla y el resultado rellena los campos, que siguen editables; guardar
// siempre lo decide la persona. Se reutiliza lo que ya existe: palabras y
// comercio de Pegar SMS (smsParser.js), reglas aprendidas (quickAdd.js) y
// separadores del locale de la moneda (keypad.js).
//
// Regla del monto: nunca se adivina. Si hay más de una lectura razonable, el
// resultado es status 'ambiguous' con las opciones y la pantalla pregunta.
//
//   parseQuickLine(text, ctx)  → resultado (ver JSDoc)
//   lineFormPatch(...)         → qué campos del formulario puede tocar la línea

import { INCOME_HINTS, EXPENSE_HINTS, parseDate, parseMerchant } from './smsParser.js'
import { ruleKey, suggestCategory } from './quickAdd.js'
import { amountToKeypad, currencyDecimals, decimalSeparator } from './keypad.js'
import { CURRENCY_SYMBOLS, localeForCurrency } from './index.js'

const USD = 'USD'
const MAX_INT_DIGITS = 13          // Más largo que esto es un código o una referencia
const norm = ruleKey               // minúsculas, sin acentos

const ALIASES = {
  USD: ['usd', 'us$', 'u$s', 'u$d', 'usdt', 'dolar', 'dolares', 'dollar', 'dollars', 'dls'],
  EUR: ['eur', 'euro', 'euros', '€'],
  VES: ['ves', 'bs', 'bs.', 'bsd', 'bolivar', 'bolivares'],
  ARS: ['ars'], CLP: ['clp'], COP: ['cop'], MXN: ['mxn'], PEN: ['pen', 's/'], BRL: ['brl', 'r$', 'reais', 'real'], UYU: ['uyu'],
}
const CURRENCY_OF = Object.fromEntries(Object.entries(ALIASES).flatMap(([c, l]) => l.map(a => [a, c])))
// "pesos" nombra la moneda local de quien la usa: no es otra moneda.
const LOCAL_WORDS = new Set(['pesos', 'peso'])

const MULTIPLIERS = {
  k: 1e3, mil: 1e3, lucas: 1e3, luca: 1e3, lukas: 1e3, luka: 1e3, thousand: 1e3, grand: 1e3, tausend: 1e3, tsd: 1e3,
  millon: 1e6, millones: 1e6, million: 1e6, millions: 1e6, milhao: 1e6, milhoes: 1e6, millionen: 1e6, mio: 1e6, palo: 1e6, palos: 1e6,
}
const ATTACHED_MULT = { k: 1e3, mil: 1e3 }
// Una cifra seguida de una unidad es una cantidad, no el monto ("2 kg").
const UNITS = new Set(['kg', 'kilo', 'kilos', 'g', 'gr', 'gramos', 'l', 'lt', 'lts', 'litro', 'litros', 'ml', 'km',
  'unidad', 'unidades', 'cuota', 'cuotas', 'mes', 'meses', 'dia', 'dias', 'hora', 'horas', 'personas', 'parcelas', 'stuck', 'stunden', 'tage'])

// Palabras que indican el tipo. Los verbos se quitan de la descripción; los
// sustantivos quedan ("sueldo" describe el movimiento, "cobré" no).
const INCOME_VERBS = new Set(['cobre', 'recibi', 'gane', 'received', 'earned', 'recebi', 'ganhei', 'erhalten', 'bekommen', 'verdient'])
const INCOME_NOUNS = new Set(['sueldo', 'salario', 'nomina', 'quincena', 'aguinaldo', 'bono', 'honorarios', 'freelance', 'reembolso', 'devolucion',
  'salary', 'paycheck', 'payroll', 'wage', 'wages', 'refund', 'bonus', 'ordenado', 'gehalt', 'lohn', 'ruckerstattung'])
const EXPENSE_VERBS = new Set(['pague', 'gaste', 'compre', 'paid', 'bought', 'spent', 'paguei', 'gastei', 'comprei', 'bezahlt', 'gekauft', 'ausgegeben'])
const INCOME_PHRASES = [['me', 'pagaron'], ['me', 'depositaron'], ['me', 'transfirieron'], ['me', 'yapearon'], ['me', 'pagaram'], ['got', 'paid']]
// Lo que queda colgando en la descripción al sacar monto o fecha.
const TRAILING_CONNECTORS = new Set(['en', 'de', 'del', 'por', 'para', 'con', 'el', 'la', 'a', 'on', 'for', 'at', 'of', 'in', 'em', 'no', 'na', 'do', 'da', 'am', 'im', 'fur', 'von'])

const RELATIVE_DAYS = {
  hoy: 0, today: 0, hoje: 0, heute: 0,
  ayer: 1, yesterday: 1, ontem: 1, gestern: 1,
  anteayer: 2, antier: 2, anteontem: 2, vorgestern: 2,
}
const WEEKDAYS = {
  es: ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
  en: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  pt: ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'],
  de: ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'],
}
// "Santo Domingo", "Black Friday", "segunda mano": el nombre no es una fecha.
const NOT_WEEKDAY_BEFORE = new Set(['santo', 'black', 'cyber', 'good'])
const NOT_WEEKDAY_AFTER = new Set(['mano', 'mao', 'via', 'avenida', 'negro'])
const DATE_LEAD_INS = new Set(['el', 'on', 'am', 'no', 'na', 'last', 'pasado', 'letzten', 'passado', 'passada'])

// Punto de partida para la primera vez, cuando todavía no hay reglas
// aprendidas: las reglas de la persona siempre mandan.
const SEED_EXPENSE = {
  'Alimentación': 'pan super supermercado mercado almuerzo cena desayuno cafe comida pizza empanadas arepa groceries lunch dinner breakfast coffee food bread padaria almoco jantar lanche brot kaffee mittagessen abendessen supermarkt lebensmittel',
  Transporte: 'uber taxi didi cabify bus colectivo metro nafta gasolina combustible peaje estacionamiento fuel parking gasoline onibus benzin tanken bahn',
  'Entretención': 'netflix spotify disney hbo cine movie cinema kino',
  Salud: 'farmacia medico doctor pharmacy remedio apotheke arzt',
  Servicios: 'luz agua internet telefono electricity strom',
  Vivienda: 'alquiler arriendo renta rent aluguel miete',
  'Educación': 'colegio escuela universidad curso school escola schule',
  Ropa: 'ropa zapatos clothes roupa kleidung',
  Deporte: 'gimnasio gym academia',
  Viajes: 'hotel vuelo flight flug',
}
const SEED_INCOME = {
  Salario: 'sueldo salario nomina quincena salary paycheck payroll wage ordenado gehalt lohn',
  Freelance: 'freelance honorarios',
  Bono: 'bono bonus aguinaldo',
  Arriendo: 'alquiler arriendo rent aluguel miete',
}
const seedMap = (src) => Object.fromEntries(Object.entries(src).flatMap(([cat, words]) => words.split(' ').map(w => [w, cat])))
const SEEDS = { expense: seedMap(SEED_EXPENSE), income: seedMap(SEED_INCOME) }

// ── Monto ───────────────────────────────────────────────────────────────────

// Lectura de una cifra escrita. `decimals` y `locale` son los de su moneda.
// → { value } · { options: [miles, decimal] } si caben dos · { unreadable: true }
export function readNumber(raw, { decimals = 2, locale = 'es-CL', mult = false } = {}) {
  const s = String(raw)
  const seps = s.replace(/\d/g, '')
  if (s.replace(/\D/g, '').length > MAX_INT_DIGITS + 2) return { unreadable: true }
  if (!seps) return { value: Number(s) }

  const last = seps[seps.length - 1]
  const cut = s.lastIndexOf(last)
  const head = s.slice(0, cut), tail = s.slice(cut + 1)
  const headDigits = head.replace(/\D/g, '')

  const validGroups = (h, sep) => {
    const g = h.split(sep)
    return /^[1-9]\d{0,2}$/.test(g[0]) && g.slice(1).every(x => x.length === 3)
  }
  const asDecimal = () => {
    const places = tail.replace(/0+$/, '').length
    if (places > decimals && !mult) return null
    return Number(`${headDigits || '0'}.${tail}`)
  }

  // Dos separadores distintos: el último es el decimal, el otro agrupa.
  if (new Set(seps).size > 1) {
    const other = seps[0]
    if (seps.slice(0, -1).split('').some(c => c !== other) || seps.indexOf(last) !== seps.length - 1) return { unreadable: true }
    if (!validGroups(head, other) || tail.length > 2) return { unreadable: true }
    const v = asDecimal()
    return v == null ? { unreadable: true } : { value: v }
  }
  // El mismo separador repetido: solo puede agrupar miles.
  if (seps.length > 1) {
    return validGroups(s.slice(0, cut), last) && tail.length === 3 ? { value: Number(s.replace(/\D/g, '')) } : { unreadable: true }
  }
  // Un solo separador.
  if (tail.length <= 2 || mult) {
    const v = asDecimal()
    return v == null ? { unreadable: true } : { value: v }
  }
  if (tail.length !== 3) return { unreadable: true }
  if (!validGroups(head, last)) {
    // "0,500" no puede ser miles: si los decimales alcanzan, es esa cifra.
    const v = /^0+$/.test(head) ? asDecimal() : null
    return v == null ? { unreadable: true } : { value: v }
  }
  const thousands = Number(headDigits + tail)
  if (decimals <= 0 || last !== decimalSeparator(locale)) return { value: thousands }
  // "45.000" con punto decimal (MXN, USD): ¿45 mil o 45? "1.234" no tiene
  // lectura decimal posible con 2 decimales: son miles.
  const dec = asDecimal()
  return dec == null ? { value: thousands } : { options: [thousands, dec] }
}

const NUM = String.raw`\d(?:[\d.,]*\d)?`
const PREFIXES = String.raw`us\$|u\$s|u\$d|r\$|s\/|bs\.?|\$|€`
const SUFFIXES = String.raw`usd|usdt|us\$|u\$s|eur|bs\.?|ves|\$|€`
const TOKEN_RE = new RegExp(String.raw`^([+\-−])?(${PREFIXES})?([+\-−])?(${NUM})(k|mil)?(${SUFFIXES})?$`, 'i')

function currencyFromMark(mark, ctx) {
  if (!mark) return null
  if (mark === '$') {
    // "$" es la moneda local donde ese es su símbolo (ARS, COP, MXN, CLP); en
    // el resto, con moneda de referencia, se dice así a los dólares (VE).
    const sym = CURRENCY_SYMBOLS[ctx.currency]
    return sym === '$' || ctx.currency === USD ? ctx.currency : USD
  }
  return CURRENCY_OF[mark] || null
}

// Busca las cifras de la línea: cada una con su moneda y los tokens que ocupa.
function findCandidates(tokens, ctx, skip) {
  const out = []
  const taken = new Set()
  const digits = (t) => /^[1-9]\d{0,2}$/.test(t?.clean || '')
  tokens.forEach((tk, i) => {
    if (skip.has(i) || taken.has(i)) return
    const m = TOKEN_RE.exec(tk.clean)
    if (!m) return
    const [, s1, pre, s2, num, attached, suf] = m
    if (/^\d+$/.test(num) && (/^0\d/.test(num) || num.length > MAX_INT_DIGITS)) return // código o referencia, no monto
    const next = tokens[i + 1]
    const nextWord = next && !skip.has(i + 1) ? next.norm : ''
    if (!attached && UNITS.has(nextWord)) return
    const used = [i]
    let mult = attached ? ATTACHED_MULT[attached.toLowerCase()] : 1
    if (!attached && MULTIPLIERS[nextWord]) { mult = MULTIPLIERS[nextWord]; used.push(i + 1) }
    let extra = 0
    // "2 mil 500", "mil 500"
    const after = tokens[used[used.length - 1] + 1]
    if (mult === 1e3 && !attached && digits(after) && !skip.has(used[used.length - 1] + 1)) {
      extra = Number(after.clean); used.push(used[used.length - 1] + 1)
    } else if (mult === 1 && digits(tk) && tokens[i - 1]?.norm === 'mil' && !skip.has(i - 1) && !TOKEN_RE.test(tokens[i - 2]?.clean || '')) {
      extra = 1000; used.unshift(i - 1)
    }
    let mark = (pre || suf || '').toLowerCase()
    if (!mark) {
      const afterAll = tokens[used[used.length - 1] + 1]
      const before = tokens[i - 1]
      if (afterAll && (CURRENCY_OF[afterAll.norm] || LOCAL_WORDS.has(afterAll.norm))) { mark = afterAll.norm; used.push(used[used.length - 1] + 1) }
      else if (before && !skip.has(i - 1) && (CURRENCY_OF[before.norm] || LOCAL_WORDS.has(before.norm))) { mark = before.norm; used.unshift(i - 1) }
    }
    const currency = LOCAL_WORDS.has(mark) ? ctx.currency : currencyFromMark(mark, ctx)
    const sign = s1 || s2 || ''
    const code = currency || ctx.currency
    const read = readNumber(num, { decimals: currencyDecimals(code), locale: localeForCurrency(code, ctx.lang), mult: mult > 1 })
    const scale = (v) => Math.round((v * mult + extra) * 100) / 100
    used.forEach(u => taken.add(u))
    out.push({
      used, currency, sign,
      marked: !!(mark || sign || mult > 1 || extra),
      value: read.value != null ? scale(read.value) : null,
      options: read.options ? read.options.map(scale) : null,
      unreadable: !!read.unreadable,
    })
  })
  // "mil" suelto cuenta solo si no hay ninguna otra cifra ("taxi mil").
  if (out.length === 0) {
    tokens.forEach((tk, i) => {
      if (skip.has(i) || tk.norm !== 'mil') return
      out.push({ used: [i], currency: null, sign: '', marked: true, value: 1000, options: null, unreadable: false })
    })
  }
  return out.filter(c => c.unreadable || c.options || c.value > 0)
}

// ── Fecha ───────────────────────────────────────────────────────────────────

const localToday = () => {
  const d = new Date(), p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function isoDaysBack(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d - n)
  const p = (x) => String(x).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}
const weekdayOf = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getDay() }

function readDateToken(tk, ctx) {
  const c = tk.clean
  if (c === '24/7') return null
  const slash = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/.exec(c)
  const dotted = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})?$/.exec(tk.raw)
  const m = slash || dotted
  if (!m) return null
  const [a, b] = ctx.monthFirst && slash ? [m[2], m[1]] : [m[1], m[2]]
  const iso = parseDate(`${a}/${b}/${m[3] || ctx.today.slice(0, 4)}`)
  if (!iso) return null
  // Igual que Pegar SMS: una fecha futura no deja un movimiento en el futuro.
  return { date: iso <= ctx.today ? iso : null, ignored: iso > ctx.today }
}

function findDate(tokens, ctx) {
  const days = WEEKDAYS[ctx.lang] || WEEKDAYS.es
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i]
    let found = null
    if (tk.norm in RELATIVE_DAYS) found = { date: isoDaysBack(ctx.today, RELATIVE_DAYS[tk.norm]) }
    else if (tk.norm === 'antes' && tokens[i + 1]?.norm === 'de' && tokens[i + 2]?.norm === 'ayer') {
      return { date: isoDaysBack(ctx.today, 2), idx: [i, i + 1, i + 2] }
    }
    else if (days.includes(tk.norm.replace(/-feira$/, ''))) {
      const before = tokens[i - 1]?.norm, after = tokens[i + 1]?.norm
      if (!NOT_WEEKDAY_BEFORE.has(before) && !NOT_WEEKDAY_AFTER.has(after)) {
        // El último día con ese nombre, sin contar hoy: quien escribe "lunes"
        // un lunes habla del anterior (si no, no lo diría). Se ve y se corrige
        // en el selector de fecha.
        const diff = (weekdayOf(ctx.today) - days.indexOf(tk.norm.replace(/-feira$/, '')) + 7) % 7 || 7
        found = { date: isoDaysBack(ctx.today, diff) }
      }
    } else found = readDateToken(tk, ctx)
    if (found) {
      const idx = [i]
      if (DATE_LEAD_INS.has(tokens[i - 1]?.norm)) idx.unshift(i - 1)
      return { ...found, idx }
    }
  }
  return null
}

// ── Tipo, descripción y categoría ───────────────────────────────────────────

function findType(tokens, skip, text) {
  const drop = new Set()
  let income = false, expense = false
  tokens.forEach((_, i) => {
    for (const phrase of INCOME_PHRASES) {
      if (phrase.every((w, k) => tokens[i + k]?.norm === w)) { income = true; phrase.forEach((__, k) => drop.add(i + k)) }
    }
  })
  tokens.forEach((tk, i) => {
    if (skip.has(i) || drop.has(i)) return
    const lower = tk.clean.toLowerCase()
    const first = i === 0
    // "cobre" sin tilde: al principio de la línea es "cobré"; adentro es el metal.
    const isCobre = tk.norm === 'cobre' && (lower === 'cobré' || first)
    if (isCobre || (tk.norm !== 'cobre' && INCOME_VERBS.has(tk.norm)) || (first && tk.norm === 'cobro')) { income = true; drop.add(i) }
    else if (EXPENSE_VERBS.has(tk.norm) || (first && tk.norm === 'pago')) { expense = true; drop.add(i) }
    else if (INCOME_NOUNS.has(tk.norm)) income = true
  })
  if (!expense && !income) {
    if (INCOME_HINTS.test(text) && !EXPENSE_HINTS.test(text)) income = true
    else if (EXPENSE_HINTS.test(text)) expense = true
  }
  // Un verbo de gasto manda: "pagué sueldo 200" es un gasto.
  const type = expense ? 'expense' : income ? 'income' : null
  return { type, drop }
}

function buildDescription(tokens, skip) {
  const words = tokens.filter((_, i) => !skip.has(i)).map(t => t.clean)
  while (words.length && TRAILING_CONNECTORS.has(norm(words[words.length - 1]))) words.pop()
  while (words.length && ['de', 'por', 'en', 'el', 'la'].includes(norm(words[0]))) words.shift()
  const s = words.join(' ').trim()
  // Mayúscula inicial solo si la persona escribió todo en minúsculas.
  return s && s === s.toLowerCase() ? s[0].toUpperCase() + s.slice(1) : s
}

function findCategory({ description, text, type, rules, allowed }) {
  const ok = (c) => c && (!allowed || allowed.includes(c))
  const direct = suggestCategory(description, rules, allowed)
  if (direct) return direct
  const merchant = parseMerchant(text)
  if (merchant) {
    const viaMerchant = suggestCategory(merchant, rules, allowed)
    if (viaMerchant) return viaMerchant
  }
  const words = norm(description).split(' ').filter(w => w.length >= 3)
  for (const w of words) {
    if (rules && Object.prototype.hasOwnProperty.call(rules, w) && ok(rules[w])) return rules[w]
  }
  for (const w of norm(description).split(' ')) {
    const seed = SEEDS[type]?.[w]
    if (ok(seed)) return seed
  }
  return null
}

/**
 * @param {string} text línea escrita por la persona
 * @param {object} ctx
 *   currency, lang, country     moneda e idioma activos
 *   rate                        tasa de referencia (0 si no hay)
 *   rules                       settings.merchantRules
 *   allowedFor(type)            categorías válidas por tipo (opcional)
 *   defaultType                 tipo si la línea no dice nada
 *   today                       'YYYY-MM-DD' local
 *   monthFirst                  mm/dd (EE. UU.)
 *   choice                      índice de la opción elegida al preguntar
 * @returns {{status:'empty'|'ok'|'noAmount'|'ambiguous'|'unreadable'|'needsRate'|'foreign',
 *   type:'expense'|'income'|null, amount:number|null, usd:boolean, code:string|null,
 *   description:string, date:string|null, category:string|null,
 *   options:Array<{value:number, usd:boolean}>}}
 */
export function parseQuickLine(text, ctx = {}) {
  const cx = { rate: 0, rules: {}, defaultType: 'expense', ...ctx, currency: ctx.currency || 'CLP', lang: ctx.lang || 'es', today: ctx.today || localToday() }
  const base = { status: 'empty', type: null, amount: null, usd: false, code: null, description: '', date: null, category: null, options: [] }
  const line = String(text ?? '').trim()
  if (!line) return base

  const tokens = line.split(/\s+/).map(raw => {
    const clean = raw.replace(/^[,;:!?()"]+|[,;:!?()".]+$/g, '')
    return { raw, clean, norm: norm(clean) }
  })

  const skip = new Set()
  const dated = findDate(tokens, cx)
  if (dated) dated.idx.forEach(i => skip.add(i))
  const { type: lineType, drop } = findType(tokens, skip, line)
  drop.forEach(i => skip.add(i))

  const all = findCandidates(tokens, cx, skip)
  const pool = all.filter(c => c.marked).length === 1 ? all.filter(c => c.marked) : all

  const result = { ...base, date: dated?.date || null }
  let chosen = null
  const asOption = (c, value) => ({ value, usd: (c.currency || cx.currency) === USD && cx.currency !== USD })

  if (pool.length === 1) {
    const c = pool[0]
    if (c.options) {
      if (cx.choice != null && c.options[cx.choice] != null) { chosen = { ...c, value: c.options[cx.choice] } }
      else { result.status = 'ambiguous'; result.options = c.options.map(v => asOption(c, v)); chosen = { ...c, value: null } }
    } else if (c.unreadable) { result.status = 'unreadable'; chosen = { ...c, value: null } }
    else chosen = c
  } else if (pool.length > 1) {
    const readable = pool.filter(c => c.value != null)
    if (cx.choice != null && readable[cx.choice]) chosen = readable[cx.choice]
    else {
      result.status = readable.length ? 'ambiguous' : 'unreadable'
      result.options = readable.map(c => asOption(c, c.value))
      pool.forEach(c => c.used.forEach(i => skip.add(i)))
    }
  }

  if (chosen) chosen.used.forEach(i => skip.add(i))
  const sign = chosen?.sign
  const type = lineType || (sign === '+' ? 'income' : sign ? 'expense' : null)
  result.type = type
  result.description = buildDescription(tokens, skip)
  const catType = type || cx.defaultType
  result.category = findCategory({ description: result.description, text: line, type: catType, rules: cx.rules, allowed: cx.allowedFor?.(catType) || null })

  if (result.status !== 'empty') return result
  if (!chosen) return { ...result, status: 'noAmount' }

  const code = chosen.currency || cx.currency
  result.code = code
  if (code !== cx.currency) {
    if (code !== USD) return { ...result, status: 'foreign' }
    if (!(cx.rate > 0)) return { ...result, status: 'needsRate' }
    result.usd = true
  }
  return { ...result, status: 'ok', amount: chosen.value }
}

// Qué campos puede tocar la línea: solo los que siguen en su valor inicial o
// en lo último que ella misma escribió. Lo que la persona corrigió a mano no
// se pisa, y borrar algo de la línea devuelve el campo a su valor inicial.
//   form      { type, amount, desc, date, usd, cat }  estado actual
//   filled    lo último que escribió la línea
//   defaults  { type, date }
export function lineFormPatch(r, form, filled, defaults, { manualCat = false, decimals = 2 } = {}) {
  const usd = !!r.usd
  const initial = { type: defaults.type, amount: '', desc: '', date: defaults.date, usd: false }
  const wanted = {
    type: r.type || defaults.type,
    amount: r.amount > 0 ? amountToKeypad(r.amount, usd ? currencyDecimals(USD) : decimals) : '',
    desc: r.description || '',
    date: r.date || defaults.date,
    usd,
  }
  const patch = {}, next = {}
  for (const f of Object.keys(initial)) {
    const mine = filled[f] !== undefined ? filled[f] : initial[f]
    if (form[f] === mine) {
      next[f] = wanted[f]
      if (wanted[f] !== form[f]) patch[f] = wanted[f]
    }
  }
  if (r.category && !manualCat) { next.cat = r.category; if (r.category !== form.cat) patch.cat = r.category }
  return { patch, filled: next }
}
