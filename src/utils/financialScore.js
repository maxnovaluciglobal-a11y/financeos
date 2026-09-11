// src/utils/financialScore.js
// IQ Score — puntaje de salud financiera 0-100. Migrado al modelo del brand
// book de MOY IQ: 5 factores con pesos NO uniformes (el modelo anterior era
// 5 × 20pts parejos; ver historial de este archivo en git para esa versión):
//   1. Flujo de caja          — 30 pts
//   2. Colchón de emergencia  — 20 pts
//   3. Carga de deuda         — 20 pts
//   4. Progreso de metas      — 15 pts
//   5. Consistencia de datos  — 15 pts
// Resultado es orientativo — no constituye asesoría financiera.

import { translations } from '../i18n/translations.js'
import { personalDebtRatio } from './personal.js'
import { COACH_CONFIG } from '../data/coachRules.js'
import { findEmergencyGoal } from './emergencyGoal.js'

function esFallback(key) { return translations.es?.[key] ?? key }

export function calcFinancialScore({
  savingRate, expenses, debts, goals, incomes, activeMonth,
  syncEnabled, lastSyncAt, now,
}, t) {
  const tr = t || esFallback
  let score = 0
  const breakdown = []

  const expArr = Array.isArray(expenses) ? expenses : []
  const incArr = Array.isArray(incomes) ? incomes : []
  const monthExp = expArr.filter(e => e?.date?.startsWith(activeMonth))
  const monthlyExpense = monthExp.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const monthlyIncome = incArr
    .filter(r => r?.date?.startsWith(activeMonth))
    .reduce((s, r) => s + (Number(r.amount) || 0), 0)

  // 1. Flujo de caja (0-30) — misma señal que la vieja "tasa de ahorro"
  // (balance/ingreso del mes activo, ya calculado en Dashboard como
  // kpis.savingRate), reescalada de 20 a 30 pts con un escalón intermedio
  // nuevo. Umbrales reusados de COACH_CONFIG (savingsRateGood/Warn) en vez
  // de inventar otros: es el mismo criterio de "bueno"/"atención" que ya
  // usa el Coach para la misma métrica.
  const sr = Number(savingRate) || 0
  const { savingsRateGood, savingsRateWarn } = COACH_CONFIG.thresholds
  const cashFlowPts = sr >= savingsRateGood ? 30 : sr >= savingsRateWarn ? 20 : sr >= 0 ? 10 : 0
  score += cashFlowPts
  breakdown.push({ label: tr('score.cashFlow'), pts: cashFlowPts, max: 30 })

  // 2. Colchón de emergencia (0-20) — factor NUEVO del brand book, sin
  // equivalente en el modelo anterior. Reusa la detección de meta de
  // emergencia por nombre (findEmergencyGoal, utils/emergencyGoal.js) y los
  // mismos umbrales de "meses de gasto cubiertos" que ya usa el Coach
  // (emergencyFundMonthsGood/Warn) — así el Coach y el score nunca dicen
  // cosas distintas sobre el mismo fondo.
  const emergencyGoal = findEmergencyGoal(goals)
  const emergencyMonths = emergencyGoal && monthlyExpense > 0
    ? (Number(emergencyGoal.saved) || 0) / monthlyExpense
    : 0
  const { emergencyFundMonthsGood, emergencyFundMonthsWarn } = COACH_CONFIG.thresholds
  const emergencyPts = emergencyMonths >= emergencyFundMonthsGood ? 20
    : emergencyMonths >= emergencyFundMonthsWarn ? 10
    : emergencyMonths > 0 ? 5
    : 0
  score += emergencyPts
  breakdown.push({ label: tr('score.emergencyCushion'), pts: emergencyPts, max: 20 })

  // 3. Carga de deuda (0-20) — SIN CAMBIOS de lógica ni de peso: ya era
  // 20pts (=20%) en el modelo anterior y coincide con el brand book.
  // personalDebtRatio() es la fuente única compartida con el Modo Asesor
  // y el Coach (ver utils/personal.js).
  const annualIncome = monthlyIncome * 12
  const { totalDebt, ratio: debtLoad } = personalDebtRatio(debts, annualIncome)
  const debtPts = totalDebt === 0 ? 20 : debtLoad < 0.20 ? 15 : debtLoad < 0.50 ? 10 : 0
  score += debtPts
  breakdown.push({ label: tr('score.debtLoad'), pts: debtPts, max: 20 })

  // 4. Progreso de metas (0-15) — misma lógica que el viejo factor "Metas
  // activas" (20pts: ≥1 meta con progreso→máximo, hay metas sin progreso→
  // mitad, sin metas→0), reescalada a 15.
  const goalArr = Array.isArray(goals) ? goals : []
  const goalsWithProgress = goalArr.filter(g => Number(g.saved) > 0).length
  const goalPts = goalsWithProgress > 0 ? 15 : goalArr.length > 0 ? 7 : 0
  score += goalPts
  breakdown.push({ label: tr('score.goalsProgress'), pts: goalPts, max: 15 })

  // 5. Consistencia de datos (0-15) — factor NUEVO del brand book, sin
  // equivalente previo. No existe una señal real de "% de cuentas
  // sincronizadas" (FinanceOS no tiene bank-linking desde que se retiró
  // Plaid — ver memoria financeos_audit_plaid_valor_20260821), así que se
  // construye con DOS señales reales que sí existen hoy:
  //   a) % de movimientos categorizados: los importados sin columna de
  //      categoría mapeada caen al literal 'Importado' (ver
  //      Import/fileParser.js) — cuenta expenses+incomes combinados. 9pts.
  //   b) antigüedad del último sync a la nube (core/sync.js: syncMeta()).
  //      El sync es opt-in y apagado por defecto (DNA privacy-first) — NO
  //      tenerlo activado no es "inconsistencia de datos", es una elección
  //      de privacidad válida, así que ese sub-puntaje queda neutral
  //      (máximo) cuando el usuario nunca lo activó en vez de castigarlo.
  //      6pts. syncEnabled/lastSyncAt se calculan en el call site
  //      (Dashboard) para mantener esta función pura y testeable sin tocar
  //      localStorage acá.
  const allRecords = [...expArr, ...incArr]
  const importedCount = allRecords.filter(r => r?.category === 'Importado').length
  const categorizedRatio = allRecords.length > 0 ? 1 - importedCount / allRecords.length : 1
  const catPts = categorizedRatio >= 0.95 ? 9 : categorizedRatio >= 0.80 ? 6 : categorizedRatio >= 0.50 ? 3 : 0

  const nowMs = typeof now === 'number' ? now : Date.now()
  let syncPts
  if (!syncEnabled) {
    syncPts = 6 // local-only por elección — no aplica, no se penaliza
  } else if (!lastSyncAt) {
    syncPts = 0 // activado pero nunca corrió un sync — sí es dato desactualizado
  } else {
    const ageDays = (nowMs - lastSyncAt) / 86400000
    syncPts = ageDays <= 1 ? 6 : ageDays <= 7 ? 3 : 0
  }
  const consistencyPts = catPts + syncPts
  score += consistencyPts
  breakdown.push({ label: tr('score.dataConsistency'), pts: consistencyPts, max: 15 })

  const label = score >= 80 ? tr('score.excellent') : score >= 60 ? tr('score.good') : score >= 40 ? tr('score.fair') : tr('score.critical')
  const color = score >= 80 ? 'var(--pos)' : score >= 60 ? 'var(--pos)' : score >= 40 ? 'var(--amb)' : 'var(--red)'

  return { score, label, color, breakdown }
}
