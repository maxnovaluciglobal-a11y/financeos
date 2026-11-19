// src/pages/Dashboard/lupa/lupaText.js — textos de la ChartLupa (puros).
// `t` = useT().t, `fmt(n)` = monto ya formateado (y enmascarado con "ocultar
// montos"), `locale` = dateLocale() del idioma de la interfaz.

const dateOf = (activeMonth, day) => {
  const [y, m] = String(activeMonth).split('-').map(Number)
  return new Date(y, m - 1, day)
}

function fmtDate(activeMonth, day, locale, opts) {
  try { return dateOf(activeMonth, day).toLocaleDateString(locale, opts) } catch { return String(day) }
}

// "martes" / "Tuesday" / "Dienstag" / "terça-feira"
export const weekdayName = (activeMonth, day, locale) => fmtDate(activeMonth, day, locale, { weekday: 'long' })
// "martes, 10 de noviembre" / "Tuesday, November 10" / "Dienstag, 10. November"
export const longDate = (activeMonth, day, locale) => fmtDate(activeMonth, day, locale, { weekday: 'long', day: 'numeric', month: 'long' })
// "10 nov" para el eje
export const shortDate = (activeMonth, day, locale) => fmtDate(activeMonth, day, locale, { day: 'numeric', month: 'short' }).replace(/\.$/, '')

const upperFirst = (s) => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s)

// aria-valuetext del slider: el día, lo que quedaba y lo que se gastó.
export function valueText({ series, day, activeMonth, t, fmt, locale }) {
  const date = longDate(activeMonth, day, locale)
  const amount = fmt(series.avail[day])
  if (series.mode === 'current' && day === series.lastDay) return t('home.lupa.vt.today', { date, amount })
  const spent = fmt(series.spent[day])
  if (series.earned[day] > 0) return t('home.lupa.vt.pastIncome', { date, amount, spent, income: fmt(series.earned[day]) })
  return t('home.lupa.vt.past', { date, amount, spent })
}

// Rótulo y línea de abajo de la cifra grande mientras se inspecciona un día.
export function inspectLines({ series, day, activeMonth, t, fmt, locale }) {
  const label = t('home.lupa.label.past', { weekday: weekdayName(activeMonth, day, locale), day })
  const parts = []
  if (series.spent[day] > 0) parts.push(t('home.lupa.sub.spent', { spent: fmt(series.spent[day]) }))
  if (series.earned[day] > 0) parts.push(t('home.lupa.sub.income', { income: fmt(series.earned[day]) }))
  if (!parts.length) parts.push(t('home.lupa.sub.nothing'))
  return { label: upperFirst(label), sub: parts.join(' · ') }
}

// Distancia contra el ritmo ideal en palabras (reposo).
export function paceLine(gap, { t, fmt, reference }) {
  if (gap == null) return null
  const close = reference > 0 && Math.abs(gap) <= reference * 0.02
  if (close) return { kind: 'even', text: t('home.lupa.pace.even') }
  return gap > 0
    ? { kind: 'ahead', text: t('home.lupa.pace.ahead', { amount: fmt(gap) }) }
    : { kind: 'behind', text: t('home.lupa.pace.behind', { amount: fmt(-gap) }) }
}

export const sheetTitle = (activeMonth, day, locale) => upperFirst(longDate(activeMonth, day, locale))
