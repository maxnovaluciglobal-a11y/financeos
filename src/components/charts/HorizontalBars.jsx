// src/components/charts/HorizontalBars.jsx
// Barras horizontales de ranking — reutilizable

import { useMemo } from 'react'
import { ChartEmpty } from './ChartCard.jsx'
import { useMoney } from '../Money.jsx'

export default function HorizontalBars({ records, sym = '$', maxItems = 6, valueKey = 'amount', labelKey = 'category' }) {
  const { m } = useMoney()
  const safeRecords = Array.isArray(records) ? records : []

  const data = useMemo(() => {
    const map = {}
    safeRecords.forEach(r => {
      if (!r) return
      const label = r[labelKey] || r.category || r.categoría || 'Sin categoría'
      map[label] = (map[label] || 0) + (Number(r[valueKey]) || Number(r.amount) || 0)
    })
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, maxItems)
  }, [safeRecords, maxItems, valueKey, labelKey])

  if (!data.length) return <ChartEmpty msg="Sin datos suficientes para mostrar las categorías principales." />

  const max = data[0].value
  const total = data.reduce((s, d) => s + d.value, 0)
  const fmtV = v => m(v >= 1000000 ? `${sym}${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${sym}${(v/1000).toFixed(0)}K` : `${sym}${v}`)

  // Color por identidad de categoría (theme-aware). Antes: la #1 salía roja
  // por su POSICIÓN, no por su significado — alarma falsa en "Arriendo", etc.
  const COLORS = ['var(--cat-1)','var(--cat-2)','var(--cat-3)','var(--cat-4)','var(--cat-5)','var(--cat-6)','var(--cat-7)','var(--cat-8)']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((d, i) => {
        const barW = max > 0 ? (d.value / max) * 100 : 0
        const pct  = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0'
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{d.name}</span>
              <span style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)', flexShrink: 0 }}>
                {fmtV(d.value)} · {pct}%
              </span>
            </div>
            <div style={{ height: 6, background: 'var(--sur2)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '100%', transform: `scaleX(${barW / 100})`, transformOrigin: 'left', background: COLORS[i % COLORS.length], borderRadius: 3, transition: 'transform .4s ease' }}/>
            </div>
          </div>
        )
      })}
    </div>
  )
}
