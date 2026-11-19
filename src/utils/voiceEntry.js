// src/utils/voiceEntry.js — dictado del alta rápida (19-nov-2026).
//
// El reconocimiento de voz (Web Speech API) devuelve una frase: "almuerzo ocho
// mil", "uber 4.500 ayer", "pagué 25 lucas de luz", "Kaffee drei Euro fünfzig".
// Acá se pasa a una línea que entiende parseQuickLine (números en cifras,
// decimales con coma, "hace 3 días" como fecha) y se limpia lo que se dice al
// hablar y no se escribe ("anota un gasto de…", "ich habe … für"). Lógica pura:
// sin red ni React. Guardar siempre lo decide la persona.
//
//   spokenToLine(texto, { lang, today, monthFirst })  → línea para parseQuickLine
//   parseVoiceLine(línea, ctx)                         → resultado de parseQuickLine, limpio
//   parseSpoken(texto, ctx)                            → las dos cosas juntas (tests)
//   speechLang(lang, country)                          → idioma BCP 47 del reconocimiento

import { parseQuickLine, findCategory } from './quickLine.js'
import { ruleKey } from './quickAdd.js'

const norm = (s) => ruleKey(s).replace(/ß/g, 'ss')
const isDigits = (s) => /^\d+$/.test(s)

// ── Números dichos con palabras ─────────────────────────────────────────────

const ES = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
  setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700,
  setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
}
const EN = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, a: 1, an: 1,
}
const PT = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezasseis: 16, dezessete: 17, dezassete: 17,
  dezoito: 18, dezenove: 19, dezanove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70,
  oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300,
  quatrocentos: 400, quatrocentas: 400, quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600,
  setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900,
}
const SCALES = {
  es: { mil: 1e3, millon: 1e6, millones: 1e6 },
  en: { hundred: 100, thousand: 1e3, million: 1e6 },
  pt: { mil: 1e3, milhao: 1e6, milhoes: 1e6 },
}
const WORDS = { es: ES, en: EN, pt: PT }
const JOIN = { es: 'y', en: 'and', pt: 'e' }
// Palabras que también son artículos ("un café", "a coffee", "ein Kaffee"):
// cuentan como número solo delante de una escala, un multiplicador o una moneda.
const WEAK = new Set(['un', 'uno', 'una', 'a', 'an', 'one', 'um', 'uma', 'ein', 'eine', 'einen'])

const DE_BASE = {
  null: 0, ein: 1, eins: 1, eine: 1, einen: 1, zwei: 2, zwo: 2, drei: 3, vier: 4, funf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9,
  zehn: 10, elf: 11, zwolf: 12, dreizehn: 13, vierzehn: 14, funfzehn: 15, sechzehn: 16, siebzehn: 17, achtzehn: 18,
  neunzehn: 19, zwanzig: 20, dreissig: 30, vierzig: 40, funfzig: 50, sechzig: 60, siebzig: 70, achtzig: 80, neunzig: 90,
}
// "fünfundzwanzig", "zwölfhundert", "zweitausenddreihundert": el alemán junta
// las cifras en una palabra.
export function germanNumber(word) {
  const w = norm(word)
  if (!w) return null
  for (const [name, scale] of [['millionen', 1e6], ['million', 1e6], ['tausend', 1e3], ['hundert', 100]]) {
    const i = w.indexOf(name)
    if (i < 0) continue
    const left = w.slice(0, i), right = w.slice(i + name.length).replace(/^und/, '')
    const l = left ? germanNumber(left) : 1
    const r = right ? germanNumber(right) : 0
    return l == null || r == null || l === 0 ? null : l * scale + r
  }
  if (w in DE_BASE) return DE_BASE[w]
  const und = /^(\w+?)und(\w+)$/.exec(w)
  if (und) {
    const u = DE_BASE[und[1]], t = DE_BASE[und[2]]
    if (u != null && u > 0 && u < 10 && t != null && t >= 20 && t % 10 === 0) return t + u
  }
  return null
}

// Monedas y multiplicadores que habilitan a un "un/a/ein" como número.
const CURRENCY_WORDS = new Set(['peso', 'pesos', 'dolar', 'dolares', 'dollar', 'dollars', 'buck', 'bucks', 'euro', 'euros',
  'real', 'reais', 'bolivar', 'bolivares', 'bs', 'bolos', 'usd', 'eur', 'cent', 'cents', 'centavos', 'centimos'])
