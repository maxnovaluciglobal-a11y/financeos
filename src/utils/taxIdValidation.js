// src/utils/taxIdValidation.js
// Validación de identificadores fiscales — SIN contratar ninguna API de pago.
//
// Cobertura real (checksum/dígito verificador implementado en JS puro, offline):
//   CL → RUT   (módulo 11, multiplicador cíclico 2-7)
//   MX → RFC   (módulo 11 sobre tabla de valores oficial SAT, verificado
//               contra el ejemplo publicado GODE561231GR8)
//   AR → CUIT  (módulo 11, pesos 5,4,3,2,7,6,5,4,3,2)
//   VE → RIF   (módulo 11 con base por tipo de contribuyente V/E/J/P/G)
//   ES → NIF/NIE (módulo 23 sobre tabla de letras, verificado contra el
//               ejemplo canónico 12345678Z)
//   PT → NIF   (módulo 11, pesos 9..2, verificado contra el ejemplo
//               publicado 501442600)
//
// Cobertura parcial (solo formato, sin dígito verificador offline):
//   DE → USt-IdNr — no hay un algoritmo de dígito de control públicamente
//     confiable para el IdNr de IVA alemán que pueda verificar con un caso
//     de prueba (el Steuer-ID *personal* de 11 dígitos sí tiene uno
//     documentado — ISO 7064-ish —, pero es un número DISTINTO al USt-IdNr
//     de IVA; mezclarlos daría falsos negativos/positivos). Ver validateVIES.
//   US → EIN — Estados Unidos no tiene un "IVA" equivalente y ni el IRS ni
//     la SSA publican un dígito verificador para EIN/SSN. No se fuerza
//     ningún checksum inventado: solo se valida el formato XX-XXXXXXX.
//
// ── VIES (Unión Europea) — nota importante sobre CORS ───────────────────
// El endpoint REST público de VIES para validar IVA intracomunitario es:
//   https://ec.europa.eu/taxation_customs/vies/rest-api/ms/{cc}/vat/{vat}
// Verificado en vivo (2026-08-16, curl): responde 200 OK a un GET normal,
// pero al preflight CORS (OPTIONS con Origin) responde 403 Forbidden y NO
// manda Access-Control-Allow-Origin en ningún caso. Eso significa que un
// fetch() hecho desde el navegador en app.moyiq.app será bloqueado
// por CORS — no es un tema de API key, es que el servicio no está pensado
// para llamarse directo desde un cliente web. FinanceOS es 100% cliente
// (sin backend que pueda hacer de proxy, ver CLAUDE.md del repo), así que
// validateVIES() HOY va a fallar con un error de red/CORS si se llama
// desde la app en el navegador. Queda implementada igual porque: (a) es
// el contrato correcto si en algún momento se agrega una función
// serverless propia como proxy, y (b) el error se degrada con gracia
// (reason: 'network_or_cors') para que quien la use pueda caer al
// validador local de ES/PT, que sí corre 100% offline.

// ────────────────────────────────────────────────────────────────────────
// Chile — RUT
// ────────────────────────────────────────────────────────────────────────
export function validateRUT(raw) {
  if (!raw) return { valid: false, reason: 'empty' }
  const clean = String(raw).toUpperCase().replace(/[.\s]/g, '').replace(/-/g, '')
  if (!/^\d{7,8}[0-9K]$/.test(clean)) return { valid: false, reason: 'format' }
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  let sum = 0
  let mul = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const res = 11 - (sum % 11)
  const expected = res === 11 ? '0' : res === 10 ? 'K' : String(res)
  const valid = expected === dv
  return { valid, formatted: `${body}-${dv}`, checkDigit: expected, reason: valid ? null : 'checkDigit' }
}

// ────────────────────────────────────────────────────────────────────────
// México — RFC (persona física: 13 chars · persona moral: 12 chars)
// ────────────────────────────────────────────────────────────────────────
const RFC_VALUES = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, I: 18, J: 19,
  K: 20, L: 21, M: 22, N: 23, '&': 24, O: 25, P: 26, Q: 27, R: 28, S: 29,
  T: 30, U: 31, V: 32, W: 33, X: 34, Y: 35, Z: 36, ' ': 37, Ñ: 38,
}
const RFC_FORMAT = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/

function rfcCheckDigit(bodyWithoutCheckDigit) {
  const total = bodyWithoutCheckDigit.length + 1 // largo del RFC completo, incluyendo el dígito a calcular
  let sum = 0
  for (let i = 0; i < bodyWithoutCheckDigit.length; i++) {
    const weight = total - i // posición 1 (izquierda) pesa `total`, baja de a 1 hasta 2
    sum += (RFC_VALUES[bodyWithoutCheckDigit[i]] ?? 0) * weight
  }
  const res = sum % 11
  if (res === 0) return '0'
  if (res === 1) return 'A'
  return String(11 - res)
}

