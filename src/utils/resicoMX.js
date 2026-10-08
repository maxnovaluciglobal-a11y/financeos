// src/utils/resicoMX.js
// RESICO — Régimen Simplificado de Confianza (México), personas físicas.
// Fuente: Art. 113-E LISR, tasas 2026 (idénticas a 2025). NO constituye
// asesoría fiscal — el ISR real depende de tu situación completa ante el SAT.
//
// Trampa 1: la tasa NO es progresiva/marginal como el ISR normal. Se aplica
// sobre el 100% del ingreso mensual cobrado, según en qué tramo caiga el total.
// Cruzar un tramo por $1 sube la tasa de TODO el ingreso — un "efecto cliff"
// real que vale la pena advertir.
//
// Trampa 2 (Art. 113-J LISR): si le facturas a una persona moral, ella está
// obligada a retenerte 1.25% del pago (sin IVA) y enterarlo al SAT por ti.
// Esa retención NO es un impuesto extra: es un pago a cuenta acreditable
// contra el ISR causado del mes. Lo que realmente sale de tu bolsillo cuando
// declaras es ISR causado − retenciones. Si la retención supera al ISR causado
// (pasa en el primer tramo, donde la tasa 1.00% < 1.25% retenido), el mes
// cierra con saldo a favor, no con un pago.

export const TRAMOS_RESICO = [
  { hasta: 25000,     tasa: 0.0100 },
  { hasta: 50000,     tasa: 0.0110 },
  { hasta: 83333.33,  tasa: 0.0150 },
  { hasta: 208333.33, tasa: 0.0200 },
  { hasta: 3500000,   tasa: 0.0250 }, // tope RESICO: ingresos anuales ≤ $3.5M
]

export const TOPE_ANUAL_RESICO = 3500000 // MXN — arriba de esto, sales del régimen

// Art. 113-J LISR — retención obligatoria de personas morales a contribuyentes
// RESICO, sobre el monto del pago sin considerar IVA.
export const RETENCION_PERSONA_MORAL = 0.0125

/**
 * Calcula el ISR RESICO de un mes.
 *
 * @param {number|string} ingresoMensual  Ingreso cobrado del mes, sin IVA.
 * @param {object}  [opts]
 * @param {boolean} [opts.facturaAPersonaMoral=false]  Si el pagador retiene el 1.25%.
 * @param {number|null} [opts.ingresoAcumuladoAnual=null]  Ingresos reales acumulados
 *        del ejercicio en curso. La regla del SAT para el tope de $3.5M es sobre
 *        ingresos acumulados del ejercicio (actual o anterior), NO sobre una
 *        proyección de un mes puntual. Si no se pasa este dato, se cae a la
 *        proyección lineal ingreso×12 y se marca `topeEsProyeccion: true` para
 *        que la UI no la presente como el cálculo real de superación de tope.
 */
export function calcResico(ingresoMensual, opts = {}) {
  const ingreso = Number(ingresoMensual) || 0
  if (ingreso <= 0) return null

  const { facturaAPersonaMoral = false, ingresoAcumuladoAnual = null } = opts

  const ultimoTramo = TRAMOS_RESICO[TRAMOS_RESICO.length - 1]
  const tramo = TRAMOS_RESICO.find(t => ingreso <= t.hasta) || ultimoTramo
  const tramoIdx = TRAMOS_RESICO.indexOf(tramo)
  const siguienteTramo = TRAMOS_RESICO[tramoIdx + 1]

  // ── ISR causado, retención y lo que realmente se paga ──
  // Se redondea cada componente ANTES de restar para que los tres números que
  // ve el usuario reconcilien exactamente (causado − retención = a pagar).
  const isrCausado = Math.round(ingreso * tramo.tasa)
  const retencion = facturaAPersonaMoral ? Math.round(ingreso * RETENCION_PERSONA_MORAL) : 0
  const diferencia = isrCausado - retencion

  // El costo económico del mes sigue siendo el ISR causado: la retención ya es
  // parte de él, no se suma aparte.
  const neto = ingreso - isrCausado

  // ── Tope anual del régimen ──
  const acumulado = Number(ingresoAcumuladoAnual)
  const topeEsProyeccion = !(acumulado > 0)
  const baseTope = topeEsProyeccion ? ingreso * 12 : acumulado

  return {
    ingreso,
    tasa: tramo.tasa,
    isrCausado,
    retencion,
    conRetencion: facturaAPersonaMoral,
    aPagar: Math.max(0, diferencia),
    saldoAFavor: Math.max(0, -diferencia),
    neto: Math.round(neto),
    tramoIdx,
    // El ingreso ya excede el último tramo de la tabla: está fuera de RESICO.
    fueraDeTabla: ingreso > ultimoTramo.hasta,
    margenEnTramo: Math.max(0, Math.round(tramo.hasta - ingreso)),
    siguienteTasa: siguienteTramo?.tasa ?? null,
    ingresoAnualProyectado: Math.round(ingreso * 12),
    baseTope: Math.round(baseTope),
    topeEsProyeccion,
    superaTope: baseTope > TOPE_ANUAL_RESICO,
  }
}
