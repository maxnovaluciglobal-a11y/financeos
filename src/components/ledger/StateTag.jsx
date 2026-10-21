// src/components/ledger/StateTag.jsx — estado con ícono + palabra (sistema compartido con Invest, UI-L1)
//
// Regla "Honest Ledger": un estado nunca es solo color. La forma del ícono
// distingue el tono aunque el color no se vea (daltonismo, escala de grises):
//   ok    → círculo con check    (--pos)   "A tiempo", "Bien"
//   warn  → círculo con "!"      (--warn)  "Cerca del límite", "Atrasada"
//   risk  → círculo con cruz     (--neg)   "Excedido", "Sobregiro"
//   muted → círculo punteado     (--th)    "Sin asignar", "sin dato"
// `label` llega ya traducido.
import { CircleCheck, CircleAlert, CircleX, CircleDashed } from 'lucide-react'
import s from './ledger.module.css'

const TONES = {
  ok:    { Ic: CircleCheck,  color: 'var(--pos)' },
  warn:  { Ic: CircleAlert,  color: 'var(--warn)' },
  risk:  { Ic: CircleX,      color: 'var(--neg)' },
  muted: { Ic: CircleDashed, color: 'var(--th)' },
}

export default function StateTag({ tone = 'muted', label, size = 14, className, style }) {
  const { Ic, color } = TONES[tone] || TONES.muted
  return (
    <span className={[s.stateTag, className].filter(Boolean).join(' ')} style={{ color, ...style }} data-tone={tone}>
      <Ic size={size} strokeWidth={1.7} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}
