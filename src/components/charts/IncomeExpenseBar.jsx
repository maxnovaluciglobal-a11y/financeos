// src/components/charts/IncomeExpenseBar.jsx
import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { ChartEmpty } from './ChartCard.jsx'
import { moneyLocale, monthShortName } from '../../utils/index.js'
import { useT } from '../../i18n/useT.js'
import { useMoney, MONEY_MASK } from '../Money.jsx'

function CustomTooltip({ active, payload, label, sym, m, t }) {
  if (!active || !payload?.length) return null
  const inc = payload.find(p => p.dataKey === 'ingresos')?.value || 0
  const exp = payload.find(p => p.dataKey === 'gastos')?.value || 0
  const f = v => m(`${sym}${(v || 0).toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })}`)
  return (
    <div style={{ background:'var(--sur2)', border:'.5px solid var(--brd2)', borderRadius:8, padding:'10px 14px', fontSize:12, fontFamily:'var(--mono)' }}>
      <div style={{ fontWeight:600, color:'var(--tx)', marginBottom:6 }}>{label}</div>
      <div style={{ color:'var(--accent)', marginBottom:2 }}>{t('chart.tooltip.income', { amount: f(inc) })}</div>
      <div style={{ color:'var(--red)', marginBottom:4 }}>{t('chart.tooltip.expenses', { amount: f(exp) })}</div>
      <div style={{ color:'var(--th)', borderTop:'.5px solid var(--brd)', paddingTop:4 }}>{t('chart.tooltip.net', { amount: f(inc - exp) })}</div>
    </div>
  )
}

export default function IncomeExpenseBar({ incomes, expenses, sym = '$', months = 6 }) {
  const { hidden, m } = useMoney()
  const { t, lang } = useT()
  const safeInc = Array.isArray(incomes)  ? incomes  : []
  const safeExp = Array.isArray(expenses) ? expenses : []

  const data = useMemo(() => {
    const now = new Date()
    const result = []
    for (let i = months - 1; i >= 0; i--) {
      const d  = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const inc = safeInc.filter(r => r?.date?.startsWith(key)).reduce((s, r) => s + (Number(r?.amount) || 0), 0)
      const exp = safeExp.filter(r => r?.date?.startsWith(key)).reduce((s, r) => s + (Number(r?.amount) || 0), 0)
      result.push({ mes: monthShortName(d.getMonth()), ingresos: Math.round(inc), gastos: Math.round(exp) })
    }
    return result
    // lang: el nombre del mes cambia con el idioma
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeInc, safeExp, months, lang])

  const hasData = data.some(d => d.ingresos > 0 || d.gastos > 0)
  if (!hasData) return <ChartEmpty msg={t('chart.empty.incomeExpense')} />

  const maxVal = Math.max(...data.flatMap(d => [d.ingresos, d.gastos]), 1)
  // Ocultar montos (T13): el eje Y también es una cifra legible.
  const tickFmt = v => hidden ? MONEY_MASK : v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barGap={3} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false}/>
        <XAxis dataKey="mes" tick={{ fill:'var(--th)', fontSize:11, fontFamily:'var(--mono)' }} axisLine={false} tickLine={false}/>
        <YAxis domain={[0, Math.ceil(maxVal * 1.15)]} tick={{ fill:'var(--th)', fontSize:10, fontFamily:'var(--mono)' }} axisLine={false} tickLine={false} tickFormatter={tickFmt}/>
        <Tooltip content={<CustomTooltip sym={sym} m={m} t={t}/>} cursor={{ fill:'rgba(255,255,255,.03)' }}/>
        <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--th)', paddingTop:8 }}/>
        <Bar dataKey="ingresos" name={t('chart.income')} fill="var(--accent)" radius={[3,3,0,0]} maxBarSize={32}/>
        <Bar dataKey="gastos"   name={t('chart.expenses')} fill="var(--red)"    radius={[3,3,0,0]} maxBarSize={32}/>
      </BarChart>
    </ResponsiveContainer>
  )
}
