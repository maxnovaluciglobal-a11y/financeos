// src/pages/Dashboard/useHomeData.jsx — cálculos del Inicio compartidos con
// Panorama (poda P1, 30-oct-2026). Antes vivían dentro de Dashboard/index.jsx;
// Panorama hereda la vista detallada del Inicio y tiene que mostrar las mismas
// cifras (KPIs del mes, IQ Score, señales del Diagnóstico, proyección, fijos),
// así que se calculan en un solo lugar.
import { useMemo, useState, useCallback } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { evaluateCoach, calcCoachMetrics } from '../../data/coachRules.js'
import { calcFinancialScore } from '../../utils/financialScore.js'
import { isSyncEnabled, syncAvailable, syncMeta } from '../../core/sync.js'
import { ScoreStateIcon } from '../../components/ScoreState.jsx'
import SignalIcon from '../../components/icons/SignalIcon.jsx'
import { refEligible, resolveRefRate } from '../../utils/refRate.js'
import { homeMonthTotals } from './dashboardModel.js'
import { moneyLocale, currentMonth, catName, fmtSignedMoney, currencySymbol, fmtPctPoints, localDateStr } from '../../utils/index.js'
import { DEFAULT_USD_RATES } from '../shared/constants.js'
import { useMoney } from '../../components/Money.jsx'
import { monthPlan, pendingTotals } from '../../utils/recurring.js'

const SEV_COLOR = { info: 'var(--accent)', attention: 'var(--amb)', warning: 'var(--red)' }

