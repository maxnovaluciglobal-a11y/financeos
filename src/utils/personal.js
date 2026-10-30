// src/utils/personal.js
// Marca de "inversión" en transacciones (ingresos/egresos).
// Un movimiento marcado como inversión (r.inv === true) representa flujo de un activo
// de inversión (ej. propiedad en arriendo, hipoteca de esa propiedad) y NO debe
// distorsionar el presupuesto ni la tasa de ahorro personal.

import { isOwed } from './debtDirection.js'

export const isInvestment = (r) => !!(r && r.inv)

// Devuelve solo los movimientos personales (excluye los marcados como inversión).
export const excludeInvestment = (arr) => (arr || []).filter((r) => !r?.inv)

// ── Deudas sin duplicar ────────────────────────────────────────────────────────
// Problema que resuelve: el "Disponible / tras deudas y subs" restaba SIEMPRE la
// suma de cuotas mínimas de TODAS las deudas, aunque:
//   (a) la deuda esté vinculada a una propiedad (d.project) — su cuota pertenece
//       al ámbito de inversión (ya reflejada en el flujo de Propiedades), no al
//       presupuesto personal; y/o
//   (b) el pago del mes ya se haya registrado como egreso (botón "Registrar pago"
//       crea un gasto con categoría 'Deudas') — restarlo otra vez lo duplicaba.

// Deudas del ámbito personal: excluye las vinculadas a una propiedad/proyecto.
// "Me deben" (D2, direction 'owed') es un activo: nunca entra en la carga de
// deuda del IQ Score, del Asesor ni del Coach (utils/debtDirection.js).
export const personalDebts = (debts) => (debts || []).filter((d) => !isOwed(d) && !(d?.project || '').trim())

// Cuota mensual de deuda personal AÚN NO reflejada como gasto del mes activo:
// suma de pagos mínimos (solo deudas personales) menos los pagos ya registrados
// este mes como egresos de categoría 'Deudas' (nunca negativo).
export function pendingDebtMonthly(debts, monthExpenses) {
  const minTotal = personalDebts(debts).reduce((s, d) => s + (Number(d.minPayment) || 0), 0)
  const paid = (monthExpenses || [])
    .filter((e) => e?.category === 'Deudas')
    .reduce((s, e) => s + (Number(e.amount) || 0), 0)
  return Math.max(0, minTotal - paid)
}

// ── Ratio de deuda personal ──────────────────────────────────────────────────
// Fuente única para el score, el Modo Asesor y el Coach — antes cada uno tenía
// su propio cálculo, con dos bugs distintos:
//  (a) sumaban TODA la deuda, incluida la de propiedades de inversión (cuyo
//      dividendo ya se refleja en el flujo de esa propiedad, no en el bolsillo
//      personal) — infla el ratio de alguien con una hipoteca de inversión sana;
//  (b) con ingreso $0, unos daban ratio 0 ("sin carga") y otros ratio 1 ("carga
//      máxima") para la MISMA situación — Modo Asesor mostraba "Saludable" en
//      verde mientras el score daba 0 de 20 puntos.
// Convención correcta: ingreso $0 + deuda personal > 0 es el escenario de MÁS
// riesgo, no de menos — así que el ratio debe ser el máximo (1), no 0.
//
// Desde el 19-oct-2026 (auditoría 360, FIN-11; D-13) la carga se mide como
// SERVICIO de la deuda: cuotas mínimas mensuales de las deudas personales con
// saldo ÷ ingreso mensual (DTI). El saldo total contra el ingreso anual
// castigaba cualquier hipoteca con dividendo sano. Umbrales únicos en
// COACH_CONFIG.thresholds (debtLoadWarn 30 %, debtLoadHigh 40 %).
export function personalDebtRatio(debts, monthlyIncome) {
  const active = personalDebts(debts).filter(d => (Number(d.balance) || 0) > 0)
  const totalDebt = active.reduce((s, d) => s + (Number(d.balance) || 0), 0)
  const monthlyPayments = active.reduce((s, d) => s + (Number(d.minPayment) || 0), 0)
  const ratio = monthlyIncome > 0 ? monthlyPayments / monthlyIncome : (monthlyPayments > 0 ? 1 : 0)
  return { totalDebt, monthlyPayments, ratio }
}
