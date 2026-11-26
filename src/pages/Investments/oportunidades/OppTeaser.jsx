// Tarjeta de Resumen (vista esencial y completa): cuántas de tus posiciones
// están hoy en o bajo alguna de sus medias, con un acceso a Planificar ›
// Oportunidades y a "Repartir mi capital". Usa las historias de 1 año que
// Resumen ya pidió (useHoyData: historyPlan), sin pedidos nuevos.
// `compact` (desde el 26-nov-2026): Resumen ya muestra arriba "Tus reglas hoy"
// con la cuenta de tramos según tu regla; aquí quedan solo los accesos, para
// no repetir una cifra distinta (esta ignora la condición de RSI).
import { ChevronRight, Info } from 'lucide-react'
import { joinList, readSignal, summarize } from './signals.js'
import { useMoney } from '../../../components/Money.jsx'
import { useOppT } from './dict.js'
import h from '../hoy/hoy.module.css'
import s from './oportunidades.module.css'

const MAX_CHIPS = 4

// items: [{ t, label, rows (undefined = cargando, null = falló), crypto }]
export default function OppTeaser({ items, free, money, onSee, onSplit, compact = false }) {
  const { t, ready } = useOppT()
  const { m } = useMoney()
  if (!ready || !items.length) return null
  if (compact) {
    return (
      <section className={h.card} aria-labelledby="hoy-opp-title">
        <div className={h.cardHead}><h2 id="hoy-opp-title" className={h.cardTitle}>{t('opp.title')}</h2></div>
        <div className={h.links} style={{ flexWrap: 'wrap', gap: '4px 16px' }}>
          <button type="button" className={h.link} onClick={onSee}>{t('opp.teaser.see')}<ChevronRight size={14} aria-hidden="true" /></button>
          <button type="button" className={h.link} onClick={onSplit}>{free > 0 ? t('opp.teaser.split', { v: m(money(free)) }) : t('opp.teaser.splitAny')}<ChevronRight size={14} aria-hidden="true" /></button>
        </div>
      </section>
    )
  }
  const loading = items.some(i => i.rows === undefined)
  const read = items.map(i => ({ t: i.t, label: i.label || i.t, reading: i.rows ? readSignal(i.rows.map(r => r.close), { crypto: i.crypto }) : null }))
  const sum = summarize(read)
  const labelOf = Object.fromEntries(read.map(r => [r.t, r.label]))
  let body
  if (loading && !sum.read) body = <p className={h.muted} role="status">{t('opp.teaser.loading')}</p>
  else if (!sum.read) body = <p className={h.text}>{t('opp.teaser.failed')}</p>
  else if (!sum.hit) body = <p className={h.text}>{t('opp.teaser.none')}</p>
  else {
    body = (
      <>
        <p className={h.text}>{t(sum.hit === 1 ? 'opp.teaser.someOne' : 'opp.teaser.someMany', { n: sum.hit, m: sum.read })}</p>
        <div className={h.chips}>
          {sum.rows.slice(0, MAX_CHIPS).map(r => (
            <button key={r.t} type="button" className={h.chip} onClick={onSee}
              aria-label={t('opp.teaser.chipAria', { t: labelOf[r.t], n: r.deepest, tramos: t(r.tramos.length === 1 ? 'opp.tramosOne' : 'opp.tramosMany', { list: joinList(r.tramos, t) }) })}>
              {t('opp.teaser.chip', { t: labelOf[r.t], n: r.deepest })}
            </button>
          ))}
        </div>
      </>
    )
  }
  return (
    <section className={h.card} aria-labelledby="hoy-opp-title">
      <div className={h.cardHead}><h2 id="hoy-opp-title" className={h.cardTitle}>{t('opp.teaser.title')}</h2></div>
      <div aria-live="polite">{body}</div>
      <div className={h.links} style={{ flexWrap: 'wrap', gap: '4px 16px' }}>
        <button type="button" className={h.link} onClick={onSee}>{t('opp.teaser.see')}<ChevronRight size={14} aria-hidden="true" /></button>
        <button type="button" className={h.link} onClick={onSplit}>{free > 0 ? t('opp.teaser.split', { v: m(money(free)) }) : t('opp.teaser.splitAny')}<ChevronRight size={14} aria-hidden="true" /></button>
      </div>
      <p className={s.edu} role="note"><Info size={14} strokeWidth={2} aria-hidden="true" />{t('opp.edu')}</p>
    </section>
  )
}
