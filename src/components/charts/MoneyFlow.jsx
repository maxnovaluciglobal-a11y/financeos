// src/components/charts/MoneyFlow.jsx
// Flujo de dinero del mes — visualización tipo Sankey con SVG
// Sin librerías externas · datos reales · orientativo

import { useMemo } from 'react'
import { ChartEmpty } from './ChartCard.jsx'
import { fmtMoneyCompact, fmtPct } from '../../utils/index.js'
import { useMoney } from '../Money.jsx'
import { useT } from '../../i18n/useT.js'

const fmtV = (v, sym) => fmtMoneyCompact(v, sym)
const NODE_TINT = 0.2

const COLORS = {
  income:  { fill: 'var(--pos)', stroke: 'var(--pos)', text: 'var(--pos)' },
  // Gastar no es un error: el nodo de gastos va en el azul categórico, no en rojo (UI-Q4).
  gastos:  { fill: 'var(--cat-1)', stroke: 'var(--cat-1)', text: 'var(--cat-1)' },
  subs:    { fill: 'var(--amb)', stroke: 'var(--amb)', text: 'var(--amb)' },
  deudas:  { fill: 'var(--accent2)', stroke: 'var(--accent2)', text: 'var(--accent2)' },
  libre:   { fill: 'var(--pos)', stroke: 'var(--pos)', text: 'var(--pos)' },
}

function SankeyPath({ x1, y1, h1, x2, y2, h2, color, opacity = 0.22 }) {
  const mx = (x1 + x2) / 2
  const d = [
    `M ${x1} ${y1}`,
    `C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`,
    `L ${x2} ${y2 + h2}`,
    `C ${mx} ${y2 + h2}, ${mx} ${y1 + h1}, ${x1} ${y1 + h1}`,
    'Z'
  ].join(' ')
  return <path d={d} fill={color} opacity={opacity} />
}

