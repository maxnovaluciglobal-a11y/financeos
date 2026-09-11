// src/pages/Dashboard/index.jsx
// Dashboard Visual Polish — FinanceOS v1.1.1

import { useMemo, useEffect, useState, useRef } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { useDialogA11y } from '../../hooks/useDialogA11y.js'
import ChartCard from '../../components/charts/ChartCard.jsx'
import IncomeExpenseBar from '../../components/charts/IncomeExpenseBar.jsx'
import CategoryDonut from '../../components/charts/CategoryDonut.jsx'
import MoneyFlow from '../../components/charts/MoneyFlow.jsx'
import { evaluateCoach, calcCoachMetrics } from '../../data/coachRules.js'
import { calcFinancialScore } from '../../utils/financialScore.js'
import { isSyncEnabled, syncAvailable, syncMeta } from '../../core/sync.js'
import { pendingDebtMonthly } from '../../utils/personal.js'
import { projectEndOfMonth } from '../../utils/projection.js'
import CountUp from '../../components/CountUp.jsx'
import { IconIQScore } from '../../components/icons/Icons.jsx'
import LivingRing from '../../components/LivingRing.jsx'
import MonthVerdict from './MonthVerdict.jsx'
import CountryTool from './CountryTool.jsx'
import { moneyLocale } from '../../utils/index.js'
import { DEFAULT_USD_RATES } from '../shared/constants.js'
import { BackupReminderBanner } from '../../components/backup/BackupManager.jsx'

const fmt  = (n) => (Number(n) || 0).toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })
const pct  = (n) => ((Number(n) || 0) * 100).toFixed(1) + '%'
const pct0 = (n) => ((Number(n) || 0) * 100).toFixed(0) + '%'

