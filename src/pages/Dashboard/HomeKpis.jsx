// src/pages/Dashboard/HomeKpis.jsx — "¿cuánto me queda?" (M5, pieza 1).
// Ingresos · Gastos · Te queda este mes, cada uno con su variación vs. el mes
// anterior (DeltaLine). "Te queda" absorbe la card héroe anterior (veredicto
// del mes + Anillo Vivo): es el mismo disponible real que mostraba MonthVerdict
// Desde los movimientos fijos (08-oct-2026) "Te queda" es SOLO lo real
// (ingresos − gastos registrados); lo previsto que falta va en la línea
// "Previsto pendiente", con un enlace para revisarlo.
import { ChevronRight } from 'lucide-react'
import CountUp from '../../components/CountUp.jsx'
import Money from '../../components/Money.jsx'
import LivingRing from '../../components/LivingRing.jsx'
import { ScoreState } from '../../components/ScoreState.jsx'
import { useT } from '../../i18n/useT.js'
import { fmtMoney, fmtSignedMoney } from '../../utils/index.js'
import { monthDelta, prevMonthOf } from './dashboardModel.js'
import DeltaLine from './DeltaLine.jsx'
import { RefSwitch, RefRow, fmtRef } from './RefCurrency.jsx'
import { toRef } from '../../utils/refRate.js'
import s from './Home.module.css'
import r from '../../components/recurring/recurring.module.css'


export default function HomeKpis({ kpis, activeMonth, sym, dualOn, toUSD, pulse, daysLeft, pending, onReviewPending, onOpen, refc, children }) {
  const { t, lang } = useT()
  const prevMonth = prevMonthOf(activeMonth)
  const { cur, prev } = kpis
  const hasData = cur.incCount > 0 || cur.expCount > 0
  const prevHasData = prev.incCount > 0 || prev.expCount > 0

  const free = cur.freeFlow
  // R12: la cifra de "Te queda" en US$ si el usuario lo eligió y hay tasa.
  const showRef = !!(refc?.rate && refc.mode === 'ref')
  // Largo del texto de la cifra (R12 + VES): define el tamaño y el layout del hero.
  const heroText = (free < 0 ? '−' : free > 0 ? '+' : '') + (showRef ? fmtRef(toRef(Math.abs(free), refc.rate.rate), lang) : fmtMoney(Math.abs(free), sym))
  const heroLong = heroText.length > 11
  const freeColor = !hasData ? 'var(--th)' : free > 0 ? 'var(--pos)' : free === 0 ? 'var(--warn)' : 'var(--neg)'

  const tiles = [
    { key: 'inc', label: t('dash.kpi.income'), raw: cur.totalInc, page: 'income',
      delta: monthDelta(cur.totalInc, prev.totalInc, { hasPrev: prev.incCount > 0 }) },
    { key: 'exp', label: t('dash.kpi.expenses'), raw: cur.totalExp, page: 'movements',
      delta: monthDelta(cur.totalExp, prev.totalExp, { invert: true, hasPrev: prev.expCount > 0 }) },
  ]

  const subParts = [t('home.kpi.leftSub')]
  if (daysLeft != null) subParts.push(t(`home.kpi.daysLeft.${daysLeft === 1 ? 'one' : 'many'}`, { n: daysLeft }))

  return (
    <section aria-label={t('home.kpis.aria')}>
      <div className={s.kpis}>
        {/* "Te queda" primero también en el DOM (lectores de pantalla). */}
        <div data-tour="kpi-free" className={`${s.card} ${s.kpi} ${s.kpiLeft} rise`} style={{
          animationDelay: '0ms',
          background: hasData ? `color-mix(in srgb, ${freeColor} 7%, var(--sur))` : undefined,
          borderColor: hasData ? `color-mix(in srgb, ${freeColor} 30%, transparent)` : undefined,
        }}>
          <div className={`${s.left} ${heroLong ? s.leftLong : ''}`}>
            <div className={s.leftBody}>
              <div className={s.kpiLabel}>{free < 0 ? t('home.kpi.short') : t('home.kpi.left')}</div>
              {hasData ? (
                <div className={`num-hero ${s.leftValue}`} style={{ color: freeColor, '--chars': heroText.length }}>
                  {/* key: al cambiar de moneda la cifra arranca de cero otra vez (no anima de Bs a US$) */}
                  <span key={showRef ? 'ref' : 'local'} style={{ whiteSpace: 'nowrap' }}>{free < 0 ? '−' : free > 0 ? '+' : ''}<Money>{showRef
                    ? <CountUp value={toRef(Math.abs(free), refc.rate.rate)} format={(v) => fmtRef(v, lang)} />
                    : <CountUp value={Math.abs(free)} format={(v) => fmtMoney(v, sym)} />}</Money></span>
                </div>
              ) : (
                <div className={s.kpiSub} style={{ fontSize: 14, color: 'var(--tm)' }}>{t('verdict.noData')}</div>
              )}
              {hasData && <DeltaLine delta={monthDelta(free, prev.freeFlow, { hasPrev: prevHasData })} prevMonth={prevMonth} />}
              {hasData && <div className={s.kpiSub}>{subParts.join(' · ')}</div>}
              {pending && pending.count > 0 && (
                <div className={r.pending}>
                  <span className={r.pendingLabel}>{t('rec.pending.line')}</span>
                  <span className={r.pendingVals}>
                    {pending.expense > 0 && <Money>−{fmtMoney(pending.expense, sym)}</Money>}
                    {pending.expense > 0 && pending.income > 0 && ' · '}
                    {pending.income > 0 && <Money>+{fmtMoney(pending.income, sym)}</Money>}
                  </span>
                  {onReviewPending && <button type="button" className={r.reviewLink} onClick={onReviewPending}>{t('rec.pending.review')} →</button>}
                </div>
              )}
              {!refc && dualOn && hasData && <div className={s.kpiDual}>{toUSD(free)}</div>}
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
          {/* R12/R13: a todo el ancho de la tarjeta, debajo de la cifra y el anillo */}
          {refc && (
            <RefRow refRate={refc.rate} mode={showRef ? 'ref' : 'local'} free={free} sym={sym} country={refc.country}
              showAmount={hasData} onEdit={refc.onEdit} tool={refc.tool} onTool={refc.onTool}
              switcher={refc.rate && hasData ? <RefSwitch mode={refc.mode} onChange={refc.setMode} localCode={refc.localCode} /> : null} />
          )}
        </div>

        {/* Ingresos | Gastos (R05/G6): tocables, llevan a su lista del mes. */}
        {tiles.map((k, i) => {
          const Tag = onOpen ? 'button' : 'div'
          return (
            <Tag key={k.key} type={onOpen ? 'button' : undefined} data-tour={k.key === 'inc' ? 'kpi-income' : undefined}
              className={`${s.card} ${s.kpi} ${onOpen ? s.kpiTap : ''} rise`}
              style={{ animationDelay: `${40 + i * 40}ms` }}
              onClick={onOpen ? () => onOpen(k.page) : undefined}>
              <div className={s.kpiLabel}>
                {k.label}
                {onOpen && <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" className={s.kpiChevron} />}
              </div>
              <div className={`num ${s.kpiValue}`} style={{ '--chars': fmtSignedMoney(k.raw, sym).length }}>
                <Money><CountUp value={k.raw} format={(v) => fmtSignedMoney(v, sym)} /></Money>
              </div>
              <DeltaLine delta={k.delta} prevMonth={prevMonth} />
              {dualOn && <div className={s.kpiDual}>{toUSD(k.raw)}</div>}
            </Tag>
          )
        })}

      </div>
      {children}
    </section>
  )
}
