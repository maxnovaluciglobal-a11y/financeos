// Estado de una meta (investigación UI oct-2026, UI-Q5): una meta al 24 % no
// está mal, está en curso. Por eso el estado no sale del porcentaje sino del
// ritmo: ¿alcanza lo que queda disponible este mes para el aporte mensual que
// pide la meta hasta su fecha?
//
// - done:   ahorrado >= objetivo.
// - none:   sin fecha objetivo (no hay ritmo que medir).
// - behind: la fecha ya pasó, o el aporte mensual que falta no entra en lo
//           disponible del mes una vez cubiertas las metas de mayor prioridad.
// - onTrack: el resto.
//
// Las metas se reparten lo disponible por prioridad (Alta, Media, Baja) y,
// dentro de la misma prioridad, por fecha más cercana. Puro, sin React.

const PRIO_ORDER = { Alta: 0, Media: 1, Baja: 2 }

// Meses entre 'YYYY-MM' (activo) y la fecha objetivo ('YYYY-MM' o 'YYYY-MM-DD'),
// contando el mes activo: una meta para este mismo mes tiene 1 mes.
export function monthsLeft(activeMonth, targetDate) {
  const [ay, am] = String(activeMonth).split('-').map(Number)
  const [ty, tm] = String(targetDate).slice(0, 7).split('-').map(Number)
  if (!ay || !am || !ty || !tm) return null
  return (ty - ay) * 12 + (tm - am) + 1
}

export function goalStatuses(goals, { activeMonth, available }) {
  const out = {}
  let budget = Math.max(0, Number(available) || 0)
  const list = (Array.isArray(goals) ? goals : []).map((g) => {
    const target = Number(g?.target) || 0
    const saved = Number(g?.saved) || 0
    const months = g?.targetDate ? monthsLeft(activeMonth, g.targetDate) : null
    return { g, target, saved, months }
  })
  for (const it of list) {
    if (it.target > 0 && it.saved >= it.target) out[it.g.id] = 'done'
    else if (it.months == null) out[it.g.id] = 'none'
    else if (it.months < 1) out[it.g.id] = 'behind'
  }
  const pending = list
    .filter((it) => !out[it.g.id])
    .sort((a, b) => (PRIO_ORDER[a.g.priority] ?? 1) - (PRIO_ORDER[b.g.priority] ?? 1) || a.months - b.months)
  for (const it of pending) {
    const monthly = (it.target - it.saved) / it.months
    if (monthly <= budget + 1e-9) { out[it.g.id] = 'onTrack'; budget -= monthly }
    else out[it.g.id] = 'behind'
  }
  return out
}
