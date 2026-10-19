// src/utils/csvSafe.js — celdas de CSV a prueba de inyección de fórmulas
// (DAT-15). Un texto que empieza con = + - @ (o tabulador / retorno) lo
// ejecuta Excel o Sheets como fórmula al abrir el archivo; con un apóstrofo
// delante se muestra como texto. Los números se dejan tal cual: un monto
// negativo tiene que seguir siendo un número.
const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(value) {
  if (value === null || value === undefined) return '""'
  if (typeof value === 'number') return `"${String(value)}"`
  let s = String(value)
  if (FORMULA_START.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

export function toCsv(rows) {
  return rows.map(r => r.map(csvCell).join(',')).join('\n')
}