const MULT_WORDS = new Set(['mil', 'k', 'luca', 'lucas', 'luka', 'lukas', 'palo', 'palos', 'millon', 'millones', 'thousand',
  'grand', 'million', 'milhao', 'milhoes', 'tausend', 'millionen', 'mio', 'hundred', 'hundert'])

function numberAt(tokens, i, lang) {
  if (lang === 'de') {
    const v = germanNumber(tokens[i].n)
    if (v == null) return null
    if (WEAK.has(tokens[i].n)) {
      const next = tokens[i + 1]?.n
      if (!next || !(CURRENCY_WORDS.has(next) || MULT_WORDS.has(next))) return null
    }
    return { value: v, end: i + 1 }
  }
  const words = WORDS[lang] || ES
  const scales = SCALES[lang] || SCALES.es
  const join = JOIN[lang]
  let total = 0, cur = 0, j = i, any = false, lastTens = false
  for (; j < tokens.length; j++) {
    const w = tokens[j].n
    if (w in scales && any) {
      if (scales[w] === 100) cur = (cur || 1) * 100
      else { total += (cur || 1) * scales[w]; cur = 0 }
      lastTens = false
      continue
    }
    if (w in scales && !any) {
      // "mil" solo, después de una cifra escrita ("8 mil"), lo resuelve quickLine.
      if (i > 0 && isDigits(tokens[i - 1].n)) break
      if (lang === 'en' && w === 'hundred') break
      total = scales[w]; any = true; lastTens = false
      continue
    }
    if (w === join && any && j + 1 < tokens.length && tokens[j + 1].n in words && !WEAK.has(tokens[j + 1].n)) {
      // "treinta y dos", "vinte e cinco", "two hundred and fifty", "mil e quinhentos"
      const nv = words[tokens[j + 1].n]
      if (lang === 'es' && !(lastTens && nv < 10)) break
      continue
    }
    if (w in words) {
      if (lang === 'en' && (w === 'a' || w === 'an') && !(tokens[j + 1]?.n in scales)) break
      const v = words[w]
      if (any && cur % 10 === 0 && cur % 100 !== 0 && v < 10 && lang === 'en') { cur += v; lastTens = false; continue } // "twenty five"
      if (any && !lastTens && cur > 0 && v < 100 && cur % 100 !== 0) break // dos números seguidos: otra cifra
      cur += v; any = true; lastTens = v >= 20 && v < 100 && v % 10 === 0
      continue
    }
    break
  }
  if (!any) return null
  if (WEAK.has(tokens[i].n) && j === i + 1) {
    const next = tokens[j]?.n
    if (!next || !(CURRENCY_WORDS.has(next) || MULT_WORDS.has(next))) return null
  }
  return { value: total + cur, end: j }
}

// ── Decimales, monedas dichas, fecha relativa ───────────────────────────────

const DEC_WORDS = new Set(['coma', 'punto', 'point', 'virgula', 'ponto', 'komma'])
const CENT_WORDS = new Set(['cent', 'cents', 'centavos', 'centavo', 'centimos', 'centimo', 'centimes'])
const MAIN_CURRENCY = new Set(['peso', 'pesos', 'dolar', 'dolares', 'dollar', 'dollars', 'euro', 'euros', 'real', 'reais', 'bolivar', 'bolivares', 'bs'])
const DEC_JOIN = { es: new Set(['con', 'y']), en: new Set(['and']), pt: new Set(['e', 'com']), de: new Set(['und']) }
const ALIAS = { bucks: 'dollars', buck: 'dollars', bolos: 'bs', pavos: 'euros' }

const RELATIVE = {
  es: { lead: 'hace', unit: new Set(['dia', 'dias']) },
  pt: { lead: ['ha', 'faz'], unit: new Set(['dia', 'dias']) },
  de: { lead: 'vor', unit: new Set(['tag', 'tagen', 'tage']) },
  en: { tail: 'ago', unit: new Set(['day', 'days']) },
}

