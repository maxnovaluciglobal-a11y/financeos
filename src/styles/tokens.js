// src/styles/tokens.js
// Paleta de MOY IQ para lo que no puede leer variables CSS (PDF de react-pdf,
// metadatos, colores guardados en datos). Copia exacta de los hex de
// src/styles/tokens.css: tokens.test.js falla si se desalinean. Para color en
// la interfaz, usar siempre var(--…) en CSS o en estilos inline.

export const TOKENS_LIGHT = {
  '--navy': '#14213D',
  '--navy-700': '#1C2A4A',
  '--navy-400': '#4A5875',
  '--laton': '#B8863B',
  '--laton-300': '#E3C592',
  '--laton-700': '#8A6329',
  '--accent-dark': '#CC9A52',
  '--accent-dark-hover': '#E3B36B',
  '--papel': '#F1EEE6',
  '--papel-000': '#FAF8F2',
  '--papel-200': '#E4DFD1',
  '--verde': '#5FA98C',
  '--verde-800': '#356E57',
  '--verde-dark': '#74C2A3',
  '--ceniza': '#8B7A55',
  '--ceniza-700': '#5F5236',
  '--ceniza-300': '#B8AC91',
  '--warning': '#C97A3D',
  '--warning-800': '#8A4A14',
  '--warning-dark': '#E0975A',
  '--error': '#A23E2E',
  '--error-dark': '#E0826E',
  '--info': '#5B7A99',
  '--info-800': '#3E5A78',
  '--info-dark': '#89A6C2',
  '--sur2': '#F5F2EA',
  '--tm': '#4A4739',
  '--th': '#63604F',
}

export const TOKENS_DARK = {
  '--bg': '#12161F',
  '--sur': '#181D29',
  '--sur2': '#1D2331',
  '--sur3': '#242B3B',
  '--tm': '#C7C2B2',
  '--th': '#9C9784',
  '--cat-5': '#8FB3D6',
}

// Nombres cortos para el código.
export const BRAND = {
  navy: TOKENS_LIGHT['--navy'],
  navy400: TOKENS_LIGHT['--navy-400'],
  laton: TOKENS_LIGHT['--laton'],
  laton700: TOKENS_LIGHT['--laton-700'],
  papel: TOKENS_LIGHT['--papel'],
  papel000: TOKENS_LIGHT['--papel-000'],
  papel200: TOKENS_LIGHT['--papel-200'],
  verde: TOKENS_LIGHT['--verde'],
  verde800: TOKENS_LIGHT['--verde-800'],
  ceniza: TOKENS_LIGHT['--ceniza'],
  ceniza700: TOKENS_LIGHT['--ceniza-700'],
  warning: TOKENS_LIGHT['--warning'],
  warning800: TOKENS_LIGHT['--warning-800'],
  error: TOKENS_LIGHT['--error'],
  info: TOKENS_LIGHT['--info'],
  info800: TOKENS_LIGHT['--info-800'],
  ink: TOKENS_LIGHT['--tm'],
  muted: TOKENS_LIGHT['--th'],
  white: '#FFFFFF',
}

// Fuera de la paleta pero permitidos: blanco puro (texto sobre Navy/rojo).
export const EXTRA_ALLOWED_HEX = ['#FFF', '#FFFFFF']
