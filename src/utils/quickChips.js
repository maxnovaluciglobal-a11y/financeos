// src/utils/quickChips.js — orden de los chips de categoría del registro rápido.
//
// Sin plantilla (o con la "personal", que son las canónicas): primero las más
// usadas del historial y después las categorías efectivas — comportamiento de
// siempre.
//
// Con una plantilla de perfil activa que no sea la personal (ej. freelancer):
// sus categorías van primero. Hasta 3 lugares para las de la plantilla que más
// se usan; después se completa en el orden de la plantilla con un CUPO: las
// PROPIAS de la plantilla (las que no son canónicas, ej. "Marketing propio",
// "Provisión impuestos") tienen hasta la mitad de los lugares, para que no
// queden escondidas detrás de las canónicas ya usadas, y el resto queda para
// las básicas de la plantilla (Vivienda, Alimentación…). Antes las propias
// entraban todas primero y en el primer gasto de un freelancer no aparecía
// "Alimentación" (feedback de Walter, 09-oct-2026). Los cajones genéricos
// ("Otro"/"Otros") no cuentan como propios: nunca le ganan lugar a una real.
// El último lugar se reserva para la categoría más usada que no sea de la
// plantilla, si existe: el registro rápido solo muestra estos chips y una
// categoría habitual no puede desaparecer.
const GENERIC = new Set(['Otro', 'Otros'])

export function orderQuickChips({ ranked = [], effective = [], templateCats = [], canonical = [], templateActive = false, max = 6 }) {
  const uniq = (arr) => [...new Set(arr.filter(Boolean))]
  if (!templateActive || templateCats.length === 0) return uniq([...ranked, ...effective]).slice(0, max)

  const tpl = new Set(templateCats)
  const canon = new Set(canonical)
  const isOwn = (c) => !canon.has(c) && !GENERIC.has(c)
  const firstOther = ranked.find(c => !tpl.has(c))
  const budget = firstOther ? max - 1 : max

  const out = uniq(ranked.filter(c => tpl.has(c))).slice(0, Math.min(3, budget))
  const rest = uniq(templateCats).filter(c => !out.includes(c))
  const ownAvailable = rest.filter(isOwn).length + out.filter(isOwn).length
  const ownQuota = Math.min(Math.ceil(budget / 2), ownAvailable)
  const basicQuota = budget - ownQuota
  let own = out.filter(isOwn).length
  let basic = out.length - own
  for (const c of rest) {
    if (out.length >= budget) break
    if (isOwn(c)) { if (own < ownQuota) { out.push(c); own++ } }
    else if (basic < basicQuota) { out.push(c); basic++ }
  }
  // Si algún cupo quedó sin usar, se completa en el orden de la plantilla.
  for (const c of rest) { if (out.length >= budget) break; if (!out.includes(c)) out.push(c) }
  if (firstOther) out.push(firstOther)
  // Si la plantilla trae menos de `max`, completar como siempre.
  return uniq([...out, ...ranked, ...effective]).slice(0, max)
}

// ¿Hay una plantilla de perfil activa distinta de la personal?
export function hasProfileTemplate(settings) {
  return !!settings?.activeTemplateId && settings.activeTemplateId !== 'personal'
}