function isoDaysBack(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d - n)
  return [dt.getFullYear(), dt.getMonth() + 1, dt.getDate()]
}
const localToday = () => {
  const d = new Date(), p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const cents = (v) => (v < 10 ? `0${v}` : String(v))

/**
 * Frase dictada → línea para parseQuickLine.
 * @param {string} text
 * @param {{ lang?: string, today?: string, monthFirst?: boolean }} opts
 */
export function spokenToLine(text, { lang = 'es', today = localToday(), monthFirst = false } = {}) {
  const raw = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!raw) return ''
  const L = ['es', 'en', 'pt', 'de'].includes(lang) ? lang : 'es'
  // "twenty-five", "trinta-e-dois": el guion une números
  let tokens = raw.split(' ').flatMap(w => (/^[a-záéíóúüñç]+-[a-záéíóúüñç-]+$/i.test(w) ? w.split('-') : [w]))
    .map(w => {
      const clean = w.replace(/^[¿¡"(]+|[,;:!?)".]+$/g, '')
      return { t: clean, n: norm(clean) }
    })
    .filter(tk => tk.t)

  // 1) números con palabras → cifras
  const out = []
  for (let i = 0; i < tokens.length;) {
    const num = numberAt(tokens, i, L)
    if (num) { out.push({ t: String(num.value), n: String(num.value) }); i = num.end; continue }
    const a = ALIAS[tokens[i].n]
    out.push(a ? { t: a, n: a } : tokens[i])
    i++
  }
  tokens = out

  // 2) "medio palo", "una luca y media", "un palo y medio"
  for (let i = 0; i < tokens.length; i++) {
    if ((tokens[i].n === 'medio' || tokens[i].n === 'media') && MULT_WORDS.has(tokens[i + 1]?.n) && !isDigits(tokens[i - 1]?.n || '')) {
      tokens.splice(i, 1, { t: '0,5', n: '0,5' })
    }
    if (isDigits(tokens[i].n) && MULT_WORDS.has(tokens[i + 1]?.n) && tokens[i + 2]?.n === 'y' && ['medio', 'media'].includes(tokens[i + 3]?.n)) {
      tokens.splice(i, 1, { t: `${tokens[i].n},5`, n: `${tokens[i].n},5` })
      tokens.splice(i + 2, 2)
    }
  }

  // 3) decimales: "3 coma 5", "3 con 50", "3 euros con 50", "3 Euro 50", "25 dollars and 40 cents"
  for (let i = 0; i < tokens.length; i++) {
    const a = tokens[i]
    if (!isDigits(a.n)) continue
    const n1 = tokens[i + 1]?.n, n2 = tokens[i + 2]?.n, n3 = tokens[i + 3]?.n
    if (DEC_WORDS.has(n1) && isDigits(n2 || '')) {
      tokens.splice(i, 3, { t: `${a.n},${n2}`, n: `${a.n},${n2}` })
      continue
    }
    if (DEC_JOIN[L].has(n1) && isDigits(n2 || '') && Number(n2) < 100 && L === 'es' && n1 === 'con') {
      const drop = CENT_WORDS.has(n3) ? 4 : 3
      tokens.splice(i, drop, { t: `${a.n},${cents(Number(n2))}`, n: `${a.n},${cents(Number(n2))}` })
      continue
    }
    if (MAIN_CURRENCY.has(n1)) {
      const cur = tokens[i + 1]
      let k = i + 2
      if (DEC_JOIN[L].has(tokens[k]?.n) && isDigits(tokens[k + 1]?.n || '')) k++
      const b = tokens[k]?.n
      // "3 Euro 50": solo si lo que sigue a la moneda es una cifra de centavos
      if (isDigits(b || '') && Number(b) < 100 && (k > i + 2 || L === 'de' || L === 'en' || CENT_WORDS.has(tokens[k + 1]?.n))) {
        const drop = k - i + 1 + (CENT_WORDS.has(tokens[k + 1]?.n) ? 1 : 0)
        tokens.splice(i, drop, { t: `${a.n},${cents(Number(b))}`, n: `${a.n},${cents(Number(b))}` }, cur)
      }
    }
  }

  // 4) "hace 3 días", "há 3 dias", "vor 3 Tagen", "3 days ago" → fecha
  const rel = RELATIVE[L]
  const leads = rel.lead ? [].concat(rel.lead) : []
  for (let i = 0; i < tokens.length; i++) {
    let span = null, days = null
    if (leads.includes(tokens[i].n) && isDigits(tokens[i + 1]?.n || '') && rel.unit.has(tokens[i + 2]?.n)) { span = [i, 3]; days = Number(tokens[i + 1].n) }
    else if (rel.tail && isDigits(tokens[i].n) && rel.unit.has(tokens[i + 1]?.n) && tokens[i + 2]?.n === rel.tail) { span = [i, 3]; days = Number(tokens[i].n) }
    if (span && days > 0 && days <= 90) {
      const [y, m, d] = isoDaysBack(today, days)
      const date = monthFirst ? `${m}/${d}/${y}` : `${d}/${m}/${y}`
      tokens.splice(span[0], span[1], { t: date, n: date })
    }
  }

  return tokens.map(tk => tk.t).join(' ')
}

