// src/pages/Dashboard/index.jsx
// Dashboard Visual Polish — FinanceOS v1.1.1

import { useMemo, useState, useCallback, useEffect } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import Sheet from '../../components/ui/Sheet.jsx'
import ChartCard from '../../components/charts/ChartCard.jsx'
import IncomeExpenseBar from '../../components/charts/IncomeExpenseBar.jsx'
import CategoryDonut from '../../components/charts/CategoryDonut.jsx'
import MoneyFlow from '../../components/charts/MoneyFlow.jsx'
import { evaluateCoach, calcCoachMetrics } from '../../data/coachRules.js'
import { calcFinancialScore, SCORE_LEVELS } from '../../utils/financialScore.js'
import { isSyncEnabled, syncAvailable, syncMeta } from '../../core/sync.js'
import { projectEndOfMonth } from '../../utils/projection.js'
import CountUp from '../../components/CountUp.jsx'
import { ScoreState, ScoreStateIcon } from '../../components/ScoreState.jsx'
import SignalIcon, { InlineIcon } from '../../components/icons/SignalIcon.jsx'
import CountryTool from './CountryTool.jsx'
import HomeKpis from './HomeKpis.jsx'
import FirstSteps from './FirstSteps.jsx'
import BudgetByCategory from './BudgetByCategory.jsx'
import UpcomingPayments from './UpcomingPayments.jsx'
import ScoreCard from './ScoreCard.jsx'
import NetWorthCard from './NetWorthCard.jsx'
import DeltaLine from './DeltaLine.jsx'
import { monthDelta, prevMonthOf } from './dashboardModel.js'
import hs from './Home.module.css'
import { moneyLocale, currentMonth, catName, fmtMoney, fmtSignedMoney, currencySymbol } from '../../utils/index.js'
import { DEFAULT_USD_RATES, monthLabel } from '../shared/constants.js'
import { BackupReminderBanner } from '../../components/backup/BackupManager.jsx'
import { Card, CardHeader } from '../../components/ui/index.jsx'
import Money, { useMoney } from '../../components/Money.jsx'
import MonthSheet from '../../components/recurring/MonthSheet.jsx'
import { monthPlan, pendingTotals } from '../../utils/recurring.js'
import { localDateStr } from '../../utils/index.js'
import { ChevronDown } from 'lucide-react'

const pct  = (n) => ((Number(n) || 0) * 100).toFixed(1) + '%'
const pct0 = (n) => ((Number(n) || 0) * 100).toFixed(0) + '%'

