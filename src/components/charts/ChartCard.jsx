// src/components/charts/ChartCard.jsx
import SignalIcon from '../icons/SignalIcon.jsx'
export default function ChartCard({ title, subtitle, children, minHeight = 220 }) {
  return (
    <div style={{ background:'var(--sur)', border:'.5px solid var(--brd)', borderRadius:'var(--rl)', padding:'18px 20px', marginBottom:16, boxShadow:'var(--sh-1)' }}>
      {title && (
        <div style={{ marginBottom:14 }}>
          <div className="display" style={{ fontSize:15, fontWeight:600, color:'var(--tx)', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', display:'inline-block', flexShrink:0 }}/>
            {title}
          </div>
          {subtitle && <div style={{ fontSize:11, color:'var(--th)', fontFamily:'var(--mono)', marginTop:3, marginLeft:14 }}>{subtitle}</div>}
        </div>
      )}
      <div style={{ minHeight }}>{children}</div>
    </div>
  )
}

export function ChartEmpty({ msg = 'Sin datos suficientes para mostrar este gráfico.' }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:160, flexDirection:'column', gap:8 }}>
      <div style={{ opacity:.35, color:'var(--th)' }}><SignalIcon kind="category" size={22} /></div>
      <div style={{ fontSize:12, color:'var(--th)', fontFamily:'var(--mono)', textAlign:'center', maxWidth:220 }}>{msg}</div>
    </div>
  )
}
