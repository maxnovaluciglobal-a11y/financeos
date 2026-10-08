// src/components/recurring/labels.js — texto de la frecuencia de una regla
// ("Mensual · día 1", "Cada 14 días", "Cada 3 meses · día 20").
export function freqText(rule, t) {
  const sch = rule?.schedule || {}
  const every = Number(sch.interval) || 1
  const base = sch.freq === 'monthly' && every > 1 ? t('rec.freq.everyN', { n: every }) : t(`rec.freq.${sch.freq || 'monthly'}`)
  if (sch.freq === 'monthly' || sch.freq === 'yearly') {
    return `${base} · ${sch.day === 'last' ? t('rec.day.last') : t('rec.day.n', { d: sch.day || 1 })}`
  }
  return base
}
