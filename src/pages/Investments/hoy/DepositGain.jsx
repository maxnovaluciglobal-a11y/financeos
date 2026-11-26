// src/pages/Investments/hoy/DepositGain.jsx — "Depositado frente a ganancia",
// la primera lectura de Resumen (Inversiones v2, 24-nov-2026).
// Valor total, lo depositado y la ganancia o pérdida en dinero y en %. Dice
// siempre con qué se compara (utils/investDeposit.js): si no hay depósitos
// registrados, lo dice y ofrece registrarlos en Portafolio › Movimientos.
// Reemplaza a la banda de valor en Resumen (con la variación de hoy adentro).
// `compact` (26-nov-2026, propuesta 4): sin los dos párrafos de abajo; la
// explicación de "Depositado" va en el detalle "¿De dónde viene la ganancia?"
// (Hoy.jsx, con putExplainKey) y el efectivo sin invertir en los enlaces que
// Hoy pasa como `children`, al pie de la banda.
import { ArrowDown, ArrowUp, Equal, Info } from 'lucide-react'
import Money from '../../../components/Money.jsx'
import { useT } from '../../../i18n/useT.js'
import { fmtPct } from '../../../utils/index.js'
import s from './hoy.module.css'

const dirOf = (n) => (n > 0.005 ? 'up' : n < -0.005 ? 'down' : 'flat')
function Arrow({ n }) {
  const d = dirOf(n)
  const Ic = d === 'up' ? ArrowUp : d === 'down' ? ArrowDown : Equal
  return <Ic size={12} strokeWidth={2.4} aria-hidden="true" />
}

const putKeyOf = (dep) => (dep.basis === 'deposits' ? 'deposited' : dep.basis === 'purchases' ? 'paid' : 'cost')
/** Clave del texto que explica con qué se compara ("Depositado: tus depósitos…"). */
export const putExplainKey = (dep) => `invest.dep.${putKeyOf(dep)}Sub`

// dep: depositGain(); sub: equivalente en la moneda de la persona o "precios
// cargando"; costRes: costResult() en la Vista completa (o null).
export default function DepositGain({ dep, sub, money, costRes = null, onRegister = null, compact = false, children = null }) {
  const { t } = useT()
  if (!dep) return null
  const lost = dep.gain < -0.005
  const putKey = putKeyOf(dep)
  const pctKey = dep.basis === 'deposits' ? 'invest.dep.gainSub' : 'invest.dep.gainSubCost'
  const notes = []
  if (!compact && dep.basis !== 'cost' && dep.cash > 0.5) notes.push(t('invest.dep.cashIn', { v: money(dep.cash) }))
  if (dep.atCost > 0) notes.push(t(dep.atCost === 1 ? 'invest.dep.atCostOne' : 'invest.dep.atCostMany', { n: dep.atCost }))
  if (dep.partial) notes.push(t('invest.dep.partial'))
  return (
    <section className={s.band} aria-labelledby="hoy-dep-label">
      <h2 className="sr-only">{t('invest.dep.title')}</h2>
      <span id="hoy-dep-label" className={s.bandLabel}>{t('invest.hoy.band.label')}</span>
      <div className={s.bandValue}><Money>{money(dep.value)}</Money></div>
      {sub && <div className={s.bandSub}>{sub}</div>}
      <dl className={s.bandRow}>
        <div>
          <dt>{t(`invest.dep.${putKey}`)}</dt>
          <dd><Money>{money(dep.deposited)}</Money></dd>
        </div>
        <div>
          <dt>{t(lost ? 'invest.dep.loss' : 'invest.dep.gain')}</dt>
          <dd data-tone={dirOf(dep.gain)}>
            <Arrow n={dep.gain} /><Money>{lost ? money(Math.abs(dep.gain)) : money(dep.gain, true)}</Money>
            {dep.pct != null && <span>{t(pctKey, { pct: lost ? fmtPct(Math.abs(dep.pct)) : fmtPct(dep.pct, { signed: true }) })}</span>}
          </dd>
        </div>
        <div>
          <dt>{t('invest.card.day')}</dt>
          <dd data-tone={dep.day != null ? dirOf(dep.day) : 'flat'}>
            {dep.day != null ? <><Arrow n={dep.day} /><Money>{money(dep.day, true)}</Money> <span>{fmtPct(dep.dayPct || 0, { signed: true })}</span></> : '—'}
          </dd>
        </div>
        {costRes && (
          <div>
            <dt>{t('invest.dep.costResult')}</dt>
            <dd data-tone={dirOf(costRes.abs)}>
              <Arrow n={costRes.abs} /><Money>{money(costRes.abs, true)}</Money> <span>{fmtPct(costRes.pct, { signed: true })}</span>
            </dd>
          </div>
        )}
      </dl>
      {!compact && <p className={s.bandSub}>{t(putExplainKey(dep))}</p>}
      {notes.map((n, i) => <p key={i} className={s.bandSub}><Money>{n}</Money></p>)}
      {dep.hint && (
        <div className={s.depHint} role="note">
          <Info size={14} strokeWidth={2} aria-hidden="true" />
          <span>{t(`invest.dep.hint.${dep.hint}`)}</span>
          {onRegister && dep.hint !== 'opsUnavailable' && (
            <button type="button" className={s.depBtn} onClick={onRegister}>{t('invest.dep.register')}</button>
          )}
        </div>
      )}
      {children}
    </section>
  )
}
