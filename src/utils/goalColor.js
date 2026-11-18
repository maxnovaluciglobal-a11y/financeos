// src/utils/goalColor.js — color de una meta pintado como objeto (barra de
// progreso). Las metas guardan un hex propio; el de una meta nueva es el
// morado de marca #3C2282, que es también la conversión del Navy anterior
// (legacyColors.js). Sobre el grafito del tema oscuro ese morado da 1,40:1, y
// un objeto necesita 3:1 (WCAG 1.4.11). En oscuro se devuelve una variante
// legible: los morados de marca pasan a morado 300 y cualquier otro hex
// oscuro se aclara hacia blanco lo justo para llegar a 3:1 sobre el fondo y
// sobre la superficie. En claro el color guardado se usa tal cual.

// Fondo y superficie del tema oscuro (tokens.css: --gray-900, --gray-800).
export const DARK_SURFACES = ['#1C1D21', '#2A2C31']
export const MIN_OBJECT_CONTRAST = 3
const BRAND_DARK = { '#3C2282': '#A897DA', '#2D1964': '#A897DA' } // → --purple-300

function rgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function lum([r, g, b]) {
  const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export function contrast(a, b) {
  const la = lum(rgb(a)), lb = lum(rgb(b))
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
const toHex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()
const readable = hex => DARK_SURFACES.every(s => contrast(hex, s) >= MIN_OBJECT_CONTRAST)

export function goalDisplayColor(hex, dark) {
  const c = rgb(hex)
  if (!dark || !c) return hex
  const up = toHex(c)
  if (BRAND_DARK[up]) return BRAND_DARK[up]
  if (readable(up)) return hex
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const mixed = toHex(c.map(v => v + (255 - v) * t))
    if (readable(mixed)) return mixed
  }
  return '#FFFFFF'
}
