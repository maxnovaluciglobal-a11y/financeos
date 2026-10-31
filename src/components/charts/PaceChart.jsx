// src/components/charts/PaceChart.jsx — gasto acumulado contra el ritmo (#11).
// `data` = paceSeries (utils/monthReading.js). Vive en su propio trozo: se
// carga con lazy desde Panorama. Sin doble eje: las dos líneas son dinero del
// mismo mes. El ritmo va punteado y recesivo: es una referencia, no un dato.
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import ChartTooltip, { AXIS_TICK, GRID } from './ChartTooltip.jsx'
import { fmtMoney, fmtAxis } from '../../utils/index.js'
import { useT } from '../../i18n/useT.js'
import { useMoney, MONEY_MASK } from '../Money.jsx'

export default function PaceChart({ data, sym = '$', paceLabel, caption }) {
  const { hidden, m } = useMoney()
  const { t } = useT()
  const spentLabel = t('chart.pace.spent')
  const tickFmt = (v) => (hidden ? MONEY_MASK : fmtAxis(v))
  const rows = data.filter(d => d.day % 5 === 0 || d.day === 1 || d.day === data.length)
  return (
    <>
      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart accessibilityLayer={false} data={data}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
            <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={tickFmt} width={48} />
            <Tooltip content={<ChartTooltip format={(v) => m(fmtMoney(v, sym))} labelFormat={(d) => t('reports.cum.day', { d })} />} />
            <Legend iconType="plainline" iconSize={14} wrapperStyle={{ fontSize: 11, fontFamily: 'var(--sans)', color: 'var(--chart-axis)', paddingTop: 8 }} />
            <Line dataKey="current" name={spentLabel} type="monotone" stroke="var(--chart-expense)" strokeWidth={2} dot={false} connectNulls={false} />
            <Line dataKey="pace" name={paceLabel} type="linear" stroke="var(--chart-axis)" strokeWidth={1.5} strokeDasharray="6 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="sr-only"><table>
        <caption>{caption}</caption>
        <thead><tr><th scope="col">{t('reports.cum.dayCol')}</th><th scope="col">{spentLabel}</th><th scope="col">{paceLabel}</th></tr></thead>
        <tbody>{rows.map(d => (
          <tr key={d.day}><th scope="row">{d.day}</th><td>{d.current == null ? '—' : m(fmtMoney(d.current, sym))}</td><td>{m(fmtMoney(d.pace, sym))}</td></tr>
        ))}</tbody>
      </table></div>
    </>
  )
}
