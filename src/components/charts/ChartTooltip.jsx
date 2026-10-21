// src/components/charts/ChartTooltip.jsx — un solo tooltip para todos los gráficos (UI-M6)
//
// Patrón shadcn Charts: la fecha (o el nombre) arriba y, por serie, el
// indicador de color, la etiqueta y el valor alineado a la derecha en .num.
// La serie del período anterior se dibuja con un indicador punteado.
// `format(value, item)` formatea el valor; los montos pasan por useMoney().m
// en quien lo usa, así "ocultar montos" también tapa el tooltip.
// `footer`: filas extra al pie, separadas por una línea (p. ej. "Neto").
import s from './chartTooltip.module.css'

export default function ChartTooltip({ active, payload, label, labelFormat, format = (v) => v, footer, title }) {
  if (!active || !payload?.length) return null
  const head = title ?? (labelFormat ? labelFormat(label, payload) : label)
  const rows = payload.filter(p => p && p.value != null && !p.hide)
  const extra = typeof footer === 'function' ? footer(payload) : footer
  return (
    <div className={s.tip}>
      {head != null && head !== '' && <div className={s.head}>{head}</div>}
      {rows.map((p, i) => {
        const color = p.payload?.fill && p.dataKey === 'value' ? p.payload.fill : (p.color || p.stroke || p.fill)
        const dashed = !!p.strokeDasharray || String(p.dataKey || '').endsWith('Prev')
        return (
          <div key={i} className={s.row}>
            <span className={dashed ? s.dash : s.dot} style={dashed ? { borderColor: color } : { background: color }} aria-hidden="true" />
            <span className={s.name}>{p.name}</span>
            <span className={`num ${s.val}`}>{format(p.value, p)}</span>
          </div>
        )
      })}
      {extra?.length > 0 && (
        <div className={s.foot}>
          {extra.map((f, i) => (
            <div key={i} className={s.row}>
              <span className={s.blank} aria-hidden="true" />
              <span className={s.name}>{f.label}</span>
              <span className={`num ${s.val}`}>{f.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Estilo de ejes común (ejes localizados con fmtAxis, UI-Q2).
export const AXIS_TICK = { fill: 'var(--chart-axis)', fontSize: 11, fontFamily: 'var(--sans)' }
export const GRID = { stroke: 'var(--chart-grid)', strokeDasharray: '3 3', vertical: false }
// Período anterior: gris punteado, sin puntos.
export const PREV_LINE = { stroke: 'var(--chart-prev)', strokeWidth: 1.6, strokeDasharray: '4 4', dot: false, activeDot: false, isAnimationActive: false }
