// "Pusiste" y "El mercado sumó" arriba de Resumen y de Portafolio, con el
// desglose Precio + Dividendos + Dólar cuando hay datos y "¿Le ganaste a la
// inflación y al dólar?" cuando se puede calcular (utils/investEsencial.js).
// money(n, signed) formatea en la moneda de la pantalla; pct(frac, signed) los
// porcentajes. Sin datos para calcular, no se dibuja nada.
import { useId } from 'react'
import { ArrowDown, ArrowUp, Check, Equal, Minus } from 'lucide-react'
import Money from '../../../components/Money.jsx'
import { beatChecks } from '../../../utils/investEsencial.js'
import { useEssT } from './dict.js'
import s from './esencial.module.css'

const dirOf = (n) => (n > 0.005 ? 'up' : n < -0.005 ? 'down' : 'flat')
function Arrow({ n }) {
  const d = dirOf(n)
  const Ic = d === 'up' ? ArrowUp : d === 'down' ? ArrowDown : Equal
  return <Ic size={14} strokeWidth={2.4} aria-hidden="true" />
}

export default function PutSummary({ summary, money, pct, currency = 'USD', inflation = null }) {
  const { t } = useEssT()
  const id = useId()
  if (!summary) return null
  const g = summary.gain
  const checks = beatChecks(summary, { currency, inflation })
  const parts = summary.parts
    ? [
      ['price', summary.parts.price],
      ['dividends', summary.parts.dividends],
      ['fx', summary.parts.fx],
    ].filter(([, v]) => v != null)
    : []
  const hasInflation = !!checks?.some(c => c.key === 'inflation')
  return (
    <section className={s.put} aria-labelledby={`${id}-put`}>
      <h2 id={`${id}-put`} className="sr-only">{t('ess.put.title')}</h2>
      <dl className={s.putRow}>
        <div className={s.putCell}>
          <dt className={s.putLabel}>{t('ess.put.put')}</dt>
          <dd className={s.putValue}><Money>{money(summary.put)}</Money></dd>
          <dd className={s.putSub}>{t(summary.basis === 'contributed' ? 'ess.put.putSub.contributed' : 'ess.put.putSub.invested')}</dd>
        </div>
        <div className={s.putCell}>
          <dt className={s.putLabel}>{t(g < -0.005 ? 'ess.put.lost' : 'ess.put.gain')}</dt>
          <dd className={`${s.putValue} ${s.tone}`} data-tone={dirOf(g)}><Arrow n={g} /><Money>{money(g, true)}</Money></dd>
          <dd className={s.putSub}>
            {summary.pct != null ? t('ess.put.gainSub', { pct: pct(summary.pct, true) }) : null}
            {summary.value != null ? <> · <Money>{t('ess.put.value', { v: money(summary.value) })}</Money></> : null}
          </dd>
        </div>
      </dl>

      {parts.length > 1 && (
        <div className={s.parts}>
          <h3 className={s.h3}>{t('ess.put.parts')}</h3>
          <dl className={s.partList}>
            {parts.map(([k, v]) => (
              <div key={k} className={s.part}>
                <dt><span className={s.partName}>{t(`ess.put.part.${k}`)}</span><span className={s.putSub}>{t(`ess.put.part.${k}Sub`)}</span></dt>
                <dd className={s.tone} data-tone={dirOf(v)}><Arrow n={v} /><Money>{money(v, true)}</Money></dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {checks && (
        <div className={s.parts}>
          <h3 className={s.h3}>{t(hasInflation ? 'ess.beat.title' : 'ess.beat.titleUsd')}</h3>
          <ul className={s.beatList}>
            {checks.map(c => {
              const Ic = c.even ? Equal : c.beat ? Check : Minus
              const k = `ess.beat.${c.key}.${c.even ? 'even' : c.beat ? 'yes' : 'no'}`
              return (
                <li key={c.key} className={s.beat} data-beat={c.even ? 'even' : c.beat ? 'yes' : 'no'}>
                  <Ic size={16} strokeWidth={2.4} aria-hidden="true" />
                  <span>{t(k, { pct: pct(c.pct, true), ref: c.ref != null ? pct(c.ref, true) : '' })}</span>
                </li>
              )
            })}
          </ul>
          <p className={s.putSub}>{t('ess.beat.note')}</p>
        </div>
      )}
      {summary.partial && <p className={s.putSub} role="note">{t('ess.put.partial')}</p>}
    </section>
  )
}