export function useHomeData() {
  const ctx = useApp() || {}
  const { t, lang } = useT()
  // Panorama PERSONAL: excluye movimientos marcados como inversión (r.inv) de todos
  // los cálculos del dashboard (ingresos, gastos, balance, tasa de ahorro, score, señales).
  const incomes  = useMemo(() => (Array.isArray(ctx.incomes)  ? ctx.incomes.filter(r => !r?.inv)  : []), [ctx.incomes])
  const expenses = useMemo(() => (Array.isArray(ctx.expenses) ? ctx.expenses.filter(r => !r?.inv) : []), [ctx.expenses])
  const budgets  = useMemo(() => (Array.isArray(ctx.budgets) ? ctx.budgets : []), [ctx.budgets])
  const goals    = useMemo(() => (Array.isArray(ctx.goals) ? ctx.goals : []), [ctx.goals])
  const settings = useMemo(() => ((ctx.settings && typeof ctx.settings === 'object') ? ctx.settings : {}), [ctx.settings])
  const subs     = useMemo(() => (Array.isArray(ctx.subscriptions) ? ctx.subscriptions : []), [ctx.subscriptions])
  const debts    = useMemo(() => (Array.isArray(ctx.debts) ? ctx.debts : []), [ctx.debts])

  const sym         = currencySymbol(settings.currency, settings.language)
  const activeMonth = settings.activeMonth || currentMonth()

  // R12: quien califica para la moneda de referencia (VE/AR o moneda dual
  // activada) usa la tasa resuelta con fecha (utils/refRate.js) y NUNCA el
  // DEFAULT_USD_RATES fijo. `bumpRate` relee la caché tras guardar o consultar.
  const refOn = refEligible(settings)
  const [rateTick, setRateTick] = useState(0)
  const bumpRate = useCallback(() => setRateTick(n => n + 1), [])
  const refRate = useMemo(() => (refOn
    ? resolveRefRate(settings, (k) => { try { return localStorage.getItem(k) } catch { return null } })
    : null),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [refOn, settings.usdRate, settings.usdRateAt, settings.usdRateSource, settings.country, settings.currency, rateTick])
  // Defensa extra contra usdRate en 0 guardado de antes del fix de Ajustes.
  const effectiveUsdRate = refOn ? (refRate?.rate || 0) : (Number(settings.usdRate) || DEFAULT_USD_RATES[settings.currency] || 0)
  const dualOn  = !!settings.showDualCurrency && settings.currency !== 'USD' && effectiveUsdRate > 0
  const usdRate = effectiveUsdRate || 1

  // Ocultar montos (T13): toda cifra pasa por money() o por <Money>.
  const { m } = useMoney()
  const money = useCallback((n) => m(fmtSignedMoney(n, sym)), [m, sym])
  const toUSD = (n) => `≈ ${m(`US$${((Number(n) || 0) / usdRate).toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })}`)}`

  const kpis = useMemo(() => {
    const { cur, prev, prevToDate, prevCutDay } = homeMonthTotals({ incomes, expenses, activeMonth })
    return { ...cur, cur, prev, prevToDate, prevCutDay }
  }, [incomes, expenses, activeMonth])

  // ── Movimientos fijos del mes activo ─────────────────────────────────────
  const todayStr = localDateStr()
  const rules = useMemo(() => (Array.isArray(ctx.recurring) ? ctx.recurring : []), [ctx.recurring])
  const plan = useMemo(() => monthPlan(rules, activeMonth, { incomes: ctx.incomes || [], expenses: ctx.expenses || [], today: todayStr }),
    [rules, activeMonth, ctx.incomes, ctx.expenses, todayStr])
  const pendingSum = useMemo(() => pendingTotals(plan), [plan])

  const monthExpenses = useMemo(() => expenses.filter(r => r?.date?.startsWith(activeMonth)), [expenses, activeMonth])
  const monthIncomes  = useMemo(() => incomes.filter(r => r?.date?.startsWith(activeMonth)), [incomes, activeMonth])

  // Gasto mensual equivalente de suscripciones ACTIVAS (weekly×4.33, quarterly/3,
  // annual/12). Debe coincidir con la página Suscripciones, Coach y Reports.
  const subMonthly = useMemo(() => subs.filter(s => s?.status === 'active').reduce((s, sub) => {
    const amt  = Number(sub.amount) || 0
    const freq = sub.frequency || 'monthly'
    if (freq === 'annual' || freq === 'anual') return s + amt / 12
    if (freq === 'quarterly') return s + amt / 3
    if (freq === 'weekly') return s + amt * 4.33
    return s + amt
  }, 0), [subs])

  // ── Insight cards ─────────────────────────────────────────────────────────
  const insights = useMemo(() => {
    const cards = []
    if (subMonthly > 0) {
      cards.push({ icon: <SignalIcon kind="subs" size={13} />, color: 'var(--amb)',
        text: t('dash.insight.subs.text', { v: money(subMonthly * 12) }), sub: t('dash.insight.subs.sub'), page: 'subscriptions' })
    }
    if (monthExpenses.length > 0) {
      const catMap = {}
      monthExpenses.forEach(e => {
        const cat = e.category || 'Sin categoría' // valor canónico; catName lo traduce
        catMap[cat] = (catMap[cat] || 0) + (Number(e.amount) || 0)
      })
      const totalExp = monthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
      const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]
      if (topCat && totalExp > 0) {
        const catPct = ((topCat[1] / totalExp) * 100).toFixed(0)
        cards.push({ icon: <SignalIcon kind="category" size={13} />, color: 'var(--accent2)',
          text: t('dash.insight.topCat.text', { cat: catName(topCat[0], lang), pct: fmtPctPoints(catPct) }), sub: t('dash.insight.topCat.sub'), page: 'movements' })
      }
    }
    if (budgets.length > 0 && monthExpenses.length > 0) {
      const expByCat = {}
      monthExpenses.forEach(e => { expByCat[e.category] = (expByCat[e.category] || 0) + (Number(e.amount) || 0) })
      const totalBudget = budgets.reduce((s, b) => s + (Number(b.limit) || 0), 0)
      const totalUsed   = budgets.reduce((s, b) => s + Math.min(expByCat[b.category] || 0, Number(b.limit) || 0), 0)
      if (totalBudget > 0) {
        const budgetPct = ((totalUsed / totalBudget) * 100).toFixed(0)
        const pctN = Number(budgetPct)
        const color = pctN > 90 ? 'var(--red)' : pctN > 80 ? 'var(--amb)' : 'var(--accent)'
        cards.push({ icon: <ScoreStateIcon level={pctN > 90 ? 'risk' : pctN > 80 ? 'attention' : 'ok'} size={13} color="currentColor" />, color,
          text: t('dash.insight.budget.text', { pct: fmtPctPoints(budgetPct) }),
          sub: pctN > 90 ? t('dash.insight.budget.danger') : pctN > 80 ? t('dash.insight.budget.warn') : t('dash.insight.budget.ok'), page: 'budgets' })
      }
    }
    if (goals.length > 0) {
      const top = [...goals].sort((a, b) => {
        const pa = Number(a.target) > 0 ? Number(a.saved) / Number(a.target) : 0
        const pb = Number(b.target) > 0 ? Number(b.saved) / Number(b.target) : 0
        return pb - pa
      })[0]
      if (top && Number(top.target) > 0) {
        const goalPct = Math.min((Number(top.saved) / Number(top.target)) * 100, 100).toFixed(0)
        cards.push({ icon: <SignalIcon kind="goal" size={13} />, color: 'var(--accent)',
          text: t('dash.insight.goal.text', { name: top.name, pct: fmtPctPoints(goalPct) }),
          sub: t('dash.insight.goal.sub', { v: money(Number(top.target) - Number(top.saved)) }), page: 'goals' })
      }
    }
    return cards.slice(0, 4)
  }, [subMonthly, monthExpenses, budgets, goals, money, t, lang])

  // ── Señales del Diagnóstico ──────────────────────────────────────────────
  const topSignals = useMemo(() => {
    if (kpis.incCount === 0 && kpis.expCount === 0) return []
    const metrics = calcCoachMetrics({ incomes, expenses, budgets, debts, goals, subs, settings })
    return evaluateCoach(metrics, t).slice(0, 2)
  }, [incomes, expenses, budgets, debts, goals, subs, settings, kpis.incCount, kpis.expCount, t])

  // ── IQ Score — 5 factores del brand book MOY IQ (ver utils/financialScore.js) ──
  const healthScore = useMemo(() => {
    if (kpis.incCount === 0 && kpis.expCount === 0) return null
    const meta = syncMeta()
    return calcFinancialScore({
      savingRate: kpis.savingRate,
      expenses, debts, goals, incomes, activeMonth,
      syncEnabled: isSyncEnabled() && syncAvailable(),
      lastSyncAt: meta.lastPushedAt || meta.lastPulledAt || null,
      pending: pendingSum,
    }, t)
  }, [kpis.savingRate, kpis.incCount, kpis.expCount, expenses, debts, goals, incomes, activeMonth, pendingSum, t])

  // Mapea una señal del diagnóstico a una acción concreta (por la categoría
  // de la regla: el texto ya viene traducido).
  const signalAction = useCallback((s) => {
    const byCat = {
      'ccat.savings':   { label: t('dash.action.createBudget'), page: 'budgets' },
      'ccat.subs':      { label: t('dash.action.viewSubs'),     page: 'subscriptions' },
      'ccat.debts':     { label: t('dash.action.viewDebts'),    page: 'debts' },
      'ccat.budgets':   { label: t('dash.action.adjustBudget'), page: 'budgets' },
      'ccat.goals':     { label: t('dash.action.viewGoals'),    page: 'goals' },
      'ccat.emergency': { label: t('dash.action.viewGoals'),    page: 'goals' },
    }
    if (s.categoryKey && byCat[s.categoryKey]) return byCat[s.categoryKey]
    // Reglas viejas sin categoryKey: por el texto en español.
    const txt = `${s.title || ''} ${s.msg || ''}`.toLowerCase()
    if (txt.includes('ahorro'))      return byCat['ccat.savings']
    if (txt.includes('suscrip'))     return byCat['ccat.subs']
    if (txt.includes('deuda'))       return byCat['ccat.debts']
    if (txt.includes('presupuesto')) return byCat['ccat.budgets']
    if (txt.includes('meta'))        return byCat['ccat.goals']
    return { label: t('dash.action.viewCoach'), page: 'coach' }
  }, [t])

  // "Para hacer hoy" (Fase 05): señales del Diagnóstico + insights en una sola
  // lista priorizada, tope de 3.
  const todoItems = useMemo(() => [
    ...topSignals.map(s => ({
      icon: <SignalIcon kind={s.severity} size={13} />, color: SEV_COLOR[s.severity],
      title: s.title, sub: s.msg, ...signalAction(s),
    })),
    ...insights.map(ins => ({ icon: ins.icon, color: ins.color, title: ins.text, sub: ins.sub, page: ins.page })),
  ].slice(0, 3), [topSignals, insights, signalAction])

  // Flujo de inversión/propiedades (💼) del mes activo — para el "flujo total real"
  const propFlow = useMemo(() => {
    const raw = (arr) => (Array.isArray(arr) ? arr : [])
    const inMonth = (r) => r?.inv && r?.date?.startsWith(activeMonth)
    const inc = raw(ctx.incomes).filter(inMonth).reduce((s, r) => s + (Number(r.amount) || 0), 0)
    const exp = raw(ctx.expenses).filter(inMonth).reduce((s, r) => s + (Number(r.amount) || 0), 0)
    return { net: inc - exp, has: inc > 0 || exp > 0 }
  }, [ctx.incomes, ctx.expenses, activeMonth])

  return {
    ctx, settings, incomes, expenses, budgets, goals, subs, debts, sym, activeMonth,
    refOn, refRate, bumpRate, dualOn, usdRate, money, toUSD,
    kpis, rules, plan, pendingSum, todayStr, monthExpenses, monthIncomes, subMonthly,
    insights, topSignals, healthScore, todoItems, propFlow, flujoTotal: kpis.balance + propFlow.net,
  }
}
