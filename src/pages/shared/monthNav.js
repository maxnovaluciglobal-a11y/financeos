// src/pages/shared/monthNav.js — lógica pura del selector de mes ‹ mes › (B3a)
// Sin React; testeado en monthNav.test.js.

const YM = /^(\d{4})-(\d{2})$/

// 'YYYY-MM' + delta meses → 'YYYY-MM' (cruza años). Entrada inválida → la misma.
export function shiftMonth(ym, delta) {
  const m = YM.exec(String(ym || ''))
  if (!m) return ym
  const idx = Number(m[1]) * 12 + (Number(m[2]) - 1) + (Number(delta) || 0)
  const y = Math.floor(idx / 12)
  return `${y}-${String(idx - y * 12 + 1).padStart(2, '0')}`
}

// Rango navegable: del mes más viejo con datos al más nuevo, y siempre incluye
// el mes en curso y el mes activo (para no dejar al usuario sin salida).
export function monthRange(dates, current, active) {
  const months = (Array.isArray(dates) ? dates : [])
    .map((d) => String(d || '').slice(0, 7))
    .filter((d) => YM.test(d))
  for (const x of [current, active]) if (YM.test(String(x || ''))) months.push(x)
  if (months.length === 0) return { min: null, max: null }
  months.sort()
  return { min: months[0], max: months[months.length - 1] }
}

// Todos los meses del rango, del más nuevo al más viejo (la lista de la hoja).
export function monthsBetween({ min, max }) {
  if (!min || !max) return []
  const out = []
  for (let m = max; m >= min && out.length < 600; m = shiftMonth(m, -1)) out.push(m)
  return out
}

// ¿Se puede ir al mes anterior / siguiente desde `active` dentro del rango?
export function stepState(active, { min, max }) {
  return {
    prev: shiftMonth(active, -1),
    next: shiftMonth(active, 1),
    canPrev: !!min && active > min,
    canNext: !!max && active < max,
  }
}

// El Inicio abre la hoja de cierre de mes (MonthlyCloseModal) cuando el mes
// activo ya terminó y su clave `fos_close_<mes>` no está marcada. Si el usuario
// elige a propósito un mes pasado desde Movimientos, esa hoja aparecería sin
// motivo al volver al Inicio: esta es la clave que hay que marcar (o null si el
// mes elegido es el actual o uno futuro).
export function closeKeyToDismiss(target, current) {
  if (!YM.test(String(target || '')) || !YM.test(String(current || ''))) return null
  return target < current ? `fos_close_${target}` : null
}
