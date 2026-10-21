// src/components/charts/ChartCard.jsx
import SignalIcon from '../icons/SignalIcon.jsx'
import { useT } from '../../i18n/useT.js'
export default function ChartCard({ title, subtitle, children, minHeight = 220 }) {
  return (
    // Una lectura no va en una caja (UI-M7, "Flat Ledger"): sección con una
    // línea fina arriba, título y subtítulo.
    <section style={{ borderTop:'1px solid var(--brd2)', padding:'14px 0 0', marginBottom:20, minWidth:0 }}>
      {title && (
        <div style={{ marginBottom:12 }}>
          <h2 className="display" style={{ margin:0, fontSize:16, fontWeight:600, color:'var(--tx)' }}>{title}</h2>
          {subtitle && <div style={{ fontSize:12, color:'var(--th)', fontFamily: 'var(--sans)', marginTop:3 }}>{subtitle}</div>}
        </div>
      )}
      <div style={{ minHeight }}>{children}</div>
    </section>
  )
}

export function ChartEmpty({ msg }) {
  const { t } = useT()
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:160, flexDirection:'column', gap:8 }}>
      <div style={{ opacity:.35, color:'var(--th)' }}><SignalIcon kind="category" size={22} /></div>
      <div style={{ fontSize:12, color:'var(--th)', fontFamily: 'var(--sans)', textAlign:'center', maxWidth:220 }}>{msg || t('chart.empty.generic')}</div>
    </div>
  )
}
