// src/utils/investMappedImport.js — importar posiciones desde un archivo con
// columnas elegidas por la persona (Inversiones v2, 24-nov-2026).
//
// Solo archivos que la persona descarga y elige (CSV o Excel): nunca usuario,
// clave ni lectura de la web de la corredora. El archivo se lee en el
// dispositivo; al servidor llegan solo las posiciones que se confirman, como
// con el CSV de siempre.
//
// Formatos:
//  · generic — los encabezados del CSV de Inversiones (utils/investCsv.js) y
//    los habituales en es/en/pt/de; la persona puede cambiar cada columna.
//  · fintual, racional — FORMATO POR CONFIRMAR. El 24-nov-2026 no se pudo
//    verificar un archivo real exportado por ninguna de las dos (ni su centro
//    de ayuda dice qué columnas trae). Los alias son una suposición razonable:
//    la pantalla lo avisa y siempre muestra el mapeo para revisarlo. Cuando
//    haya un archivo real, se ajustan los alias y se pasa `confirmed` a true.
//
// Lógica pura: sin DOM, sin red, sin almacenamiento. Errores como códigos
// (pf.csv.err.<código>) para traducirlos en la pantalla.
import { COLS, TYPES, TICKER_RE, IMPORT_MAX_ROWS, parseNum, splitLine } from './investCsv.js'

// Encabezado normalizado: minúsculas, sin tildes, sin "(USD)" al final, sin
// signos sueltos y con un solo espacio.
export function normHead(h) {
  return String(h ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*\([^)]*\)\s*$/, '').replace(/[°º#:*]/g, ' ').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim()
}
const norm = (list) => list.map(normHead)

// Monto total invertido (cuando el archivo no trae precio promedio): el precio
// de entrada sale de monto / unidades.
const TOTAL = ['monto invertido', 'total invertido', 'costo total', 'importe invertido', 'valor invertido', 'inversion', 'cost basis', 'total cost', 'amount invested', 'invested', 'valor investido', 'custo total', 'einstandswert', 'kaufwert']

export const PRESETS = {
  generic: {
    confirmed: true,
    type: 'Stock',
    cols: { t: norm(COLS.t), sh: norm(COLS.sh), cost: norm(COLS.cost), total: norm(TOTAL), type: norm(COLS.type), stop: norm(COLS.stop), fxCost: norm(COLS.fxCost) },
  },
  fintual: {
    confirmed: false,
    thousandsDot: true,
    type: 'Stock',
    cols: {
      t: norm(['fondo', 'nombre del fondo', 'nombre fondo', 'serie', 'activo', 'nombre']),
      sh: norm(['cuotas', 'numero de cuotas', 'n de cuotas', 'cantidad de cuotas', 'unidades']),
      cost: norm(['valor cuota promedio', 'valor cuota de compra', 'precio promedio', 'valor cuota inicial']),
      total: norm(['monto invertido', 'total invertido', 'monto depositado neto', 'inversion', 'costo total']),
      type: [], stop: [], fxCost: [],
    },
  },
  racional: {
    confirmed: false,
    thousandsDot: true,
    type: 'Stock',
    cols: {
      t: norm(['ticker', 'simbolo', 'nemotecnico', 'nemo', 'instrumento', 'accion', 'activo']),
      sh: norm(['cantidad', 'acciones', 'unidades', 'cantidad de acciones', 'titulos']),
      cost: norm(['precio promedio', 'precio promedio de compra', 'costo promedio', 'precio de compra']),
      total: norm(['monto invertido', 'costo total', 'total invertido', 'inversion']),
      type: norm(['tipo', 'tipo de instrumento', 'clase']), stop: [], fxCost: [],
    },
  },
}
export const PRESET_IDS = Object.keys(PRESETS)
// Las columnas que la persona puede elegir en la hoja (stop y tipo de cambio
// de compra se detectan solos, como en el CSV de siempre).
export const MAP_FIELDS = ['t', 'sh', 'cost', 'total', 'type']

// Texto CSV (separador , ; o tabulador) → { head, rows } o { error }.
// La fila de encabezados es la primera con al menos 2 celdas con texto
// (algunos exportes traen un título arriba).
export function csvTable(text) {
  // Número de línea real de cada fila (las vacías y el título también cuentan),
  // para que un error diga la línea que la persona ve en su archivo.
  const entries = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).map((l, i) => ({ l, n: i + 1 })).filter(e => e.l.trim())
  if (!entries.length) return { error: 'empty' }
  const count = (l, c) => l.split(c).length - 1
  const pick = (l) => {
    const n = { ';': count(l, ';'), ',': count(l, ','), '\t': count(l, '\t') }
    return Object.keys(n).sort((a, b) => n[b] - n[a])[0]
  }
  let start = entries.findIndex(e => splitLine(e.l, pick(e.l)).filter(c => c).length >= 2)
  if (start < 0) start = 0
  const sep = pick(entries[start].l)
  const rest = entries.slice(start)
  return tableFrom(rest.map(e => splitLine(e.l, sep)), rest.map(e => e.n))
}