export function validateRFC(raw) {
  if (!raw) return { valid: false, reason: 'empty' }
  const clean = String(raw).toUpperCase().replace(/[-\s]/g, '')
  if (!RFC_FORMAT.test(clean)) return { valid: false, reason: 'format' }
  const body = clean.slice(0, -1)
  const given = clean.slice(-1)
  const expected = rfcCheckDigit(body)
  const valid = expected === given
  return { valid, formatted: clean, checkDigit: expected, reason: valid ? null : 'checkDigit' }
}

// ────────────────────────────────────────────────────────────────────────
// Argentina — CUIT
// ────────────────────────────────────────────────────────────────────────
const CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

export function validateCUIT(raw) {
  if (!raw) return { valid: false, reason: 'empty' }
  const clean = String(raw).replace(/[-\s]/g, '')
  if (!/^\d{11}$/.test(clean)) return { valid: false, reason: 'format' }
  const digits = clean.split('').map(Number)
  const sum = digits.slice(0, 10).reduce((acc, d, i) => acc + d * CUIT_WEIGHTS[i], 0)
  const res = sum % 11
  let expected = 11 - res
  if (expected === 11) expected = 0
  if (expected === 10) {
    // AFIP nunca emite un CUIT que necesite un dígito de 2 cifras: cuando el
    // módulo da esto, en la práctica se resuelve cambiando el prefijo (23↔24)
    // durante la EMISIÓN, no la validación. Si nos llega este caso, el
    // número tal como está no es válido.
    return { valid: false, reason: 'checkDigit', note: 'prefixMismatch' }
  }
  const valid = expected === digits[10]
  return {
    valid,
    formatted: `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`,
    checkDigit: expected,
    reason: valid ? null : 'checkDigit',
  }
}

// ────────────────────────────────────────────────────────────────────────
// Venezuela — RIF
// ────────────────────────────────────────────────────────────────────────
const RIF_BASE = { V: 4, E: 8, J: 12, P: 16, G: 20 }
const RIF_WEIGHTS = [0, 3, 2, 7, 6, 5, 4, 3, 2] // índice 0 sin uso (es la letra)

export function validateRIF(raw) {
  if (!raw) return { valid: false, reason: 'empty' }
  const clean = String(raw).toUpperCase().replace(/[-\s]/g, '')
  if (!/^[VEJPG]\d{9}$/.test(clean)) return { valid: false, reason: 'format' }
  const letter = clean[0]
  const bodyDigits = clean.slice(1, 9) // 8 dígitos del cuerpo
  const given = Number(clean[9])
  let val = RIF_BASE[letter] || 0
  for (let i = 0; i < bodyDigits.length; i++) {
    val += RIF_WEIGHTS[i + 1] * Number(bodyDigits[i])
  }
  let expected = 11 - (val % 11)
  if (expected >= 10) expected = 0
  const valid = expected === given
  return { valid, formatted: `${letter}-${bodyDigits}-${given}`, checkDigit: expected, reason: valid ? null : 'checkDigit' }
}

// ────────────────────────────────────────────────────────────────────────
// España — NIF (DNI) / NIE
// ────────────────────────────────────────────────────────────────────────
const NIF_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE'
const NIE_PREFIX = { X: '0', Y: '1', Z: '2' }

export function validateNIF(raw) {
  if (!raw) return { valid: false, reason: 'empty' }
  const clean = String(raw).toUpperCase().replace(/[-\s]/g, '')
  let numPart
  if (/^\d{8}[A-Z]$/.test(clean)) {
    numPart = clean.slice(0, 8)
  } else if (/^[XYZ]\d{7}[A-Z]$/.test(clean)) {
    numPart = NIE_PREFIX[clean[0]] + clean.slice(1, 8)
  } else {
    return { valid: false, reason: 'format' }
  }
  const letter = clean.slice(-1)
  const expected = NIF_LETTERS[Number(numPart) % 23]
  const valid = expected === letter
  return { valid, formatted: clean, checkDigit: expected, reason: valid ? null : 'checkDigit' }
}

// ────────────────────────────────────────────────────────────────────────
// Portugal — NIF
// ────────────────────────────────────────────────────────────────────────
const PT_WEIGHTS = [9, 8, 7, 6, 5, 4, 3, 2]