// ── Limpieza de la descripción ──────────────────────────────────────────────

const FILLERS = new Set([
  // es
  'anota', 'anotar', 'anote', 'apunta', 'apuntar', 'registra', 'registrar', 'agrega', 'agregar', 'anade', 'pon', 'yo',
  'un', 'una', 'el', 'la', 'los', 'las', 'de', 'del', 'en', 'por', 'para', 'al', 'con', 'que', 'compra',
  // en
  'add', 'log', 'record', 'note', 'i', 'a', 'an', 'the', 'on', 'for', 'at', 'of', 'to', 'in', 'my', 'some',
  // pt
  'anota', 'adiciona', 'coloca', 'eu', 'um', 'uma', 'o', 'os', 'as', 'do', 'da', 'no', 'na', 'em', 'com', 'pra', 'pro',
  // de
  'ich', 'habe', 'hab', 'hat', 'trag', 'trage', 'notiere', 'ein', 'eine', 'einen', 'fur', 'furs', 'von', 'am', 'im',
  'an', 'auf', 'den', 'der', 'die', 'das', 'dem', 'mit', 'beim', 'bei', 'zum', 'zur',
])
const TYPE_WORDS = {
  income: new Set(['ingreso', 'income', 'einnahme', 'receita', 'entrada']),
  expense: new Set(['gasto', 'gastos', 'expense', 'ausgabe', 'despesa']),
}

function cleanDescription(desc) {
  const words = String(desc || '').split(' ').filter(Boolean)
  let type = null
  const isFiller = (w) => {
    const n = norm(w)
    if (TYPE_WORDS.income.has(n)) { type = type || 'income'; return true }
    if (TYPE_WORDS.expense.has(n)) { type = type || 'expense'; return true }
    return FILLERS.has(n)
  }
  while (words.length && isFiller(words[0])) words.shift()
  while (words.length && isFiller(words[words.length - 1])) words.pop()
  const s = words.join(' ')
  const d = s && s.slice(1) === s.slice(1).toLowerCase() ? s[0].toUpperCase() + s.slice(1) : s
  return { description: d, type }
}

// parseQuickLine con la descripción limpia de lo que solo se dice al hablar.
export function parseVoiceLine(line, ctx = {}) {
  const r = parseQuickLine(line, ctx)
  if (r.status === 'empty') return r
  const { description, type } = cleanDescription(r.description)
  const out = { ...r, description, type: r.type || type }
  if (description !== r.description || out.type !== r.type) {
    const catType = out.type || ctx.defaultType || 'expense'
    out.category = findCategory({ description, text: line, type: catType, rules: ctx.rules || {}, allowed: ctx.allowedFor?.(catType) || null })
  }
  return out
}

export function parseSpoken(text, ctx = {}) {
  return parseVoiceLine(spokenToLine(text, { lang: ctx.lang, today: ctx.today, monthFirst: ctx.monthFirst }), ctx)
}

// ── Idioma del reconocimiento ───────────────────────────────────────────────

const ES_COUNTRIES = new Set(['AR', 'BO', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC', 'SV', 'GT', 'HN', 'MX', 'NI', 'PA', 'PY', 'PE', 'PR', 'ES', 'UY', 'VE', 'US'])
export function speechLang(lang, country) {
  const c = String(country || '').toUpperCase()
  if (lang === 'en') return ['US', 'GB', 'AU', 'CA', 'IN', 'IE', 'NZ'].includes(c) ? `en-${c}` : 'en-US'
  if (lang === 'pt') return c === 'PT' ? 'pt-PT' : 'pt-BR'
  if (lang === 'de') return ['AT', 'CH'].includes(c) ? `de-${c}` : 'de-DE'
  return ES_COUNTRIES.has(c) ? `es-${c}` : 'es-ES'
}
