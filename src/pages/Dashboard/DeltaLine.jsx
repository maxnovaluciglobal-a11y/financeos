// src/pages/Dashboard/DeltaLine.jsx — variación vs. el mes anterior (M5).
// Ícono + texto, nunca solo color: flecha arriba/abajo o "=" con la frase
// completa ("−6 % vs. septiembre", "igual que septiembre"). El color dice si el
// cambio es bueno (verde) o malo (rojo) según la métrica — en Gastos bajar es
// bueno — pero la dirección se lee igual sin él.
import { ArrowUp, ArrowDown, Equal } from 'lucide-react'
import { useT } from '../../i18n/useT.js'
import { fmtSignedPct, monthName } from './dashboardModel.js'
import s from './Home.module.css'

// delta: resultado de monthDelta() o null (no se muestra nada).
// valueText: reemplaza el porcentaje (ej. "+3 pts" del IQ Score).
export default function DeltaLine({ delta, prevMonth, valueText, style }) {
  const { t, lang } = useT()
  if (!delta) return null
  const month = monthName(prevMonth, lang)
  const flat = delta.dir === 'flat'
  const Ic = flat ? Equal : delta.dir === 'up' ? ArrowUp : ArrowDown
  const color = flat || delta.good === null ? 'var(--th)' : delta.good ? 'var(--pos)' : 'var(--neg)'
  const text = flat
    ? t('home.delta.flat', { month })
    : t('home.delta.vs', { pct: valueText ?? fmtSignedPct(delta.pct, lang), month })
  return (
    <span className={s.delta} style={{ color, ...style }}>
      <Ic size={14} strokeWidth={2} aria-hidden="true" />
      <span>{text}</span>
    </span>
  )
}
