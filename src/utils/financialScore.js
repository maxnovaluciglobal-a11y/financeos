// src/utils/financialScore.js
// Puntaje de salud financiera 0-100 basado en 5 componentes de 20 pts c/u
// Resultado es orientativo — no constituye asesoría financiera.

import { translations } from '../i18n/translations.js'
import { effectiveBudgetLimits } from './budgets.js'
import { personalDebtRatio } from './personal.js'

function esFallback(key) { return translations.es?.[key] ?? key }

export function calcFinancialScore({ savingRate, budgets, expenses, debts, goals, subs, incomes, activeMonth, settings }, t) {
  const tr = t || esFallback
  let score = 0
  const breakdown = []

  // 1. Tasa de ahorro (0-20)
  // 20pts = ≥20%, 10pts = 5-19%, 5pts = 0-4.9%, 0pts = negativa
  const sr = Number(savingRate) || 0
  const srPts = sr >= 0.20 ? 20 : sr >= 0.05 ? 10 : sr >= 0 ? 5 : 0
  score += srPts
  breakdown.push({ label: tr('score.savingRate'), pts: srPts, max: 20 })

  // 2. Control de presupuestos (0-20)
  // 20pts = ningún presupuesto excedido, -4 por cada uno excedido
  const monthExp = Array.isArray(expenses) ? expenses.filter(e => e?.date?.startsWith(activeMonth)) : []
  const expByCat = {}
  monthExp.forEach(e => { expByCat[e.category] = (expByCat[e.category] || 0) + (Number(e.amount) || 0) })
  const budgetArr = Array.isArray(budgets) ? budgets : []
  const effLimits = effectiveBudgetLimits({ budgets: budgetArr, expenses, activeMonth, settings })
  const exceeded = budgetArr.filter(b => (expByCat[b.category] || 0) > (effLimits[b.category] || 0)).length
  const budgetPts = Math.max(0, 20 - exceeded * 5)
  score += budgetPts
  breakdown.push({ label: tr('score.budgets'), pts: budgetPts, max: 20 })

  // 3. Carga de deuda (0-20)
  // 20pts = sin deuda, 15pts = <20% ingreso anual, 10pts = 20-50%, 0pts = >50%
  const monthlyIncome = Array.isArray(incomes)
    ? incomes.filter(r => r?.date?.startsWith(activeMonth)).reduce((s, r) => s + (Number(r.amount) || 0), 0)
    : 0
  const annualIncome = monthlyIncome * 12
  const { totalDebt, ratio: debtLoad } = personalDebtRatio(debts, annualIncome)
  const debtPts = totalDebt === 0 ? 20 : debtLoad < 0.20 ? 15 : debtLoad < 0.50 ? 10 : 0
  score += debtPts
  breakdown.push({ label: tr('score.debtLoad'), pts: debtPts, max: 20 })

  // 4. Metas activas (0-20)
  // 20pts = ≥1 meta con progreso >0, 10pts = meta creada sin progreso, 0pts = sin metas
  const goalArr = Array.isArray(goals) ? goals : []
  const goalsWithProgress = goalArr.filter(g => Number(g.saved) > 0).length
  const goalPts = goalsWithProgress > 0 ? 20 : goalArr.length > 0 ? 10 : 0
  score += goalPts
  breakdown.push({ label: tr('score.goals'), pts: goalPts, max: 20 })

  // 5. Control de suscripciones (0-20)
  // 20pts = <5% ingresos, 10pts = 5-10%, 5pts = 10-20%, 0pts = >20%
  const subsArr = Array.isArray(subs) ? subs : []
  const subMonthly = subsArr.filter(s => s?.status === 'active').reduce((s, sub) => {
    const amt = Number(sub.amount) || 0
    const freq = sub.frequency || 'monthly'
    if (freq === 'annual' || freq === 'anual') return s + amt / 12
    if (freq === 'quarterly') return s + amt / 3
    if (freq === 'weekly') return s + amt * 4.33
    return s + amt
  }, 0)
  const subRatio = monthlyIncome > 0 ? subMonthly / monthlyIncome : 0
  const subPts = subRatio < 0.05 ? 20 : subRatio < 0.10 ? 10 : subRatio < 0.20 ? 5 : 0
  score += subPts
  breakdown.push({ label: tr('score.subs'), pts: subPts, max: 20 })

  const label = score >= 80 ? tr('score.excellent') : score >= 60 ? tr('score.good') : score >= 40 ? tr('score.fair') : tr('score.critical')
  const color = score >= 80 ? 'var(--pos)' : score >= 60 ? 'var(--pos)' : score >= 40 ? 'var(--amb)' : 'var(--red)'

  return { score, label, color, breakdown }
}