// Filas de celdas (texto o número) → { head, rows, lines }: encabezados y filas
// sin las vacías del todo. `lines[i]` = número de línea (o de fila de Excel) de
// rows[i] en el archivo; sin `lineNos`, la posición en `cells` (1 = la primera).
export function tableFrom(cells, lineNos = null) {
  const all = (cells || []).map(r => (r || []).map(c => (c == null ? '' : typeof c === 'number' ? c : String(c).trim())))
  const start = all.findIndex(r => r.filter(c => c !== '').length >= 2)
  if (start < 0) return { error: 'no_rows' }
  const head = all[start].map(c => String(c))
  const rows = [], lines = []
  for (let j = start + 1; j < all.length; j++) {
    if (!all[j].some(c => c !== '')) continue
    rows.push(all[j])
    lines.push(lineNos?.[j] ?? j + 1)
  }
  if (!rows.length) return { error: 'no_rows' }
  return { head, rows, lines }
}

// Primer encabezado (en el orden del archivo) que está en la lista de alias.
export function autoMap(head, presetId = 'generic') {
  const p = PRESETS[presetId] || PRESETS.generic
  const h = (head || []).map(normHead)
  const used = new Set()
  const out = {}
  for (const k of ['t', 'sh', 'cost', 'total', 'type', 'stop', 'fxCost']) {
    const aliases = p.cols[k] || []
    const i = h.findIndex((x, j) => !used.has(j) && aliases.includes(x))
    out[k] = i
    if (i >= 0) used.add(i)
  }
  return out
}

// Nombre o símbolo → identificador de la posición: mayúsculas, sin tildes ni
// espacios. Un fondo ("Risky Norris") queda como RISKYNORRIS.
// Un nombre (con espacios) se corta a 15 caracteres, el largo máximo de un
// ticker; un símbolo sin espacios no se corta (si es inválido, se avisa).
export const TICKER_MAX = 15
export function toTicker(v) {
  const raw = String(v ?? '').trim()
  const t = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9.\-^=]/g, '')
  return /\s/.test(raw) ? t.slice(0, TICKER_MAX) : t
}
// Separador decimal de los números del archivo (la persona lo elige en la
// hoja): 'auto' (lo que sigue), 'comma' (1.234,56: el punto es de miles) o
// 'dot' (1,234.56: la coma es de miles).
export const DECIMAL_MODES = ['auto', 'comma', 'dot']
// Números. En 'auto' y en los formatos de Chile (thousandsDot) "1.600" y
// "105.000" son miles: uno o más puntos seguidos de exactamente 3 cifras, sin
// coma. Lo demás, como parseNum ("190.5", "1.234,56").
export function numOf(v, { thousandsDot = false, decimal = 'auto' } = {}) {
  if (typeof v === 'number') return v
  const str = String(v ?? '').trim()
  const digits = str.replace(/[^0-9,.-]/g, '')
  if (decimal === 'comma') return digits ? parseFloat(digits.replace(/\./g, '').replace(',', '.')) : NaN
  if (decimal === 'dot') return digits ? parseFloat(digits.replace(/,/g, '')) : NaN
  if (thousandsDot && /^[^\d,.]*-?\d{1,3}(\.\d{3})+[^\d,.]*$/.test(str)) return parseNum(str.replace(/\./g, ''))
  return parseNum(str)
}

