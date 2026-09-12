// src/pages/CashFlow/index.jsx
// Proyección de flujo de caja — 30/60/90 días
// Basado en transacciones recurrentes detectadas + saldo actual

import { useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { KPI, Card, CardHeader, Alert, Empty, ProgressBar, PageHeader } from '../../components/ui/index.jsx'
import ProGate from '../../components/ui/ProGate.jsx'
import { fmtMoney, fmtPct, moneyLocale } from '../../utils/index.js'
import { projectEndOfMonth } from '../../utils/projection.js'
import { effectiveBudgetLimits } from '../../utils/budgets.js'
import { CURRENCY_SYMBOLS } from '../shared/constants.js'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Legend,
} from 'recharts'

const ChartTooltip = ({ active, payload, label, sym }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--sur)', border: '0.5px solid var(--brd2)', borderRadius: 8, padding: '8px 12px', fontSize: 11, fontFamily: 'var(--mono)', boxShadow: '0 4px 12px rgba(0,0,0,.1)' }}>
      <div style={{ color: 'var(--tm)', marginBottom: 4, fontWeight: 500 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, display: 'flex', gap: 12, justifyContent: 'space-between' }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 600 }}>{sym}{Math.abs(Math.round(p.value)).toLocaleString(moneyLocale())}</span>
        </div>
      ))}
    </div>
  )
}

