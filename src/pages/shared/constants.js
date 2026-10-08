// src/pages/shared/constants.js
// Constantes compartidas entre módulos de páginas
import { monthYearLabel } from '../../utils/index.js'

export const CURRENCY_SYMBOLS = { CLP: '$', USD: 'US$', EUR: '€', VES: 'Bs.', MXN: '$', ARS: '$', COP: '$', PEN: 'S/', PYG: '₲', UYU: '$U', BRL: 'R$' }
export const CURRENCY_OPTIONS  = [
  { code: 'CLP', label: 'CLP — Peso chileno' },
  { code: 'USD', label: 'USD — Dólar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'MXN', label: 'MXN — Peso mexicano' },
  { code: 'ARS', label: 'ARS — Peso argentino' },
  { code: 'COP', label: 'COP — Peso colombiano' },
  { code: 'PEN', label: 'PEN — Sol peruano' },
  { code: 'BRL', label: 'BRL — Real brasileño' },
  { code: 'UYU', label: 'UYU — Peso uruguayo' },
  { code: 'VES', label: 'VES — Bolívar' },
]

// Tasas orientativas de referencia (1 USD = X moneda local) — el usuario las ajusta
export const DEFAULT_USD_RATES = {
  CLP: 950, MXN: 17.5, ARS: 1000, COP: 4100, PEN: 3.75,
  BRL: 5.0, UYU: 39, VES: 36, EUR: 0.92, USD: 1,
}
// 'YYYY-MM' → "Mar 2026" en el idioma de la interfaz (dateLocale, que
// AppContext/DemoContext fijan con settings.language).
export const monthLabel = (m) => monthYearLabel(m)

// Nombre de una moneda en el idioma de la interfaz ("CLP · Chilean Peso").
export function currencyOptionLabel(code, lang) {
  try {
    const name = new Intl.DisplayNames([lang || 'es'], { type: 'currency' }).of(code)
    return name && name !== code ? `${code} — ${name}` : code
  } catch { return code }
}
