// @ts-check
// FIN-15: sumar meses con Date#setMonth desborda en los días 29-31
// (31-ene + 1 mes = 3-mar). Para fechas "de mes" (fin de una deuda, fecha
// objetivo de una meta) se ancla al día 1 antes de sumar.

/**
 * Primer día del mes que está `n` meses después del mes de `from`.
 * @param {Date} from
 * @param {number} n
 * @returns {Date}
 */
export function monthsAheadFirstDay(from, n) {
  return new Date(from.getFullYear(), from.getMonth() + (Number(n) || 0), 1)
}
