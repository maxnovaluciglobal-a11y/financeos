// src/components/charts/BudgetProgressList.jsx
// Barras de progreso enriquecidas para Presupuestos — FinanceOS

import { ChartEmpty } from './ChartCard.jsx'
import SignalIcon from '../icons/SignalIcon.jsx'
import { useMoney } from '../Money.jsx'
import { moneyLocale } from '../../utils/index.js'

const STATUS = [
  { key: 'over',  label: 'Sobrepasado',      color: 'var(--red)',    bg: 'color-mix(in srgb, var(--neg) 12%, transparent)',   border: 'color-mix(in srgb, var(--neg) 26%, transparent)',  icon: 'warning' },
  { key: 'warn',  label: 'Cerca del límite',  color: 'var(--amb)',    bg: 'rgba(245,166,35,.08)',  border: 'rgba(245,166,35,.25)',  icon: 'attention' },
  { key: 'ok',    label: 'Bajo control',      color: 'var(--accent)', bg: 'transparent',           border: 'var(--brd)',            icon: 'ok' },
]

function getStatus(spent, limit) {
  if (limit <= 0) return STATUS[2]
  const ratio = spent / limit
  if (ratio > 1)    return STATUS[0]
  if (ratio >= 0.8) return STATUS[1]
  return STATUS[2]
}

function fmtRaw(v, sym) {
  const n = Number(v) || 0
  if (n >= 1000000) return `${sym}${(n/1000000).toFixed(1)}M`
  if (n >= 1000)    return `${sym}${(n/1000).toFixed(0)}K`
  return `${sym}${Math.round(n).toLocaleString(moneyLocale())}`
}

export default function BudgetProgressList({ budgets, expByCat, sym = '$' }) {
  const { m } = useMoney()  // ocultar montos (T13)
  const fmtV = (v, s) => m(fmtRaw(v, s))
  const safeBudgets  = Array.isArray(budgets)  ? budgets  : []
  const safeExpByCat = (expByCat && typeof expByCat === 'object') ? expByCat : {}

  if (safeBudgets.length === 0) {
    return <ChartEmpty msg="Aún no tienes presupuestos. Agrega uno para ver el avance mensual." />
  }

  // Ordenar: sobrepasados → cerca → ok
  const rows = safeBudgets.map(b => {
    const spent  = Number(safeExpByCat[b.category]) || 0
    const limit  = Number(b.limit) || 0
    const avail  = Math.max(0, limit - spent)
    const ratio  = limit > 0 ? Math.min(spent / limit, 1) : 0
    const pct    = limit > 0 ? ((spent / limit) * 100).toFixed(0) : '0'
    const status = getStatus(spent, limit)
    return { ...b, spent, limit, avail, ratio, pct, status }
  }).sort((a, b) => {
    const order = { over: 0, warn: 1, ok: 2 }
    return order[a.status.key] - order[b.status.key]
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map((r, i) => (
        <div key={r.id || i} style={{
          background: r.status.bg,
          border: `.5px solid ${r.status.border}`,
          borderRadius: 10, padding: '12px 14px',
        }}>
          {/* Fila superior */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <SignalIcon kind={r.status.icon} size={14} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>{r.category}</span>
            </div>
            <span style={{
              fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 600,
              color: r.status.color, background: `${r.status.color}18`,
              padding: '2px 8px', borderRadius: 20,
            }}>{r.status.label}</span>
          </div>

          {/* Barra de progreso */}
          <div style={{ height: 8, background: 'var(--sur2)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%',
              width: '100%',
              transform: `scaleX(${r.ratio})`,
              transformOrigin: 'left',
              background: r.status.color,
              borderRadius: 4,
              transition: 'transform .4s ease',
            }}/>
          </div>

          {/* Fila inferior con cifras */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 14 }}>
              <div>
                <div style={{ fontSize: 9, color: 'var(--th)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 1 }}>Usado</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: r.status.color, fontFamily: 'var(--mono)' }}>{fmtV(r.spent, sym)}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: 'var(--th)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 1 }}>Disponible</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: r.avail > 0 ? 'var(--accent)' : 'var(--red)', fontFamily: 'var(--mono)' }}>
                  {r.avail > 0 ? fmtV(r.avail, sym) : `−${fmtV(r.spent - r.limit, sym)}`}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: 'var(--th)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 1 }}>Límite</div>
                <div style={{ fontSize: 12, color: 'var(--th)', fontFamily: 'var(--mono)' }}>{fmtV(r.limit, sym)}</div>
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: r.status.color, fontFamily: 'var(--display)', letterSpacing: '-0.01em', fontFeatureSettings: "'tnum' 1" }}>
              {r.pct}%
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
