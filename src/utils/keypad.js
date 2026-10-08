// src/utils/keypad.js
// Lógica pura del teclado numérico propio de QuickAdd. El monto se maneja como
// string con coma decimal ("1234,5"), nunca con punto: así lo que deja el
// pegado de SMS (toKeypadAmount en smsParser.js) y lo que escribe el teclado
// usan siempre el mismo formato, y la tecla "," no puede armar "12.5,3".

import { toKeypadAmount } from './smsParser.js'
import { currencyDecimals } from './index.js'

// Decimales por moneda: fuente única en utils/index.js (la usa también fmtMoney,
// así el teclado y lo que se muestra después nunca difieren). Re-export para los
// imports existentes.
export { currencyDecimals }

export const KEY_BACKSPACE = '⌫'
export const KEY_DECIMAL = ','
export const KEY_THOUSAND = '000'

// Devuelve el monto nuevo tras tocar `key`. `decimals` es la cantidad máxima
// de decimales de la moneda (2 por defecto; 0 para CLP, COP, etc.).
export function pressKey(amount, key, decimals = 2) {
  const a = String(amount ?? '')
  if (key === KEY_BACKSPACE) return a.slice(0, -1)
  if (key === KEY_DECIMAL) {
    if (decimals <= 0 || a.includes(',')) return a
    return (a || '0') + ','
  }
  if (key === KEY_THOUSAND) {
    // "000" solo multiplica un monto que ya existe: sobre vacío o "0" no
    // agrega ceros a la izquierda.
    if (!a || a === '0') return a
    let next = a
    for (let i = 0; i < 3; i++) next = pressKey(next, '0', decimals)
    return next
  }
  if (!/^\d$/.test(key)) return a
  // dígito: máximo `decimals` decimales tras la coma, sin ceros a la izquierda repetidos
  const [, dec] = a.split(',')
  if (dec != null && dec.length >= Math.max(decimals, 0)) return a
  if (key === '0' && a === '0') return a
  return a === '0' ? key : a + key
}

// "1234,5" -> 1234.5 (0 si está vacío o no es un número)
export function keypadToNumber(amount) {
  return parseFloat(String(amount ?? '').replace(',', '.')) || 0
}

// Número (ej. el que trae un SMS) -> string del teclado, redondeado a los
// decimales de la moneda: 12990.4 en CLP queda "12990", 12.5 en USD "12,5".
export function amountToKeypad(n, decimals = 2) {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return ''
  const f = 10 ** Math.max(decimals, 0)
  return toKeypadAmount(Math.round(v * f) / f)
}

// String del teclado -> texto a mostrar con separador de miles y decimal del
// locale de la moneda ("18500" -> "18.500" en es-CL, "1234,5" -> "1,234.5" en
// en-US). Mismo agrupado que fmtMoney (toLocaleString del locale).
export function formatKeypadDisplay(amount, locale = 'es-CL') {
  const a = String(amount ?? '')
  if (!a) return ''
  const [int, dec] = a.split(',')
  const intFmt = Number(int || 0).toLocaleString(locale, { maximumFractionDigits: 0 })
  return dec === undefined ? intFmt : intFmt + decimalSeparator(locale) + dec
}

export function decimalSeparator(locale = 'es-CL') {
  try {
    return new Intl.NumberFormat(locale).formatToParts(1.5).find(p => p.type === 'decimal')?.value || ','
  } catch { return ',' }
}
