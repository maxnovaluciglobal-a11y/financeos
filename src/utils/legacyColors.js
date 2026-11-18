// src/utils/legacyColors.js — colores guardados con la marca anterior.
//
// Hasta la Entrega 1 del rebranding (nov-2026) las metas guardaban su color en
// IndexedDB con la paleta "El Instrumento" (Navy, Latón, Verde, Ceniza…), y los
// respaldos JSON y los blobs del sync los traen igual. Sin conversión, una
// meta vieja se vería en Latón dentro de una interfaz morada.
//
// No se migra la base (sería un paso de migración irreversible para un dato
// cosmético): se convierte al LEER (rehidratar), al IMPORTAR un respaldo y al
// recibir el sync (los dos pasan por importAllData). El mapeo es por familia de
// tono para que dos metas que se distinguían por color se sigan distinguiendo.
// Todas las funciones son puras e idempotentes: un color nuevo no cambia.
//
// Este archivo es la única excepción a "0 hex de la marca anterior en src/"
// (tokens.test.js): los hex viejos aparecen solo como claves de este mapa.

export const LEGACY_COLOR_MAP = Object.freeze({
  // Navy → morado
  '#14213D': '#3C2282',   // navy → purple-700
  '#1C2A4A': '#2D1964',   // navy-700 → purple-800
  '#4A5875': '#8169C6',   // navy-400 → purple-400
  '#0E1628': '#1C1D21',   // fondo oscuro → grafito
  // Latón → ámbar (sigue siendo el tono cálido de la paleta)
  '#B8863B': '#B07414',   // laton → amber-600
  '#E3C592': '#F5A524',   // laton-300 → amber-500
  '#8A6329': '#9A5B00',   // laton-700 → amber-700
  '#CC9A52': '#A897DA',   // accent-dark → purple-300
  '#E3B36B': '#F5A524',   // accent-dark-hover → amber-500
  // Verde
  '#5FA98C': '#1FB57A',   // verde → green-500
  '#356E57': '#0E7A50',   // verde-800 → green-700
  '#74C2A3': '#47C292',   // verde-dark → green-300
  // Ceniza → grises
  '#8B7A55': '#6B6F78',   // ceniza → gray-600
  '#5F5236': '#3F4249',   // ceniza-700 → gray-700
  '#B8AC91': '#A3A7AE',   // ceniza-300 → gray-400
  '#888780': '#878B93',   // gris de respaldo de config → gray-500
  // Aviso, error, info
  '#C97A3D': '#F5A524',   // warning → amber-500
  '#8A4A14': '#9A5B00',   // warning-800 → amber-700
  '#E0975A': '#F5A524',   // warning-dark → amber-500
  '#A23E2E': '#E5484D',   // error → red-500
  '#E59580': '#F07A7E',   // error-dark → red-400
  '#5B7A99': '#0E8C8C',   // info → teal-600
  '#3E5A78': '#6045AE',   // info-800 → purple-500
  '#89A6C2': '#2BB3B3',   // info-dark → teal-400
  '#8FB3D6': '#A897DA',   // categórico oscuro → purple-300
  // Papel → superficies
  '#F1EEE6': '#F4F1FB',   // papel → purple-50
  '#FAF8F2': '#FFFFFF',   // papel-000 → blanco
  '#E4DFD1': '#E6E0F5',   // papel-200 → purple-100
  '#F5F2EA': '#F4F1FB',   // sur2 → purple-50
})

const SHORT = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i

// Un color (hex de 3 o 6 dígitos, cualquier caja) → su equivalente nuevo.
// Lo que no es un hex viejo vuelve tal cual (incluido undefined).
export function convertLegacyColor(color) {
  if (typeof color !== 'string') return color
  let key = color.trim().toUpperCase()
  const m = key.match(SHORT)
  if (m) key = `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`
  return Object.prototype.hasOwnProperty.call(LEGACY_COLOR_MAP, key) ? LEGACY_COLOR_MAP[key] : color
}

// Lista con campo `color` (metas). Devuelve la lista nueva (mismos objetos si no
// cambian) y solo los registros que cambiaron.
export function convertColorList(list) {
  if (!Array.isArray(list)) return { list, changed: [] }
  const changed = []
  const out = list.map(r => {
    if (!r || typeof r !== 'object') return r
    const next = convertLegacyColor(r.color)
    if (next === r.color) return r
    const item = { ...r, color: next }
    changed.push(item)
    return item
  })
  return { list: changed.length ? out : list, changed }
}

// Payload de respaldo / sync (formato de exportAllData). Copia nueva solo si
// algo cambia.
export function convertLegacyColorPayload(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.goals)) return data
  const { list, changed } = convertColorList(data.goals)
  return changed.length ? { ...data, goals: list } : data
}
