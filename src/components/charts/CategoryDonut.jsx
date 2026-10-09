// src/components/charts/CategoryDonut.jsx
import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartEmpty } from './ChartCard.jsx'
import { catLabel, fmtMoney, fmtMoneyCompact, catName } from '../../utils/index.js'
import { useT } from '../../i18n/useT.js'
import { useMoney } from '../Money.jsx'
import css from './CategoryDonut.module.css'

// Centavos: se redondea a 2 decimales (no a enteros) para que el tooltip de
// US$42.50 no diga $43.00.
const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100

// Paleta categórica por identidad, theme-aware (definida en globals.css).
const COLORS = ['var(--cat-1)','var(--cat-2)','var(--cat-3)','var(--cat-4)','var(--cat-5)','var(--cat-6)','var(--cat-7)','var(--cat-8)']

function CustomTooltip({ active, payload, sym, lang, m }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  if (!d) return null
  return (
    <div style={{ background:'var(--sur2)', border:'.5px solid var(--brd2)', borderRadius:8, padding:'8px 12px', fontSize:12, fontFamily:'var(--mono)' }}>
      <div style={{ color: d.payload?.fill || 'var(--accent)', fontWeight:600, marginBottom:2 }}>{catLabel(d.name, lang)}</div>
      <div style={{ color:'var(--tx)' }}>{m(fmtMoney(d.value, sym))}</div>
      <div style={{ color:'var(--th)' }}>{d.payload?.pct || 0}%</div>
    </div>
  )
}

// Barrido de entrada del anillo (--dur-instrument-settle, 900ms); con
// movimiento reducido aparece directo.
const reducedMotion = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }

export default function CategoryDonut({ records, sym = '$', maxCategories = 6, onCategoryClick }) {
  const { t, lang } = useT()
  const { m } = useMoney()
  const safeRecords = Array.isArray(records) ? records : []
  const clickable = (name) => typeof onCategoryClick === 'function' && name !== 'Otros'

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

    if (sorted.length > maxCategories) {
      const top   = sorted.slice(0, maxCategories - 1)
      const otros = sorted.slice(maxCategories - 1).reduce((s, d) => s + d.value, 0)
      if (otros > 0) top.push({ name:'Otros', value: round2(otros) })
      sorted = top
    }

    const withPct = sorted.map(d => ({ ...d, pct: ((d.value / total) * 100).toFixed(1) }))
    return { data: withPct, total: round2(total) }
  }, [safeRecords, maxCategories])

  if (!data.length || total === 0) return <ChartEmpty msg={t('chart.donut.empty')} />

  const fmtTotal = m(fmtMoneyCompact(total, sym))

  return (
    <div className={css.root}><div className={css.wrap}>
      <div className={css.pie}>
        <ResponsiveContainer width="100%" aspect={1}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="66%" outerRadius="98%" strokeWidth={0} paddingAngle={2}
              isAnimationActive={!reducedMotion()} animationBegin={120} animationDuration={900} animationEasing="ease-out"
              onClick={(d) => { if (d && clickable(d.name)) onCategoryClick(d.name) }}>
              {data.map((d, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} style={{ outline:'none', cursor: clickable(d.name) ? 'pointer' : 'default' }}/>)}
            </Pie>
            <Tooltip content={<CustomTooltip sym={sym} lang={lang} m={m}/>}/>
          </PieChart>
        </ResponsiveContainer>
        {/* Label central */}
        <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', textAlign:'center', pointerEvents:'none' }}>
          <div style={{ fontSize:15, fontWeight:700, color:'var(--tx)', fontFamily:'var(--mono)' }}>{fmtTotal}</div>
          <div style={{ fontSize:9, color:'var(--th)', fontFamily:'var(--mono)', textTransform:'uppercase', letterSpacing:'.5px' }}>{t('chart.donut.total')}</div>
        </div>
      </div>
      <div className={css.legend}>
        {data.map((d, i) => (
          <div
            key={i}
            {...(clickable(d.name) ? {
              role: 'button', tabIndex: 0,
              onClick: () => onCategoryClick(d.name),
              onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCategoryClick(d.name) } },
              'aria-label': t('chart.donut.viewMovements', { cat: catName(d.name, lang) }),
            } : {})}
            title={clickable(d.name) ? t('chart.donut.viewMovements', { cat: catName(d.name, lang) }) : undefined}
            style={{ display:'flex', alignItems:'center', gap:8, cursor: clickable(d.name) ? 'pointer' : 'default', padding:'2px 0' }}
          >
            <div style={{ width:8, height:8, borderRadius:'50%', background:COLORS[i % COLORS.length], flexShrink:0 }}/>
            <div style={{ flex:1, fontSize:13, color:'var(--tx)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{catLabel(d.name, lang)}{clickable(d.name) ? ' ›' : ''}</div>
            <div style={{ fontSize:12, color:'var(--th)', fontFamily:'var(--mono)' }}>{d.pct}%</div>
          </div>
        ))}
      </div>
    </div></div>
  )
}
