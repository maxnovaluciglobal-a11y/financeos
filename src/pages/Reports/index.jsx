// src/pages/Reports/index.jsx — v1.5
import { useMemo, useState } from 'react'
import { InlineIcon } from '../../components/icons/SignalIcon.jsx'
import { pdf } from '@react-pdf/renderer'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { KPI, Card, CardHeader, Alert, Empty, PageHeader } from '../../components/ui/index.jsx'
import { fmtMoney as fmtMoneyRaw, fmtPct, dateLocale, currentMonth, monthShortName, catName, subLabel, currencySymbol, fmtAxis, fmtSignedMoney, fmtPctPoints } from '../../utils/index.js'
import { ReportsDisclaimer } from '../../components/legal/MicroCopy.jsx'
import { pendingDebtMonthly } from '../../utils/personal.js'
import { effectiveBudgetLimits } from '../../utils/budgets.js'
import { calcNetWorth } from '../../utils/netWorth.js'
import { monthLabel } from '../shared/constants.js'
import MonthSelector from '../shared/MonthSelector.jsx'
import MoneyFlow from '../../components/charts/MoneyFlow.jsx'
import CategoryDonut from '../../components/charts/CategoryDonut.jsx'
import useSubscriptionMetrics from '../../hooks/useSubscriptionMetrics.js'
import ReportPDF from './ReportPDF.jsx'
import { evaluateCoach, calcCoachMetrics } from '../../data/coachRules.js'
import ProGate from '../../components/ui/ProGate.jsx'
import { usePlan } from '../../hooks/usePlan.js'
import Money, { useMoney } from '../../components/Money.jsx'
import {
  ComposedChart, LineChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  Area, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import ChartTooltip, { AXIS_TICK, GRID, PREV_LINE } from '../../components/charts/ChartTooltip.jsx'
import { totalForMonth, cumulativeByDay, prevMonthKey } from '../../utils/chartSeries.js'

export default function Reports({ setPage }) {
  const { t, lang } = useT()
  const { incomes: _incAll, expenses: _expAll, budgets, debts: allDebts, receivables, subscriptions: allSubs, goals: allGoals, settings } = useApp()
  const incomes = (_incAll || []).filter(r => !r?.inv)   // reporte personal: excluye inversión
  const expenses = (_expAll || []).filter(r => !r?.inv)
  const sym        = currencySymbol(settings.currency, settings.language)
  // Ocultar montos (T13): fmtMoney enmascara en pantalla; el PDF (ReportPDF.jsx)
  // usa su propio formateo y siempre lleva las cifras reales.
  const { m } = useMoney()
  const fmtMoney = (n, s) => m(fmtMoneyRaw(n, s))
  const subMetrics = useSubscriptionMetrics()
  const { isPro }  = usePlan()
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState(null)
  const activeMonth = settings.activeMonth || currentMonth()

  // Patrimonio neto (stock a HOY) — cálculo compartido con la página Patrimonio
  const nw = useMemo(() => calcNetWorth({ goals: allGoals, debts: allDebts, receivables, incomes: _incAll, expenses: _expAll, settings }),
    [allGoals, allDebts, receivables, _incAll, _expAll, settings])

  async function downloadPDF() {
    setPdfLoading(true)
    setPdfError(null)
    try {
      const data = {
        sym, month: activeMonth, monthLabel: monthLabel(activeMonth),
        totalIncome, totalExpense, totalSubs, totalDebt, balance, savingRate,
        savingGoalPct: settings.savingGoalPct || 25,
        necesidad, deseos, expByCat, trendData, overBudget,
        currency: settings.currency || 'CLP',
        netWorth: nw.hasData ? nw : null,
        generatedAt: new Date().toLocaleDateString(dateLocale(), { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }),
        lang,
      }
      const blob = await pdf(<ReportPDF data={data} />).toBlob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `MOY-IQ-${t('rpdf.filename')}-${activeMonth}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('PDF error:', e)
      setPdfError(t('adv.pdf.error'))
    } finally {
      setPdfLoading(false)
    }
  }

  const mIncomes    = useMemo(() => incomes.filter(r => r.date?.startsWith(activeMonth)), [incomes, activeMonth])
  const mExpenses   = useMemo(() => expenses.filter(r => r.date?.startsWith(activeMonth)), [expenses, activeMonth])

  const totalIncome  = useMemo(() => mIncomes.reduce((s,r)  => s+r.amount, 0), [mIncomes])
  const totalExpense = useMemo(() => mExpenses.reduce((s,r) => s+r.amount, 0), [mExpenses])
  const totalSubs    = useMemo(() => (Array.isArray(allSubs)?allSubs:[]).filter(s=>s?.status==='active').reduce((s,sub) => {
    const amt=Number(sub.amount)||0, f=sub.frequency||'monthly'
    if(f==='annual'||f==='anual') return s+amt/12
    if(f==='quarterly') return s+amt/3
    if(f==='weekly') return s+amt*4.33
    return s+amt
  }, 0), [allSubs])
  // Solo deudas personales y sin duplicar cuotas ya registradas como gasto del mes
  const totalDebt    = useMemo(() => pendingDebtMonthly(allDebts, mExpenses), [allDebts, mExpenses])
  const balance      = totalIncome - totalExpense                          // Balance neto = ingresos − gastos
  const freeFlow     = totalIncome - totalExpense - totalDebt - totalSubs   // Disponible tras deudas y suscripciones
  const savingRate   = totalIncome > 0 ? balance/totalIncome : 0  // sin floor: coincide con Coach/Advisor
  const necesidad    = useMemo(() => mExpenses.filter(r=>r.type==='Necesidad').reduce((s,r) => s+r.amount, 0), [mExpenses])
  const deseos       = useMemo(() => mExpenses.filter(r=>r.type==='Deseo').reduce((s,r) => s+r.amount, 0), [mExpenses])
  const expByCat     = useMemo(() => { const m={}; mExpenses.forEach(e=>{m[e.category]=(m[e.category]||0)+e.amount}); return m }, [mExpenses])
  // Límite EFECTIVO (con rollover si está activo) — mismo cálculo que la página
  // Presupuestos. Antes usaba b.limit crudo: con rollover activo, Presupuestos
  // podía decir "dentro del límite" mientras Reportes decía "excedido" para la
  // misma categoría el mismo mes.
  const effLimits    = useMemo(() => effectiveBudgetLimits({ budgets, expenses, activeMonth, settings }), [budgets, expenses, activeMonth, settings])
  const overBudget   = useMemo(() => budgets.filter(b=>(expByCat[b.category]||0)>(effLimits[b.category]||0)), [budgets, expByCat, effLimits])
  const neededToSave = Math.max(0, totalIncome*(settings.savingGoalPct/100||0.25)-Math.max(0,balance))

  const trendData = useMemo(() => {
    const months = []
    for (let i=5; i>=0; i--) {
      const base=new Date(); const d=new Date(base.getFullYear(), base.getMonth()-i, 1)
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      const lbl=monthShortName(d.getMonth())
      const inc=incomes.filter(r=>r.date?.startsWith(key)).reduce((s,r)=>s+r.amount,0)
      const exp=expenses.filter(r=>r.date?.startsWith(key)).reduce((s,r)=>s+r.amount,0)
      // Período anterior (UI-M6): el mismo mes de la ventana de 6 meses previa.
      const pd=new Date(base.getFullYear(), base.getMonth()-i-6, 1)
      const pkey=`${pd.getFullYear()}-${String(pd.getMonth()+1).padStart(2,'0')}`
      const pinc=totalForMonth(incomes, pkey), pexp=totalForMonth(expenses, pkey)
      months.push({mes:lbl, Ingresos:inc, Gastos:exp, Ahorro:Math.max(0,inc-exp), GastosPrev:pexp, AhorroPrev:Math.max(0,pinc-pexp)})
    }
    return months
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomes, expenses, settings.language])

  const coachSignals = useMemo(() => {
    if (mIncomes.length === 0 && mExpenses.length === 0) return []
    const metrics = calcCoachMetrics({ incomes, expenses, budgets, debts: allDebts, goals: [], subs: allSubs, settings })
    return evaluateCoach(metrics, t)
  }, [incomes, expenses, budgets, allDebts, allSubs, settings, mIncomes.length, mExpenses.length, t])


  const axisStyle = AXIS_TICK
  const gridStyle = GRID
  const money = (v) => fmtMoney(v, sym)
  const hasPrevExp = trendData.some(d => d.GastosPrev > 0)
  const hasPrevSav = trendData.some(d => d.AhorroPrev > 0)
  // Gasto acumulado del mes contra el mes anterior (UI-M6, Tremor "from X").
  const cumData = cumulativeByDay(expenses, activeMonth)
  const cumHasData = cumData.some(d => (d.current || 0) > 0 || d.currentPrev > 0)
  const prevMonthName = monthLabel(prevMonthKey(activeMonth))

  return (
    <div className="stack">
      <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:8}}>
        <PageHeader title={t('reports.title')} sub={t('reports.sub', { month: monthLabel(activeMonth) })} />
        <MonthSelector incomes={incomes} expenses={expenses} />
        {pdfError && <Alert type="danger">{pdfError}</Alert>}
        {isPro ? (
          <button
            onClick={downloadPDF}
            disabled={pdfLoading}
            style={{
              marginLeft:'auto', display:'flex', alignItems:'center', gap:6,
              minHeight:44, padding:'7px 14px', borderRadius:'var(--r)', border:'.5px solid ' + (pdfLoading ? 'var(--brd2)' : 'var(--laton)'),
              // Primario de marca (Latón + texto Navy). Antes era --grn con texto
              // #0f1923: tras el rebrand --grn es Navy y el texto no se leía en claro.
              background: pdfLoading ? 'var(--sur2)' : 'var(--laton)', color: pdfLoading ? 'var(--th)' : 'var(--navy)',
              fontFamily:'var(--sans)', fontWeight:600, fontSize:13, cursor: pdfLoading ? 'wait' : 'pointer',
              transition:'.2s', flexShrink:0,
            }}
          >
            {pdfLoading ? t('reports.pdf.generating') : t('reports.pdf.download')}
          </button>
        ) : (
          <a
            href="https://moyiq.app/#pricing"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginLeft:'auto', display:'flex', alignItems:'center', gap:6,
              padding:'7px 14px', borderRadius:8, border:'.5px solid var(--amb)',
              background:'rgba(245,166,35,.08)', color:'var(--amb)',
              fontFamily: 'var(--num)', fontWeight:700, fontSize:12,
              textDecoration:'none', flexShrink:0, whiteSpace:'nowrap',
            }}
          >
            <InlineIcon kind="pdf" size={13} />{t('reports.pdf.pro')}
          </a>
        )}
      </div>
      <div className="kpi-row">
        <KPI label={t('reports.kpi.balance')}  value={m(fmtSignedMoney(balance,sym))} color={balance>=0?'green':'red'} alert={balance<0 ? t('ui.state.overdrawn') : undefined} sub={(totalDebt+totalSubs>0) ? t('reports.kpi.afterDebts', { v: fmtMoney(freeFlow,sym) }) : t('reports.kpi.incMinusExp')} />
        <KPI label={t('reports.kpi.savingRate')}   value={fmtPct(savingRate)} color={savingRate>=0.25?'green':savingRate>=0?'amber':'red'} sub={t('reports.kpi.goal', { pct: fmtPct((settings.savingGoalPct||25) / 100, { decimals: 0 }) })} />
        <KPI label={t('reports.kpi.income')}      value={fmtMoney(totalIncome,sym)} />
        <KPI label={t('reports.kpi.subs')} value={fmtMoney(totalSubs,sym)} color="amber" sub={t('reports.kpi.subsSub')} />
        <KPI label={t('reports.kpi.expenses')}        value={fmtMoney(totalExpense,sym)} />
      </div>
      <div className="grid2">
        <Card>
          <CardHeader title={t('reports.chart.flow')} />
          <MoneyFlow incomes={mIncomes} expenses={mExpenses} subscriptions={Array.isArray(allSubs)?allSubs:[]} debts={Array.isArray(allDebts)?allDebts:[]} sym={sym} />
        </Card>
        <Card>
          <CardHeader title={t('reports.chart.byCat')} />
          <CategoryDonut records={mExpenses} sym={sym} maxCategories={6} />
        </Card>
        <Card>
          <CardHeader title={t('reports.rule.title')} />
          <div style={{fontSize:11,color:'var(--th)',fontFamily:'var(--sans)',lineHeight:1.5,marginTop:-2,marginBottom:10}}>{t('reports.rule.sub')}</div>
          {totalIncome === 0 ? <Empty text={t('reports.rule.empty')} cta={setPage ? t('empty.importCta') : undefined} onCta={() => setPage?.('import')} /> : (() => {
            const rules = [
              {id:'needs', label:t('reports.rule.needs'), actual:necesidad+totalDebt, ideal:totalIncome*0.5, color:'var(--grn)', max:50},
              {id:'wants', label:t('reports.rule.wants'),               actual:deseos,              ideal:totalIncome*0.3, color:'var(--amb)', max:30},
              {id:'savings', label:t('reports.rule.savings'),               actual:Math.max(0,balance), ideal:totalIncome*0.2, color:'var(--blu)', max:20},
            ]
            return (
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                {rules.map(r => {
                  const actualPct = totalIncome>0 ? r.actual/totalIncome*100 : 0
                  const ok = r.id==='savings' ? actualPct>=r.max : actualPct<=r.max
                  return (
                    <div key={r.label}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:12}}>
                        <span style={{fontWeight:500}}>{r.label}</span>
                        <span style={{fontFamily: 'var(--sans)',color:ok?'var(--grn)':'var(--red)',fontSize:11}}>{t('reports.rule.idealPct', { actual: fmtPct(actualPct / 100), max: fmtPct(r.max / 100, { decimals: 0 }), mark: '' }).trim()} <InlineIcon kind={ok ? 'ok' : 'alert'} size={12} /></span>
                      </div>
                      <div style={{height:8,background:'var(--sur3)',borderRadius:4,overflow:'hidden'}}>
                        <div style={{height:'100%',width:'100%',transform:`scaleX(${Math.min(actualPct/r.max,1)})`,transformOrigin:'left',background:ok?r.color:'var(--red)',borderRadius:4,transition:'transform .4s'}}/>
                      </div>
                      <div style={{fontSize:11,color:'var(--th)',fontFamily: 'var(--sans)',marginTop:2,display:'flex',justifyContent:'space-between'}}>
                        <span><Money>{fmtMoney(r.actual,sym)}</Money></span><span>{t('reports.rule.ideal', { v: fmtMoney(r.ideal,sym) })}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </Card>
        <Card>
          <CardHeader title={t('reports.trend.title')} />
          {trendData.every(d=>d.Ingresos===0&&d.Gastos===0) ? <Empty text={t('reports.trend.empty')} /> : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart accessibilityLayer={false} data={trendData} barGap={4} barCategoryGap="30%">
                  <CartesianGrid {...gridStyle}/>
                  <XAxis dataKey="mes" tick={axisStyle} axisLine={false} tickLine={false}/>
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v=>m(fmtAxis(v))}/>
                  <RTooltip cursor={{ fill: 'var(--grn-tint)' }} content={<ChartTooltip format={money}/>}/>
                  <Legend iconType="square" iconSize={8} wrapperStyle={{fontSize:11,fontFamily: 'var(--sans)',color:'var(--chart-axis)',paddingTop:8}}/>
                  <Bar dataKey="Ingresos" name={t('reports.trend.income')} fill="var(--chart-income)" radius={[2,2,0,0]}/>
                  <Bar dataKey="Gastos"   name={t('reports.trend.expenses')} fill="var(--chart-expense)" radius={[2,2,0,0]}/>
                  {hasPrevExp && <Line dataKey="GastosPrev" name={t('chart.expensesPrev')} type="monotone" legendType="plainline" {...PREV_LINE}/>}
                </ComposedChart>
              </ResponsiveContainer>
              {/* recharts no expone los datos del gráfico a un lector de pantalla —
                  esta tabla tiene la misma información, oculta solo visualmente. */}
              <div className="sr-only"><table>
                <caption>{t('reports.trend.title')}</caption>
                <thead><tr><th scope="col">{t('common.month')}</th><th scope="col">{t('reports.trend.income')}</th><th scope="col">{t('reports.trend.expenses')}</th></tr></thead>
                <tbody>{trendData.map(d => <tr key={d.mes}><th scope="row">{d.mes}</th><td><Money>{fmtMoney(d.Ingresos,sym)}</Money></td><td><Money>{fmtMoney(d.Gastos,sym)}</Money></td></tr>)}</tbody>
              </table></div>
            </>
          )}
        </Card>
      </div>
      {cumHasData && (
        <Card>
          <CardHeader title={t('reports.cum.title')} />
          <div style={{fontSize:12,color:'var(--th)',fontFamily:'var(--sans)',marginTop:-6,marginBottom:10}}>{t('reports.cum.sub', { prev: prevMonthName })}</div>
          <div aria-hidden="true">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart accessibilityLayer={false} data={cumData}>
              <CartesianGrid {...gridStyle}/>
              <XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18}/>
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v=>m(fmtAxis(v))} width={48}/>
              <RTooltip content={<ChartTooltip format={money} labelFormat={(d) => t('reports.cum.day', { d })}/>}/>
              <Legend iconType="plainline" iconSize={14} wrapperStyle={{fontSize:11,fontFamily:'var(--sans)',color:'var(--chart-axis)',paddingTop:8}}/>
              <Line dataKey="current" name={monthLabel(activeMonth)} type="monotone" stroke="var(--chart-expense)" strokeWidth={2} dot={false} connectNulls={false}/>
              <Line dataKey="currentPrev" name={prevMonthName} type="monotone" {...PREV_LINE}/>
            </LineChart>
          </ResponsiveContainer>
          </div>
          <div className="sr-only"><table>
            <caption>{t('reports.cum.title')}</caption>
            <thead><tr><th scope="col">{t('reports.cum.dayCol')}</th><th scope="col">{monthLabel(activeMonth)}</th><th scope="col">{prevMonthName}</th></tr></thead>
            <tbody>{cumData.filter(d => d.day % 5 === 0 || d.day === 1 || d.day === cumData.length).map(d => <tr key={d.day}><th scope="row">{d.day}</th><td>{d.current == null ? '—' : <Money>{fmtMoneyRaw(d.current,sym)}</Money>}</td><td><Money>{fmtMoneyRaw(d.currentPrev,sym)}</Money></td></tr>)}</tbody>
          </table></div>
        </Card>
      )}
      <Card>
        <CardHeader title={t('reports.savings.title')} />
        {trendData.every(d=>d.Ahorro===0) ? <Empty text={t('reports.savings.empty')} /> : (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <ComposedChart accessibilityLayer={false} data={trendData}>
                <defs>
                  <linearGradient id="ahorroGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--chart-net)" stopOpacity={0.16}/>
                    <stop offset="95%" stopColor="var(--chart-net)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridStyle}/>
                <XAxis dataKey="mes" tick={axisStyle} axisLine={false} tickLine={false}/>
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v=>m(fmtAxis(v))}/>
                <RTooltip content={<ChartTooltip format={money}/>}/>
                <ReferenceLine y={0} stroke="var(--brd2)"/>
                <Area type="monotone" dataKey="Ahorro" name={t('reports.savings.series')} stroke="var(--chart-net)" strokeWidth={2} fill="url(#ahorroGrad)"/>
                {hasPrevSav && <Line dataKey="AhorroPrev" name={t('chart.savingsPrev')} type="monotone" {...PREV_LINE}/>}
              </ComposedChart>
            </ResponsiveContainer>
            <div className="sr-only"><table>
              <caption>{t('reports.savings.title')}</caption>
              <thead><tr><th scope="col">{t('common.month')}</th><th scope="col">{t('reports.savings.series')}</th></tr></thead>
              <tbody>{trendData.map(d => <tr key={d.mes}><th scope="row">{d.mes}</th><td><Money>{fmtMoney(d.Ahorro,sym)}</Money></td></tr>)}</tbody>
            </table></div>
          </>
        )}
      </Card>
      <Card>
        <CardHeader title={t('reports.reco.title')} />
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {totalIncome===0
            ? <Alert type="info">{t('reports.reco.empty')}</Alert>
            : savingRate>=0.25
              ? <Alert type="ok">{t('reports.reco.aboveGoal', { rate: fmtPct(savingRate), goal: fmtPctPoints(settings.savingGoalPct||25) })}</Alert>
              : <Alert type="warn">{balance<0 ? t('reports.reco.belowGoal.reduce', { rate: fmtPct(savingRate), goal: fmtPctPoints(settings.savingGoalPct||25), v: fmtMoney(-balance+totalIncome*(settings.savingGoalPct/100||0.25),sym) }) : t('reports.reco.belowGoal.save', { rate: fmtPct(savingRate), goal: fmtPctPoints(settings.savingGoalPct||25), v: fmtMoney(neededToSave,sym) })}</Alert>
          }
          {overBudget.length>0
            ? <Alert type="danger">{t('reports.reco.overBudget', { cats: overBudget.map(b=>catName(b.category, lang)).join(', ') })}</Alert>
            : budgets.length>0 && <Alert type="ok">{t('reports.reco.budgetsOk')}</Alert>
          }
          {deseos>0 && totalExpense>0 && <Alert type="warn">{t('reports.reco.wants', { v: fmtMoney(deseos,sym), pct: fmtPct(deseos/totalExpense) })}</Alert>}
        </div>
      </Card>
      {subMetrics.count > 0 && (
        <Card>
          <CardHeader title={t('reports.subs.title')} />
          <div style={{fontSize:11,fontFamily: 'var(--sans)',color:'var(--th)',marginBottom:12}}>{t('reports.subs.note')}</div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:12}}>
            {[
              {lb:t('reports.subs.monthly'),v:fmtMoney(subMetrics.monthly,sym)},
              {lb:t('reports.subs.annual'),  v:fmtMoney(subMetrics.annual,sym)},
              {lb:t('reports.subs.count'),     v:`${subMetrics.count}`},
              ...(subMetrics.monthlyIncome>0?[{lb:t('reports.subs.pctIncome'),v:fmtPct(subMetrics.pct)}]:[]),
            ].map(m=>(
              <div key={m.lb} style={{flex:'1 1 110px',background: 'var(--fill)',borderRadius:6,padding:'8px 10px',border: 0}}>
                <div style={{fontSize: 12,fontFamily: 'var(--sans)', fontWeight: 600,color:'var(--th)',marginBottom:2}}>{m.lb}</div>
                <div style={{fontSize:14,fontWeight:700,fontFamily: 'var(--num)',color:'var(--tx)'}}>{m.v}</div>
              </div>
            ))}
          </div>
          {subMetrics.byCategory.length>0 && (
            <div style={{marginBottom:12}}>
              <div style={{fontSize: 12,fontFamily: 'var(--sans)', fontWeight: 600,color:'var(--th)',marginBottom:7}}>{t('reports.subs.byCat')}</div>
              {subMetrics.byCategory.map(([cat,data])=>(
                <div key={cat} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'.5px solid var(--brd)',fontSize:12}}>
                  <span style={{color:'var(--tm)'}}>{subLabel(cat, lang)}</span>
                  <span style={{fontFamily: 'var(--sans)',color:'var(--tx)'}}>{t('reports.subs.perMonthCount', { v: fmtMoney(data.monthly,sym), n: data.count })}</span>
                </div>
              ))}
            </div>
          )}
          {subMetrics.alerts.map((a,i)=><Alert key={i} type={a.type==='duplicate'?'warn':'info'}>{a.msg}</Alert>)}
          <div style={{fontSize:11,fontFamily: 'var(--sans)',color:'var(--th)',marginTop:8}}>{t('reports.subs.disclaimer')}</div>
        </Card>
      )}
      {/* Resumen de patrimonio (stock a hoy) — el desglose vive en la página Patrimonio */}
      {nw.hasData && (
        <div style={{padding:'12px 16px',background: 'var(--box-bg)', boxShadow: 'var(--box-sh)',border: 0,borderRadius:'var(--r)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:200}}>
            <div style={{fontSize: 12,fontFamily: 'var(--sans)', fontWeight: 600,color:'var(--th)',marginBottom:3}}>{t('reports.networth.title')}</div>
            <div className="num" style={{fontSize:22,fontWeight:700,color: nw.netWorth >= 0 ? 'var(--grn)' : 'var(--red)'}}>
              {nw.netWorth >= 0 ? '' : '−'}<Money>{fmtMoney(Math.abs(nw.netWorth), sym)}</Money>
            </div>
            <div style={{fontSize:11,fontFamily: 'var(--sans)',color:'var(--th)',marginTop:2}}>{t('reports.networth.formula', { a: fmtMoney(nw.totalActivos, sym), p: fmtMoney(nw.totalPasivos, sym) })}</div>
          </div>
          {setPage && (
            <button onClick={() => setPage('networth')} style={{background: 'var(--fill)',border: 0,borderRadius:7,padding:'6px 14px',minHeight:44,fontSize:12,fontWeight:600,color:'var(--accent)',cursor:'pointer',fontFamily: 'var(--num)',whiteSpace:'nowrap',flexShrink:0}}>
              {t('reports.networth.detail')}
            </button>
          )}
        </div>
      )}

      {/* La lista completa de señales vive en la página Diagnóstico (evita duplicar información) */}
      {coachSignals.length > 0 && (
        <div style={{padding:'12px 16px',background: 'var(--box-bg)', boxShadow: 'var(--box-sh)',border: 0,borderRadius:'var(--r)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
          <span style={{fontSize:12,color:'var(--th)',fontFamily:'var(--sans)',flex:1,minWidth:200,lineHeight:1.5}}><InlineIcon kind="diagnosis" size={13} />{t('reports.diag.linkText')}</span>
          {setPage && (
            <button onClick={() => setPage('coach')} style={{background: 'var(--fill)',border: 0,borderRadius:7,padding:'6px 14px',minHeight:44,fontSize:12,fontWeight:600,color:'var(--accent)',cursor:'pointer',fontFamily: 'var(--num)',whiteSpace:'nowrap',flexShrink:0}}>
              {t('reports.diag.linkBtn')}
            </button>
          )}
        </div>
      )}
      <ReportsDisclaimer />
    </div>
  )
}
