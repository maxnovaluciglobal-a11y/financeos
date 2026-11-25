// Día, mes corto y fecha larga de un 'YYYY-MM-DD' en hora local. Copia de la
// de OccurrenceRow: importarla de ahí volvía a OccurrenceRow un trozo aparte y
// sumaba su nombre al mapa de precarga de la entrada (scripts/bundleBudget.js).
export function dateParts(dateStr, lang) {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  let mon = '', full = dateStr
  try { mon = dt.toLocaleDateString(lang, { month: 'short' }).replace('.', '') } catch { /* idioma no soportado */ }
  try { full = dt.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' }) } catch { /* idioma no soportado */ }
  return { day: d, mon, full }
}
