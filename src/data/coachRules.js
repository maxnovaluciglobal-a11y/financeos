// src/data/coachRules.js
import { translations } from '../i18n/translations.js'
import { effectiveBudgetLimits } from '../utils/budgets.js'
import { moneyLocale } from '../utils/index.js'
import { personalDebtRatio } from '../utils/personal.js'
import { findEmergencyGoal } from '../utils/emergencyGoal.js'
// Motor de reglas del FinanceOS Coach
// Configurable sin tocar componentes React
// Cada regla: id, categoría, condición, severidad, mensaje, acción sugerida

export const COACH_CONFIG = {
  // Umbrales configurables
  thresholds: {
    savingsRateGood:        0.20,   // 20% ahorro = bueno
    savingsRateWarn:        0.10,   // 10% ahorro = atención
    subscriptionRatioWarn:  0.07,   // 7% suscripciones/ingreso = atención
    subscriptionRatioHigh:  0.12,   // 12% = warning
    budgetOverUsePct:       0.90,   // 90% del presupuesto usado = atención
    budgetExceededPct:      1.00,   // 100% = warning
    debtLoadWarn:           0.30,   // 30% deuda/ingreso anual = atención
    debtLoadHigh:           0.50,   // 50% = warning
    emergencyFundMonthsGood: 3,     // 3 meses = bueno
    emergencyFundMonthsWarn: 1,     // 1 mes = atención
    goalsProgressWarn:      0.25,   // menos del 25% en meta = atención
    backupDaysWarn:         14,     // sin backup en 14 días = atención
    backupDaysHigh:         30,     // sin backup en 30 días = warning
  },

  // Severidades disponibles: info | attention | warning
  severityColors: {
    info:       'var(--grn)',
    attention:  'var(--amb)',
    warning:    'var(--red)',
  },
}

// ── REGLAS ────────────────────────────────────────────────────────────────────
// Cada regla recibe `metrics` y retorna null si no aplica,
// o un objeto { id, category, severity, title, msg, action } si aplica

