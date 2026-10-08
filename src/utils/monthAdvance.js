// src/utils/monthAdvance.js — el mes activo avanza solo (decisión de Walter,
// 08-oct-2026): al empezar un mes nuevo, si el usuario estaba mirando el mes
// que en ese momento era el actual, pasa al nuevo. Si estaba revisando un mes
// anterior a propósito, se queda donde estaba.
//
// `lastSeenMonth` (en settings) es el mes en curso la última vez que se abrió
// la app. Sin ese dato (primera apertura tras la actualización) se asume que
// estaba en el mes en curso si su mes activo es justo el anterior al de hoy.
import { addMonthsYM } from './recurring.js'

export function monthAdvance(settings, current) {
  const s = settings || {}
  if (!current) return null
  if (!s.activeMonth) return { ...s, activeMonth: current, lastSeenMonth: current }
  if (s.lastSeenMonth === current) return null
  const wasOnCurrent = s.lastSeenMonth
    ? s.activeMonth === s.lastSeenMonth
    : s.activeMonth === addMonthsYM(current, -1)
  const advance = wasOnCurrent && s.activeMonth < current
  return { ...s, lastSeenMonth: current, ...(advance ? { activeMonth: current } : {}) }
}
