// src/utils/quickChips.js — orden de los chips de categoría del registro rápido.
//
// Sin plantilla (o con la "personal", que son las canónicas): primero las más
// usadas del historial y después las categorías efectivas — comportamiento de
// siempre.
//
// Con una plantilla de perfil activa que no sea la personal (ej. freelancer):
// sus categorías van primero. Hasta 3 lugares para las de la plantilla que más
// se usan; después las PROPIAS de la plantilla (las que no son canónicas, ej.
// "Marketing propio", "Provisión impuestos"), que si no quedarían siempre
// escondidas detrás de las canónicas ya usadas; después el resto de la plantilla.
// El último lugar se reserva para la categoría más usada que no sea de la
// plantilla, si existe: el registro rápido solo muestra estos chips y una
// categoría habitual no puede desaparecer.
export function orderQuickChips({ ranked = [], effective = [], templateCats = [], canonical = [], templateActive = false, max = 6 }) {
  const uniq = (arr) => [...new Set(arr.filter(Boolean))]
  if (!templateActive || templateCats.length === 0) return uniq([...ranked, ...effective]).slice(0, max)

  const tpl = new Set(templateCats)
  const canon = new Set(canonical)
  const usedTpl = ranked.filter(c => tpl.has(c)).slice(0, 3)
  const ownTpl = templateCats.filter(c => !canon.has(c))
  const firstOther = ranked.find(c => !tpl.has(c))
  const head = uniq([...usedTpl, ...ownTpl, ...templateCats])
  const out = head.slice(0, firstOther ? max - 1 : max)
  if (firstOther) out.push(firstOther)
  // Si la plantilla trae menos de `max`, completar como siempre.
  return uniq([...out, ...ranked, ...effective]).slice(0, max)
}

// ¿Hay una plantilla de perfil activa distinta de la personal?
export function hasProfileTemplate(settings) {
  return !!settings?.activeTemplateId && settings.activeTemplateId !== 'personal'
}
