// src/components/charts/Sparkline.jsx — minigráfico de una serie (Inversiones).
// SVG puro, sin librerías: entra en cualquier fila sin sumar peso. El color
// sigue la dirección del período (primer → último valor) y la dirección
// también va en el aria-label que arma quien lo usa (nunca solo el color).
// Sin datos suficientes (menos de 2 puntos válidos) no dibuja nada.
export function sparkPath(values, width, height, pad = 1.5) {
  const pts = (values || []).filter(v => v != null && v !== '').map(Number).filter(Number.isFinite)
  if (pts.length < 2) return null
  const min = Math.min(...pts), max = Math.max(...pts)
  const span = max - min || 1
  const step = (width - pad * 2) / (pts.length - 1)
  const y = (v) => (max === min ? height / 2 : pad + (height - pad * 2) * (1 - (v - min) / span))
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${(pad + i * step).toFixed(2)},${y(v).toFixed(2)}`).join(' ')
  const dir = pts[pts.length - 1] > pts[0] ? 'up' : pts[pts.length - 1] < pts[0] ? 'down' : 'flat'
  return { d, dir, last: { x: pad + (pts.length - 1) * step, y: y(pts[pts.length - 1]) } }
}

const TONE = { up: 'var(--pos)', down: 'var(--neg)', flat: 'var(--th)' }

export default function Sparkline({ values, width = 80, height = 24, label, strokeWidth = 1.6, className }) {
  const p = sparkPath(values, width, height)
  if (!p) return null
  const color = TONE[p.dir]
  return (
    <svg className={className} width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}
      data-dir={p.dir} style={{ display: 'block', overflow: 'visible' }}>
      <path d={p.d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={p.last.x} cy={p.last.y} r={strokeWidth + 0.6} fill={color} />
    </svg>
  )
}
