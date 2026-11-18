// src/styles/tokens.js
// Paleta de moyiq (v3.1, nivel 3) para lo que no puede leer variables CSS: PDF
// de react-pdf, metadatos, colores guardados en datos (metas, categorías).
// Copia exacta de los hex de los primitivos de src/styles/tokens.css:
// tokens.test.js falla si se desalinean. Para color en la interfaz, usar
// siempre var(--…) en CSS o en estilos inline.

export const TOKENS_LIGHT = {
  '--purple-50': '#F4F1FB',
  '--purple-100': '#E6E0F5',
  '--purple-200': '#CBBFEA',
  '--purple-300': '#A897DA',
  '--purple-400': '#8169C6',
  '--purple-500': '#6045AE',
  '--purple-600': '#4D3299',
  '--purple-700': '#3C2282',
  '--purple-800': '#2D1964',
  '--purple-900': '#1E1044',
  '--violet-500': '#7A21FF',
  '--violet-400': '#9A5CFF',
  '--gray-0': '#FFFFFF',
  '--gray-50': '#FAFAFA',
  '--gray-100': '#F3F4F5',
  '--gray-200': '#E6E7EA',
  '--gray-300': '#CDD0D4',
  '--gray-400': '#A3A7AE',
  '--gray-500': '#878B93',
  '--gray-600': '#6B6F78',
  '--gray-700': '#3F4249',
  '--gray-800': '#2A2C31',
  '--gray-900': '#1C1D21',
  '--lime-400': '#D0F06E',
  '--green-300': '#47C292',
  '--green-500': '#1FB57A',
  '--green-600': '#17975F',
  '--green-700': '#0E7A50',
  '--red-300': '#F09598',
  '--red-400': '#F07A7E',
  '--red-500': '#E5484D',
  '--red-700': '#C2272D',
  '--amber-500': '#F5A524',
  '--amber-600': '#B07414',
  '--amber-700': '#9A5B00',
  '--teal-600': '#0E8C8C',
  '--teal-400': '#2BB3B3',
  '--green-tint': '#E9F8F2',
  '--red-tint': '#FDF0F0',
  '--amber-tint': '#FEF6E9',
  '--green-tint-dark': '#243A35',
  '--red-tint-dark': '#3F2C30',
  '--amber-tint-dark': '#403829',
  '--impulso-0': '#2D1D59',
  '--impulso-59': '#8620D0',
  '--impulso-100': '#7A21FF',
  '--profundidad-0': '#2D1D59',
  '--profundidad-100': '#3C0097',
}

// El bloque oscuro de tokens.css no define hex propios: reusa los primitivos.
export const TOKENS_DARK = {}

// Nombres cortos para el código (PDF, pantalla de error, colores por defecto).
export const BRAND = {
  purple: TOKENS_LIGHT['--purple-700'],
  purple50: TOKENS_LIGHT['--purple-50'],
  purple100: TOKENS_LIGHT['--purple-100'],
  purple300: TOKENS_LIGHT['--purple-300'],
  purple400: TOKENS_LIGHT['--purple-400'],
  purple500: TOKENS_LIGHT['--purple-500'],
  purple800: TOKENS_LIGHT['--purple-800'],
  violet: TOKENS_LIGHT['--violet-500'],
  lime: TOKENS_LIGHT['--lime-400'],
  graphite: TOKENS_LIGHT['--gray-900'],
  gray50: TOKENS_LIGHT['--gray-50'],
  gray100: TOKENS_LIGHT['--gray-100'],
  gray200: TOKENS_LIGHT['--gray-200'],
  gray300: TOKENS_LIGHT['--gray-300'],
  gray400: TOKENS_LIGHT['--gray-400'],
  ink: TOKENS_LIGHT['--gray-700'],
  muted: TOKENS_LIGHT['--gray-600'],
  income: TOKENS_LIGHT['--green-600'],
  incomeText: TOKENS_LIGHT['--green-700'],
  over: TOKENS_LIGHT['--red-500'],
  overText: TOKENS_LIGHT['--red-700'],
  warn: TOKENS_LIGHT['--amber-600'],
  warnText: TOKENS_LIGHT['--amber-700'],
  teal: TOKENS_LIGHT['--teal-600'],
  white: '#FFFFFF',
}

// Fuera de la paleta pero permitidos: blanco puro abreviado.
export const EXTRA_ALLOWED_HEX = ['#FFF', '#FFFFFF']
