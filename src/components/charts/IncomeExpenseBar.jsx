// src/components/charts/IncomeExpenseBar.jsx
import { useMemo } from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import ChartTooltip, { AXIS_TICK, GRID, PREV_LINE } from './ChartTooltip.jsx'
import { monthKeys, totalForMonth } from '../../utils/chartSeries.js'
import { ChartEmpty } from './ChartCard.jsx'
import { fmtMoney, fmtAxis, monthShortName } from '../../utils/index.js'
import { useT } from '../../i18n/useT.js'
import { useMoney, MONEY_MASK } from '../Money.jsx'

// Centavos: se redondea a 2 decimales (no a enteros) para que el tooltip de
// US$42.50 no diga $43.00.
const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100

export default function IncomeExpenseBar({ incomes, expenses, sym = '$', months = 6 }) {
  const { hidden, m } = useMoney()
  const { t, lang } = useT()
  const safeInc = Array.isArray(incomes)  ? incomes  : []
  const safeExp = Array.isArray(expenses) ? expenses : []

  // Período anterior (UI-M6): los gastos de los `months` meses previos a la
  // ventana, alineados por posición; línea gris punteada.
  const data = useMemo(() => {
    const now = new Date()
    const cur = monthKeys(months, 0, now)
    const prev = monthKeys(months, months, now)
    return cur.map((key, i) => ({
      mes: monthShortName(Number(key.slice(5, 7)) - 1),
      ingresos: round2(totalForMonth(safeInc, key)),
      gastos: round2(totalForMonth(safeExp, key)),
      gastosPrev: round2(totalForMonth(safeExp, prev[i])),
    }))
    // lang: el nombre del mes cambia con el idioma
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeInc, safeExp, months, lang])
  const hasPrev = data.some(d => d.gastosPrev > 0)

  const hasData = data.some(d => d.ingresos > 0 || d.gastos > 0)
  if (!hasData) return <ChartEmpty msg={t('chart.empty.incomeExpense')} />

  const maxVal = Math.max(...data.flatMap(d => [d.ingresos, d.gastos, hasPrev ? d.gastosPrev : 0]), 1)
  // Ocultar montos (T13): el eje Y también es una cifra legible.
  const tickFmt = v => hidden ? MONEY_MASK : fmtAxis(v)

  // A11Y-3: Recharts no expone los datos; tabla oculta solo visualmente con la
  // misma información (patrón de Reportes) y el gráfico fuera del árbol accesible.
  return (
    <>
    <div aria-hidden="true">
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart accessibilityLayer={false} data={data} barGap={3} barCategoryGap="30%">
        <CartesianGrid {...GRID}/>
        <XAxis dataKey="mes" tick={AXIS_TICK} axisLine={false} tickLine={false}/>
        <YAxis domain={[0, Math.ceil(maxVal * 1.15)]} tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={tickFmt}/>
        <Tooltip cursor={{ fill: 'var(--grn-tint)' }} content={<ChartTooltip format={(v) => m(fmtMoney(v, sym))}
          footer={(p) => { const inc = p.find(x => x.dataKey === 'ingresos')?.value || 0; const exp = p.find(x => x.dataKey === 'gastos')?.value || 0; return [{ label: t('chart.net'), value: m(fmtMoney(inc - exp, sym)) }] }} />}/>
        <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize:11, fontFamily: 'var(--sans)', color:'var(--chart-axis)', paddingTop:8 }}/>
        <Bar dataKey="ingresos" name={t('chart.income')} fill="var(--chart-income)" radius={[2,2,0,0]} maxBarSize={32}/>
        <Bar dataKey="gastos"   name={t('chart.expenses')} fill="var(--chart-expense)" radius={[2,2,0,0]} maxBarSize={32}/>
        {hasPrev && <Line dataKey="gastosPrev" name={t('chart.expensesPrev')} type="monotone" legendType="plainline" {...PREV_LINE}/>}
      </ComposedChart>
    </ResponsiveContainer>
    </div>
    <div className="sr-only"><table>
      <caption>{t('chart.bar.summary', { n: months })}</caption>
      <thead><tr><th scope="col">{t('common.month')}</th><th scope="col">{t('chart.income')}</th><th scope="col">{t('chart.expenses')}</th></tr></thead>
      <tbody>{data.map(d => <tr key={d.mes}><th scope="row">{d.mes}</th><td>{m(fmtMoney(d.ingresos, sym))}</td><td>{m(fmtMoney(d.gastos, sym))}</td></tr>)}</tbody>
    </table></div>
    </>
  )
}
