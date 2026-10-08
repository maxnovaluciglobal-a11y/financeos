// src/components/ScoreState.jsx — estado del IQ Score y de otras señales (T15, D3)
//
// Tres niveles, cada uno con ícono + palabra + color, para que el estado se
// entienda sin depender del color (daltonismo, pantalla al sol, escala de
// grises): Bien (check) · Atención (signo de exclamación) · Riesgo (cruz).
// La forma del ícono distingue el estado aunque los tres colores se confundan.

import { CircleCheck, CircleAlert, CircleX } from 'lucide-react'
import { SCORE_LEVELS } from '../utils/financialScore.js'

const ICONS = { ok: CircleCheck, attention: CircleAlert, risk: CircleX }

export function ScoreStateIcon({ level, size = 14, color }) {
  const Ic = ICONS[level] || CircleAlert
  return <Ic size={size} strokeWidth={1.7} color={color || SCORE_LEVELS[level]?.color} aria-hidden="true" style={{ flexShrink: 0 }} />
}

// Ícono + palabra. `label` ya traducido (t(SCORE_LEVELS[level].key) o el label
// que devuelve calcFinancialScore).
export function ScoreState({ level, label, size = 14, style }) {
  const color = SCORE_LEVELS[level]?.color || 'var(--th)'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color, fontWeight: 600, ...style }}>
      <ScoreStateIcon level={level} size={size} color={color} />
      <span>{label}</span>
    </span>
  )
}