export const COACH_RULES = [

  // ── FLUJO DE CAJA ──────────────────────────────────────────────────────────
  {
    id: 'cashflow_positive',
    category: 'ccat.cashflow',
    evaluate: (m, tr) => m.cashFlow > 0 ? {
      severity: 'info',
      title: tr('cr.cashflowPos.title'),
      msg: tr('cr.cashflowPos.msg', { v: `${m.sym}${fmt(m.cashFlow)}` }),
      action: tr('cr.cashflowPos.action'),
    } : null,
  },
  {
    id: 'cashflow_negative',
    category: 'ccat.cashflow',
    evaluate: (m, tr) => m.cashFlow < 0 ? {
      severity: 'warning',
      title: tr('cr.cashflowNeg.title'),
      msg: tr('cr.cashflowNeg.msg', { v: `${m.sym}${fmt(Math.abs(m.cashFlow))}` }),
      action: tr('cr.cashflowNeg.action'),
    } : null,
  },
  {
    id: 'no_income',
    category: 'ccat.cashflow',
    evaluate: (m, tr) => m.monthlyIncome === 0 ? {
      severity: 'attention',
      title: tr('cr.noIncome.title'),
      msg: tr('cr.noIncome.msg'),
      action: tr('cr.noIncome.action'),
    } : null,
  },

  // ── TASA DE AHORRO ─────────────────────────────────────────────────────────
  {
    id: 'savings_good',
    category: 'ccat.savings',
    evaluate: (m, tr) => m.monthlyIncome > 0 && m.savingsRate >= COACH_CONFIG.thresholds.savingsRateGood ? {
      severity: 'info',
      title: tr('cr.savGood.title'),
      msg: tr('cr.savGood.msg', { rate: pct(m.savingsRate), goal: pct(COACH_CONFIG.thresholds.savingsRateGood) }),
      action: tr('cr.savGood.action'),
    } : null,
  },
  {
    id: 'savings_warn',
    category: 'ccat.savings',
    evaluate: (m, tr) => m.monthlyIncome > 0 && m.savingsRate >= 0 && m.savingsRate < COACH_CONFIG.thresholds.savingsRateWarn ? {
      severity: 'attention',
      title: tr('cr.savWarn.title'),
      msg: tr('cr.savWarn.msg', { rate: pct(m.savingsRate), min: pct(COACH_CONFIG.thresholds.savingsRateWarn) }),
      action: tr('cr.savWarn.action'),
    } : null,
  },
  {
    id: 'savings_negative',
    category: 'ccat.savings',
    evaluate: (m, tr) => m.monthlyIncome > 0 && m.savingsRate < 0 ? {
      severity: 'warning',
      title: tr('cr.savNeg.title'),
      msg: tr('cr.savNeg.msg', { rate: pct(m.savingsRate) }),
      action: tr('cr.savNeg.action'),
    } : null,
  },

  // ── SUSCRIPCIONES ──────────────────────────────────────────────────────────
  {
    id: 'subscriptions_high',
    category: 'ccat.subs',
    evaluate: (m, tr) => m.subscriptionRatio >= COACH_CONFIG.thresholds.subscriptionRatioHigh ? {
      severity: 'warning',
      title: tr('cr.subsHigh.title'),
      msg: tr('cr.subsHigh.msg', { pct: pct(m.subscriptionRatio), m: `${m.sym}${fmt(m.subscriptionMonthly)}`, a: `${m.sym}${fmt(m.subscriptionAnnual)}` }),
      action: tr('cr.subsHigh.action'),
    } : null,
  },
  {
    id: 'subscriptions_warn',
    category: 'ccat.subs',
    evaluate: (m, tr) => m.subscriptionRatio >= COACH_CONFIG.thresholds.subscriptionRatioWarn && m.subscriptionRatio < COACH_CONFIG.thresholds.subscriptionRatioHigh ? {
      severity: 'attention',
      title: tr('cr.subsWarn.title'),
      msg: tr('cr.subsWarn.msg', { pct: pct(m.subscriptionRatio), a: `${m.sym}${fmt(m.subscriptionAnnual)}` }),
      action: tr('cr.subsWarn.action'),
    } : null,
  },
  {
    id: 'subscriptions_info',
    category: 'ccat.subs',
    evaluate: (m, tr) => m.subscriptionCount > 0 && m.subscriptionRatio < COACH_CONFIG.thresholds.subscriptionRatioWarn ? {
      severity: 'info',
      title: tr('cr.subsInfo.title'),
      msg: tr('cr.subsInfo.msg', { n: m.subscriptionCount, m: `${m.sym}${fmt(m.subscriptionMonthly)}`, pct: pct(m.subscriptionRatio) }),
      action: null,
    } : null,
  },

  // ── PRESUPUESTOS ───────────────────────────────────────────────────────────
  {
    id: 'budget_exceeded',
    category: 'ccat.budgets',
    evaluate: (m, tr) => m.budgetsExceeded > 0 ? {
      severity: 'warning',
      title: tr('cr.budExceeded.title', { n: m.budgetsExceeded }),
      msg: tr('cr.budExceeded.msg', { n: m.budgetsExceeded }),
      action: tr('cr.budExceeded.action'),
    } : null,
  },
  {
    id: 'budget_near',
    category: 'ccat.budgets',
    evaluate: (m, tr) => m.budgetsNearLimit > 0 && m.budgetsExceeded === 0 ? {
      severity: 'attention',
      title: tr('cr.budNear.title', { n: m.budgetsNearLimit }),
      msg: tr('cr.budNear.msg', { n: m.budgetsNearLimit }),
      action: tr('cr.budNear.action'),
    } : null,
  },

  // ── DEUDAS ─────────────────────────────────────────────────────────────────
  {
    id: 'debt_high',
    category: 'ccat.debts',
    evaluate: (m, tr) => m.monthlyIncome > 0 && m.debtLoad >= COACH_CONFIG.thresholds.debtLoadHigh ? {
      severity: 'warning',
      title: tr('cr.debtHigh.title'),
      msg: tr('cr.debtHigh.msg', { v: `${m.sym}${fmt(m.totalDebt)}`, pct: pct(m.debtLoad) }),
      action: tr('cr.debtHigh.action'),
    } : null,
  },
  {
    id: 'debt_warn',
    category: 'ccat.debts',
    evaluate: (m, tr) => m.monthlyIncome > 0 && m.debtLoad >= COACH_CONFIG.thresholds.debtLoadWarn && m.debtLoad < COACH_CONFIG.thresholds.debtLoadHigh ? {
      severity: 'attention',
      title: tr('cr.debtWarn.title'),
      msg: tr('cr.debtWarn.msg', { pct: pct(m.debtLoad) }),
      action: tr('cr.debtWarn.action'),
    } : null,
  },

  // ── FONDO DE EMERGENCIA ────────────────────────────────────────────────────
  {
    id: 'emergency_fund_good',
    category: 'ccat.emergency',
    evaluate: (m, tr) => m.emergencyFundMonths >= COACH_CONFIG.thresholds.emergencyFundMonthsGood ? {
      severity: 'info',
      title: tr('cr.emGood.title'),
      msg: tr('cr.emGood.msg', { n: m.emergencyFundMonths.toFixed(1) }),
      action: null,
    } : null,
  },
  {
    id: 'emergency_fund_warn',
    category: 'ccat.emergency',
    evaluate: (m, tr) => m.emergencyFundMonths > 0 && m.emergencyFundMonths < COACH_CONFIG.thresholds.emergencyFundMonthsGood ? {
      severity: 'attention',
      title: tr('cr.emWarn.title'),
      msg: tr('cr.emWarn.msg', { n: m.emergencyFundMonths.toFixed(1) }),
      action: tr('cr.emWarn.action'),
    } : null,
  },
  {
    id: 'emergency_fund_none',
    category: 'ccat.emergency',
    evaluate: (m, tr) => m.emergencyFundMonths === 0 && m.monthlyExpense > 0 ? {
      severity: 'warning',
      title: tr('cr.emNone.title'),
      msg: tr('cr.emNone.msg'),
      action: tr('cr.emNone.action'),
    } : null,
  },

  // ── METAS ──────────────────────────────────────────────────────────────────
  {
    id: 'goals_progress_warn',
    category: 'ccat.goals',
    evaluate: (m, tr) => m.goalsStalled > 0 ? {
      severity: 'attention',
      title: tr('cr.goalsWarn.title', { n: m.goalsStalled }),
      msg: tr('cr.goalsWarn.msg', { n: m.goalsStalled }),
      action: tr('cr.goalsWarn.action'),
    } : null,
  },
  {
    id: 'goals_good',
    category: 'ccat.goals',
    evaluate: (m, tr) => m.goalsOnTrack > 0 && m.goalsStalled === 0 ? {
      severity: 'info',
      title: tr('cr.goalsGood.title'),
      msg: tr('cr.goalsGood.msg', { n: m.goalsOnTrack }),
      action: null,
    } : null,
  },

  // ── BACKUP ─────────────────────────────────────────────────────────────────
  {
    id: 'backup_warn',
    category: 'ccat.backup',
    evaluate: (m, tr) => m.daysSinceBackup >= COACH_CONFIG.thresholds.backupDaysWarn && m.daysSinceBackup < COACH_CONFIG.thresholds.backupDaysHigh ? {
      severity: 'attention',
      title: tr('cr.backupWarn.title'),
      msg: tr('cr.backupWarn.msg', { n: m.daysSinceBackup }),
      action: tr('cr.backupWarn.action'),
    } : null,
  },
  {
    id: 'backup_high',
    category: 'ccat.backup',
    evaluate: (m, tr) => m.daysSinceBackup >= COACH_CONFIG.thresholds.backupDaysHigh ? {
      severity: 'warning',
      title: tr('cr.backupHigh.title'),
      msg: tr('cr.backupHigh.msg', { n: m.daysSinceBackup }),
      action: tr('cr.backupHigh.action'),
    } : null,
  },
  {
    id: 'backup_ok',
    category: 'ccat.backup',
    evaluate: (m, tr) => m.daysSinceBackup >= 0 && m.daysSinceBackup < COACH_CONFIG.thresholds.backupDaysWarn ? {
      severity: 'info',
      title: tr('cr.backupOk.title'),
      msg: tr('cr.backupOk.msg', { n: m.daysSinceBackup }),
      action: null,
    } : null,
  },
]

