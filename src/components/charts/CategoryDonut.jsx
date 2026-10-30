// src/components/charts/CategoryDonut.jsx
import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartEmpty } from './ChartCard.jsx'
import ChartTooltip from './ChartTooltip.jsx'
import { fmtMoney, fmtMoneyCompact, catName, fmtPct } from '../../utils/index.js'
import { useT } from '../../i18n/useT.js'
import { useMoney } from '../Money.jsx'
import css from './CategoryDonut.module.css'

// Centavos: se redondea a 2 decimales (no a enteros) para que el tooltip de
// US$42.50 no diga $43.00.
const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100

// Paleta categórica por identidad, theme-aware (definida en globals.css).
const COLORS = ['var(--cat-1)','var(--cat-2)','var(--cat-3)','var(--cat-4)','var(--cat-5)','var(--cat-6)','var(--cat-7)','var(--cat-8)']

// Barrido de entrada del anillo (--dur-instrument-settle, 900ms); con
// movimiento reducido aparece directo.
const reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }

// H9 (ola A5, 30-oct-2026): agrupa el resto en UNA sola entrada "Otros". Si el
// usuario ya tiene una categoría real "Otros", se suma al grupo en lugar de
// aparecer dos veces en la leyenda. `group: true` marca el grupo (no se toca
// para ver movimientos: no es una categoría). Testeado en categoryDonut.test.js.
export function groupDonutSlices(sorted, maxCategories = 6) {
  if (!Array.isArray(sorted) || sorted.length <= maxCategories) return sorted
  const realOther = sorted.find(d => d.name === 'Otros')
  const rest = sorted.filter(d => d.name !== 'Otros')
  const top = rest.slice(0, maxCategories - 1)
  const tail = rest.slice(maxCategories - 1).reduce((s, d) => s + d.value, 0) + (realOther ? realOther.value : 0)
  if (tail > 0) top.push({ name: 'Otros', value: round2(tail), group: true })
  return top
}

export default function CategoryDonut({ records, sym = '$', maxCategories = 6, onCategoryClick }) {
  const { t, lang } = useT()
  const { m } = useMoney()
  const safeRecords = useMemo(() => (Array.isArray(records) ? records : []), [records])
  // H9 (ola A5): solo el GRUPO "Otros" deja de ser tocable; la categoría real sí lo es.
  const clickable = (d) => typeof onCategoryClick === 'function' && !d?.group

  const { data, total } = useMemo(() => {
    const map = {}
    safeRecords.forEach(r => {
      if (!r) return
      const cat = r.category || r.categoría || 'Sin categoría'
      map[cat] = (map[cat] || 0) + (Number(r.amount) || 0)
    })

    let sorted = Object.entries(map)
      .map(([name, value]) => ({ name, value: round2(value) }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)

    const total = sorted.reduce((s, d) => s + d.value, 0)
    if (total === 0) return { data: [], total: 0 }

    sorted = groupDonutSlices(sorted, maxCategories)

    const withPct = sorted.map(d => ({ ...d, pct: fmtPct(d.value / total) }))
    return { data: withPct, total: round2(total) }
  }, [safeRecords, maxCategories])

  if (!data.length || total === 0) return <ChartEmpty msg={t('chart.donut.empty')} />

  const fmtTotal = m(fmtMoneyCompact(total, sym))
  const pctText = (p) => `${Number(p).toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`
  // A11Y-3: el anillo se anuncia como UNA imagen con el resumen; Recharts queda
  // fuera del árbol accesible y sin foco (rootTabIndex -1).
  const summary = t('chart.donut.summary', { total: fmtTotal, items: data.map(d => `${catName(d.name, lang)} ${pctText(d.pct)}`).join(', ') })

  return (
    <div className={css.root}><div className={css.wrap}>
      <div className={css.pie} role="img" aria-label={summary}>
        <div aria-hidden="true" style={{ width: '100%', height: '100%' }}>
        <ResponsiveContainer width="100%" aspect={1}>
          <PieChart accessibilityLayer={false}>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="66%" outerRadius="98%" strokeWidth={0} paddingAngle={2} rootTabIndex={-1}
              isAnimationActive={!reducedMotion()} animationBegin={120} animationDuration={900} animationEasing="ease-out"
              onClick={(d) => { if (d && clickable(d.payload || d)) onCategoryClick(d.name) }}>
              {data.map((d, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} style={{ outline:'none', cursor: clickable(d) ? 'pointer' : 'default' }}/>)}
            </Pie>
            <Tooltip content={({ active, payload }) => (
              <ChartTooltip active={active} payload={payload?.map(p => ({ ...p, name: t('chart.donut.amount') }))}
                title={payload?.[0] ? catName(payload[0].name, lang) : ''}
                format={(v) => m(fmtMoney(v, sym))}
                footer={payload?.[0] ? [{ label: t('chart.donut.share'), value: payload[0].payload?.pct }] : null} />
            )}/>
          </PieChart>
        </ResponsiveContainer>
        </div>
        {/* Label central */}
        <div aria-hidden="true" style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center', pointerEvents:'none' }}>
          <div style={{ fontSize:15, fontWeight:700, color:'var(--tx)', fontFamily: 'var(--num)' }}>{fmtTotal}</div>
          <div style={{ fontSize: 12, color:'var(--th)', fontFamily: 'var(--sans)', fontWeight: 600}}>{t('chart.donut.total')}</div>
        </div>
      </div>
      <div className={css.legend}>
        {data.map((d, i) => (
          <div
            key={i}
            {...(clickable(d) ? {
              role: 'button', tabIndex: 0,
              onClick: () => onCategoryClick(d.name),
              onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCategoryClick(d.name) } },
              // A11Y-10: el nombre empieza por lo que se ve ("Vivienda 40,0 %").
              'aria-label': `${catName(d.name, lang)} ${d.pct}, ${t('chart.donut.viewAction')}`,
            } : {})}
            title={clickable(d) ? t('chart.donut.viewMovements', { cat: catName(d.name, lang) }) : undefined}
            style={{ display:'flex', alignItems:'center', gap:8, cursor: clickable(d) ? 'pointer' : 'default', padding:'2px 0', minHeight: clickable(d) ? 44 : undefined }}
          >
            <div style={{ width:8, height:8, borderRadius:'50%', background:COLORS[i % COLORS.length], flexShrink:0 }}/>
            <div style={{ flex:1, fontSize:13, color:'var(--tx)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{catName(d.name, lang)}{clickable(d) ? <span aria-hidden="true"> ›</span> : ''}</div>
            <div className="num" style={{ fontSize:12, fontWeight:500, color:'var(--th)' }}>{d.pct}</div>
          </div>
        ))}
      </div>
    </div></div>
  )
}