export default function Dashboard({ setPage }) {
  const ctx      = useApp() || {}
  const { t }    = useT()
  // Panorama PERSONAL: excluye movimientos marcados como inversión (r.inv) de todos
  // los cálculos del dashboard (ingresos, gastos, balance, tasa de ahorro, score, señales).
  const incomes  = Array.isArray(ctx.incomes)       ? ctx.incomes.filter(r => !r?.inv)  : []
  const expenses = Array.isArray(ctx.expenses)      ? ctx.expenses.filter(r => !r?.inv) : []
  const budgets  = Array.isArray(ctx.budgets)       ? ctx.budgets       : []
  const goals    = Array.isArray(ctx.goals)         ? ctx.goals         : []
  const settings = (ctx.settings && typeof ctx.settings === 'object') ? ctx.settings : {}
  const subs     = Array.isArray(ctx.subscriptions) ? ctx.subscriptions : []
  const debts    = Array.isArray(ctx.debts) ? ctx.debts : []

  const sym         = { CLP:'$', USD:'US$', EUR:'€', VES:'Bs.', MXN:'$', ARS:'$', COP:'$', PEN:'S/', BRL:'R$', UYU:'$U' }[settings.currency] || '$'
  const activeMonth = settings.activeMonth || new Date().toISOString().slice(0, 7)
  // Defensa extra contra usdRate quedando en 0 (bug ya arreglado en el origen —
  // Settings ahora recomputa al cambiar de moneda — pero esto cubre a quien ya
  // tenía un 0 guardado en IndexedDB de antes del fix): si el usuario activó la
  // moneda dual, mostrarla igual con la tasa por defecto en vez de apagarla.
  const effectiveUsdRate = Number(settings.usdRate) || DEFAULT_USD_RATES[settings.currency] || 0
  const dualOn      = !!settings.showDualCurrency && settings.currency !== 'USD' && effectiveUsdRate > 0
  const usdRate     = effectiveUsdRate || 1
  const toUSD       = (n) => `≈ US$${((Number(n) || 0) / usdRate).toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })}`

  const kpis = useMemo(() => {
    const [y, mo] = activeMonth.split('-').map(Number)
    const prevMo  = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`

    function monthTotals(month) {
      const inc = incomes.filter(r  => r?.date?.startsWith(month))
      const exp = expenses.filter(r => r?.date?.startsWith(month))
      const totalInc = inc.reduce((s, r) => s + (Number(r?.amount) || 0), 0)
      const totalExp = exp.reduce((s, r) => s + (Number(r?.amount) || 0), 0)
      const totalSubs = subs.filter(s => s?.status === 'active').reduce((s, sub) => {
        const amt = Number(sub.amount) || 0
        const f   = sub.frequency || 'monthly'
        if (f === 'annual' || f === 'anual') return s + amt / 12
        if (f === 'quarterly') return s + amt / 3
        if (f === 'weekly') return s + amt * 4.33
        return s + amt
      }, 0)
      // Solo deudas personales (no las de propiedades) y sin contar cuotas ya registradas como gasto
      const totalDebt = pendingDebtMonthly(debts, exp)
      const balance  = totalInc - totalExp                        // Balance neto = ingresos − gastos
      const freeFlow = totalInc - totalExp - totalDebt - totalSubs // Disponible tras deudas y suscripciones
      return { totalInc, totalExp, totalDebt, totalSubs, balance, freeFlow,
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
      delta: {
        inc:  delta(cur.totalInc,    prev.totalInc),
        exp:  delta(cur.totalExp,    prev.totalExp),
        bal:  delta(cur.balance,     prev.balance),
        save: delta(cur.savingRate,  prev.savingRate),
      }
    }
  }, [incomes, expenses, debts, subs, activeMonth])

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
        icon: '↻',
        color: 'var(--amb)',
        bg: 'color-mix(in srgb, var(--warn) 9%, transparent)',
        border: 'color-mix(in srgb, var(--warn) 24%, transparent)',
        text: t('dash.insight.subs.text', { v: `${sym}${fmt(subMonthly * 12)}` }),
        sub: t('dash.insight.subs.sub'),
      })
    }

    // Categoría principal de gasto
    if (monthExpenses.length > 0) {
      const catMap = {}
      monthExpenses.forEach(e => {
        const cat = e.category || 'Sin categoría'
        catMap[cat] = (catMap[cat] || 0) + (Number(e.amount) || 0)
      })
      const totalExp = monthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
      const topCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]
      if (topCat && totalExp > 0) {
        const catPct = ((topCat[1] / totalExp) * 100).toFixed(0)
        cards.push({
          icon: '◑',
          color: 'var(--accent2)',
          bg: 'color-mix(in srgb, var(--accent2) 9%, transparent)',
          border: 'color-mix(in srgb, var(--accent2) 22%, transparent)',
          text: t('dash.insight.topCat.text', { cat: topCat[0], pct: catPct }),
          sub: t('dash.insight.topCat.sub'),
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
          icon: pctN > 90 ? '⚠' : pctN > 80 ? '◑' : '⊞',
          color,
          bg: pctN > 90 ? 'color-mix(in srgb, var(--neg) 8%, transparent)' : pctN > 80 ? 'color-mix(in srgb, var(--warn) 9%, transparent)' : 'color-mix(in srgb, var(--pos) 8%, transparent)',
          border: pctN > 90 ? 'color-mix(in srgb, var(--neg) 24%, transparent)' : pctN > 80 ? 'color-mix(in srgb, var(--warn) 24%, transparent)' : 'color-mix(in srgb, var(--pos) 22%, transparent)',
          text: t('dash.insight.budget.text', { pct: budgetPct }),
          sub: pctN > 90 ? t('dash.insight.budget.danger') : pctN > 80 ? t('dash.insight.budget.warn') : t('dash.insight.budget.ok'),
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
          icon: '→',
          color: 'var(--accent)',
          bg: 'color-mix(in srgb, var(--pos) 8%, transparent)',
          border: 'color-mix(in srgb, var(--pos) 22%, transparent)',
          text: t('dash.insight.goal.text', { name: top.name, pct: goalPct }),
          sub: t('dash.insight.goal.sub', { v: `${sym}${fmt(Number(top.target) - Number(top.saved))}` }),
        })
      }
    }

    return cards.slice(0, 4)
  }, [subMonthly, monthExpenses, budgets, goals, sym, settings.language])

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

  // ── Historial de score semanal (localStorage) ────────────────────────────
  const SCORE_KEY = 'fos_score_history'
  const [scoreHistory, setScoreHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SCORE_KEY) || '[]') } catch { return [] }
  })

  useEffect(() => {
    if (!healthScore) return
    const week = (() => {
      const d = new Date()
      const jan1 = new Date(d.getFullYear(), 0, 1)
      return `${d.getFullYear()}-W${Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)}`
    })()
    setScoreHistory(prev => {
      const existing = prev.find(e => e.w === week)
      if (existing && existing.s === healthScore.score) return prev
      const next = [...prev.filter(e => e.w !== week), { w: week, s: healthScore.score }]
        .sort((a, b) => a.w.localeCompare(b.w))
        .slice(-8)
      try { localStorage.setItem(SCORE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [healthScore?.score])

  function ScoreSparkline({ history, currentColor }) {
    if (history.length < 2) return null
    const vals = history.map(e => e.s)
    // Escala honesta: ventana MÍNIMA de 20 pts (un ±1 no se dibuja como montaña),
    // centrada en los datos y acotada al rango real del score [0,100].
    const dataMin = Math.min(...vals), dataMax = Math.max(...vals)
    const span = Math.max(dataMax - dataMin, 20)
    const mid = (dataMin + dataMax) / 2
    const min = Math.max(0, mid - span / 2)
    const max = Math.min(100, min + span) || 100
    const W = 80, H = 28
    const pts = vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * W
      const y = H - ((v - min) / (max - min)) * H
      return `${x},${y}`
    }).join(' ')
    const prev = vals[vals.length - 2]
    const curr = vals[vals.length - 1]
    const diff = curr - prev
    const trendColor = diff > 0 ? 'var(--pos)' : diff < 0 ? 'var(--neg)' : 'var(--th)'
    const trendBg    = diff > 0 ? 'var(--pos-bg)' : diff < 0 ? 'var(--neg-bg)' : 'var(--sur3)'
    const trendTxt   = diff > 0 ? t('dash.trend.up', { n: Math.abs(diff) }) : diff < 0 ? t('dash.trend.down', { n: Math.abs(diff) }) : t('dash.trend.flat')
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        {/* Ahora también visible en móvil — es la tendencia del score, la métrica clave */}
        <span>
          <svg width={W} height={H} style={{ overflow:'visible', display:'block' }}>
            {/* #08 — relleno de área bajo la línea (tratamiento editorial dataviz):
                da peso visual a la tendencia sin competir con el trazo. */}
            <polygon points={`${pts} ${W},${H} 0,${H}`} fill={currentColor} opacity="0.10" stroke="none" />
            <polyline points={pts} fill="none" stroke={currentColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
            <circle cx={pts.split(' ').pop().split(',')[0]} cy={pts.split(' ').pop().split(',')[1]} r="3" fill={currentColor} />
          </svg>
        </span>
        <span style={{ fontSize:11, fontFamily:'var(--mono)', color: trendColor, background: trendBg, borderRadius:4, padding:'2px 6px' }}>
          {trendTxt}
        </span>
      </div>
    )
  }

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
    const boxRef = useRef(null)
    useDialogA11y(showCloseModal, dismissClose, boxRef)
    if (!showCloseModal) return null
    const balance = kpis.balance
    const ok = balance >= 0
    return (
      <div
        role="dialog" aria-modal="true" aria-label={t('dash.close.title')}
        onClick={dismissClose}
        style={{
        position:'fixed', inset:0, zIndex:500,
        background:'rgba(0,0,0,.55)', backdropFilter:'blur(4px)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:16,
      }}>
        <div ref={boxRef} tabIndex={-1} onClick={e => e.stopPropagation()} style={{
          background:'var(--sur)', border:`.5px solid var(--brd)`, borderRadius:16,
          padding:'24px 20px', maxWidth:380, width:'100%',
          maxHeight:'85vh', overflowY:'auto', outline:'none',
          boxShadow:'0 24px 64px rgba(0,0,0,.25)',
        }}>
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
              { label:t('dash.kpi.income'),    val:`${sym}${fmt(kpis.totalInc)}`,  color:'var(--accent)' },
              { label:t('dash.kpi.expenses'),      val:`${sym}${fmt(kpis.totalExp)}`,  color:'var(--red)' },
              { label:t('dash.kpi.balance'),     val:`${sym}${fmt(Math.abs(balance))}`, color: ok ? 'var(--accent)' : 'var(--red)', prefix: ok ? '+' : '−' },
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
                <div style={{ fontSize:13, fontWeight:600, color:healthScore.color }}>{healthScore.label}</div>
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
        </div>
      </div>
    )
  }

  const SEV_ICON  = { info: '◈', attention: '⚠', warning: '⊗' }
  const SEV_COLOR = { info: 'var(--accent)', attention: 'var(--amb)', warning: 'var(--red)' }

  function DeltaBadge({ d, invert = false }) {
    if (d === null) return null
    const n = Number(d)
    if (Math.abs(n) < 0.5) return null
    const up   = n > 0
    const good = invert ? !up : up
    return (
      <span style={{ fontSize:11, fontFamily:'var(--mono)', color: good ? 'var(--accent)' : 'var(--red)',
                     background: good ? 'color-mix(in srgb, var(--pos) 12%, transparent)' : 'color-mix(in srgb, var(--neg) 12%, transparent)',
                     borderRadius:4, padding:'1px 5px', marginLeft:5 }}>
        {up ? '↑' : '↓'}{Math.abs(n)}%
      </span>
    )
  }

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
    const txt = `${s.title || ''} ${s.msg || ''}`.toLowerCase()
    if (txt.includes('ahorro'))     return { label:t('dash.action.createBudget'), page:'budgets', tone:'amb' }
    if (txt.includes('suscrip'))    return { label:t('dash.action.viewSubs'), page:'subscriptions', tone:'amb' }
    if (txt.includes('deuda'))      return { label:t('dash.action.viewDebts'),        page:'debts',   tone:'red' }
    if (txt.includes('presupuesto'))return { label:t('dash.action.adjustBudget'),page:'budgets', tone:'amb' }
    if (txt.includes('meta'))       return { label:t('dash.action.viewGoals'),         page:'goals',   tone:'accent' }
    return { label:t('dash.action.viewCoach'), page:'coach', tone:'accent' }
  }

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
  const showRing = true
  const pulse = useMemo(() => {
    const { today, daysInMonth, daysLeft } = projectEndOfMonth({ incomes, expenses, activeMonth })
    // Referencia = ingreso del mes (mejor proxy de "¿voy bien para esta altura?"
    // → ritmo de gasto vs ritmo del tiempo). Fallback a gasto si no hay ingreso.
    const reference = kpis.totalInc > 0 ? kpis.totalInc : (kpis.totalExp || 1)
    const spent = kpis.totalExp
    const elapsedRatio = daysInMonth > 0 ? today / daysInMonth : 0
    const spentRatio = reference > 0 ? spent / reference : 0
    const pace = spentRatio - elapsedRatio
    const color = pace <= 0.02 ? 'var(--pos)' : pace <= 0.10 ? 'var(--warn)' : 'var(--neg)'
    const safePerDay = daysLeft > 0 ? Math.max(0, (reference - spent) / daysLeft) : 0
    return { spentRatio, elapsedRatio, color, daysLeft,
             centerValue: `${sym}${fmt(safePerDay)}`,
             refIsIncome: kpis.totalInc > 0 }
  }, [incomes, expenses, kpis.totalExp, kpis.totalInc, activeMonth, sym])

  const KPIS = [
    { label:t('dash.kpi.income'),       value:`${sym}${fmt(kpis.totalInc)}`,  color:'var(--accent)', sub:t('dash.kpi.records', { n: kpis.incCount }),                                                          delta: kpis.delta.inc,  invertDelta: false, raw: kpis.totalInc, count: true },
    { label:t('dash.kpi.expenses'),         value:`${sym}${fmt(kpis.totalExp)}`,  color:'var(--red)',    sub:t('dash.kpi.records', { n: kpis.expCount }),                                                          delta: kpis.delta.exp,  invertDelta: true,  raw: kpis.totalExp, count: true },
    { label:t('dash.kpi.balance'),   value:`${sym}${fmt(kpis.balance)}`,   color:kpis.balance >= 0 ? 'var(--accent)' : 'var(--red)', sub:(kpis.totalDebt + kpis.totalSubs > 0) ? t('dash.kpi.afterDebts', { v: `${sym}${fmt(kpis.freeFlow)}` }) : (kpis.balance >= 0 ? t('dash.kpi.incMinusExp') : t('dash.kpi.expOverInc')),      delta: kpis.delta.bal,  invertDelta: false, raw: kpis.balance, count: true },
    ...(propFlow.has ? [{ label:t('dash.kpi.totalFlow'), value:`${sym}${fmt(flujoTotal)}`, color: flujoTotal >= 0 ? 'var(--accent)' : 'var(--red)', sub:t('dash.kpi.personalPlusProps', { v: `${propFlow.net >= 0 ? '+' : '−'}${sym}${fmt(Math.abs(propFlow.net))}` }), delta: null, invertDelta: false, raw: flujoTotal, count: true }] : []),
    { label:t('dash.kpi.savingRate'), value:pct(kpis.savingRate),           color:kpis.savingRate >= 0.2 ? 'var(--accent)' : kpis.savingRate >= 0 ? 'var(--amb)' : 'var(--red)', sub:t('dash.kpi.ofIncome'), delta: kpis.delta.save, invertDelta: false, raw: null },
    { label:t('dash.kpi.subs'),  value:t('dash.kpi.perMonth', { v: `${sym}${fmt(subMonthly)}` }), color:'var(--amb)',    sub:t('dash.kpi.perYear', { v: `${sym}${fmt(subMonthly * 12)}` }),                                          delta: null,            invertDelta: false, raw: subMonthly },
  ]

  return (
    <div>
      <MonthlyCloseModal />
      <BackupReminderBanner />

      {/* Header — título + toggle de vista */}
      <div style={{ marginBottom:16, display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontFamily:'var(--mono)', fontSize:11, letterSpacing:'1.2px', textTransform:'uppercase', color:'var(--grn)', marginBottom:6 }}>Dashboard · {activeMonth}</div>
          <h1 className="display" style={{ fontSize:26, fontWeight:700, color:'var(--tx)', marginBottom:4 }}>{t('dash.title')}</h1>
        </div>
        <button onClick={toggleCompact} title={compact ? t('dash.view.show') : t('dash.view.hide')} aria-expanded={!compact}
          style={{ background:'none', border:'.5px solid var(--brd2)', borderRadius:7, padding:'6px 12px', fontSize:11, fontFamily:'var(--mono)', color:'var(--tm)', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
          {compact ? t('dash.view.detailed') : t('dash.view.compact')}
        </button>
      </div>

      {/* Estado del mes — el verdicto (¿te sobra o falta?) y el ritmo (¿vas a tiempo?)
          cuentan la misma historia desde dos ángulos: van lado a lado y ahorran scroll.
          .dash-status apila en una columna bajo 900px (el anillo necesita aire). */}
      {(() => {
        const ringOn = showRing && (kpis.incCount > 0 || kpis.expCount > 0)
        const verdict = (
          <MonthVerdict
            freeFlow={kpis.freeFlow}
            hasData={kpis.incCount > 0 || kpis.expCount > 0}
            sym={sym}
            month={activeMonth}
          />
        )
        if (!ringOn) return <div style={{ marginBottom:16 }}>{verdict}</div>
        return (
          <div className="dash-status" style={{ marginBottom:16 }}>
            {verdict}
            <div className="card rise" style={{ padding:'20px 16px', display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
              <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--th)', textTransform:'uppercase', letterSpacing:'1px' }}>
                {pulse.refIsIncome ? 'Tu ritmo del mes' : 'Ritmo de gasto'} · {activeMonth}
              </div>
              <LivingRing
                spentRatio={pulse.spentRatio}
                elapsedRatio={pulse.elapsedRatio}
                color={pulse.color}
                centerValue={pulse.centerValue}
                centerLabel="SEGURO/DÍA"
                footLabel={`quedan ${pulse.daysLeft} días`}
                size={200}
              />
              <div style={{ fontSize:11.5, color:'var(--tm)', textAlign:'center', maxWidth:340, lineHeight:1.5 }}>
                El punto que late es hoy · la marca fina es dónde deberías ir · si el arco no la alcanza, vas bien.
              </div>
            </div>
          </div>
        )
      })()}

      {/* #03 — Herramienta fiscal del país como protagonista (el foso competitivo). */}
      <CountryTool country={settings.country} setPage={setPage} />

      {/* Empieza aquí */}
      {setPage && kpis.incCount === 0 && kpis.expCount === 0 && (
        <div style={{ background:'color-mix(in srgb, var(--pos) 8%, transparent)', border:'.5px solid color-mix(in srgb, var(--pos) 28%, transparent)', borderRadius:'var(--r)', padding:'18px 20px', marginBottom:20 }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--accent)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:6 }}>{t('dash.start.title')}</div>
          <p style={{ fontSize:13, color:'var(--th)', fontFamily:'var(--mono)', marginBottom:14 }}>{t('dash.start.sub')}</p>
          {/* Vía rápida: importar la cartola arma el mes de una vez. Es el activo
              más fuerte de la app (autodetección de bancos) y estaba ausente del
              primer minuto — solo se ofrecía a mano. Va destacado, antes de los
              pasos manuales, que quedan como alternativa. */}
          <button onClick={() => setPage?.('import')} style={{
            display:'flex', alignItems:'center', gap:10, width:'100%', textAlign:'left',
            background:'var(--laton)', color:'var(--navy)', border:'none', borderRadius:'var(--r)',
            padding:'12px 14px', marginBottom:14, cursor:'pointer', fontFamily:'var(--mono)',
          }}>
            <span style={{ fontSize:18, lineHeight:1, flexShrink:0 }}>⇪</span>
            <span style={{ flex:1, fontSize:12.5, fontWeight:600, lineHeight:1.4 }}>{t('dash.start.import')}</span>
            <span style={{ fontSize:12, fontWeight:700, whiteSpace:'nowrap' }}>{t('dash.start.importbtn')} →</span>
          </button>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { n:'1', txt:t('dash.start.s1'),   btn:t('dash.start.s1btn'),    page:'income',   color:'var(--accent)' },
              { n:'2', txt:t('dash.start.s2'),         btn:t('dash.start.s2btn'),     page:'movements', color:'var(--red)' },
              { n:'3', txt:t('dash.start.s3'),        btn:t('dash.start.s3btn'),  page:'budgets',  color:'var(--amb)' },
            ].map((s,i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ width:24, height:24, borderRadius:'50%', background:'var(--laton)', color:'var(--navy)', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{s.n}</div>
                <span style={{ flex:1, fontSize:13, color:'var(--tx)' }}>{s.txt}</span>
                <button onClick={() => setPage?.(s.page)} style={{ background:'none', border:`.5px solid ${s.color}`, borderRadius:7, padding:'5px 12px', fontSize:12, fontWeight:600, color:s.color, cursor:'pointer', fontFamily:'var(--mono)', whiteSpace:'nowrap' }}>{s.btn}</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Acciones rápidas — solo en vista detallada (reduce ruido inicial) */}
      {setPage && !compact && (
        <div style={{ marginBottom:20 }}>
          <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--th)', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:10 }}>{t('dash.quick.title')}</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {[
              { label:t('dash.quick.income'),     page:'income',     color:'var(--accent)' },
              { label:t('dash.quick.expense'),      page:'movements',  color:'var(--red)' },
              { label:t('dash.quick.import'),page:'import',     color:'var(--accent2)' },
              { label:t('dash.quick.budget'), page:'budgets',    color:'var(--amb)' },
              { label:t('dash.quick.goal'),        page:'goals',      color:'var(--accent)' },
            ].map((a,i) => (
              <button key={i} onClick={() => setPage(a.page)} style={{
                background:'none', border:`.5px solid ${a.color}`, borderRadius:8,
                padding:'7px 14px', fontSize:12, fontWeight:600, color:a.color,
                cursor:'pointer', fontFamily:'var(--mono)', transition:'.15s',
                whiteSpace:'nowrap',
              }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* KPI Cards */}
      <div aria-live="polite" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:12, marginBottom:16 }}>
        {KPIS.map((k, i) => (
          <div key={i} className="card card-hover rise" style={{ padding:'14px 16px', position:'relative', overflow:'hidden', animationDelay:`${i*40}ms` }}>
            <div style={{ position:'absolute', top:-16, right:-16, width:56, height:56, borderRadius:'50%', background:`${k.color}`, opacity:.08 }}/>
            <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--th)', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:6 }}>{k.label}</div>
            <div className="num" style={{ fontSize:22, fontWeight:700, color:k.color, marginBottom:3, display:'flex', alignItems:'center', flexWrap:'wrap', gap:4 }}>
              {k.count ? <CountUp value={k.raw} format={(v) => `${sym}${fmt(v)}`} /> : k.value}
              <DeltaBadge d={k.delta} invert={k.invertDelta} />
            </div>
            <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--th)' }}>{k.sub}</div>
            {dualOn && k.raw !== null && (
              <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--th)', marginTop:4, opacity:.7, borderTop:'.5px solid var(--brd)', paddingTop:4 }}>
                {toUSD(k.raw)}
              </div>
            )}
          </div>
        ))}
      </div>

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
                {t('dash.expected.expected')} <strong>{sym}{fmt(expected)}</strong> · {t('dash.expected.received')} <strong style={{ color: over ? 'var(--accent)' : 'var(--red)' }}>{sym}{fmt(kpis.totalInc)}</strong>
              </div>
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: over ? 'var(--accent)' : 'var(--red)' }}>
              {over ? '+' : ''}{pctDiff}%
            </div>
          </div>
        )
      })()}

      {/* Insight Cards */}
      {insights.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:10, marginBottom:20 }}>
          {insights.map((ins, i) => (
            <div key={i} style={{ background:ins.bg, border:`.5px solid ${ins.border}`, borderRadius:'var(--r)', padding:'12px 14px', display:'flex', alignItems:'flex-start', gap:10 }}>
              <span style={{ fontSize:16, color:ins.color, flexShrink:0, marginTop:1 }}>{ins.icon}</span>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--tx)', marginBottom:3, lineHeight:1.45 }}>{ins.text}</div>
                <div style={{ fontSize:11, color:'var(--th)', fontFamily:'var(--mono)' }}>{ins.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* IQ Score — puntaje 0-100 de salud financiera */}
      {healthScore && (
        <div className="card rise" style={{ padding:'16px 18px', marginBottom:16, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:14, flex:1, minWidth:180 }}>
            <div style={{ textAlign:'center', flexShrink:0 }}>
              <div className="num" style={{ fontSize:34, fontWeight:700, color:healthScore.color, lineHeight:1 }}>
                {/* instrument-settle: barrido con resorte 900ms — nunca vuelve a
                    cero al re-renderizar, ver token --dur-instrument-settle */}
                <CountUp value={healthScore.score} format={(v) => Math.round(v)} duration={900} overshoot />
              </div>
              <div style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--th)', textTransform:'uppercase', letterSpacing:'.5px', marginTop:2 }}>/ 100</div>
            </div>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontFamily:'var(--mono)', color:'var(--th)', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:2 }}>
                <IconIQScore size={13} />
                {t('dash.health.title')}
              </div>
              <div style={{ fontSize:14, fontWeight:700, color:healthScore.color, marginBottom:4 }}>{healthScore.label}</div>
              <ScoreSparkline history={scoreHistory} currentColor={healthScore.color} />
            </div>
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {healthScore.breakdown.map((b, i) => (
              <div key={i} style={{ textAlign:'center', minWidth:56 }}>
                <div style={{ fontSize:13, fontWeight:700, fontFamily:'var(--mono)', color: b.pts >= b.max ? 'var(--accent)' : b.pts > 0 ? 'var(--amb)' : 'var(--red)' }}>{b.pts}</div>
                <div style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--th)', textTransform:'uppercase', letterSpacing:'.3px' }}>{b.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Señales del Diagnóstico */}
      {topSignals.length > 0 && (
        <div className="card rise" style={{ padding:'16px 18px', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <h2 style={{ margin:0, fontFamily:'var(--mono)', fontSize:10, fontWeight:600, color:'var(--th)', textTransform:'uppercase', letterSpacing:'.8px' }}>{t('dash.signals.title')}</h2>
            {setPage && (
              <button type="button" onClick={() => setPage('coach')}
                style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--accent)', cursor:'pointer', background:'none', border:0, padding:0 }}>
                {t('dash.signals.viewAll')}
              </button>
            )}
          </div>
          {topSignals.map((s, i) => (
            <div key={i} style={{ borderLeft:`3px solid ${SEV_COLOR[s.severity]}`, paddingLeft:10, marginBottom: i < topSignals.length - 1 ? 10 : 0 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                <span style={{ fontSize:12, color:SEV_COLOR[s.severity] }}>{SEV_ICON[s.severity]}</span>
                <span style={{ fontSize:11, fontWeight:600, color:SEV_COLOR[s.severity], fontFamily:'var(--mono)', textTransform:'uppercase', letterSpacing:'.4px' }}>{s.severity === 'warning' ? t('dash.sev.warning') : s.severity === 'attention' ? t('dash.sev.attention') : t('dash.sev.info')}</span>
              </div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--tx)', marginBottom:2 }}>{s.title}</div>
              <div style={{ fontSize:12, color:'var(--tm)', lineHeight:1.5 }}>{s.msg}</div>
              {(() => { const a = signalAction(s); return <InlineCTA label={a.label} page={a.page} tone={a.tone} /> })()}
            </div>
          ))}
        </div>
      )}

      {/* Proyección fin de mes */}
      {!compact && (kpis.totalInc > 0 || kpis.totalExp > 0) && (() => {
        // Cálculo compartido con la página Proyección — mismos números en ambas vistas
        const { today, daysInMonth, daysLeft, dailyExp, medianDaily, projInc, projExp, projBal, avgExp, avgExpMonths } =
          projectEndOfMonth({ incomes, expenses, activeMonth })
        const pctMonth = (today / daysInMonth * 100).toFixed(0)
        const over     = projBal < 0
        return (
          <div style={{ background:'var(--sur)', border:`.5px solid ${over ? 'color-mix(in srgb, var(--neg) 32%, transparent)' : 'var(--brd)'}`, borderRadius:'var(--r)', padding:'14px 16px', marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, flexWrap:'wrap', gap:6 }}>
              <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--th)', textTransform:'uppercase', letterSpacing:'.8px' }}>{t('dash.proj.title')}</div>
              <div style={{ fontSize:10, fontFamily:'var(--mono)', color:'var(--th)' }}>{t('dash.proj.day', { d: today, n: daysInMonth, left: daysLeft })}</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10, marginBottom:10 }}>
              {[
                { label:t('dash.proj.exp'),   value:`${sym}${fmt(projExp)}`,            color:'var(--red)',                                  rawVal: projExp },
                { label:t('dash.proj.bal'), value:`${sym}${fmt(Math.abs(projBal))}`,  color: over ? 'var(--red)' : 'var(--accent)', prefix: over ? '−' : '+', rawVal: projBal },
                { label:t('dash.proj.daily'),       value:t('dash.proj.perDay', { v: `${sym}${fmt(dailyExp)}` }),       color:'var(--th)',                                   rawVal: null },
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
                {t('dash.proj.basis', { cur: `${sym}${fmt(kpis.totalExp)}`, med: `${sym}${fmt(medianDaily)}`, left: daysLeft, avg: `${sym}${fmt(avgExp)}` })}
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, fontFamily:'var(--mono)', color:'var(--th)' }}>
              <span>{t('dash.proj.elapsed', { pct: pctMonth })}</span>
              {setPage && <button type="button" onClick={() => setPage('cashflow')} style={{ color:'var(--accent)', cursor:'pointer', background:'none', border:0, padding:0, font:'inherit' }}>{t('dash.proj.viewFull')}</button>}
            </div>
            {over && <InlineCTA label={t('dash.proj.reviewExpenses')} page="movements" tone="red" />}
          </div>
        )
      })()}

      {/* Gráficos — el donut de categorías vive también en la vista esencial
          (da vida visual sin recargar); flujo y barras solo en detallada. */}
      {monthExpenses.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))', gap:16, marginBottom:16 }}>
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
          <span style={{ fontSize:12, color:'var(--th)', fontFamily:'var(--mono)' }}>{t('dash.coachLink.text')}</span>
          <button onClick={() => setPage('coach')} style={{ background:'none', border:'.5px solid var(--brd2)', borderRadius:6, padding:'4px 12px', fontSize:11, color:'var(--accent)', cursor:'pointer', fontFamily:'var(--mono)' }}>
            {t('dash.coachLink.btn')}
          </button>
        </div>
      )}


      {/* Backup recomendado */}
      <div style={{ background:'var(--sur)', border:'.5px solid var(--brd)', borderRadius:'var(--r)', padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--th)', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:3 }}>{t('dash.backup.title')}</div>
          <div style={{ fontSize:12, color:'var(--th)', fontFamily:'var(--mono)' }}>{t('dash.backup.text')}</div>
        </div>
        {setPage && <button onClick={() => setPage?.('settings')} style={{ background:'none', border:'.5px solid var(--brd2)', borderRadius:7, padding:'5px 12px', fontSize:11, color:'var(--tx)', cursor:'pointer', fontFamily:'var(--mono)', whiteSpace:'nowrap', flexShrink:0 }}>{t('dash.backup.btn')}</button>}
      </div>
      <div style={{ fontSize:10, color:'var(--th)', fontFamily:'var(--mono)', lineHeight:1.6 }}>
        {t('dash.disclaimer')}
      </div>
    </div>
  )
}