export default function CashFlow({ setPage }) {
  const { t } = useT()
  const { incomes: _incAll, expenses: _expAll, budgets, settings } = useApp()
  const incomes = (_incAll || []).filter(r => !r?.inv)   // proyección personal: excluye inversión
  const expenses = (_expAll || []).filter(r => !r?.inv)
  const sym = CURRENCY_SYMBOLS[settings.currency] || '$'

  // ── Detectar recurrentes ──────────────────────────────────────────────────
  const recurringInc = useMemo(() =>
    incomes.filter(r => r.recurrence && r.recurrence !== 'Único')
  , [incomes])

  const recurringExp = useMemo(() =>
    expenses.filter(r => r.recurrence && r.recurrence !== 'Único')
  , [expenses])

  // ── Calcular flujo mensual recurrente ─────────────────────────────────────
  const monthlyRecInc = useMemo(() => {
    return recurringInc.reduce((s, r) => {
      const amt = r.recurrence === 'Semanal' ? r.amount * 4.33
                : r.recurrence === 'Quincenal' ? r.amount * 2
                : r.amount
      return s + amt
    }, 0)
  }, [recurringInc])

  const monthlyRecExp = useMemo(() => {
    return recurringExp.reduce((s, r) => {
      const amt = r.recurrence === 'Semanal' ? r.amount * 4.33
                : r.recurrence === 'Quincenal' ? r.amount * 2
                : r.amount
      return s + amt
    }, 0)
  }, [recurringExp])

  // ── Saldo actual del mes activo ───────────────────────────────────────────
  const activeMonth = settings.activeMonth || new Date().toISOString().slice(0, 7)
  const curInc  = incomes.filter(r => r.date?.startsWith(activeMonth)).reduce((s, r) => s + r.amount, 0)
  const curExp  = expenses.filter(r => r.date?.startsWith(activeMonth)).reduce((s, r) => s + r.amount, 0)
  const curBal  = curInc - curExp

  // ── Estimación mensual REALISTA: promedio de los últimos meses con datos ──────
  // Incluye TODOS los movimientos (recurrentes + únicos/variables), porque los
  // gastos "Único" de un mes normalmente se repiten con variaciones el mes siguiente.
  const monthsWithData = useMemo(() => {
    const set = new Set()
    incomes.forEach(r => r.date && set.add(r.date.slice(0, 7)))
    expenses.forEach(r => r.date && set.add(r.date.slice(0, 7)))
    return [...set].sort()
  }, [incomes, expenses])

  const monthlyEstimate = useMemo(() => {
    const nowMonth = new Date().toISOString().slice(0, 7)
    // Preferimos meses COMPLETOS (distintos del mes en curso); si no hay, usamos lo que haya
    let months = monthsWithData.filter(m => m < nowMonth)
    let partial = false
    if (months.length === 0) { months = monthsWithData.slice(); partial = true }
    const last = months.slice(-3) // últimos 3 meses
    const sumMonth = (arr, m) => arr.filter(r => r.date?.startsWith(m)).reduce((s, r) => s + (Number(r.amount) || 0), 0)
    const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0
    return {
      avgInc: avg(last.map(m => sumMonth(incomes, m))),
      avgExp: avg(last.map(m => sumMonth(expenses, m))),
      monthsUsed: last.length,
      partial,
    }
  }, [incomes, expenses, monthsWithData])

  const monthlyNetFlow = monthlyEstimate.avgInc - monthlyEstimate.avgExp

  // ── Proyección fin de mes ─────────────────────────────────────────────────
  // Límite EFECTIVO (con rollover si está activo) — mismo cálculo que la página
  // Presupuestos. Antes sumaba b.limit crudo: con rollover activo, el "ritmo de
  // gasto" se calculaba contra un presupuesto más chico del que el usuario
  // realmente tenía disponible ese mes.
  const effLimits = useMemo(() => effectiveBudgetLimits({ budgets, expenses, activeMonth, settings }), [budgets, expenses, activeMonth, settings])
  const eomProjection = useMemo(() => {
    // Núcleo compartido con el Dashboard (mismos números en ambas vistas)
    const core = projectEndOfMonth({ incomes, expenses, activeMonth })
    const totalBudget = budgets.reduce((s, b) => s + (effLimits[b.category] || 0), 0)
    const pctBudgetUsed = totalBudget > 0 ? core.curExp / totalBudget : null
    const pace = pctBudgetUsed !== null ? pctBudgetUsed - core.pctElapsed : null
    return { ...core, pctMonthElapsed: core.pctElapsed, totalBudget, pctBudgetUsed, pace }
  }, [incomes, expenses, activeMonth, budgets, effLimits])

  // ── Proyección 6 meses hacia adelante ────────────────────────────────────
  const projectionData = useMemo(() => {
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    const result = []
    let balance = curBal

    for (let i = 0; i < 6; i++) {
      const base = new Date()
      const d = new Date(base.getFullYear(), base.getMonth() + i, 1)
      const label = months[d.getMonth()] + ' ' + d.getFullYear().toString().slice(2)
      if (i === 0) {
        // Mes actual = DATO. Sirve de puente: aparece en ambas series para que
        // la línea real (sólida) y la estimada (punteada) se conecten.
        result.push({ mes: label, Balance: balance, BalanceReal: balance, BalanceEst: balance, Ingresos: monthlyEstimate.avgInc, Gastos: monthlyEstimate.avgExp, actual: true })
      } else {
        balance += monthlyNetFlow
        result.push({ mes: label, Balance: balance, BalanceReal: null, BalanceEst: balance, Ingresos: monthlyEstimate.avgInc, Gastos: monthlyEstimate.avgExp })
      }
    }
    return result
  }, [curBal, monthlyEstimate, monthlyNetFlow])

  // ── Hitos de 30/60/90 días ────────────────────────────────────────────────
  const bal30  = curBal + monthlyNetFlow
  const bal60  = curBal + monthlyNetFlow * 2
  const bal90  = curBal + monthlyNetFlow * 3
  const trend  = monthlyNetFlow > 0 ? 'positivo' : monthlyNetFlow < 0 ? 'negativo' : 'neutro'

  const axisStyle = { fill: 'var(--th)', fontSize: 10 }
  const gridStyle = { stroke: 'var(--chart-grid)', strokeDasharray: '3 3' }

  const hasData = monthsWithData.length > 0

  return (
    <ProGate feature={t('cf.proGateFeature')} feminine>
    <div className="stack">
      <PageHeader
        title={t('cf.title')}
        sub={t('cf.sub')}
      />

      {/* Antes este aviso vivía en el disclaimer de letra chica al pie de la
          página — alguien que escanea (no lee párrafos largos) nunca lo veía,
          y es el único aviso de toda la pantalla cuyo costo de ignorarlo es
          perder datos de verdad. */}
      <Alert type="warning">{t('cf.incognitoWarning')}</Alert>

      {!hasData && (
        <Alert type="info">
          <div style={{ marginBottom: setPage ? 10 : 0 }}>
            <strong>{t('cf.empty.strong')}</strong>{t('cf.empty.text')}
          </div>
          {setPage && (
            <button onClick={() => setPage('movements')}
              style={{ background:'var(--accent)', color:'#0f1923', border:'none', borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:700, fontFamily:'var(--mono)', cursor:'pointer' }}>
              {t('cf.empty.btn')}
            </button>
          )}
        </Alert>
      )}

      {hasData && (monthlyEstimate.partial || monthlyEstimate.monthsUsed < 2) && (
        <Alert type="warn">
          {t('cf.partial.text', { src: monthlyEstimate.partial ? t('cf.partial.currentOnly') : t('cf.partial.nMonths', { n: monthlyEstimate.monthsUsed }) })}
        </Alert>
      )}

      {/* ── Proyección fin de mes ── */}
      {(curInc > 0 || curExp > 0) && (() => {
        const { today, daysInMonth, daysLeft, dailyExp, projInc, projExp, projBal, totalBudget, pctMonthElapsed, pctBudgetUsed, pace } = eomProjection
        const paceColor = pace === null ? 'var(--th)' : pace > 0.08 ? 'var(--red)' : pace > 0 ? 'var(--amb)' : 'var(--accent)'
        const paceLabel = pace === null ? '—' : pace > 0.08 ? t('cf.pace.fast') : pace > 0 ? t('cf.pace.high') : t('cf.pace.ok')
        const barPct    = Math.min(pctMonthElapsed * 100, 100)
        const budgetBarPct = pctBudgetUsed !== null ? Math.min(pctBudgetUsed * 100, 100) : null
        return (
          <Card>
            <CardHeader title={t('cf.eom.title', { month: activeMonth })} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
              {[
                { label: t('cf.eom.day'), value: t('cf.eom.dayValue', { d: today, n: daysInMonth }), sub: t('cf.eom.daysLeft', { n: daysLeft }), color: 'var(--tx)' },
                { label: t('cf.eom.dailyExp'), value: `${sym}${Math.round(dailyExp).toLocaleString(moneyLocale())}`, sub: t('cf.eom.avgToDate'), color: 'var(--red)' },
                { label: t('cf.eom.projInc'), value: `${sym}${Math.round(projInc).toLocaleString(moneyLocale())}`, sub: t('cf.eom.atPace'), color: 'var(--accent)' },
                { label: t('cf.eom.projExp'), value: `${sym}${Math.round(projExp).toLocaleString(moneyLocale())}`, sub: t('cf.eom.atPace'), color: 'var(--red)' },
                { label: t('cf.eom.projBal'), value: `${sym}${Math.round(projBal).toLocaleString(moneyLocale())}`, sub: projBal >= 0 ? t('cf.eom.positive') : t('cf.eom.deficit'), color: projBal >= 0 ? 'var(--accent)' : 'var(--red)' },
              ].map(k => (
                <div key={k.label} style={{ background: 'var(--sur2)', borderRadius: 8, padding: '10px 12px', border: '.5px solid var(--brd)' }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--mono)', color: k.color, marginBottom: 2 }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)' }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Barras de progreso */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--th)', marginBottom: 4 }}>
                  <span>{t('cf.eom.monthElapsed')}</span>
                  <span>{barPct.toFixed(0)}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--brd2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${barPct}%`, background: 'var(--accent)', borderRadius: 3, transition: '.3s' }} />
                </div>
              </div>
              {budgetBarPct !== null && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--th)', marginBottom: 4 }}>
                    <span>{t('cf.eom.budgetUsed')}</span>
                    <span style={{ color: paceColor }}>{budgetBarPct.toFixed(0)}% · {paceLabel}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--brd2)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${budgetBarPct}%`, background: paceColor, borderRadius: 3, transition: '.3s' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)', marginTop: 4 }}>
                    {t('cf.eom.budgetLine', { total: sym+totalBudget.toLocaleString(moneyLocale()), spent: sym+Math.round(curExp).toLocaleString(moneyLocale()) })}
                  </div>
                </div>
              )}
            </div>

            {/* Alerta de ritmo */}
            {pace !== null && pace > 0.08 && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255,77,106,.07)', border: '.5px solid rgba(255,77,106,.25)', borderRadius: 8, fontSize: 11, color: 'var(--red)', fontFamily: 'var(--mono)' }}>
                {t('cf.alert.over', { pct: (pace * 100).toFixed(0), proj: sym+Math.round(projExp).toLocaleString(moneyLocale()), overBudget: totalBudget > 0 ? t('cf.alert.overBudgetPart', { v: sym+Math.round(projExp - totalBudget).toLocaleString(moneyLocale()) }) : '' })}
              </div>
            )}
            {pace !== null && pace <= 0 && curExp > 0 && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--accent-bg)', border: '.5px solid var(--accent)', borderRadius: 8, fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>
                {t('cf.alert.under', { pct: Math.abs((pace * 100).toFixed(0)) })}
              </div>
            )}
          </Card>
        )
      })()}

      {/* KPIs de proyección */}
      <div className="kpi-row">
        <KPI label={t('cf.kpi.netFlow')}
          value={fmtMoney(monthlyNetFlow, sym)}
          color={monthlyNetFlow > 0 ? 'green' : monthlyNetFlow < 0 ? 'red' : 'default'}
          sub={trend === 'positivo' ? t('cf.kpi.trendUp') : trend === 'negativo' ? t('cf.kpi.trendDown') : t('cf.kpi.trendFlat')} />
        <KPI label={t('cf.kpi.bal30')}  value={fmtMoney(bal30, sym)}  color={bal30 > 0 ? 'green' : 'red'} />
        <KPI label={t('cf.kpi.bal60')}  value={fmtMoney(bal60, sym)}  color={bal60 > 0 ? 'green' : 'red'} />
        <KPI label={t('cf.kpi.bal90')}  value={fmtMoney(bal90, sym)}  color={bal90 > 0 ? 'green' : 'red'} />
      </div>

      {/* Gráfico de proyección */}
      <Card>
        <CardHeader title={t('cf.chart.title')} />
        {!hasData
          ? <Empty text={t('cf.chart.empty')} cta={setPage ? t('empty.importCta') : undefined} onCta={() => setPage?.('import')} />
          : (
            <>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={projectionData}>
                <defs>
                  <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--grn)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--grn)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="balGradNeg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--red)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--red)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridStyle} />
                <XAxis dataKey="mes" tick={axisStyle} axisLine={false} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000000 ? (v/1000000).toFixed(1)+'M' : v >= 1000 ? (v/1000).toFixed(0)+'K' : v} />
                <Tooltip content={<ChartTooltip sym={sym} />} />
                {/* Zona estimada: todo lo que va del 2º mes en adelante es proyección */}
                {projectionData.length > 1 && (
                  <ReferenceArea x1={projectionData[1].mes} x2={projectionData[projectionData.length-1].mes}
                    fill="var(--th)" fillOpacity={0.06} strokeOpacity={0}
                    label={{ value: t('cf.chart.estimate'), position: 'insideTopRight', fontSize: 9, fill: 'var(--th)', fontFamily: 'var(--mono)' }} />
                )}
                <ReferenceLine y={0} stroke="var(--red)" strokeDasharray="4 2" strokeWidth={1.5} />
                {/* Real = sólido con relleno */}
                <Area type="monotone" dataKey="BalanceReal" name={t('cf.chart.series')} connectNulls={false}
                  stroke={monthlyNetFlow >= 0 ? 'var(--grn)' : 'var(--red)'} strokeWidth={2.5}
                  fill={monthlyNetFlow >= 0 ? 'url(#balGrad)' : 'url(#balGradNeg)'} />
                {/* Estimado = punteado, sin relleno (comunica incertidumbre, no inventa bandas) */}
                <Area type="monotone" dataKey="BalanceEst" name={t('cf.chart.estimate')} connectNulls={false}
                  stroke={monthlyNetFlow >= 0 ? 'var(--grn)' : 'var(--red)'} strokeWidth={2}
                  strokeDasharray="5 4" strokeOpacity={0.75} fill="none" />
              </AreaChart>
            </ResponsiveContainer>
            {/* recharts no expone los datos a un lector de pantalla — misma
                información que el gráfico, oculta solo visualmente. */}
            <table className="sr-only">
              <caption>{t('cf.chart.title')}</caption>
              <thead><tr><th scope="col">{t('common.month')}</th><th scope="col">{t('cf.chart.series')}{projectionData.some(d=>!d.actual) ? ` / ${t('cf.chart.estimate')}` : ''}</th></tr></thead>
              <tbody>{projectionData.map(d => <tr key={d.mes}><th scope="row">{d.mes}{d.actual ? '' : ` (${t('cf.chart.estimate')})`}</th><td>{fmtMoney(d.Balance, sym)}</td></tr>)}</tbody>
            </table>
            </>
          )
        }
      </Card>

      {/* Detalle de recurrentes */}
      <div className="grid2">

        <Card>
          <CardHeader title={t('cf.recInc.title', { n: recurringInc.length })} />
          {recurringInc.length === 0
            ? <Empty text={t('cf.recInc.empty')} />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {recurringInc.map(r => {
                  const mensual = r.recurrence === 'Semanal' ? r.amount * 4.33
                                : r.recurrence === 'Quincenal' ? r.amount * 2
                                : r.amount
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '0.5px solid var(--brd)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--tx)' }}>{r.source}</div>
                        <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)' }}>{r.recurrence} · {r.category}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 500, color: 'var(--grn)' }}>+{t('cf.rec.perMonth', { v: fmtMoney(mensual, sym) })}</div>
                        <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)' }}>{t('cf.rec.original', { v: fmtMoney(r.amount, sym) })}</div>
                      </div>
                    </div>
                  )
                })}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 12, fontWeight: 600, borderTop: '0.5px solid var(--brd2)', marginTop: 2 }}>
                  <span>{t('cf.rec.totalMonthly')}</span>
                  <span style={{ color: 'var(--grn)', fontFamily: 'var(--mono)' }}>+{fmtMoney(monthlyRecInc, sym)}</span>
                </div>
              </div>
            )
          }
        </Card>

        <Card>
          <CardHeader title={t('cf.recExp.title', { n: recurringExp.length })} />
          {recurringExp.length === 0
            ? <Empty text={t('cf.recExp.empty')} />
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {recurringExp.map(r => {
                  const mensual = r.recurrence === 'Semanal' ? r.amount * 4.33
                                : r.recurrence === 'Quincenal' ? r.amount * 2
                                : r.amount
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '0.5px solid var(--brd)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--tx)' }}>{r.description}</div>
                        <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)' }}>{r.recurrence} · {r.category}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 500, color: 'var(--red)' }}>-{t('cf.rec.perMonth', { v: fmtMoney(mensual, sym) })}</div>
                        <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)' }}>{t('cf.rec.original', { v: fmtMoney(r.amount, sym) })}</div>
                      </div>
                    </div>
                  )
                })}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 12, fontWeight: 600, borderTop: '0.5px solid var(--brd2)', marginTop: 2 }}>
                  <span>{t('cf.rec.totalMonthly')}</span>
                  <span style={{ color: 'var(--red)', fontFamily: 'var(--mono)' }}>-{fmtMoney(monthlyRecExp, sym)}</span>
                </div>
              </div>
            )
          }
        </Card>

      </div>

      {/* Análisis del flujo */}
      {hasData && (
        <Card>
          <CardHeader title={t('cf.analysis.title')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {monthlyNetFlow > 0 && (
              <Alert type="ok">
                {t('cf.analysis.positive', { v: fmtMoney(monthlyNetFlow, sym), b90: fmtMoney(bal90, sym) })}
              </Alert>
            )}
            {monthlyNetFlow < 0 && (
              <Alert type="danger">
                {t('cf.analysis.negative', { v: fmtMoney(-monthlyNetFlow, sym), b90: fmtMoney(bal90, sym) })}
              </Alert>
            )}
            {monthlyNetFlow === 0 && (
              <Alert type="warn">
                {t('cf.analysis.zero')}
              </Alert>
            )}
            {recurringExp.length > 0 && (
              <Alert type="info">
                {t('cf.analysis.recap', { n: recurringExp.length, v: fmtMoney(monthlyRecExp, sym), pct: fmtPct(monthlyRecInc > 0 ? monthlyRecExp / monthlyRecInc : 0) })}
              </Alert>
            )}
          </div>
        </Card>
      )}

      <div style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)', padding: '4px 0', lineHeight: 1.5 }}>
        {t('cf.disclaimer')}
      </div>
    </div>
    </ProGate>
  )
}