export default function Dashboard({ setPage }) {
  const ctx      = useApp() || {}
  const { t, lang } = useT()
  // Panorama PERSONAL: excluye movimientos marcados como inversión (r.inv) de todos
  // los cálculos del dashboard (ingresos, gastos, balance, tasa de ahorro, score, señales).
  const incomes  = Array.isArray(ctx.incomes)       ? ctx.incomes.filter(r => !r?.inv)  : []
  const expenses = Array.isArray(ctx.expenses)      ? ctx.expenses.filter(r => !r?.inv) : []
  const budgets  = Array.isArray(ctx.budgets)       ? ctx.budgets       : []
  const goals    = Array.isArray(ctx.goals)         ? ctx.goals         : []
  const settings = (ctx.settings && typeof ctx.settings === 'object') ? ctx.settings : {}
  const subs     = Array.isArray(ctx.subscriptions) ? ctx.subscriptions : []
  const debts    = Array.isArray(ctx.debts) ? ctx.debts : []

  const sym         = currencySymbol(settings.currency, settings.language)
  const activeMonth = settings.activeMonth || currentMonth()
  // Defensa extra contra usdRate quedando en 0 (bug ya arreglado en el origen —
  // Settings ahora recomputa al cambiar de moneda — pero esto cubre a quien ya
  // tenía un 0 guardado en IndexedDB de antes del fix): si el usuario activó la
  // moneda dual, mostrarla igual con la tasa por defecto en vez de apagarla.
  const effectiveUsdRate = Number(settings.usdRate) || DEFAULT_USD_RATES[settings.currency] || 0
  const dualOn      = !!settings.showDualCurrency && settings.currency !== 'USD' && effectiveUsdRate > 0
  const usdRate     = effectiveUsdRate || 1
  // Ocultar montos (T13): toda cifra de dinero de esta pantalla pasa por money()
  // (strings: frases i18n, KPIs) o por <Money> (cifras sueltas en JSX).
  const { hidden: amountsHidden, m } = useMoney()
  const money       = (n) => m(fmtSignedMoney(n, sym))
  const toUSD       = (n) => `≈ ${m(`US$${((Number(n) || 0) / usdRate).toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })}`)}`

  const kpis = useMemo(() => {
    const [y, mo] = activeMonth.split('-').map(Number)
    const prevMo  = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`

    function monthTotals(month) {
      const inc = incomes.filter(r  => r?.date?.startsWith(month))
      const exp = expenses.filter(r => r?.date?.startsWith(month))
      const totalInc = inc.reduce((s, r) => s + (Number(r?.amount) || 0), 0)
      const totalExp = exp.reduce((s, r) => s + (Number(r?.amount) || 0), 0)
      const balance  = totalInc - totalExp                        // Balance neto = ingresos − gastos
      // "Te queda" = solo lo REAL (decisión de Walter, 08-oct-2026). Antes se
      // restaban siempre las suscripciones activas y las cuotas: si el gasto
      // también estaba registrado, se contaba dos veces. Lo previsto que falta
      // (suscripciones, cuotas, fijos) va aparte en "Previsto pendiente".
      const freeFlow = balance
      return { totalInc, totalExp, balance, freeFlow,
               savingRate: totalInc > 0 ? balance / totalInc : 0,  // sin floor: coincide con Coach/Advisor
               incCount: inc.length, expCount: exp.length }
    }

    const cur  = monthTotals(activeMonth)
    const prev = monthTotals(prevMo)

    function delta(cur, prev) {
      if (prev === 0) return null
      return ((cur - prev) / prev * 100).toFixed(1)
    }

    return {
      ...cur,
      cur, prev,
      delta: {
        inc:  delta(cur.totalInc,    prev.totalInc),
        exp:  delta(cur.totalExp,    prev.totalExp),
        bal:  delta(cur.balance,     prev.balance),
        save: delta(cur.savingRate,  prev.savingRate),
      }
    }
  }, [incomes, expenses, activeMonth])

  // ── Movimientos fijos del mes activo ─────────────────────────────────────
  const todayStr = localDateStr()
  const rules = Array.isArray(ctx.recurring) ? ctx.recurring : []
  const plan = useMemo(() => monthPlan(rules, activeMonth, { incomes: ctx.incomes || [], expenses: ctx.expenses || [], today: todayStr }),
    [rules, activeMonth, ctx.incomes, ctx.expenses, todayStr])
  const pendingSum = useMemo(() => pendingTotals(plan), [plan])

  const monthExpenses = useMemo(() =>
    expenses.filter(r => r?.date?.startsWith(activeMonth)),
    [expenses, activeMonth]
  )

  const monthIncomes = useMemo(() =>
    incomes.filter(r => r?.date?.startsWith(activeMonth)),
    [incomes, activeMonth]
  )

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

    // Suscripciones anuales
    if (subMonthly > 0) {
      cards.push({
        icon: <SignalIcon kind="subs" size={13} />,
        color: 'var(--amb)',
        bg: 'color-mix(in srgb, var(--warn) 9%, transparent)',
        border: 'color-mix(in srgb, var(--warn) 24%, transparent)',
        text: t('dash.insight.subs.text', { v: money(subMonthly * 12) }),
        sub: t('dash.insight.subs.sub'),
        page: 'subscriptions',
      })
    }

    // Categoría principal de gasto
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
        cards.push({
          icon: <SignalIcon kind="category" size={13} />,
          color: 'var(--accent2)',
          bg: 'color-mix(in srgb, var(--accent2) 9%, transparent)',
          border: 'color-mix(in srgb, var(--accent2) 22%, transparent)',
          text: t('dash.insight.topCat.text', { cat: catName(topCat[0], lang), pct: catPct }),
          sub: t('dash.insight.topCat.sub'),
          page: 'movements',
        })
      }
    }

    // Presupuesto más usado
    if (budgets.length > 0 && monthExpenses.length > 0) {
      const expByCat = {}
      monthExpenses.forEach(e => { expByCat[e.category] = (expByCat[e.category] || 0) + (Number(e.amount) || 0) })
      const totalBudget = budgets.reduce((s, b) => s + (Number(b.limit) || 0), 0)
      const totalUsed   = budgets.reduce((s, b) => s + Math.min(expByCat[b.category] || 0, Number(b.limit) || 0), 0)
      if (totalBudget > 0) {
        const budgetPct = ((totalUsed / totalBudget) * 100).toFixed(0)
        const pctN = Number(budgetPct)
        const color = pctN > 90 ? 'var(--red)' : pctN > 80 ? 'var(--amb)' : 'var(--accent)'
        cards.push({
          icon: <ScoreStateIcon level={pctN > 90 ? 'risk' : pctN > 80 ? 'attention' : 'ok'} size={13} color="currentColor" />,
          color,
          bg: pctN > 90 ? 'color-mix(in srgb, var(--neg) 8%, transparent)' : pctN > 80 ? 'color-mix(in srgb, var(--warn) 9%, transparent)' : 'color-mix(in srgb, var(--pos) 8%, transparent)',
          border: pctN > 90 ? 'color-mix(in srgb, var(--neg) 24%, transparent)' : pctN > 80 ? 'color-mix(in srgb, var(--warn) 24%, transparent)' : 'color-mix(in srgb, var(--pos) 22%, transparent)',
          text: t('dash.insight.budget.text', { pct: budgetPct }),
          sub: pctN > 90 ? t('dash.insight.budget.danger') : pctN > 80 ? t('dash.insight.budget.warn') : t('dash.insight.budget.ok'),
          page: 'budgets',
        })
      }
    }

    // Meta principal
    if (goals.length > 0) {
      const top = [...goals].sort((a, b) => {
        const pa = Number(a.target) > 0 ? Number(a.saved) / Number(a.target) : 0
        const pb = Number(b.target) > 0 ? Number(b.saved) / Number(b.target) : 0
        return pb - pa
      })[0]
      if (top && Number(top.target) > 0) {
        const goalPct = Math.min((Number(top.saved) / Number(top.target)) * 100, 100).toFixed(0)
        cards.push({
          icon: <SignalIcon kind="goal" size={13} />,
          color: 'var(--accent)',
          bg: 'color-mix(in srgb, var(--pos) 8%, transparent)',
          border: 'color-mix(in srgb, var(--pos) 22%, transparent)',
          text: t('dash.insight.goal.text', { name: top.name, pct: goalPct }),
          sub: t('dash.insight.goal.sub', { v: money(Number(top.target) - Number(top.saved)) }),
          page: 'goals',
        })
      }
    }

    return cards.slice(0, 4)
  }, [subMonthly, monthExpenses, budgets, goals, sym, settings.language, amountsHidden])

  // ── Coach signals para Dashboard ──────────────────────────────────────────
  const topSignals = useMemo(() => {
    if (kpis.incCount === 0 && kpis.expCount === 0) return []
    const metrics = calcCoachMetrics({ incomes, expenses, budgets, debts, goals, subs, settings })
    return evaluateCoach(metrics, t).slice(0, 2)
  }, [incomes, expenses, budgets, debts, goals, subs, settings, kpis.incCount, kpis.expCount])

  // ── IQ Score — 5 factores del brand book MOY IQ (ver utils/financialScore.js) ──
  const healthScore = useMemo(() => {
    if (kpis.incCount === 0 && kpis.expCount === 0) return null
    const meta = syncMeta()
    return calcFinancialScore({
      savingRate: kpis.savingRate,
      expenses, debts, goals, incomes, activeMonth,
      syncEnabled: isSyncEnabled() && syncAvailable(),
      lastSyncAt: meta.lastPushedAt || meta.lastPulledAt || null,
    }, t)
  }, [kpis.savingRate, kpis.incCount, kpis.expCount, expenses, debts, goals, incomes, activeMonth, settings.language])

  // ── Vista compacta (progressive disclosure) ───────────────────────────────
  // Vista esencial por defecto (calma): la primera pantalla muestra lo esencial y
  // el resto (acciones, proyección, gráficos, ingreso esperado) vive en "detallado".
  // Respeta la preferencia previa del usuario si ya la fijó.
  const [compact, setCompact] = useState(() => {
    try { return localStorage.getItem('fos_dash_compact') !== '0' } catch { return true }
  })
  function toggleCompact() {
    setCompact(c => {
      const next = !c
      try { localStorage.setItem('fos_dash_compact', next ? '1' : '0') } catch {}
      return next
    })
  }

  // ── Modal cierre de mes ───────────────────────────────────────────────────
  const updateSettings = useApp()?.updateSettings
  const [closeDismissed, setCloseDismissed] = useState(() => {
    try { return localStorage.getItem(`fos_close_${activeMonth}`) === '1' } catch { return false }
  })

  const isMonthClosed = (() => {
    const now = new Date()
    const [y, mo] = activeMonth.split('-').map(Number)
    return now.getFullYear() > y || (now.getFullYear() === y && now.getMonth() + 1 > mo)
  })()

  const showCloseModal = isMonthClosed && !closeDismissed && (kpis.incCount > 0 || kpis.expCount > 0)

  // Hoja de inicio de mes (fusionada con el cierre): con el mes activo en el
  // mes en curso, la primera vez que se abre el Inicio en ese mes muestra cómo
  // cerró el anterior y los fijos previstos. "Revisar" la reabre cuando sea.
  const isCurrent = activeMonth === currentMonth()
  const prevMonthKey = prevMonthOf(activeMonth)
  const prevHasData = kpis.prev.incCount > 0 || kpis.prev.expCount > 0
  const [startDismissed, setStartDismissed] = useState(() => {
    try { return localStorage.getItem(`fos_mstart_${activeMonth}`) === '1' } catch { return false }
  })
  useEffect(() => {
    try { setStartDismissed(localStorage.getItem(`fos_mstart_${activeMonth}`) === '1') } catch {}
  }, [activeMonth])
  const [reviewOpen, setReviewOpen] = useState(false)
  const autoStart = isCurrent && !startDismissed && !settings.isDemo &&
    (plan.some(o => !o.rule.inv) || prevHasData) && (kpis.incCount > 0 || kpis.expCount > 0 || rules.length > 0)
  const sheetOpen = reviewOpen || autoStart
  const closeSheet = useCallback(() => {
    try { localStorage.setItem(`fos_mstart_${activeMonth}`, '1') } catch {}
    setStartDismissed(true)
    setReviewOpen(false)
  }, [activeMonth])

  function dismissClose() {
    try { localStorage.setItem(`fos_close_${activeMonth}`, '1') } catch {}
    setCloseDismissed(true)
  }

  function goNextMonth() {
    const [y, mo] = activeMonth.split('-').map(Number)
    const next = mo === 12
      ? `${y + 1}-01`
      : `${y}-${String(mo + 1).padStart(2, '0')}`
    updateSettings?.({ ...settings, activeMonth: next })
    dismissClose()
  }

  function MonthlyCloseModal() {
    const balance = kpis.balance
    const ok = balance >= 0
    return (
      <Sheet open={showCloseModal} onClose={dismissClose} ariaLabel={t('dash.close.title')} maxWidth={380}>
          <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--th)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:8 }}>
            {t('dash.close.title')}
          </div>
          <div style={{ fontSize:20, fontWeight:700, color:'var(--tx)', marginBottom:4 }}>
            {activeMonth}
          </div>
          <div style={{ fontSize:13, color: ok ? 'var(--accent)' : 'var(--red)', fontWeight:600, marginBottom:20 }}>
            {ok ? t('dash.close.positive') : t('dash.close.negative')}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
            {[
              { label:t('dash.kpi.income'),    val:money(kpis.totalInc),  color:'var(--accent)' },
              { label:t('dash.kpi.expenses'),      val:money(kpis.totalExp),  color:'var(--red)' },
              { label:t('dash.kpi.balance'),     val:money(Math.abs(balance)), color: ok ? 'var(--accent)' : 'var(--red)', prefix: ok ? '+' : '−' },
              { label:t('dash.close.savings'),      val:pct(kpis.savingRate),            color: kpis.savingRate >= 0.2 ? 'var(--accent)' : 'var(--amb)' },
            ].map(k => (
              <div key={k.label} style={{ background:'var(--bg2)', borderRadius:10, padding:'10px 12px' }}>
                <div style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--th)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:3 }}>{k.label}</div>
                <div style={{ fontSize:15, fontWeight:700, fontFamily:'var(--mono)', color:k.color }}>{k.prefix||''}{k.val}</div>
              </div>
            ))}
          </div>

          {healthScore && (
            <div style={{ background:'var(--bg2)', borderRadius:10, padding:'10px 12px', marginBottom:20, display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ fontSize:28, fontWeight:700, fontFamily:'var(--mono)', color:healthScore.color }}>{healthScore.score}</div>
              <div>
                <div style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--th)', textTransform:'uppercase', letterSpacing:'.5px' }}>{t('dash.health.title')}</div>
                <ScoreState level={healthScore.level} label={healthScore.label} style={{ fontSize:13 }} />
              </div>
            </div>
          )}

          <div style={{ display:'flex', gap:10, flexDirection:'column' }}>
            <button
              onClick={goNextMonth}
              style={{ background:'var(--laton)', color:'var(--navy)', border:'none', borderRadius:9, padding:'11px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'var(--mono)' }}
            >
              {t('dash.close.next')}
            </button>
            <button
              onClick={dismissClose}
              style={{ background:'none', color:'var(--th)', border:'.5px solid var(--brd)', borderRadius:9, padding:'9px 18px', fontSize:12, cursor:'pointer', fontFamily:'var(--mono)' }}
            >
              {t('dash.close.stay', { m: activeMonth })}
            </button>
          </div>
      </Sheet>
    )
  }

  const SEV_ICON  = { info: <SignalIcon kind="info" size={13} />, attention: <SignalIcon kind="attention" size={13} />, warning: <SignalIcon kind="warning" size={13} /> }
  const SEV_COLOR = { info: 'var(--accent)', attention: 'var(--amb)', warning: 'var(--red)' }

  // CTA contextual reutilizable (señales, proyección, metas)
  function InlineCTA({ label, page, tone = 'accent' }) {
    if (!setPage) return null
    const color = tone === 'red' ? 'var(--red)' : tone === 'amb' ? 'var(--amb)' : 'var(--accent)'
    return (
      <button
        onClick={() => setPage(page)}
        style={{
          marginTop:6, background:'none', border:`.5px solid ${color}`, borderRadius:6,
          padding:'5px 11px', fontSize:11, fontWeight:600, color, cursor:'pointer',
          fontFamily:'var(--mono)', whiteSpace:'nowrap',
        }}
      >
        {label} →
      </button>
    )
  }

  // Mapea una señal del diagnóstico a una acción concreta
  function signalAction(s) {
    // Por la categoría de la regla (no por el texto, que ya viene traducido y
    // en inglés/portugués/alemán no contiene 'ahorro', 'deuda', etc.).
    const byCat = {
      'ccat.savings':   { label:t('dash.action.createBudget'), page:'budgets',       tone:'amb' },
      'ccat.subs':      { label:t('dash.action.viewSubs'),     page:'subscriptions', tone:'amb' },
      'ccat.debts':     { label:t('dash.action.viewDebts'),    page:'debts',         tone:'red' },
      'ccat.budgets':   { label:t('dash.action.adjustBudget'), page:'budgets',       tone:'amb' },
      'ccat.goals':     { label:t('dash.action.viewGoals'),    page:'goals',         tone:'accent' },
      'ccat.emergency': { label:t('dash.action.viewGoals'),    page:'goals',         tone:'accent' },
    }
    if (s.categoryKey && byCat[s.categoryKey]) return byCat[s.categoryKey]
    const txt = `${s.title || ''} ${s.msg || ''}`.toLowerCase()
    if (txt.includes('ahorro'))     return { label:t('dash.action.createBudget'), page:'budgets', tone:'amb' }
    if (txt.includes('suscrip'))    return { label:t('dash.action.viewSubs'), page:'subscriptions', tone:'amb' }
    if (txt.includes('deuda'))      return { label:t('dash.action.viewDebts'),        page:'debts',   tone:'red' }
    if (txt.includes('presupuesto'))return { label:t('dash.action.adjustBudget'),page:'budgets', tone:'amb' }
    if (txt.includes('meta'))       return { label:t('dash.action.viewGoals'),         page:'goals',   tone:'accent' }
    return { label:t('dash.action.viewCoach'), page:'coach', tone:'accent' }
  }

  // ── "Para hacer hoy" (Fase 05) — unifica señales del Diagnóstico + insights
  // en una sola lista priorizada en vez de dos secciones separadas contando
  // cosas distintas. Señales primero (ya vienen ordenadas por severidad desde
  // evaluateCoach), después insights; tope de 3 para no repetir el ruido que
  // esto vino a resolver.
  const todoItems = [
    ...topSignals.map(s => ({
      icon: SEV_ICON[s.severity], color: SEV_COLOR[s.severity],
      title: s.title, sub: s.msg, ...signalAction(s),
    })),
    ...insights.map(ins => ({
      icon: ins.icon, color: ins.color, title: ins.text, sub: ins.sub, page: ins.page,
    })),
  ].slice(0, 3)

  // Flujo de inversión/propiedades (💼) del mes activo — para el "flujo total real"
  const propFlow = useMemo(() => {
    const raw = (arr) => (Array.isArray(arr) ? arr : [])
    const inMonth = (r) => r?.inv && r?.date?.startsWith(activeMonth)
    const inc = raw(ctx.incomes).filter(inMonth).reduce((s, r) => s + (Number(r.amount) || 0), 0)
    const exp = raw(ctx.expenses).filter(inMonth).reduce((s, r) => s + (Number(r.amount) || 0), 0)
    return { net: inc - exp, has: inc > 0 || exp > 0 }
  }, [ctx.incomes, ctx.expenses, activeMonth])
  const flujoTotal = kpis.balance + propFlow.net

  // ── El Anillo Vivo (Pulso) — firma del producto, visible por defecto.
  //    Solo se muestra cuando hay datos del mes. Usa motores ya existentes.
  const pulse = useMemo(() => {
    const { today, daysInMonth, daysLeft } = projectEndOfMonth({ incomes, expenses, activeMonth })
    // Referencia = ingreso del mes (mejor proxy de "¿voy bien para esta altura?"
    // → ritmo de gasto vs ritmo del tiempo). Fallback a gasto si no hay ingreso.
    const reference = kpis.totalInc > 0 ? kpis.totalInc : (kpis.totalExp || 1)
    const spent = kpis.totalExp
    const elapsedRatio = daysInMonth > 0 ? today / daysInMonth : 0
    const spentRatio = reference > 0 ? spent / reference : 0
    const pace = spentRatio - elapsedRatio
    const level = pace <= 0.02 ? 'ok' : pace <= 0.10 ? 'attention' : 'risk'
    const color = SCORE_LEVELS[level].color
    const safePerDay = daysLeft > 0 ? Math.max(0, (reference - spent) / daysLeft) : 0
    return { spentRatio, elapsedRatio, color, level, daysLeft,
             centerValue: money(safePerDay),
             refIsIncome: kpis.totalInc > 0 }
  }, [incomes, expenses, kpis.totalExp, kpis.totalInc, activeMonth, sym, amountsHidden])

  // KPIs secundarios (debajo de Ingresos/Gastos/Te queda). El balance neto
  // salió de acá: desde los fijos, "Te queda" ES ingresos − gastos y se repetía.
  const KPIS_SECONDARY = [
    ...(propFlow.has ? [{ label:t('dash.kpi.totalFlow'), color: flujoTotal >= 0 ? 'var(--pos)' : 'var(--neg)', sub:t('dash.kpi.personalPlusProps', { v: `${propFlow.net >= 0 ? '+' : '−'}${money(Math.abs(propFlow.net))}` }), raw: flujoTotal, count: true }] : []),
    { label:t('dash.kpi.savingRate'), value:pct(kpis.savingRate), color:kpis.savingRate >= 0.2 ? 'var(--pos)' : kpis.savingRate >= 0 ? 'var(--warn)' : 'var(--neg)', sub:t('dash.kpi.ofIncome') },
    { label:t('dash.kpi.subs'), value:t('dash.kpi.perMonth', { v: money(subMonthly) }), color:'var(--tx)', sub:t('dash.kpi.perYear', { v: money(subMonthly * 12) }) },
  ]

  return (
    <div>
      {!isCurrent && <MonthlyCloseModal />}
      <MonthSheet open={sheetOpen} onClose={closeSheet} month={activeMonth} plan={plan} today={todayStr} sym={sym}
        prev={autoStart && prevHasData ? { month: prevMonthKey, balance: kpis.prev.balance } : null}
        onGoToList={setPage ? () => { closeSheet(); setPage('recurring') } : undefined} />

      {/* Cabecera (R05): sin eyebrow ni h1 de "Dashboard" — el título "Inicio"
          ya está en la barra superior; acá solo el mes que se está mirando. */}
      <div className={hs.head}>
        <span className={hs.monthPill}>{monthLabel(activeMonth)}</span>
      </div>

      {/* Inicio M5 — responde en orden ¿cuánto me queda?, ¿en qué me estoy
          pasando? y ¿qué viene? Escritorio a dos columnas, móvil en una sola
          (orden en Home.module.css). */}
      <div className={hs.home}>
        <div className={hs.stack}>
          <div className={hs.oBackup}><BackupReminderBanner /></div>
          <div className={hs.oKpis}>
            <HomeKpis kpis={kpis} activeMonth={activeMonth} sym={sym} dualOn={dualOn} toUSD={toUSD}
              pending={pendingSum} onReviewPending={() => setReviewOpen(true)}
              pulse={(kpis.incCount > 0 || kpis.expCount > 0) ? pulse : null}
              daysLeft={activeMonth === currentMonth() ? pulse.daysLeft : null}
              onOpen={setPage}>
              {/* KPIs secundarios: en móvil solo en vista detallada */}
              <div className={hs.secondary + (compact ? ' ' + hs.secondaryCompact : '')}>
                {KPIS_SECONDARY.map((k, i) => (
                  <div key={i} className={`${hs.card} ${hs.kpi}`}>
                    <div className={hs.kpiLabel}>{k.label}</div>
                    <div className={`num ${hs.kpiValue}`} style={{ color: k.color }}>
                      {k.count ? <Money><CountUp value={k.raw} format={(v) => `${k.raw < 0 ? '−' : ''}${fmtMoney(v, sym)}`} /></Money> : k.value}
                    </div>
                    {k.delta && <DeltaLine delta={k.delta} prevMonth={prevMonthOf(activeMonth)} />}
                    <div className={hs.kpiSub}>{k.sub}</div>
                  </div>
                ))}
              </div>
            </HomeKpis>
          </div>
          <div className={hs.oSteps} data-tour="first-steps"><FirstSteps setPage={setPage} /></div>
          <div className={`${hs.pair} ${hs.pairA}`}>
            <div className={hs.oBudget}>
              <BudgetByCategory budgets={budgets} expenses={expenses} monthExpenses={monthExpenses}
                activeMonth={activeMonth} settings={settings} sym={sym} setPage={setPage} />
            </div>
            <div className={hs.oUpcoming}>
              <UpcomingPayments rules={rules} incomes={ctx.incomes} expenses={ctx.expenses} debts={debts} subscriptions={subs} sym={sym} setPage={setPage} />
            </div>
          </div>
          <div className={`${hs.pair} ${hs.pairB}`}>
            {/* IQ Score: fila compacta en la vista esencial, tarjeta completa
                (siguiente paso + factores) en la detallada. ScoreCard sigue
                montado en las dos para no cortar el historial semanal. */}
            <div className={hs.oScore}>
              <ScoreCard healthScore={healthScore} activeMonth={activeMonth} compact={compact}
                isCurrentMonth={activeMonth === currentMonth()} setPage={setPage} />
            </div>
            {!compact && (
              <div className={hs.oNetWorth}>
                <NetWorthCard goals={goals} debts={debts} incomes={ctx.incomes} expenses={ctx.expenses}
                  settings={settings} sym={sym} setPage={setPage} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vista detallada (R05): todo lo que no responde "¿cuánto me queda?"
          queda detrás de este botón. La elección se guarda en el dispositivo
          (fos_dash_compact). Nada se borró: solo se movió. */}
      <button type="button" className={hs.viewToggle} data-tour="view-toggle" onClick={toggleCompact} aria-expanded={!compact} aria-controls="home-detailed">
        <span>{compact ? t('home.view.showDetailed') : t('home.view.hideDetailed')}</span>
        <ChevronDown size={18} strokeWidth={1.8} aria-hidden="true" style={{ transform: compact ? 'none' : 'rotate(180deg)' }} />
      </button>

      <div id="home-detailed" hidden={compact}>
      {/* Para hacer hoy — fusión de señales del Diagnóstico + insights (Fase 05).
          Cada fila navega a la página donde se resuelve. */}
      {!compact && todoItems.length > 0 && (
        <Card className="rise" style={{ padding:'16px 18px', marginBottom:20 }}>
          <CardHeader
            title={<><InlineIcon kind="diagnosis" size={13} />{t('dash.signals.title')}</>}
            right={setPage && (
              <button type="button" onClick={() => setPage('coach')}
                style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--accent)', cursor:'pointer', background:'none', border:0, padding:0 }}>
                {t('dash.signals.viewAll')}
              </button>
            )}
          />
          {todoItems.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => item.page && setPage?.(item.page)}
              style={{
                display:'flex', alignItems:'flex-start', gap:10, width:'100%', textAlign:'left',
                background:'none', border:'none', cursor: item.page ? 'pointer' : 'default',
                marginBottom: i < todoItems.length - 1 ? 12 : 0,
              }}
            >
              <span style={{
                width:22, height:22, borderRadius:'50%', flexShrink:0, marginTop:1,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:12, color:item.color, background:`color-mix(in srgb, ${item.color} 14%, transparent)`,
              }}>{item.icon}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--tx)', marginBottom:2 }}>{item.title}</div>
                <div style={{ fontSize:12, color:'var(--tm)', lineHeight:1.5 }}>{item.sub}</div>
              </div>
              {item.page && <span style={{ fontSize:13, color:item.color, flexShrink:0 }}>→</span>}
            </button>
          ))}
        </Card>
      )}

      {/* #03 — Herramienta fiscal del país como protagonista (el foso competitivo). */}
      {!compact && <CountryTool country={settings.country} setPage={setPage} />}

      {/* Acciones rápidas — solo en vista detallada (reduce ruido inicial) */}
      {setPage && !compact && (
        <div style={{ marginBottom:20 }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--th)', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:10 }}>{t('dash.quick.title')}</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {[
              { label:t('dash.quick.income'),     page:'income',     color:'var(--accent)', icon:'plus' },
              { label:t('dash.quick.expense'),      page:'movements',  color:'var(--red)', icon:'plus' },
              { label:t('dash.quick.import'),page:'import',     color:'var(--accent2)', icon:'upload' },
              { label:t('dash.quick.budget'), page:'budgets',    color:'var(--amb)', icon:'budget' },
              { label:t('dash.quick.goal'),        page:'goals',      color:'var(--accent)', icon:'goal' },
            ].map((a,i) => (
              <button key={i} onClick={() => setPage(a.page)} style={{
                background:'none', border:`.5px solid ${a.color}`, borderRadius:8,
                padding:'7px 14px', fontSize:12, fontWeight:600, color:a.color,
                cursor:'pointer', fontFamily:'var(--mono)', transition:'.15s',
                whiteSpace:'nowrap',
              }}>
                <InlineIcon kind={a.icon} size={13} />{a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ingreso esperado vs recibido — vista detallada */}
      {!compact && (() => {
        const expected = Number(settings.estimatedMonthlyIncome) || 0
        if (expected <= 0 || kpis.totalInc <= 0) return null
        const diff = kpis.totalInc - expected
        const pctDiff = ((diff / expected) * 100).toFixed(1)
        const over = diff >= 0
        return (
          <div style={{ background: over ? 'color-mix(in srgb, var(--pos) 8%, transparent)' : 'color-mix(in srgb, var(--neg) 8%, transparent)', border: `.5px solid ${over ? 'color-mix(in srgb, var(--pos) 28%, transparent)' : 'color-mix(in srgb, var(--neg) 28%, transparent)'}`, borderRadius: 'var(--r)', padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--th)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 4 }}>{t('dash.expected.title')}</div>
              <div style={{ fontSize: 13, color: 'var(--tx)' }}>
                {t('dash.expected.expected')} <strong><Money>{fmtMoney(expected, sym)}</Money></strong> · {t('dash.expected.received')} <strong style={{ color: over ? 'var(--accent)' : 'var(--red)' }}><Money>{fmtMoney(kpis.totalInc, sym)}</Money></strong>
              </div>
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: over ? 'var(--accent)' : 'var(--red)' }}>
              {over ? '+' : ''}{pctDiff}%
            </div>
          </div>
        )
      })()}

      {/* Proyección fin de mes */}
      {!compact && (kpis.totalInc > 0 || kpis.totalExp > 0) && (() => {
        // Cálculo compartido con la página Proyección — mismos números en ambas vistas
        const { today, daysInMonth, daysLeft, dailyExp, medianDaily, projInc, projExp, projBal, avgExp, avgExpMonths } =
          projectEndOfMonth({ incomes, expenses, activeMonth })
        const pctMonth = (today / daysInMonth * 100).toFixed(0)
        const over     = projBal < 0
        return (
          <Card style={{ border: over ? '.5px solid color-mix(in srgb, var(--neg) 32%, transparent)' : undefined, padding:'14px 16px', marginBottom:16 }}>
            <CardHeader
              title={t('dash.proj.title')}
              right={<span style={{ fontSize:10, fontFamily:'var(--mono)', color:'var(--th)', textTransform:'none', letterSpacing:'normal' }}>{t('dash.proj.day', { d: today, n: daysInMonth, left: daysLeft })}</span>}
            />
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10, marginBottom:10 }}>
              {[
                { label:t('dash.proj.exp'),   value:money(projExp),            color:'var(--red)',                                  rawVal: projExp },
                { label:t('dash.proj.bal'), value:money(Math.abs(projBal)),  color: over ? 'var(--red)' : 'var(--accent)', prefix: over ? '−' : '+', rawVal: projBal },
                { label:t('dash.proj.daily'),       value:t('dash.proj.perDay', { v: money(dailyExp) }),       color:'var(--th)',                                   rawVal: null },
              ].map(k => (
                <div key={k.label}>
                  <div style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--th)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:3 }}>{k.label}</div>
                  <div style={{ fontSize:13, fontWeight:700, fontFamily:'var(--mono)', color:k.color }}>{k.prefix || ''}{k.value}</div>
                  {dualOn && k.rawVal != null && (
                    <div style={{ fontSize:11, color:'var(--th)', fontFamily:'var(--mono)', opacity:.7, marginTop:2 }}>{toUSD(k.rawVal)}</div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ height:4, borderRadius:2, background:'var(--brd2)', overflow:'hidden', marginBottom:4 }}>
              <div style={{ height:'100%', width:'100%', transform:`scaleX(${pctMonth / 100})`, transformOrigin:'left', background: over ? 'var(--red)' : 'var(--accent)', borderRadius:2, transition:'transform .3s' }} />
            </div>
            {avgExp > 0 && avgExpMonths > 0 && (
              <div style={{ fontSize:10, fontFamily:'var(--mono)', color:'var(--th)', marginBottom:4, opacity:.8 }}>
                {t('dash.proj.basis', { cur: money(kpis.totalExp), med: money(medianDaily), left: daysLeft, avg: money(avgExp) })}
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, fontFamily:'var(--mono)', color:'var(--th)' }}>
              <span>{t('dash.proj.elapsed', { pct: pctMonth })}</span>
              {setPage && <button type="button" onClick={() => setPage('cashflow')} style={{ color:'var(--accent)', cursor:'pointer', background:'none', border:0, padding:0, font:'inherit' }}>{t('dash.proj.viewFull')}</button>}
            </div>
            {over && <InlineCTA label={t('dash.proj.reviewExpenses')} page="movements" tone="red" />}
          </Card>
        )
      })()}

      {/* Gráficos — el donut de categorías vive también en la vista esencial
          (da vida visual sin recargar); flujo y barras solo en detallada. */}
      {!compact && monthExpenses.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap:16, marginBottom:16 }}>
          {!compact && (
            <div className="fos-hide-mobile">
              <ChartCard title={t('dash.chart.flow.title')} subtitle={t('dash.chart.flow.sub')} minHeight={220}>
                <MoneyFlow incomes={monthIncomes} expenses={monthExpenses} subscriptions={subs} debts={debts} sym={sym}/>
              </ChartCard>
            </div>
          )}
          <ChartCard title={t('dash.chart.cat.title')} subtitle={activeMonth} minHeight={160}>
            <CategoryDonut records={monthExpenses} sym={sym} maxCategories={6}
              onCategoryClick={setPage ? (cat) => { try { sessionStorage.setItem('fos_drill_category', cat) } catch {} ; setPage('movements') } : undefined}/>
          </ChartCard>
        </div>
      )}
      {!compact && (
        <ChartCard title={t('dash.chart.bar.title')} subtitle={t('dash.chart.bar.sub')} minHeight={180}>
          <IncomeExpenseBar incomes={incomes} expenses={expenses} sym={sym} months={6}/>
        </ChartCard>
      )}



      {/* Link a Diagnóstico — vista detallada */}
      {setPage && !compact && (
        <div style={{ padding:'10px 14px', background:'var(--sur)', border:'.5px solid var(--brd)', borderRadius:'var(--r)', display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <span style={{ fontSize:12, color:'var(--th)', fontFamily:'var(--mono)' }}><InlineIcon kind="diagnosis" size={13} />{t('dash.coachLink.text')}</span>
          <button onClick={() => setPage('coach')} style={{ background:'none', border:'.5px solid var(--brd2)', borderRadius:6, padding:'4px 12px', fontSize:11, color:'var(--accent)', cursor:'pointer', fontFamily:'var(--mono)' }}>
            {t('dash.coachLink.btn')}
          </button>
        </div>
      )}


      {/* Backup recomendado — nota general en la vista detallada; el aviso con
          días y botón de un clic es la franja de la primera vista (M5) */}
      {!compact && <div style={{ background:'var(--sur)', border:'.5px solid var(--brd)', borderRadius:'var(--r)', padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--th)', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:3 }}>{t('dash.backup.title')}</div>
          <div style={{ fontSize:12, color:'var(--th)', fontFamily:'var(--mono)' }}>{t('dash.backup.text')}</div>
        </div>
        {setPage && <button onClick={() => setPage?.('settings')} style={{ background:'none', border:'.5px solid var(--brd2)', borderRadius:7, padding:'5px 12px', fontSize:11, color:'var(--tx)', cursor:'pointer', fontFamily:'var(--mono)', whiteSpace:'nowrap', flexShrink:0 }}>{t('dash.backup.btn')}</button>}
      </div>}
      </div>

      <div style={{ fontSize:10, color:'var(--th)', fontFamily:'var(--mono)', lineHeight:1.6, marginTop:16 }}>
        {t('dash.disclaimer')}
      </div>
    </div>
  )
}
