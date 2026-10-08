// src/utils/smsParser.js
// Interpreta el texto de una notificación/SMS bancaria pegada por el usuario y
// extrae monto, comercio, fecha y tipo (cargo/abono). 100% local — nada se envía
// a ningún servidor; el usuario copia y pega el texto a mano.
// No es magia: son patrones (regex) de formatos comunes de bancos LATAM/US/ES.
// Siempre es orientativo — el usuario revisa y confirma antes de guardar.

// Palabras que indican un ABONO (ingreso) en vez de un cargo (egreso)
const INCOME_HINTS = /\b(abono|dep[oó]sito|deposito|transferencia recibida|recibiste|te transfiri|pago recibido|ingreso)\b/i

// Palabras que indican un CARGO (egreso) — ayuda a confirmar y a cortar el texto del comercio
const EXPENSE_HINTS = /\b(compra|cargo|pago realizado|retiro|env[ií]o|pagaste|compra por|debito|d[eé]bito)\b/i

// Monto: símbolo de moneda + número con separadores de miles/decimales
// Soporta: $12.990  $12,990.50  MX$350.00  COP 50.000  US$14.99  1.234,56
const AMOUNT_RE = /(?:[A-Z]{0,3}\$|\$)\s?([0-9][0-9.,]*[0-9]|[0-9])/
// Algunos bancos escriben el monto con el CÓDIGO de moneda y sin símbolo: "COP 50.000", "CLP 12.990"
const AMOUNT_CODE_RE = /\b(?:COP|CLP|MXN|ARS|USD|PEN|BRL|UYU|EUR|VES)\s?([0-9][0-9.,]*[0-9]|[0-9])/i

// Fecha: dd-mm-yyyy, dd/mm/yyyy, dd-mm-yy (con o sin hora al final)
const DATE_RE = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/

// Comercio: texto después de "en <COMERCIO>" hasta el próximo delimitador común.
// Excluye "en tu/mi/la/el/su cuenta..." (frases de transferencias, no comercios).
// Incluye "/" en la clase para no romper el match cuando sigue una fecha dd/mm/yyyy
// (la fecha se recorta después, en el post-proceso).
const MERCHANT_RE = /\ben\s+(?!(?:tu|mi|la|el|su|cuenta)\b)([A-Za-zÀ-ÿ0-9&.\-\s/]{2,50}?)(?:,|\scon\s|\ssaldo|\sSdo\b|\saprob|\starjeta|\scta\b|\s(?:el|del)\s|\s\d|\.|\n|$)/i

// Recorta del comercio cualquier fecha/hora que haya quedado pegada al final
function stripTrailingDateTime(s) {
  return s
    .replace(/\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}.*$/, '')
    .replace(/\s*\d{1,2}:\d{2}(:\d{2})?\s*(hrs?|am|pm)?.*$/i, '')
    // Conectores colgantes que suelen quedar antes de la fecha/hora ("en Jumbo el 15/07")
    .replace(/\s+(el|del|de|a las|hoy|ayer|por)\s*$/i, '')
    .trim()
}

function parseAmount(raw) {
  if (!raw) return null
  let s = raw.trim()
  // Si tiene coma Y punto, el último símbolo es el decimal; el otro son miles.
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.') // 1.234,56 -> 1234.56
    } else {
      s = s.replace(/,/g, '') // 1,234.56 -> 1234.56
    }
  } else if (hasComma && !hasDot) {
    // Ambiguo: "12,990" en LATAM suele ser miles (sin decimales); "12,99" sería decimal.
    const parts = s.split(',')
    s = parts[parts.length - 1].length === 2 ? s.replace(',', '.') : s.replace(/,/g, '')
  } else if (hasDot && !hasComma) {
    const parts = s.split('.')
    // "12.990" (3 dígitos tras el punto) = miles; "12.99" (2 dígitos) = decimal
    if (parts[parts.length - 1].length === 3) s = s.replace(/\./g, '')
  }
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

function parseDate(text) {
  const m = text.match(DATE_RE)
  if (!m) return null
  let [, d, mo, y] = m
  d = d.padStart(2, '0'); mo = mo.padStart(2, '0')
  if (y.length === 2) y = '20' + y
  // Validación básica de rango
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31) return null
  // Fecha de calendario real (descarta 31/02, 31/04…)
  const dt = new Date(+y, +mo - 1, +d)
  if (dt.getFullYear() !== +y || dt.getMonth() !== +mo - 1 || dt.getDate() !== +d) return null
  return `${y}-${mo}-${d}`
}

function parseMerchant(text) {
  const m = text.match(MERCHANT_RE)
  if (!m) return ''
  return stripTrailingDateTime(m[1].trim().replace(/\s{2,}/g, ' '))
}

/**
 * Interpreta el texto pegado por el usuario.
 * @param {string} text - texto del SMS/notificación bancaria
 * @returns {{amount:number|null, merchant:string, date:string|null, type:'income'|'expense', confidence:'high'|'low'}}
 */
export function parseTransactionText(text) {
  if (!text || typeof text !== 'string') return null
  const clean = text.trim()
  if (clean.length < 4) return null

  const amountMatch = clean.match(AMOUNT_RE) || clean.match(AMOUNT_CODE_RE)
  const amount = amountMatch ? parseAmount(amountMatch[1]) : null
  const merchant = parseMerchant(clean)
  const date = parseDate(clean)
  const type = INCOME_HINTS.test(clean) && !EXPENSE_HINTS.test(clean) ? 'income' : 'expense'

  // Confianza: si encontramos monto Y (comercio O fecha), es una detección sólida
  const confidence = amount != null && (merchant || date) ? 'high' : 'low'

  return { amount, merchant, date, type, confidence }
}

/**
 * Convierte un monto numérico al formato del teclado de QuickAdd: sin
 * separador de miles, coma como decimal y como máximo 2 decimales
 * (14.99 -> "14,99", 12990 -> "12990", 12.5 -> "12,5"). Sin esto, el monto
 * pegado quedaba con punto ("12.5") y al tocar la tecla "," se formaba
 * "12.5,3", que se guardaba como 12.5 sin aviso.
 * @param {number|null} n
 * @returns {string}
 */
export function toKeypadAmount(n) {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return ''
  return (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '').replace('.', ',')
}
