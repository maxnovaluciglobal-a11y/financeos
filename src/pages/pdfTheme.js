// src/pages/pdfTheme.js
// Marca de los PDF (reporte mensual y Modo Asesor, auditoría 360 BRD-8),
// rebranding moyiq (Entrega 1): Inter 4.1 en todo (texto, títulos y cifras) y
// los colores de src/styles/tokens.js. Solo lo importan los PDF, que viven en
// el chunk perezoso pdf-*: no suma nada a la carga inicial.
// react-pdf no lee woff2 ni deja activar rasgos OpenType: las fuentes van en
// TTF estático (public/fonts/pdf/, del zip oficial Inter 4.1, OFL) con las
// cifras tabulares (tnum) ya fijadas en el cmap y subset latin + latin-ext
// (4 idiomas, "−" U+2212 y espacio fino U+202F incluidos). Se piden recién al
// generar un PDF.
import { Font } from '@react-pdf/renderer'
import { BRAND } from '../styles/tokens.js'

const base = `${import.meta.env?.BASE_URL || '/app/'}fonts/pdf/`

Font.register({
  family: 'Inter',
  fonts: [
    { src: `${base}Inter-Regular.ttf`, fontWeight: 400 },
    { src: `${base}Inter-Medium.ttf`, fontWeight: 500 },
    { src: `${base}Inter-SemiBold.ttf`, fontWeight: 600 },
    { src: `${base}Inter-Bold.ttf`, fontWeight: 700 },
  ],
})
// Sin guiones de corte: react-pdf parte palabras en español de forma rara.
Font.registerHyphenationCallback((word) => [word])

// Una sola familia (D2). mono: identificadores (clave, IBAN), con la Courier
// estándar de PDF (no se descarga nada).
export const PDF_FONT = { body: 'Inter', num: 'Inter', mono: 'Courier', display: 'Inter' }

export const PDF_COLOR = {
  brand: BRAND.purple,          // cabecera, títulos de marca, numerales
  brandText: BRAND.purple,      // texto de marca sobre blanco (12,05:1)
  brandBg: BRAND.purple50,      // recuadros de notas
  lime: BRAND.lime,             // acento sobre la cabecera morada (9,4:1)
  onBrandSub: 'rgba(255,255,255,0.84)', // texto secundario sobre la cabecera morada
  page: BRAND.white,
  card: BRAND.purple50,
  line: BRAND.purple100,
  ink: BRAND.graphite,
  text: BRAND.ink,
  muted: BRAND.muted,
  faint: BRAND.gray400,
  pos: BRAND.incomeText,
  posMid: BRAND.income,
  neg: BRAND.overText,
  warn: BRAND.warnText,
  info: BRAND.purple500,
  white: BRAND.white,
  posBg: 'rgba(31,181,122,0.10)',
  posLine: 'rgba(14,122,80,0.25)',
  negBg: 'rgba(229,72,77,0.10)',
  warnBg: 'rgba(245,165,36,0.12)',
  infoBg: 'rgba(96,69,174,0.10)',
}

// Paleta categórica de las barras del reporte (mismo orden de roles que --cat-*).
export const PDF_CAT_COLORS = [
  BRAND.purple, BRAND.purple400, BRAND.income, BRAND.warn, BRAND.teal,
  BRAND.over, BRAND.purple300, BRAND.muted, BRAND.violet, BRAND.ink,
]

// ¿El reporte va con la marca propia? (acepta el nombre anterior mientras
// config.app.name cambia a "moyiq" en la rama de textos).
export const isOwnBrand = (name) => /^moy\s?iq$/i.test(String(name || '').trim())
