// Vista esencial: línea simple con el precio de cierre de cada día del rango.
// Sin velas, medias ni bandas (esas quedan en Vista completa, ChartPanel).
// SVG propio: no baja la librería de velas.
import { useMemo } from 'react'

export function linePath(values, W, H, pad = 4) {
  const v = (values || []).filter(x => Number.isFinite(x))
  if (v.length < 2) return null
  const lo = Math.min(...v), hi = Math.max(...v)
  const span = hi - lo || 1
  const x = (i) => (i / (v.length - 1)) * W
  const y = (n) => pad + (1 - (n - lo) / span) * (H - pad * 2)
  return v.map((n, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(n).toFixed(1)}`).join('')
}

export default function LineChart({ closes, label, up, height = 200, className }) {
  const W = 600
  const d = useMemo(() => linePath(closes, W, height), [closes, height])
  if (!d) return null
  return (
    <svg className={className} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" role="img" aria-label={label}
      style={{ display: 'block', width: '100%', height }}>
      <path d={d} fill="none" stroke={up ? 'var(--pos)' : 'var(--chart-net, var(--tx))'} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
