// src/utils/converter.js — conversor rápido de tasa (B2), lógica pura.
//
// El conversor es GRATIS (decisión D-A del 30-oct-2026): moneda principal ↔
// US$ con la tasa de referencia del usuario (utils/refRate.js). Acá viven las
// piezas sin DOM, con tests en converter.test.js:
// - evalAmount(): operaciones básicas en el campo ("25*3", "100+50", "1.234,5")
//   con un parser propio. Nunca eval() ni Function(): lo que se escribe en un
//   campo de texto no se ejecuta como código.
// - convertAmount(): conversión y redondeo a los decimales de la moneda destino.
// - gapPct(): brecha del paralelo sobre el BCV, en %.
// - toFieldText(): el resultado como texto editable al intercambiar los campos.

const OPS = new Set(['+', '-', '*', '/'])

// ¿La moneda usa coma decimal en este locale? ("es-VE" → sí, "en-US" → no)
export function usesDecimalComma(locale) {
  try { return (1.5).toLocaleString(locale).includes(',') } catch { return false }
}

// Un número escrito a mano → Number, según el separador decimal del locale.
// Coma decimal: "1.234,5" → 1234.5; "1.234" → 1234 (punto de miles con grupos
// de 3); "2.5" → 2.5 (un punto suelto que no arma grupos de miles es decimal).
// Punto decimal: "1,234.5" → 1234.5; "1,234" → 1234; "2,5" → 2.5.
export function parseNumberToken(tok, decimalComma = true) {
  const s = String(tok)
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null
  const dec = decimalComma ? ',' : '.'
  const grp = decimalComma ? '.' : ','
  let norm
  if (s.includes(dec)) {
    if (s.split(dec).length > 2) return null
    const [int, frac] = s.split(dec)
    if (frac.includes(grp)) return null
    if (int.includes(grp) && !new RegExp(`^\\d{1,3}(\\${grp}\\d{3})+$`).test(int)) return null
    norm = `${int.split(grp).join('')}.${frac}`
  } else if (s.includes(grp)) {
    if (new RegExp(`^\\d{1,3}(\\${grp}\\d{3})+$`).test(s)) norm = s.split(grp).join('')
    else if (s.split(grp).length === 2) norm = s.replace(grp, '.')
    else return null
  } else {
    norm = s
  }
  if (norm.startsWith('.')) norm = '0' + norm
  if (norm.endsWith('.')) norm = norm.slice(0, -1)
  const n = Number(norm)
  return Number.isFinite(n) ? n : null
}

function tokenize(input, decimalComma) {
  const s = String(input ?? '')
    .replace(/[×xX]/g, '*').replace(/÷/g, '/').replace(/[\u2212\u2013]/g, '-')
    .replace(/[\s\u00a0\u202f]/g, '')
  const out = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (OPS.has(c) || c === '(' || c === ')') { out.push(c); i++; continue }
    if (/[\d.,]/.test(c)) {
      let j = i
      while (j < s.length && /[\d.,]/.test(s[j])) j++
      const n = parseNumberToken(s.slice(i, j), decimalComma)
      if (n == null) return null
      out.push(n); i = j; continue
    }
    return null // cualquier otro carácter: no es una cuenta
  }
  return out
}

// Evalúa una cuenta básica (+ - × ÷ y paréntesis). Devuelve un número finito o
// null (vacío, inválido, división por cero). Un operador al final ("25*", a
// mitad de escribir) se ignora para que el resultado no parpadee.
export function evalAmount(input, { decimalComma = true } = {}) {
  let toks = tokenize(input, decimalComma)
  if (!toks) return null
  while (toks.length && OPS.has(toks[toks.length - 1])) toks = toks.slice(0, -1)
  if (!toks.length) return null
  let pos = 0
  const peek = () => toks[pos]
  function factor() {
    const tk = peek()
    if (tk === '-' || tk === '+') { pos++; const v = factor(); return v == null ? null : (tk === '-' ? -v : v) }
    if (tk === '(') {
      pos++
      const v = expr()
      if (peek() !== ')') return null
      pos++
      return v
    }
    if (typeof tk === 'number') { pos++; return tk }
    return null
  }
  function term() {
    let v = factor()
    while (v != null && (peek() === '*' || peek() === '/')) {
      const op = toks[pos++]
      const r = factor()
      if (r == null) return null
      if (op === '/' && r === 0) return null
      v = op === '*' ? v * r : v / r
    }
    return v
  }
  function expr() {
    let v = term()
    while (v != null && (peek() === '+' || peek() === '-')) {
      const op = toks[pos++]
      const r = term()
      if (r == null) return null
      v = op === '+' ? v + r : v - r
    }
    return v
  }
  const v = expr()
  if (v == null || pos !== toks.length || !Number.isFinite(v)) return null
  return v
}

// ¿Lo escrito es una cuenta (y no solo un número)? Para mostrar "= 75" debajo.
export function isExpression(input) {
  const s = String(input ?? '').replace(/[\s\u00a0\u202f]/g, '')
    .replace(/[×xX]/g, '*').replace(/÷/g, '/').replace(/[\u2212\u2013]/g, '-')
  return /[\d.,)][+\-*/][(\d.,]/.test(s)
}

export function roundDecimals(n, decimals = 2) {
  if (n == null || n === '') return null
  const x = Number(n)
  if (!Number.isFinite(x)) return null
  const v = Number(`${Math.round(Number(`${Math.abs(x)}e${decimals}`))}e-${decimals}`)
  const r = Number.isFinite(v) ? v : Math.round(Math.abs(x) * 10 ** decimals) / 10 ** decimals
  return x < 0 ? -r : r
}

// dir 'toRef': moneda principal → US$ (÷ tasa). dir 'toLocal': US$ → principal (× tasa).
// Se redondea a los decimales de la moneda DESTINO (CLP/COP 0, el resto 2).
export function convertAmount({ amount, rate, dir = 'toRef', localDecimals = 2, refDecimals = 2 }) {
  if (amount == null || amount === '') return null
  const a = Number(amount)
  const r = Number(rate)
  if (!Number.isFinite(a) || !Number.isFinite(r) || r <= 0) return null
  return dir === 'toLocal' ? roundDecimals(a * r, localDecimals) : roundDecimals(a / r, refDecimals)
}

// Brecha del paralelo sobre el BCV, en % (paralelo 1009,30 y BCV 885,40 → 13,99).
export function gapPct(base, other) {
  const b = Number(base), o = Number(other)
  if (!(b > 0) || !(o > 0)) return null
  return (o / b - 1) * 100
}

// Datos de la brecha a partir de la respuesta de loadTasaVE(): solo una
// consulta real (source 'api') con los dos valores; sin red no hay brecha.
export function veGap(ve) {
  if (!ve || ve.source !== 'api' || !ve.paraleloDisponible) return null
  const pct = gapPct(ve.oficial, ve.paralelo)
  if (pct == null) return null
  return { pct, bcv: Number(ve.oficial), paralelo: Number(ve.paralelo), at: Number(ve.paraleloAt ?? ve.at ?? ve.ts) || null }
}

// Un número como texto editable (sin separador de miles), para pasarlo al
// campo de arriba al intercambiar: 88540.5 → "88540,5" (coma) / "88540.5".
export function toFieldText(n, decimals = 2, decimalComma = true) {
  const v = roundDecimals(n, decimals)
  if (v == null) return ''
  const s = String(v)
  return decimalComma ? s.replace('.', ',') : s
}