export default function MoneyFlow({ incomes, expenses, subscriptions, debts, sym = '$' }) {
  // Ocultar montos (T13): las cifras de los nodos SVG pasan por m(); los
  // porcentajes y las proporciones del dibujo se quedan (no son montos).
  const { m } = useMoney()
  const { t } = useT()
  const amt = (v) => m(fmtV(v, sym))
  const safeInc = useMemo(() => (Array.isArray(incomes) ? incomes : []), [incomes])
  const safeExp = useMemo(() => (Array.isArray(expenses) ? expenses : []), [expenses])
  const safeSubs = useMemo(() => (Array.isArray(subscriptions) ? subscriptions : []), [subscriptions])
  const safeDebt = useMemo(() => (Array.isArray(debts) ? debts : []), [debts])

  const data = useMemo(() => {
    const totalInc = safeInc.reduce((s, r) => s + (Number(r?.amount) || 0), 0)
    if (totalInc === 0) return null

    const totalExp  = safeExp.reduce((s, r) => s + (Number(r?.amount) || 0), 0)
    const totalSubs = safeSubs.filter(s => s?.status === 'active').reduce((s, sub) => {
      const amt = Number(sub.amount) || 0
      const f   = sub.frequency || 'monthly'
      if (f === 'annual' || f === 'anual') return s + amt / 12
      if (f === 'quarterly') return s + amt / 3
      if (f === 'weekly') return s + amt * 4.33
      return s + amt
    }, 0)
    const totalDebt = safeDebt.reduce((s, d) => s + (Number(d?.minPayment) || 0), 0)
    const libre     = Math.max(0, totalInc - totalExp - totalSubs - totalDebt)

    const items = [
      { key: 'gastos', label: t('chart.expenses'), amount: totalExp,   color: COLORS.gastos },
      totalSubs > 0 && { key: 'subs',   label: t('chart.flow.subs'), amount: totalSubs,  color: COLORS.subs },
      totalDebt > 0 && { key: 'deudas', label: t('chart.flow.debt'), amount: totalDebt,  color: COLORS.deudas },
      { key: 'libre',  label: t('chart.flow.available'), amount: libre,     color: COLORS.libre },
    ].filter(Boolean)

    return { totalInc, items }
  }, [safeInc, safeExp, safeSubs, safeDebt, t])

  if (!data) return <ChartEmpty msg={t('chart.flow.empty')} />

  const { totalInc, items } = data

  // ── Layout SVG ──────────────────────────────────────────────────────────────
  // Nodos derechos corridos a la izquierda para dejar margen al % (evita que el
  // "Disponible" y su porcentaje se desborden por el borde derecho).
  const W = 520, H = 280, PAD = 20
  const LEFT_X  = 30,  LEFT_W  = 90
  const RIGHT_X = 380, RIGHT_W = 90
  const MID_X   = 220, MID_W  = 80
  const NODE_H  = H - PAD * 2

  // Nodo ingreso central
  const incH = NODE_H

  // Nodos salida — altura proporcional al monto
  const totalOut = items.reduce((s, it) => s + it.amount, 0) || totalInc
  let rightY = PAD
  const rightNodes = items.map(it => {
    const h = Math.max(20, Math.round((it.amount / totalOut) * (NODE_H - items.length * 4)))
    const node = { ...it, y: rightY, h }
    rightY += h + 4
    return node
  })

  // Slices del lado izquierdo (origen del flujo) — proporcionales al monto, NO en partes iguales
  let leftCursor = PAD
  const leftSlices = rightNodes.map(node => {
    const h = Math.max(6, (node.amount / totalOut) * incH)
    const slice = { y: leftCursor, h }
    leftCursor += h
    return slice
  })

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display:'block', maxWidth:'100%' }}
        role="img"
        aria-label={t('chart.flow.aria')}
      >
        {/* Nodo izquierdo — Ingresos */}
        {/* Nodos tintados (relleno al 20 % + borde) con texto en --tx: antes el
            texto iba del mismo color que el relleno y en oscuro no se leía (UI-Q9). */}
        <rect x={LEFT_X} y={PAD} width={LEFT_W} height={incH} rx="6"
          fill={COLORS.income.fill} fillOpacity={NODE_TINT} stroke={COLORS.income.stroke} strokeWidth="1.5" />
        <text x={LEFT_X + LEFT_W/2} y={PAD + incH/2 - 10}
          textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily: 'var(--sans)', fontSize:12, fontWeight:600, fill: 'var(--tx)' }}>
          {t('chart.income')}
        </text>
        <text x={LEFT_X + LEFT_W/2} y={PAD + incH/2 + 10}
          textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily: 'var(--num)', fontSize: amt(totalInc).length > 8 ? 11 : 12, fontWeight:600, fill: 'var(--tx)' }}>
          {amt(totalInc)}
        </text>

        {/* Paths Sankey + nodos derecha */}
        {rightNodes.map((node, i) => {
          const startY    = leftSlices[i].y
          const sliceH    = leftSlices[i].h

          return (
            <g key={node.key}>
              {/* Flujo bezier */}
              <SankeyPath
                x1={LEFT_X + LEFT_W} y1={startY}       h1={sliceH}
                x2={RIGHT_X}         y2={node.y}        h2={node.h}
                color={node.color.fill}
                opacity={node.key === 'libre' ? 0.28 : 0.22}
              />
              {/* Nodo derecha */}
              <rect x={RIGHT_X} y={node.y} width={RIGHT_W} height={node.h} rx="5"
                fill={node.color.fill} fillOpacity={NODE_TINT} stroke={node.color.stroke} strokeWidth="1.5" />
              <text x={RIGHT_X + RIGHT_W/2} y={node.y + node.h/2 - (node.h > 36 ? 8 : 0)}
                textAnchor="middle" dominantBaseline="middle"
                style={{ fontFamily: 'var(--sans)', fontSize: node.label.length > 11 ? 10 : 11, fontWeight:600, fill: 'var(--tx)' }}>
                {node.label}
              </text>
              {node.h > 32 && (
                <text x={RIGHT_X + RIGHT_W/2} y={node.y + node.h/2 + 9}
                  textAnchor="middle" dominantBaseline="middle"
                  style={{ fontFamily: 'var(--num)', fontSize: amt(node.amount).length > 8 ? 10 : 11, fill: 'var(--tx)' }}>
                  {amt(node.amount)}
                </text>
              )}
              {/* Porcentaje a la derecha (anclado; con margen al borde del viewBox) */}
              <text x={RIGHT_X + RIGHT_W + 8} y={node.y + node.h/2}
                dominantBaseline="middle"
                style={{ fontFamily: 'var(--num)', fontSize:11, fill:'var(--th)' }}>
                {fmtPct(totalInc > 0 ? node.amount / totalInc : 0, { decimals: 0 })}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Mobile fallback — lista simple */}
      <div style={{ marginTop:4, fontSize:11, color:'var(--th)', fontFamily: 'var(--sans)', lineHeight:1.5, display:'flex', flexWrap:'wrap', gap:'4px 16px' }}>
        {items.map(it => (
          <span key={it.key} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:it.color.fill, display:'inline-block' }}/>
            {it.label}: {amt(it.amount)} ({fmtPct(totalInc > 0 ? it.amount / totalInc : 0, { decimals: 0 })})
          </span>
        ))}
      </div>

      <div style={{ marginTop:8, fontSize:11, color:'var(--th)', fontFamily: 'var(--sans)' }}>
        {t('chart.flow.disclaimer')}
      </div>
    </div>
  )
}
