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

// aria-valuetext del slider: lo gastado hasta ese día, lo de ese día y lo que quedaba.
export function valueText({ series, day, activeMonth, t, fmt, locale }) {
  const date = longDate(activeMonth, day, locale)
  const total = fmt(series.spentCum[day])
  const amount = fmt(series.avail[day])
  if (series.mode === 'current' && day === series.lastDay) return t('home.lupa.vt.today', { date, total, amount })
  return t('home.lupa.vt.past', { date, total, spent: fmt(series.spent[day]), amount })
}

// Rótulo y línea de abajo de la cifra grande mientras se inspecciona un día:
// "El martes 10 llevabas gastado" / "ese día gastaste $Y · te quedaban $Z".
export function inspectLines({ series, day, activeMonth, t, fmt, locale }) {
  const label = t('home.lupa.label.past', { weekday: weekdayName(activeMonth, day, locale), day })
  const parts = [series.spent[day] > 0
    ? t('home.lupa.sub.spent', { spent: fmt(series.spent[day]) })
    : t('home.lupa.sub.nothing')]
  parts.push(t('home.lupa.sub.left', { amount: fmt(series.avail[day]) }))
  return { label: upperFirst(label), sub: parts.join(' · ') }
}

// `pace` = paceToday(): ideal(hoy) − gastado(hoy), la misma cuenta que el anillo.
export function paceLine(pace, { t, fmt }) {
  if (!pace) return null
  // I-22: fijos + apartado se llevan todo el ingreso; no hay ritmo que medir.
  if (pace.cause === 'fixed') return { kind: 'fixed', text: t('pulse.fixed') }
  const gap = pace.gap
  if (pace.even) return { kind: 'even', text: t('home.lupa.pace.even') }
  return gap > 0
    ? { kind: 'ahead', text: t('home.lupa.pace.ahead', { amount: fmt(gap) }) }
    : { kind: 'behind', text: t('home.lupa.pace.behind', { amount: fmt(-gap) }) }
}

// Rótulo sobre el gráfico: "$639.144 por encima" o "por
// debajo" del ritmo de hoy. null si el ritmo va parejo o los fijos se llevan
// todo el ingreso (no hay ritmo que medir). Claves en components/ahead.
export function paceGap(pace, { t, fmt }) {
  if (!pace || pace.cause === 'fixed' || pace.even || !Number.isFinite(pace.gap) || pace.gap === 0) return null
  return pace.gap > 0
    ? { kind: 'under', text: t('ahead.pace.under', { amount: fmt(pace.gap) }) }
    : { kind: 'over', text: t('ahead.pace.over', { amount: fmt(-pace.gap) }) }
}

export const sheetTitle = (activeMonth, day, locale) => upperFirst(longDate(activeMonth, day, locale))