// ── HELPERS ───────────────────────────────────────────────────────────────────
function fmt(n) { return (n || 0).toLocaleString(moneyLocale(), { maximumFractionDigits: 0 }) }
function pct(n) { return ((n || 0) * 100).toFixed(1) + '%' }

// ── EVALUADOR DE REGLAS ───────────────────────────────────────────────────────
// Fallback: si no se pasa t (p.ej. llamadas antiguas), resuelve las keys en español.
function esFallback(key, vars) {
  const str = translations.es?.[key] ?? key
  if (!vars) return str
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : `{${k}}`))
}

export function evaluateCoach(metrics, t) {
  const tr = t || esFallback
  const results = []
  for (const rule of COACH_RULES) {
    try {
      const result = rule.evaluate(metrics, tr)
      if (result) {
        results.push({ id: rule.id, category: tr(rule.category), ...result })
      }
    } catch (e) {
      console.warn(`Coach rule ${rule.id} error:`, e)
    }
  }
  // Ordenar: warning primero, luego attention, luego info
  const order = { warning: 0, attention: 1, info: 2 }
  return results.sort((a, b) => (order[a.severity] || 2) - (order[b.severity] || 2))
}

// ── CALCULADOR DE MÉTRICAS PARA EL COACH ─────────────────────────────────────
export function calcCoachMetrics({ incomes, expenses, budgets, debts, goals, subs, settings }) {
  const activeMonth = settings?.activeMonth || new Date().toISOString().slice(0, 7)
  const sym = { CLP: '$', USD: 'US$', EUR: '€', VES: 'Bs.', MXN: '$', ARS: '$', COP: '$' }[settings?.currency] || '$'

  // Ingresos y gastos del mes activo
  const monthlyIncome  = incomes.filter(r => r.date?.startsWith(activeMonth)).reduce((s, r) => s + (r.amount || 0), 0)
  const monthlyExpense = expenses.filter(r => r.date?.startsWith(activeMonth)).reduce((s, r) => s + (r.amount || 0), 0)
  const cashFlow       = monthlyIncome - monthlyExpense
  const savingsRate    = monthlyIncome > 0 ? cashFlow / monthlyIncome : 0

  // Suscripciones
  const activeSubs = (subs || []).filter(s => s.status === 'active')
  const toMonthly = (amount, freq) => {
    const a = parseFloat(amount) || 0
    return freq === 'weekly' ? a * 4.33 : freq === 'quarterly' ? a / 3 : freq === 'annual' ? a / 12 : a
  }
  const toAnnual = (amount, freq) => {
    const a = parseFloat(amount) || 0
    return freq === 'weekly' ? a * 52 : freq === 'quarterly' ? a * 4 : freq === 'annual' ? a : a * 12
  }
  const subscriptionMonthly = activeSubs.reduce((s, sub) => s + toMonthly(sub.amount, sub.frequency), 0)
  const subscriptionAnnual  = activeSubs.reduce((s, sub) => s + toAnnual(sub.amount, sub.frequency), 0)
  const subscriptionRatio   = monthlyIncome > 0 ? subscriptionMonthly / monthlyIncome : 0
  const subscriptionCount   = activeSubs.length

  // Presupuestos
  const expByCat = {}
  expenses.filter(r => r.date?.startsWith(activeMonth)).forEach(e => {
    expByCat[e.category] = (expByCat[e.category] || 0) + e.amount
  })
  // Límite EFECTIVO (con rollover si está activo) — coincide con la página Presupuestos.
  const effLimits = effectiveBudgetLimits({ budgets, expenses, activeMonth, settings })
  const budgetsExceeded  = budgets.filter(b => (expByCat[b.category] || 0) >= (effLimits[b.category] || 0) * COACH_CONFIG.thresholds.budgetExceededPct).length
  const budgetsNearLimit = budgets.filter(b => {
    const lim = effLimits[b.category] || 0
    const used = lim > 0 ? (expByCat[b.category] || 0) / lim : 0
    return used >= COACH_CONFIG.thresholds.budgetOverUsePct && used < COACH_CONFIG.thresholds.budgetExceededPct
  }).length

  // Deudas — solo ámbito personal (excluye deudas de propiedad/inversión), mismo
  // cálculo que el score y el Modo Asesor (ver personalDebtRatio en utils/personal.js).
  const annualIncome = monthlyIncome * 12
  const { totalDebt, ratio: debtLoad } = personalDebtRatio(debts, annualIncome)

  // Fondo de emergencia
  const emergencyGoal = findEmergencyGoal(goals)
  const emergencyFundMonths = emergencyGoal && monthlyExpense > 0
    ? (emergencyGoal.saved || 0) / monthlyExpense
    : 0

  // Metas
  const goalsStalled  = goals.filter(g => g.target > 0 && (g.saved || 0) / g.target < COACH_CONFIG.thresholds.goalsProgressWarn).length
  const goalsOnTrack  = goals.filter(g => g.target > 0 && (g.saved || 0) / g.target >= COACH_CONFIG.thresholds.goalsProgressWarn).length

  // Backup
  let daysSinceBackup = 999
  try {
    const lastBackup = localStorage.getItem('fos_last_backup')
    if (lastBackup) {
      daysSinceBackup = Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86400000)
    }
  } catch {}

  return {
    sym, activeMonth,
    monthlyIncome, monthlyExpense, cashFlow, savingsRate,
    subscriptionMonthly, subscriptionAnnual, subscriptionRatio, subscriptionCount,
    budgetsExceeded, budgetsNearLimit,
    totalDebt, debtLoad,
    emergencyFundMonths,
    goalsStalled, goalsOnTrack,
    daysSinceBackup,
  }
}
