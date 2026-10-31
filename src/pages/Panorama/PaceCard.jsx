// src/pages/Panorama/PaceCard.jsx — "¿el gasto va al ritmo del mes?" (#11).
// Reports compara el acumulado contra el mes anterior; acá va contra un ritmo
// parejo, con el resultado como título.
import { lazy, Suspense, useMemo } from 'react'
import { useT } from '../../i18n/useT.js'
import ChartCard from '../../components/charts/ChartCard.jsx'
import { ConclusionTitle } from '../Dashboard/MonthReading.jsx'
import { useReadingText } from '../Dashboard/useMonthReading.js'
import { cumulativeByDay } from '../../utils/chartSeries.js'
import { monthPosition, paceConclusion, paceReference, paceSeries } from '../../utils/monthReading.js'
import { monthLabel } from '../shared/constants.js'

// recharts no entra al trozo de Panorama por este gráfico.
const PaceChart = lazy(() => import('../../components/charts/PaceChart.jsx'))

export default function PaceCard({ expenses, kpis, activeMonth, sym }) {
  const { t } = useT()
  const text = useReadingText(sym)
  const reference = paceReference({ income: kpis.totalInc, prevExpenses: kpis.prev.totalExp })
  const mode = monthPosition(activeMonth).mode
  const series = useMemo(() => paceSeries(cumulativeByDay(expenses, activeMonth), reference?.value), [expenses, activeMonth, reference?.value])
  if (!reference || mode === 'future' || !(kpis.totalExp > 0)) return null
  const plain = t('chart.pace.title')
  return (
    <ChartCard minHeight={200} subtitle={monthLabel(activeMonth)}
      title={<ConclusionTitle plain={plain} conclusion={text(paceConclusion(series, { closed: mode === 'past' }))} />}>
      <Suspense fallback={null}>
        <PaceChart data={series} sym={sym} caption={plain} paceLabel={t(reference.kind === 'income' ? 'chart.pace.lineIncome' : 'chart.pace.linePrev')} />
      </Suspense>
    </ChartCard>
  )
}
