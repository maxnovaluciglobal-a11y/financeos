// src/components/icons/SignalIcon.jsx — íconos de señales y estados (T17)
// Reemplaza los glifos unicode que hacían de ícono (◈ ⚠ ⊗ ◑ ⊞ ↻ ⇪) en el
// Dashboard, el Diagnóstico y avisos. lucide con trazo 1.7 (el del TabBar);
// heredan el color del texto (currentColor) salvo que se pase `color`.
// Severidades del diagnóstico con el mismo vocabulario de forma que el estado
// del IQ Score (ScoreState.jsx): aviso fuerte = cruz, atención = signo de
// exclamación, info = "i".
import { Info, CircleAlert, CircleX, CircleCheck, TriangleAlert, Repeat, ChartPie, Target, Upload, Sparkles, Briefcase, Stethoscope, FileText, Plus, Wallet, Lock, CircleDashed } from 'lucide-react'

const ICONS = {
  info: Info,
  attention: CircleAlert,
  warning: CircleX,
  ok: CircleCheck,
  alert: TriangleAlert,   // aviso/advertencia en texto (antes "⚠ ")
  subs: Repeat,
  category: ChartPie,
  goal: Target,
  upload: Upload,
  empty: Sparkles,
  investment: Briefcase,
  diagnosis: Stethoscope,
  suggested: Sparkles,
  pdf: FileText,
  plus: Plus,
  budget: Wallet,
  lock: Lock,
  progress: CircleDashed,
}

export default function SignalIcon({ kind, size = 14, color, style }) {
  const Ic = ICONS[kind] || Info
  return <Ic size={size} strokeWidth={1.7} color={color} aria-hidden="true" style={{ flexShrink: 0, ...style }} />
}

// Para usar al inicio de una línea de texto (alineado a la línea base).
export function InlineIcon({ kind, size = 14, color }) {
  return <SignalIcon kind={kind} size={size} color={color} style={{ verticalAlign: '-2px', marginRight: 6 }} />
}
