// src/pages/Dashboard/HomeKpis.jsx — "¿cuánto me queda?" (M5, pieza 1).
// Ingresos · Gastos · Te queda este mes, cada uno con su variación vs. el mes
// anterior (DeltaLine). "Te queda" absorbe la card héroe anterior (veredicto
// del mes + Anillo Vivo): es el mismo disponible real que mostraba MonthVerdict
// (ingresos − gastos − deudas − suscripciones), no el saldo del banco.
import CountUp from '../../components/CountUp.jsx'
import Money from '../../components/Money.jsx'
import LivingRing from '../../components/LivingRing.jsx'
import { ScoreState } from '../../components/ScoreState.jsx'
import { useT } from '../../i18n/useT.js'
import { moneyLocale } from '../../utils/index.js'
import { monthDelta, prevMonthOf } from './dashboardModel.js'
import DeltaLine from './DeltaLine.jsx'
import s from './Home.module.css'

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString(moneyLocale())

export default function HomeKpis({ kpis, activeMonth, sym, dualOn, toUSD, pulse, daysLeft, children }) {
  const { t } = useT()
  const prevMonth = prevMonthOf(activeMonth)
  const { cur, prev } = kpis
  const hasData = cur.incCount > 0 || cur.expCount > 0
  const prevHasData = prev.incCount > 0 || prev.expCount > 0

  const free = cur.freeFlow
  const freeColor = !hasData ? 'var(--th)' : free > 0 ? 'var(--pos)' : free === 0 ? 'var(--warn)' : 'var(--neg)'

  const tiles = [
    { key: 'inc', label: t('dash.kpi.income'), raw: cur.totalInc,
      delta: monthDelta(cur.totalInc, prev.totalInc, { hasPrev: prev.incCount > 0 }) },
    { key: 'exp', label: t('dash.kpi.expenses'), raw: cur.totalExp,
      delta: monthDelta(cur.totalExp, prev.totalExp, { invert: true, hasPrev: prev.expCount > 0 }) },
  ]

  const subParts = [t('home.kpi.leftSub')]
  if (daysLeft != null) subParts.push(t(`home.kpi.daysLeft.${daysLeft === 1 ? 'one' : 'many'}`, { n: daysLeft }))

  return (
    <section aria-label={t('home.kpis.aria')}>
      <div className={s.kpis}>
        {tiles.map((k, i) => (
          <div key={k.key} className={`${s.card} ${s.kpi} rise`} style={{ animationDelay: `${i * 40}ms` }}>
            <div className={s.kpiLabel}>{k.label}</div>
            <div className={`num ${s.kpiValue}`}>
              <Money><CountUp value={k.raw} format={(v) => `${sym}${fmt(v)}`} /></Money>
            </div>
            <DeltaLine delta={k.delta} prevMonth={prevMonth} />
            {dualOn && <div className={s.kpiDual}>{toUSD(k.raw)}</div>}
          </div>
        ))}

        <div data-tour="kpi-free" className={`${s.card} ${s.kpi} ${s.kpiLeft} rise`} style={{
          animationDelay: '80ms',
          background: hasData ? `color-mix(in srgb, ${freeColor} 7%, var(--sur))` : undefined,
          borderColor: hasData ? `color-mix(in srgb, ${freeColor} 30%, transparent)` : undefined,
        }}>
          <div className={s.left}>
            <div className={s.leftBody}>
              <div className={s.kpiLabel}>{free < 0 ? t('home.kpi.short') : t('home.kpi.left')}</div>
              {hasData ? (
                <div className={`num-hero ${s.leftValue}`} style={{ color: freeColor }}>
                  {free < 0 ? '−' : free > 0 ? '+' : ''}<Money>{sym}<CountUp value={Math.abs(free)} format={(v) => fmt(v)} /></Money>
                </div>
              ) : (
                <div className={s.kpiSub} style={{ fontSize: 14, color: 'var(--tm)' }}>{t('verdict.noData')}</div>
              )}
              {hasData && <DeltaLine delta={monthDelta(free, prev.freeFlow, { hasPrev: prevHasData })} prevMonth={prevMonth} />}
              {hasData && <div className={s.kpiSub}>{subParts.join(' · ')}</div>}
              {dualOn && hasData && <div className={s.kpiDual}>{toUSD(free)}</div>}
            </div>
            {hasData && pulse && (
              <div className={s.ring}>
                <LivingRing
                  spentRatio={pulse.spentRatio}
                  elapsedRatio={pulse.elapsedRatio}
                  color={pulse.color}
                  centerValue="" centerLabel="" footLabel=""
                  size={88}
                  ariaLabel={t('pulse.aria', { spent: Math.round(pulse.spentRatio * 100), elapsed: Math.round(pulse.elapsedRatio * 100) })}
                />
                {/* El ritmo con ícono + palabra, no solo el color del anillo (T15) */}
                <ScoreState level={pulse.level} label={t(`pulse.${pulse.level}`)} size={13} style={{ fontSize: 12 }} />
              </div>
            )}
          </div>
        </div>
      </div>
      {children}
    </section>
  )
}