export function validateNIFPT(raw) {
  if (!raw) return { valid: false, reason: 'empty' }
  const clean = String(raw).replace(/[-\s.]/g, '')
  if (!/^[1-35-9]\d{8}$/.test(clean)) return { valid: false, reason: 'format' }
  const digits = clean.split('').map(Number)
  const sum = digits.slice(0, 8).reduce((acc, d, i) => acc + d * PT_WEIGHTS[i], 0)
  const res = sum % 11
  let expected = 11 - res
  if (expected >= 10) expected = 0
  const valid = expected === digits[8]
  return { valid, formatted: clean, checkDigit: expected, reason: valid ? null : 'checkDigit' }
}

// ────────────────────────────────────────────────────────────────────────
// Alemania — USt-IdNr: solo formato (ver nota del header). Prefijo "DE" +
// 9 dígitos. El dígito de control real solo lo puede confirmar VIES.
// ────────────────────────────────────────────────────────────────────────
export function validateVATFormatDE(raw) {
  if (!raw) return { valid: false, reason: 'empty' }
  const clean = String(raw).toUpperCase().replace(/[-\s]/g, '')
  const valid = /^DE\d{9}$/.test(clean)
  return {
    valid,
    formatted: clean,
    reason: valid ? null : 'format',
    checkedVia: 'format-only',
    note: 'DE no tiene checksum offline confiable acá — el dígito de control real solo lo confirma VIES.',
  }
}

// ────────────────────────────────────────────────────────────────────────
// Estados Unidos — EIN: sin equivalente de IVA, sin dígito verificador
// público. Solo formato XX-XXXXXXX.
// ────────────────────────────────────────────────────────────────────────
export function validateEINFormat(raw) {
  if (!raw) return { valid: false, reason: 'empty' }
  const clean = String(raw).replace(/[-\s]/g, '')
  const valid = /^\d{9}$/.test(clean)
  return {
    valid,
    formatted: valid ? `${clean.slice(0, 2)}-${clean.slice(2)}` : clean,
    reason: valid ? null : 'format',
    checkedVia: 'format-only',
    note: 'El IRS no publica un dígito verificador para el EIN — solo se valida el formato.',
  }
}

// ────────────────────────────────────────────────────────────────────────
// VIES — validación remota de IVA intracomunitario (ES/DE/PT y resto UE).
// Ver nota de CORS en el header de este archivo: desde el navegador de la
// app, esta llamada hoy falla por CORS. Queda lista para un futuro proxy.
// ────────────────────────────────────────────────────────────────────────
const VIES_BASE = 'https://ec.europa.eu/taxation_customs/vies/rest-api/ms'

export async function validateVIES(countryCode, vatNumber) {
  const cc = String(countryCode || '').toUpperCase()
  const num = String(vatNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!cc || !num) return { valid: false, reason: 'empty' }
  try {
    const res = await fetch(`${VIES_BASE}/${cc}/vat/${num}`)
    if (!res.ok) return { valid: false, reason: 'http_error', status: res.status }
    const data = await res.json()
    return {
      valid: !!data.isValid,
      name: data.name,
      address: data.address,
      requestDate: data.requestDate,
      userError: data.userError,
      raw: data,
    }
  } catch (err) {
    return { valid: null, reason: 'network_or_cors', error: String((err && err.message) || err) }
  }
}

// ────────────────────────────────────────────────────────────────────────
// Dispatcher — un solo punto de entrada por país. Países no cubiertos por
// el módulo fiscal de 8 países (CO/EC/PE/otros) devuelven unsupported_country.
// ────────────────────────────────────────────────────────────────────────
export function validateTaxId(countryCode, rawValue) {
  switch (String(countryCode || '').toUpperCase()) {
    case 'CL': return { ...validateRUT(rawValue), method: 'checksum' }
    case 'MX': return { ...validateRFC(rawValue), method: 'checksum' }
    case 'AR': return { ...validateCUIT(rawValue), method: 'checksum' }
    case 'VE': return { ...validateRIF(rawValue), method: 'checksum' }
    case 'ES': return { ...validateNIF(rawValue), method: 'checksum' }
    case 'PT': return { ...validateNIFPT(rawValue), method: 'checksum' }
    case 'DE': return { ...validateVATFormatDE(rawValue), method: 'format' }
    case 'US': return { ...validateEINFormat(rawValue), method: 'format' }
    default: return { valid: null, reason: 'unsupported_country', method: 'none' }
  }
}

// Países del módulo fiscal (8) que tienen algún tipo de validador acá.
export const TAX_ID_COUNTRIES = ['CL', 'MX', 'AR', 'VE', 'ES', 'PT', 'DE', 'US']

// Etiqueta local del identificador por país (para la UI).
export const TAX_ID_LABEL = {
  CL: 'RUT', MX: 'RFC', AR: 'CUIT', VE: 'RIF', ES: 'NIF', PT: 'NIF', DE: 'USt-IdNr', US: 'EIN',
}