// Dos nombres distintos que se cortan igual (los 15 primeros caracteres) no
// pueden quedar como la misma posición: el segundo lleva un sufijo (…2, …3).
function uniqueTicker(t, raw, seen) {
  if (!/\s/.test(String(raw ?? '').trim())) return t
  const key = normHead(raw)
  const owner = seen.get(t)
  if (owner == null || owner === key) { seen.set(t, key); return t }
  for (let n = 2; n < 100; n++) {
    const sfx = String(n)
    const cand = t.slice(0, TICKER_MAX - sfx.length) + sfx
    const o = seen.get(cand)
    if (o == null || o === key) { seen.set(cand, key); return cand }
  }
  return t
}

// → { rows: [{ t, type, sh, cost, stop?, fxCost? }], errors: [{ code, line?, value? }] }
// Mismos códigos que parseHoldingsCsv, más 'need' (faltan columnas elegidas).
// `line` es la línea (o fila de Excel) en el archivo: los títulos de arriba del
// encabezado también cuentan (table.lines); sin eso, encabezado = 1.
// `decimal`: ver DECIMAL_MODES.
export function applyMap(table, map, { presetId = 'generic', decimal = 'auto' } = {}) {
  if (!table || table.error) return { rows: [], errors: [{ code: table?.error || 'empty' }] }
  const m = map || {}
  if (!(m.t >= 0) || !(m.sh >= 0) || !(m.cost >= 0 || m.total >= 0)) return { rows: [], errors: [{ code: 'need' }] }
  const P = PRESETS[presetId] || PRESETS.generic
  const defType = P.type
  const nOpt = { thousandsDot: !!P.thousandsDot, decimal: DECIMAL_MODES.includes(decimal) ? decimal : 'auto' }
  const rows = [], errors = []
  const seen = new Map()
  for (let i = 0; i < table.rows.length; i++) {
    const c = table.rows[i]
    const line = table.lines?.[i] ?? i + 2
    const raw = c[m.t]
    let t = toTicker(raw)
    if (!t || t === 'TOTAL') continue
    if (!TICKER_RE.test(t)) { errors.push({ code: 'ticker', line, value: String(raw).slice(0, 20) }); continue }
    t = uniqueTicker(t, raw, seen)
    const sh = numOf(c[m.sh], nOpt)
    if (!(sh > 0)) { errors.push({ code: 'shares', line }); continue }
    let cost = m.cost >= 0 ? numOf(c[m.cost], nOpt) : NaN
    if (!(cost > 0) && m.total >= 0) {
      const tot = numOf(c[m.total], nOpt)
      if (tot > 0) cost = tot / sh
    }
    if (!(cost > 0)) { errors.push({ code: 'cost', line }); continue }
    const type = m.type >= 0 ? TYPES[String(c[m.type] || '').toLowerCase().trim()] || defType : defType
    const row = { t, type, sh, cost: Math.round(cost * 1e6) / 1e6 }
    if (m.stop >= 0) { const st = numOf(c[m.stop], nOpt); if (st > 0) row.stop = st }
    if (m.fxCost >= 0) { const fx = numOf(c[m.fxCost], nOpt); if (fx > 0) row.fxCost = fx }
    rows.push(row)
    if (rows.length > IMPORT_MAX_ROWS) return { rows: rows.slice(0, IMPORT_MAX_ROWS), errors: [...errors, { code: 'too_many' }] }
  }
  if (!rows.length && !errors.length) errors.push({ code: 'no_rows' })
  return { rows, errors }
}

// Valor de una celda de exceljs → texto o número (fórmulas: su resultado;
// texto enriquecido: el texto; fechas: AAAA-MM-DD).
export function xlsxCell(v) {
  if (v == null) return ''
  if (typeof v === 'number' || typeof v === 'string') return v
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map(r => r.text || '').join('')
    if ('result' in v) return xlsxCell(v.result)
    if ('text' in v) return String(v.text)
  }
  return String(v)
}
