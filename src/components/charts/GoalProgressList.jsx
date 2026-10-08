// src/components/charts/GoalProgressList.jsx
// Progreso de metas con estados visuales — FinanceOS

import { useMemo } from 'react'
import SignalIcon from '../icons/SignalIcon.jsx'
import { ChartEmpty } from './ChartCard.jsx'
import { useMoney } from '../Money.jsx'
import { moneyLocale } from '../../utils/index.js'

function fmtRaw(v, sym) {
  const n = Number(v) || 0
  if (n >= 1000000) return `${sym}${(n/1000000).toFixed(1)}M`
  if (n >= 1000)    return `${sym}${(n/1000).toFixed(0)}K`
  return `${sym}${Math.round(n).toLocaleString(moneyLocale())}`
}

const STATUS = [
  { key:'done',  label:'Completada',          color:'var(--accent)', bg:'color-mix(in srgb, var(--pos) 9%, transparent)',  border:'color-mix(in srgb, var(--pos) 22%, transparent)',  icon:'ok' },
  { key:'close', label:'Cerca de completarse', color:'var(--amb)',    bg:'rgba(245,166,35,.08)', border:'rgba(245,166,35,.2)', icon:'attention' },
  { key:'prog',  label:'En progreso',          color:'var(--accent2)',       bg:'transparent',          border:'var(--brd)',          icon:'progress' },
]

function getStatus(prog) {
  if (prog >= 1)    return STATUS[0]
  if (prog >= 0.7)  return STATUS[1]
  return STATUS[2]
}

const PRIORITY_COLOR = { Alta:'var(--red)', Media:'var(--amb)', Baja:'var(--th)' }

export default function GoalProgressList({ goals, sym = '$' }) {
  const { m } = useMoney()  // ocultar montos (T13)
  const fmtV = (v, s) => m(fmtRaw(v, s))
  const safeGoals = Array.isArray(goals) ? goals : []

  const rows = useMemo(() => safeGoals.map(g => {
    const target    = Number(g.target) || 0
    const saved     = Math.min(Number(g.saved) || 0, target)
    const remaining = Math.max(0, target - saved)
    const prog      = target > 0 ? saved / target : 0
    const pct       = (prog * 100).toFixed(0)
    const status    = getStatus(prog)
    return { ...g, target, saved, remaining, prog, pct, status }
  }).sort((a, b) => b.prog - a.prog), [safeGoals])

  if (!rows.length) {
    return <ChartEmpty msg="Aún no tienes metas registradas para mostrar el avance." />
  }

  const totalTarget    = rows.reduce((s, g) => s + g.target,    0)
  const totalSaved     = rows.reduce((s, g) => s + g.saved,     0)
  const totalRemaining = rows.reduce((s, g) => s + g.remaining, 0)
  const totalProg      = totalTarget > 0 ? totalSaved / totalTarget : 0
  const completedCount = rows.filter(g => g.prog >= 1).length

  return (
    <div>
      {/* Resumen global */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:10, marginBottom:20 }}>
        {[
          { label:'Total objetivo',  value:fmtV(totalTarget,    sym), color:'var(--th)' },
          { label:'Total acumulado', value:fmtV(totalSaved,     sym), color:'var(--accent)' },
          { label:'Restante',        value:fmtV(totalRemaining, sym), color:'var(--amb)' },
          { label:'Avance global',   value:`${(totalProg*100).toFixed(0)}%`, color: totalProg >= 0.7 ? 'var(--accent)' : totalProg >= 0.4 ? 'var(--amb)' : 'var(--th)' },
          { label:'Completadas',     value:`${completedCount}/${rows.length}`, color: completedCount > 0 ? 'var(--accent)' : 'var(--th)' },
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
          <span style={{ fontSize:12, color:'var(--th)', fontFamily:'var(--mono)' }}>Progreso total de metas</span>
          <span style={{ fontSize:12, fontWeight:700, color:'var(--accent)', fontFamily:'var(--mono)' }}>{(totalProg*100).toFixed(0)}%</span>
        </div>
        <div style={{ height:8, background:'var(--sur2)', borderRadius:4, overflow:'hidden' }}>
          <div style={{ height:'100%', width:'100%', transform:`scaleX(${Math.min(totalProg,1)})`, transformOrigin:'left', background:'var(--accent)', borderRadius:4, transition:'transform .4s ease' }}/>
        </div>
      </div>

      {/* Lista por meta — ordenadas de mayor a menor progreso */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {rows.map((g, i) => (
          <div key={g.id || i} style={{ background:g.status.bg, border:`.5px solid ${g.status.border}`, borderRadius:10, padding:'12px 14px' }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                <SignalIcon kind={g.status.icon} size={14} />
                <span style={{ fontSize:13, fontWeight:600, color:'var(--tx)' }}>{g.name}</span>
                {g.priority && (
                  <span style={{ fontSize:9, fontFamily:'var(--mono)', color:PRIORITY_COLOR[g.priority] || 'var(--th)', background:`${PRIORITY_COLOR[g.priority] || 'var(--th)'}18`, padding:'1px 6px', borderRadius:20 }}>
                    {g.priority}
                  </span>
                )}
              </div>
              <span style={{ fontSize:10, fontFamily:'var(--mono)', fontWeight:600, color:g.status.color, background:`${g.status.color}18`, padding:'2px 8px', borderRadius:20 }}>
                {g.status.label}
              </span>
            </div>

            {/* Barra */}
            <div style={{ height:7, background:'var(--sur2)', borderRadius:4, overflow:'hidden', marginBottom:8 }}>
              <div style={{ height:'100%', width:'100%', transform:`scaleX(${Math.min(g.prog,1)})`, transformOrigin:'left', background:g.status.color, borderRadius:4, transition:'transform .4s ease' }}/>
            </div>

            {/* Cifras */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ display:'flex', gap:16 }}>
                {[
                  { label:'Acumulado', value:fmtV(g.saved,     sym), color:'var(--accent)' },
                  { label:'Restante',  value:fmtV(g.remaining, sym), color: g.remaining > 0 ? 'var(--amb)' : 'var(--accent)' },
                  { label:'Objetivo',  value:fmtV(g.target,    sym), color:'var(--th)' },
                ].map((c,j) => (
                  <div key={j}>
                    <div style={{ fontSize:9, color:'var(--th)', fontFamily:'var(--mono)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:1 }}>{c.label}</div>
                    <div style={{ fontSize:12, fontWeight:700, color:c.color, fontFamily:'var(--mono)' }}>{c.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:20, fontWeight:700, color:g.status.color, fontFamily:'var(--mono)' }}>{g.pct}%</div>
            </div>

            {g.targetDate && (
              <div style={{ marginTop:6, fontSize:10, color:'var(--th)', fontFamily:'var(--mono)' }}>
                Fecha objetivo: {g.targetDate.slice(0,7).replace('-','/')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
