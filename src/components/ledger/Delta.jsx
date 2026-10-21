// src/components/ledger/Delta.jsx — variación con flecha + texto (sistema compartido, UI-L1)
//
// La dirección se lee aunque no se vea el color (regla "Direction" de Invest):
// flecha arriba/abajo o "=", y la frase completa. El color solo dice si el
// cambio es bueno (verde) o malo (rojo) para esa métrica; `good === null` es
// neutro (tinta terciaria).
import { ArrowUp, ArrowDown, Equal } from 'lucide-react'
import s from './ledger.module.css'

export default function Delta({ dir = 'flat', good = null, children, style, className }) {
  const Ic = dir === 'up' ? ArrowUp : dir === 'down' ? ArrowDown : Equal
  const color = dir === 'flat' || good === null ? 'var(--th)' : good ? 'var(--pos)' : 'var(--neg)'
  return (
    <span className={[s.delta, className].filter(Boolean).join(' ')} style={{ color, ...style }}>
      <Ic size={14} strokeWidth={2} aria-hidden="true" />
      <span>{children}</span>
    </span>
  )
}
