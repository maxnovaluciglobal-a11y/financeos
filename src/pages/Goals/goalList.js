// src/pages/Goals/goalList.js — poda P2 (30-oct-2026).
// Una meta que ya está en una bolsa fija (Fondo de emergencia, Ahorros
// generales) no se repite como tarjeta en la lista: la bolsa la reemplaza y su
// detalle (editar, borrar, aportar, ajuste del fondo) se abre desde la bolsa.
// Solo sale de la lista la meta que fixedBuckets() eligió para la bolsa: una
// segunda meta de emergencia sigue en la lista. Sin React; testeado en goalList.test.js.

const sameGoal = (a, b) => !!a && !!b && (a === b || (a.id != null && a.id === b.id))

export function bucketGoalOf(buckets, goal) {
  return (Array.isArray(buckets) ? buckets : []).find(b => sameGoal(b?.goal, goal)) || null
}

export function listedGoals(goals, buckets) {
  const bound = (Array.isArray(buckets) ? buckets : []).map(b => b?.goal).filter(Boolean)
  return (Array.isArray(goals) ? goals : []).filter(g => g && !bound.some(b => sameGoal(b, g)))
}
