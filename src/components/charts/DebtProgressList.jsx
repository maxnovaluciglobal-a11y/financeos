// src/components/charts/DebtProgressList.jsx
// Progreso de deudas con estados visuales — FinanceOS

import { useMemo } from 'react'
import SignalIcon from '../icons/SignalIcon.jsx'
import { ChartEmpty } from './ChartCard.jsx'
import { useMoney } from '../Money.jsx'
import { fmtMoneyCompact, dateLocale } from '../../utils/index.js'
import { useT } from '../../i18n/useT.js'

const fmtRaw = (v, sym) => fmtMoneyCompact(v, sym)

const STATUS = [
  { key:'done',  label:'chart.debt.status.done',  color:'var(--accent)', bg:'color-mix(in srgb, var(--pos) 9%, transparent)',  border:'color-mix(in srgb, var(--pos) 22%, transparent)',  icon:'ok' },
  { key:'close', label:'chart.debt.status.close', color:'var(--amb)',     bg:'rgba(245,166,35,.08)', border:'rgba(245,166,35,.2)', icon:'attention' },
  { key:'prog',  label:'chart.progress',          color:'var(--accent2)',        bg:'transparent',          border:'var(--brd)',          icon:'progress' },
]

// 'YYYY-MM-DD' → '15 mar' / 'Mar 15' según el idioma de la interfaz.
function fmtDay(iso) {
  const [y, mo, d] = String(iso).split('-').map(Number)
  if (!y || !mo || !d) return iso
  return new Date(y, mo - 1, d).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })
}

function getStatus(prog) {
  if (prog >= 1)    return STATUS[0]
  if (prog >= 0.75) return STATUS[1]
  return STATUS[2]
}

export default function DebtProgressList({ debts, sym = '$' }) {
  const { m } = useMoney()  // ocultar montos (T13)
  const { t } = useT()
  const fmtV = (v, s) => m(fmtRaw(v, s))
  const safeDebts = Array.isArray(debts) ? debts : []

  const rows = useMemo(() => safeDebts.map(d => {
    const initial = Number(d.initial) || Number(d.balance) || 0
    const balance = Number(d.balance) || 0
    const paid    = Math.max(0, initial - balance)
    const prog    = initial > 0 ? Math.min(paid / initial, 1) : 0
    const pct     = (prog * 100).toFixed(0)
    const status  = getStatus(prog)
    return { ...d, initial, balance, paid, prog, pct, status }
  }).sort((a, b) => b.balance - a.balance), [safeDebts])

  if (!rows.length) {
    return <ChartEmpty msg={t('chart.debt.empty')} />
  }

  // Totales
  const totalInitial = rows.reduce((s, d) => s + d.initial, 0)
  const totalBalance = rows.reduce((s, d) => s + d.balance, 0)
  const totalPaid    = rows.reduce((s, d) => s + d.paid,    0)
  const totalProg    = totalInitial > 0 ? totalPaid / totalInitial : 0

  return (
    <div>
      {/* Resumen global */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:10, marginBottom:20 }}>
        {[
          { label:t('chart.debt.original'), value:fmtV(totalInitial, sym), color:'var(--th)' },
          { label:t('chart.debt.balance'), value:fmtV(totalBalance,  sym), color:'var(--red)' },
          { label:t('chart.debt.totalPaid'), value:fmtV(totalPaid,     sym), color:'var(--accent)' },
          { label:t('chart.debt.overall'), value:`${(totalProg*100).toFixed(0)}%`, color: totalProg >= 0.75 ? 'var(--accent)' : totalProg >= 0.4 ? 'var(--amb)' : 'var(--th)' },
        ].map((k,i) => (
          <div key={i} style={{ background:'var(--sur)', border:'.5px solid var(--brd)', borderRadius:'var(--rl)', padding:'12px 14px', boxShadow:'var(--sh-1)' }}>
            <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--th)', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:5 }}>{k.label}</div>
            <div style={{ fontFamily:'var(--display)', fontSize:19, fontWeight:700, letterSpacing:'-0.01em', fontFeatureSettings:"'tnum' 1", color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Barra global */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
          <span style={{ fontSize:12, color:'var(--th)', fontFamily:'var(--mono)' }}>{t('chart.debt.progressTitle')}</span>
          <span style={{ fontSize:12, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)' }}>{(totalProg*100).toFixed(0)}%</span>
        </div>
        <div style={{ height:8, background:'var(--sur2)', borderRadius:4, overflow:'hidden' }}>
          <div style={{ height:'100%', width:'100%', transform:`scaleX(${Math.min(totalProg,1)})`, transformOrigin:'left', background:'var(--accent)', borderRadius:4, transition:'transform .4s ease' }}/>
        </div>
      </div>

      {/* Lista por deuda */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {rows.map((d, i) => (
          <div key={d.id || i} style={{ background:d.status.bg, border:`.5px solid ${d.status.border}`, borderRadius:10, padding:'12px 14px' }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <SignalIcon kind={d.status.icon} size={14} />
                <span style={{ fontSize:13, fontWeight:600, color:'var(--tx)' }}>{d.creditor}</span>
                {d.rate > 0 && <span style={{ fontSize:9, fontFamily:'var(--mono)', color:'var(--red)', background:'color-mix(in srgb, var(--neg) 12%, transparent)', padding:'1px 6px', borderRadius:20 }}>{t('chart.debt.rate', { rate: d.rate })}</span>}
              </div>
              <span style={{ fontSize:10, fontFamily:'var(--mono)', fontWeight:600, color:d.status.color, background:`${d.status.color}18`, padding:'2px 8px', borderRadius:20 }}>
                {t(d.status.label)}
              </span>
            </div>

            {/* Barra */}
            <div style={{ height:7, background:'var(--sur2)', borderRadius:4, overflow:'hidden', marginBottom:8 }}>
              <div style={{ height:'100%', width:'100%', transform:`scaleX(${Math.min(d.prog,1)})`, transformOrigin:'left', background:d.status.color, borderRadius:4, transition:'transform .4s ease' }}/>
            </div>

            {/* Cifras */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', gap:16 }}>
                {[
                  { label:t('chart.debt.paid'), value:fmtV(d.paid,    sym), color:'var(--accent)' },
                  { label:t('chart.debt.pending'), value:fmtV(d.balance, sym), color:'var(--red)' },
                  { label:t('chart.debt.initial'), value:fmtV(d.initial, sym), color:'var(--th)' },
                ].map((c,j) => (
                  <div key={j}>
                    <div style={{ fontSize:9, color:'var(--th)', fontFamily:'var(--mono)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:1 }}>{c.label}</div>
                    <div style={{ fontSize:12, fontWeight:700, color:c.color, fontFamily:'var(--mono)' }}>{c.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:20, fontWeight:700, color:d.status.color, fontFamily:'var(--mono)' }}>{d.pct}%</div>
            </div>

            {d.dueDate && (
              <div style={{ marginTop:6, fontSize:10, color:'var(--th)', fontFamily:'var(--mono)' }}>
                {t('chart.debt.due', { date: fmtDay(d.dueDate) })} {d.minPayment > 0 ? `· ${t('chart.debt.minPayment', { amount: fmtV(d.minPayment, sym) })}` : ''}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
