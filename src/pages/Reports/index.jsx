// src/pages/Reports/index.jsx — v1.5
import { useMemo, useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { KPI, Card, CardHeader, Alert, Empty, PageHeader } from '../../components/ui/index.jsx'
import { fmtMoney, fmtPct, dateLocale } from '../../utils/index.js'
import { ReportsDisclaimer } from '../../components/legal/MicroCopy.jsx'
import { pendingDebtMonthly } from '../../utils/personal.js'
import { effectiveBudgetLimits } from '../../utils/budgets.js'
import { calcNetWorth } from '../../utils/netWorth.js'
import { CURRENCY_SYMBOLS, monthLabel } from '../shared/constants.js'
import MonthSelector from '../shared/MonthSelector.jsx'
import MoneyFlow from '../../components/charts/MoneyFlow.jsx'
import CategoryDonut from '../../components/charts/CategoryDonut.jsx'
import useSubscriptionMetrics from '../../hooks/useSubscriptionMetrics.js'
import ReportPDF from './ReportPDF.jsx'
import { evaluateCoach, calcCoachMetrics } from '../../data/coachRules.js'
import ProGate from '../../components/ui/ProGate.jsx'
import { usePlan } from '../../hooks/usePlan.js'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  AreaChart, Area, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'

export default function Reports({ setPage }) {
  const { t } = useT()
  const { incomes: _incAll, expenses: _expAll, budgets, debts: allDebts, subscriptions: allSubs, goals: allGoals, settings } = useApp()
  const incomes = (_incAll || []).filter(r => !r?.inv)   // reporte personal: excluye inversión
  const expenses = (_expAll || []).filter(r => !r?.inv)
  const sym        = CURRENCY_SYMBOLS[settings.currency] || '$'
  const subMetrics = useSubscriptionMetrics()
  const { isPro }  = usePlan()
  const [pdfLoading, setPdfLoading] = useState(false)
  const activeMonth = settings.activeMonth || new Date().toISOString().slice(0, 7)

  // Patrimonio neto (stock a HOY) — cálculo compartido con la página Patrimonio
  const nw = useMemo(() => calcNetWorth({ goals: allGoals, debts: allDebts, incomes: _incAll, expenses: _expAll, settings }),
    [allGoals, allDebts, _incAll, _expAll, settings])

  async function downloadPDF() {
    setPdfLoading(true)
    try {
      const data = {
        sym, month: activeMonth, monthLabel: monthLabel(activeMonth),
        totalIncome, totalExpense, totalSubs, totalDebt, balance, savingRate,
        savingGoalPct: settings.savingGoalPct || 25,
        necesidad, deseos, expByCat, trendData, overBudget,
        currency: settings.currency || 'CLP',
        netWorth: nw.hasData ? nw : null,
        generatedAt: new Date().toLocaleDateString(dateLocale(), { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }),
      }
      const blob = await pdf(<ReportPDF data={data} />).toBlob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `MOY-IQ-Reporte-${activeMonth}.pdf`
      a.click()
      URL.revokeObjectURL(url)
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
      const lbl=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][d.getMonth()]
      const inc=incomes.filter(r=>r.date?.startsWith(key)).reduce((s,r)=>s+r.amount,0)
      const exp=expenses.filter(r=>r.date?.startsWith(key)).reduce((s,r)=>s+r.amount,0)
      months.push({mes:lbl, Ingresos:inc, Gastos:exp, Ahorro:Math.max(0,inc-exp)})
    }
    return months
  }, [incomes, expenses])

  const coachSignals = useMemo(() => {
    if (mIncomes.length === 0 && mExpenses.length === 0) return []
    const metrics = calcCoachMetrics({ incomes, expenses, budgets, debts: allDebts, goals: [], subs: allSubs, settings })
    return evaluateCoach(metrics, t)
  }, [incomes, expenses, budgets, allDebts, allSubs, settings, mIncomes.length, mExpenses.length])


  const axisStyle = {fill:'var(--th)',fontSize:10}
  const gridStyle = {stroke:'rgba(0,0,0,0.05)',strokeDasharray:'3 3'}
  const ttStyle   = {background:'var(--sur)',border:'0.5px solid var(--brd2)',borderRadius:8,padding:'8px 12px',fontSize:11,fontFamily:'var(--mono)'}

  return (
    <div className="stack">
      <div style={{display:'flex',alignItems:'center',flexWrap:'wrap',gap:8}}>
        <PageHeader title={t('reports.title')} sub={t('reports.sub', { month: monthLabel(activeMonth) })} />
        <MonthSelector incomes={incomes} expenses={expenses} />
        {isPro ? (
          <button
            onClick={downloadPDF}
            disabled={pdfLoading}
            style={{
              marginLeft:'auto', display:'flex', alignItems:'center', gap:6,
              padding:'7px 14px', borderRadius:8, border:'.5px solid var(--grn)',
              background: pdfLoading ? 'var(--sur2)' : 'var(--grn)', color: pdfLoading ? 'var(--th)' : '#0f1923',
              fontFamily:'var(--mono)', fontWeight:700, fontSize:12, cursor: pdfLoading ? 'wait' : 'pointer',
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
              fontFamily:'var(--mono)', fontWeight:700, fontSize:12,
              textDecoration:'none', flexShrink:0, whiteSpace:'nowrap',
            }}
          >
            {t('reports.pdf.pro')}
          </a>
        )}
      </div>
      <div className="kpi-row">
        <KPI label={t('reports.kpi.balance')}  value={fmtMoney(balance,sym)} color={balance>=0?'green':'red'} sub={(totalDebt+totalSubs>0) ? t('reports.kpi.afterDebts', { v: fmtMoney(freeFlow,sym) }) : t('reports.kpi.incMinusExp')} />
        <KPI label={t('reports.kpi.savingRate')}   value={fmtPct(savingRate)} color={savingRate>=0.25?'green':savingRate>=0.1?'amber':'red'} sub={t('reports.kpi.goal', { pct: settings.savingGoalPct||25 })} />
        <KPI label={t('reports.kpi.income')}      value={fmtMoney(totalIncome,sym)} />
        <KPI label={t('reports.kpi.subs')} value={fmtMoney(totalSubs,sym)} color="amber" sub={t('reports.kpi.subsSub')} />
        <KPI label={t('reports.kpi.expenses')}        value={fmtMoney(totalExpense,sym)} color="red" />
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
                        <span style={{fontFamily:'var(--mono)',color:ok?'var(--grn)':'var(--red)',fontSize:11}}>{t('reports.rule.idealPct', { actual: actualPct.toFixed(1), max: r.max, mark: ok?'✓':'⚠' })}</span>
                      </div>
                      <div style={{height:8,background:'var(--sur3)',borderRadius:4,overflow:'hidden'}}>
                        <div style={{height:'100%',width:'100%',transform:`scaleX(${Math.min(actualPct/r.max,1)})`,transformOrigin:'left',background:ok?r.color:'var(--red)',borderRadius:4,transition:'transform .4s'}}/>
                      </div>
                      <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginTop:2,display:'flex',justifyContent:'space-between'}}>
                        <span>{fmtMoney(r.actual,sym)}</span><span>{t('reports.rule.ideal', { v: fmtMoney(r.ideal,sym) })}</span>
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
                <BarChart data={trendData} barGap={4} barCategoryGap="30%">
                  <CartesianGrid {...gridStyle}/>
                  <XAxis dataKey="mes" tick={axisStyle} axisLine={false} tickLine={false}/>
                  <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000000?(v/1000000).toFixed(1)+'M':v>=1000?(v/1000).toFixed(0)+'K':v}/>
                  <RTooltip contentStyle={ttStyle}/>
                  <Legend wrapperStyle={{fontSize:11,fontFamily:'var(--mono)',paddingTop:8}}/>
                  <Bar dataKey="Ingresos" name={t('reports.trend.income')} fill="var(--grn)" radius={[3,3,0,0]} opacity={0.85}/>
                  <Bar dataKey="Gastos"   name={t('reports.trend.expenses')} fill="var(--red)" radius={[3,3,0,0]} opacity={0.75}/>
                </BarChart>
              </ResponsiveContainer>
              {/* recharts no expone los datos del gráfico a un lector de pantalla —
                  esta tabla tiene la misma información, oculta solo visualmente. */}
              <table className="sr-only">
                <caption>{t('reports.trend.title')}</caption>
                <thead><tr><th scope="col">{t('common.month')}</th><th scope="col">{t('reports.trend.income')}</th><th scope="col">{t('reports.trend.expenses')}</th></tr></thead>
                <tbody>{trendData.map(d => <tr key={d.mes}><th scope="row">{d.mes}</th><td>{fmtMoney(d.Ingresos,sym)}</td><td>{fmtMoney(d.Gastos,sym)}</td></tr>)}</tbody>
              </table>
            </>
          )}
        </Card>
      </div>
      <Card>
        <CardHeader title={t('reports.savings.title')} />
        {trendData.every(d=>d.Ahorro===0) ? <Empty text={t('reports.savings.empty')} /> : (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="ahorroGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--grn)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--grn)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridStyle}/>
                <XAxis dataKey="mes" tick={axisStyle} axisLine={false} tickLine={false}/>
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000000?(v/1000000).toFixed(1)+'M':v>=1000?(v/1000).toFixed(0)+'K':v}/>
                <RTooltip contentStyle={ttStyle}/>
                <ReferenceLine y={0} stroke="var(--brd2)"/>
                <Area type="monotone" dataKey="Ahorro" name={t('reports.savings.series')} stroke="var(--grn)" strokeWidth={2} fill="url(#ahorroGrad)"/>
              </AreaChart>
            </ResponsiveContainer>
            <table className="sr-only">
              <caption>{t('reports.savings.title')}</caption>
              <thead><tr><th scope="col">{t('common.month')}</th><th scope="col">{t('reports.savings.series')}</th></tr></thead>
              <tbody>{trendData.map(d => <tr key={d.mes}><th scope="row">{d.mes}</th><td>{fmtMoney(d.Ahorro,sym)}</td></tr>)}</tbody>
            </table>
          </>
        )}
      </Card>
      <Card>
        <CardHeader title={t('reports.reco.title')} />
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {totalIncome===0
            ? <Alert type="info">{t('reports.reco.empty')}</Alert>
            : savingRate>=0.25
              ? <Alert type="ok">{t('reports.reco.aboveGoal', { rate: fmtPct(savingRate), goal: settings.savingGoalPct||25 })}</Alert>
              : <Alert type="warn">{balance<0 ? t('reports.reco.belowGoal.reduce', { rate: fmtPct(savingRate), goal: settings.savingGoalPct||25, v: fmtMoney(-balance+totalIncome*(settings.savingGoalPct/100||0.25),sym) }) : t('reports.reco.belowGoal.save', { rate: fmtPct(savingRate), goal: settings.savingGoalPct||25, v: fmtMoney(neededToSave,sym) })}</Alert>
          }
          {overBudget.length>0
            ? <Alert type="danger">{t('reports.reco.overBudget', { cats: overBudget.map(b=>b.category).join(', ') })}</Alert>
            : budgets.length>0 && <Alert type="ok">{t('reports.reco.budgetsOk')}</Alert>
          }
          {deseos>0 && totalExpense>0 && <Alert type="warn">{t('reports.reco.wants', { v: fmtMoney(deseos,sym), pct: fmtPct(deseos/totalExpense) })}</Alert>}
        </div>
      </Card>
      {subMetrics.count > 0 && (
        <Card>
          <CardHeader title={t('reports.subs.title')} />
          <div style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--th)',marginBottom:12}}>{t('reports.subs.note')}</div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:12}}>
            {[
              {lb:t('reports.subs.monthly'),v:fmtMoney(subMetrics.monthly,sym)},
              {lb:t('reports.subs.annual'),  v:fmtMoney(subMetrics.annual,sym)},
              {lb:t('reports.subs.count'),     v:`${subMetrics.count}`},
              ...(subMetrics.monthlyIncome>0?[{lb:t('reports.subs.pctIncome'),v:`${(subMetrics.pct*100).toFixed(1)}%`}]:[]),
            ].map(m=>(
              <div key={m.lb} style={{flex:'1 1 110px',background:'var(--sur2)',borderRadius:6,padding:'8px 10px',border:'.5px solid var(--brd)'}}>
                <div style={{fontSize:9,fontFamily:'var(--mono)',color:'var(--th)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:2}}>{m.lb}</div>
                <div style={{fontSize:14,fontWeight:700,fontFamily:'var(--mono)',color:'var(--tx)'}}>{m.v}</div>
              </div>
            ))}
          </div>
          {subMetrics.byCategory.length>0 && (
            <div style={{marginBottom:12}}>
              <div style={{fontSize:9,fontFamily:'var(--mono)',color:'var(--th)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:7}}>{t('reports.subs.byCat')}</div>
              {subMetrics.byCategory.map(([cat,data])=>(
                <div key={cat} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'.5px solid var(--brd)',fontSize:12}}>
                  <span style={{color:'var(--tm)'}}>{cat}</span>
                  <span style={{fontFamily:'var(--mono)',color:'var(--tx)'}}>{t('reports.subs.perMonthCount', { v: fmtMoney(data.monthly,sym), n: data.count })}</span>
                </div>
              ))}
            </div>
          )}
          {subMetrics.alerts.map((a,i)=><Alert key={i} type={a.type==='duplicate'?'warn':'info'}>{a.msg}</Alert>)}
          <div style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--th)',marginTop:8}}>{t('reports.subs.disclaimer')}</div>
        </Card>
      )}
      {/* Resumen de patrimonio (stock a hoy) — el desglose vive en la página Patrimonio */}
      {nw.hasData && (
        <div style={{padding:'12px 16px',background:'var(--sur)',border:'.5px solid var(--brd)',borderRadius:'var(--r)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
          <div style={{flex:1,minWidth:200}}>
            <div style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--th)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:3}}>{t('reports.networth.title')}</div>
            <div className="num" style={{fontSize:22,fontWeight:700,color: nw.netWorth >= 0 ? 'var(--grn)' : 'var(--red)'}}>
              {nw.netWorth >= 0 ? '' : '-'}{fmtMoney(Math.abs(nw.netWorth), sym)}
            </div>
            <div style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--th)',marginTop:2}}>{t('reports.networth.formula', { a: fmtMoney(nw.totalActivos, sym), p: fmtMoney(nw.totalPasivos, sym) })}</div>
          </div>
          {setPage && (
            <button onClick={() => setPage('networth')} style={{background:'none',border:'.5px solid var(--brd2)',borderRadius:7,padding:'6px 14px',fontSize:12,fontWeight:600,color:'var(--accent)',cursor:'pointer',fontFamily:'var(--mono)',whiteSpace:'nowrap',flexShrink:0}}>
              {t('reports.networth.detail')}
            </button>
          )}
        </div>
      )}

      {/* La lista completa de señales vive en la página Diagnóstico (evita duplicar información) */}
      {coachSignals.length > 0 && (
        <div style={{padding:'12px 16px',background:'var(--sur)',border:'.5px solid var(--brd)',borderRadius:'var(--r)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
          <span style={{fontSize:12,color:'var(--th)',fontFamily:'var(--mono)',flex:1,minWidth:200,lineHeight:1.5}}>{t('reports.diag.linkText')}</span>
          {setPage && (
            <button onClick={() => setPage('coach')} style={{background:'none',border:'.5px solid var(--brd2)',borderRadius:7,padding:'6px 14px',fontSize:12,fontWeight:600,color:'var(--accent)',cursor:'pointer',fontFamily:'var(--mono)',whiteSpace:'nowrap',flexShrink:0}}>
              {t('reports.diag.linkBtn')}
            </button>
          )}
        </div>
      )}
      <ReportsDisclaimer />
    </div>
  )
}
