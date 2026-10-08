// src/demo/demoDates.js
// Fechas relativas al mes actual, compartidas por todas las personas del demo
// (Sofía en COP, la de EE. UU. en USD, la de Alemania en EUR).

// IDs fijos (no aleatorios — para consistencia entre renders y escenarios)
export const d = (suffix) => `demo-${suffix}`

const now = new Date()
const y0  = now.getFullYear()
const m0  = now.getMonth() + 1
const y1  = m0 === 1  ? y0 - 1 : y0;  const m1 = m0 === 1  ? 12 : m0 - 1
const y2  = m1 === 1  ? y1 - 1 : y1;  const m2 = m1 === 1  ? 12 : m1 - 1
const y3  = m2 === 1  ? y2 - 1 : y2;  const m3 = m2 === 1  ? 12 : m2 - 1
const y4  = m3 === 1  ? y3 - 1 : y3;  const m4 = m3 === 1  ? 12 : m3 - 1
const y5  = m4 === 1  ? y4 - 1 : y4;  const m5 = m4 === 1  ? 12 : m4 - 1
const pad = (n) => String(n).padStart(2, '0')
export const M0  = `${y0}-${pad(m0)}`
export const M1  = `${y1}-${pad(m1)}`
export const M2  = `${y2}-${pad(m2)}`
export const M3  = `${y3}-${pad(m3)}`
export const M4  = `${y4}-${pad(m4)}`
export const M5  = `${y5}-${pad(m5)}`
// Los 5 meses anteriores al actual, del más reciente al más viejo.
export const PAST_MONTHS = [M1, M2, M3, M4, M5]
export const day = (ym, dd) => `${ym}-${pad(dd)}`

export const nextMonthDate = (dd) => {
  const dt = new Date(y0, m0, dd)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}
export const nextYearDate = (month, dd) => `${y0 + 1}-${pad(month)}-${pad(dd)}`
