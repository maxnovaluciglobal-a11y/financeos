// src/pages/pdfTheme.js
// Marca de los PDF (reporte mensual y Modo Asesor, auditoría 360 BRD-8):
// IBM Plex Sans para el texto, Instrument Sans para títulos, Plex Mono para
// cifras y los colores de src/styles/tokens.js. Solo lo importan los PDF, que
// viven en el chunk perezoso pdf-*: no suma nada a la carga inicial.
// react-pdf no lee woff2: las fuentes van en TTF (public/fonts/pdf/, OFL) y se
// piden recién al generar un PDF.
import { Font } from '@react-pdf/renderer'
import { BRAND } from '../styles/tokens.js'

const base = `${import.meta.env?.BASE_URL || '/app/'}fonts/pdf/`

Font.register({
  family: 'Plex',
  fonts: [
    { src: `${base}IBMPlexSans-Regular.ttf`, fontWeight: 400 },
    { src: `${base}IBMPlexSans-SemiBold.ttf`, fontWeight: 600 },
    { src: `${base}IBMPlexSans-Bold.ttf`, fontWeight: 700 },
  ],
})
Font.register({
  family: 'PlexMono',
  fonts: [
    { src: `${base}IBMPlexMono-Regular.ttf`, fontWeight: 400 },
    { src: `${base}IBMPlexMono-SemiBold.ttf`, fontWeight: 600 },
  ],
})
Font.register({ family: 'Instrument', fonts: [{ src: `${base}InstrumentSans-SemiBold.ttf`, fontWeight: 600 }] })
// Sin guiones de corte: react-pdf parte palabras en español de forma rara.
Font.registerHyphenationCallback((word) => [word])

export const PDF_FONT = { body: 'Plex', mono: 'PlexMono', display: 'Instrument' }

export const PDF_COLOR = {
  navy: BRAND.navy,
  laton: BRAND.laton,
  laton700: BRAND.laton700,
  latonOnNavy: '#CC9A52', // --accent-dark: Latón para texto sobre Navy
  papel: BRAND.papel,
  page: BRAND.papel000,
  card: '#F5F2EA', // --sur2
  line: BRAND.papel200,
  ink: BRAND.navy,
  text: BRAND.ink,
  muted: BRAND.muted,
  faint: '#B8AC91', // --ceniza-300
  pos: BRAND.verde800,
  posMid: BRAND.verde,
  neg: BRAND.error,
  warn: BRAND.warning800,
  info: BRAND.info800,
  white: BRAND.white,
  posBg: 'rgba(53,110,87,0.09)',
  posLine: 'rgba(53,110,87,0.25)',
  negBg: 'rgba(162,62,46,0.08)',
  warnBg: 'rgba(201,122,61,0.12)',
  infoBg: 'rgba(91,122,153,0.12)',
  navySub: 'rgba(250,248,242,0.72)', // texto secundario sobre Navy
}
