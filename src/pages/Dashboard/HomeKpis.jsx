// src/pages/Dashboard/HomeKpis.jsx — "¿cuánto me queda?" (M5, pieza 1).
// Ingresos · Gastos · Te queda este mes, cada uno con su variación vs. el mes
// anterior (DeltaLine). "Te queda" absorbe la card héroe anterior (veredicto
// del mes + Anillo Vivo): es el mismo disponible real que mostraba MonthVerdict
// Desde los movimientos fijos (08-oct-2026) "Te queda" es SOLO lo real
// (ingresos − gastos registrados); lo previsto que falta va en "Previsto
// pendiente", dentro del detalle de la tarjeta (HeroDetailSheet.jsx).
import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import CountUp from '../../components/CountUp.jsx'
import Money from '../../components/Money.jsx'
import Amount from '../../components/Amount.jsx'
import LivingRing from '../../components/LivingRing.jsx'
import { ScoreState } from '../../components/ScoreState.jsx'
import { useT } from '../../i18n/useT.js'
import { fmtMoney, fmtSignedMoney, fmtPctPoints } from '../../utils/index.js'
import { monthDelta, prevMonthOf, prefersAmountDelta, deltaRateDates, usdMonthDelta } from './dashboardModel.js'
import { useApp } from '../../context/AppContext.jsx'
import { useRefHistory } from '../../hooks/useRefHistory.js'
import { rateOnOrBefore } from '../../utils/refHistory.js'
import DeltaLine from './DeltaLine.jsx'
import { fmtRef } from './RefCurrency.jsx'
import HeroDetailSheet from './HeroDetailSheet.jsx'
import { toRef } from '../../utils/refRate.js'
import s from './Home.module.css'


// Variación de cada cifra vs. el mes anterior, con las reglas por país (A1/W5,
// B5). La usan el héroe del Inicio y las tarjetas Ingresos/Gastos de Panorama.
export function useKpiDeltas({ kpis, activeMonth, country }) {
  const { lang } = useT()
  const prevMonth = prevMonthOf(activeMonth)
  const prev = kpis.prevToDate || kpis.prev
  const cutDay = kpis.prevCutDay ?? null
  // A1/W5: en VE y AR la variación va siempre en monto (inflación alta).
  const preferAmount = prefersAmountDelta(country)
  // B5 (D-D, W5): en Venezuela la variación va en US$ con la tasa de CADA
  // período (histórico BCV o foto mensual). Sin una de las dos tasas, queda en
  // bolívares como en A1.
  const ctx = useApp() || {}
  const hist = useRefHistory(ctx.settings || {})
  const { curDate, prevDate } = deltaRateDates({ activeMonth, cutDay })
  const curRate = hist ? rateOnOrBefore(hist, curDate) : null
  const prevRate = hist ? rateOnOrBefore(hist, prevDate) : null
  const usdOn = !!(curRate && prevRate)
  // La variación B5 se calcula en US$ (tasa BCV de cada período): se rotula
  // siempre en US$, aunque la lente del héroe esté en euros.
  const usdFmt = (d) => (d > 0 ? '+' : d < 0 ? '\u2212' : '') + fmtRef(Math.abs(d), lang, 'USD')
  const deltaOf = (c, p, opts) => (usdOn
    ? usdMonthDelta(c, p, { ...opts, curRate, prevRate })
    : monthDelta(c, p, { ...opts, preferAmount }))
  return { prevMonth, prev, cutDay, usdOn, usdFmt, deltaOf }
}

// Ingresos | Gastos como tarjetas con su variación (antes en el Inicio; desde
// la poda P1 viven en Panorama). Tocables: llevan a su lista del mes.
export function IncExpTiles({ kpis, activeMonth, sym, dualOn, toUSD, onOpen, country }) {
  const { t } = useT()
  const { cur } = kpis
  const { prevMonth, prev, cutDay, usdOn, usdFmt, deltaOf } = useKpiDeltas({ kpis, activeMonth, country })
  const tiles = [
    // B3a: la tarjeta abre Movimientos con el filtro Ingresos.
    { key: 'inc', label: t('dash.kpi.income'), raw: cur.totalInc, page: 'movements', filter: 'income',
      delta: deltaOf(cur.totalInc, prev.totalInc, { hasPrev: prev.incCount > 0 }) },
    { key: 'exp', label: t('dash.kpi.expenses'), raw: cur.totalExp, page: 'movements', filter: 'expense',
      delta: deltaOf(cur.totalExp, prev.totalExp, { invert: true, hasPrev: prev.expCount > 0 }) },
  ]
  return (
    <div className={s.kpis}>
      {tiles.map((k, i) => {
        const Tag = onOpen ? 'button' : 'div'
        return (
          <Tag key={k.key} type={onOpen ? 'button' : undefined}
            className={`${s.card} ${s.kpi} ${onOpen ? s.kpiTap : ''}`}
            style={{ animationDelay: `${40 + i * 40}ms` }}
            onClick={onOpen ? () => openMovements(onOpen, k.filter) : undefined}>
            <div className={s.kpiLabel}>
              {k.label}
              {onOpen && <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" className={s.kpiChevron} />}
            </div>
            <div className={`num ${s.kpiValue}`} style={{ '--chars': fmtSignedMoney(k.raw, sym).length }}>
              <Money><CountUp value={k.raw} format={(v) => fmtSignedMoney(v, sym)} /></Money>
            </div>
            <DeltaLine delta={k.delta} prevMonth={prevMonth} untilDay={cutDay} sym={sym} formatAmount={usdOn ? usdFmt : undefined} />
            {dualOn && <div className={s.kpiDual}>{toUSD(k.raw)}</div>}
          </Tag>
        )
      })}
    </div>
  )
}

function openMovements(onOpen, filter) {
  if (filter) { try { sessionStorage.setItem('fos_mov_filter', filter) } catch { /* modo privado: abre sin filtro */ } }
  onOpen('movements')
}

export default function HomeKpis({ kpis, activeMonth, sym, dualOn, toUSD, pulse, daysLeft, pending, onReviewPending, onOpen, refc, children }) {
  const { t, lang } = useT()
  const [detailOpen, setDetailOpen] = useState(false)
  const { cur } = kpis
  const hasData = cur.incCount > 0 || cur.expCount > 0
  const { prevMonth, prev, cutDay, usdOn, usdFmt, deltaOf } = useKpiDeltas({ kpis, activeMonth, country: refc?.country })
  const prevHasData = prev.incCount > 0 || prev.expCount > 0

  const free = cur.freeFlow
  // R12: la cifra de "Te queda" en US$ si el usuario lo eligió y hay tasa.
  const showRef = !!(refc?.rate && refc.mode === 'ref')
  // Largo del texto de la cifra (R12 + VES): define el tamaño y el layout del hero.
  const heroText = (free < 0 ? '−' : free > 0 ? '+' : '') + (showRef ? fmtRef(toRef(Math.abs(free), refc.rate.rate), lang) : fmtMoney(Math.abs(free), sym))
  const heroLong = heroText.length > 11
  const freeColor = !hasData ? 'var(--th)' : free > 0 ? 'var(--pos)' : free === 0 ? 'var(--warn)' : 'var(--neg)'

  const subParts = [t('home.kpi.leftSub')]
  if (daysLeft != null) subParts.push(t(`home.kpi.daysLeft.${daysLeft === 1 ? 'one' : 'many'}`, { n: daysLeft }))

  return (
    <section aria-label={t('home.kpis.aria')}>
      <div className={`${s.kpis} ${refc ? s.kpisTall : ''}`}>
        {/* "Te queda" primero también en el DOM (lectores de pantalla). Cinco
            elementos (causa 9): rótulo, cifra, días, anillo y ritmo. Toda la
            tarjeta abre el detalle: variación, previsto pendiente, tasa, moneda. */}
        <div data-tour="kpi-free" className={`${s.hero} ${s.kpi} ${s.kpiLeft} rise`} style={{
          animationDelay: '0ms',
          background: hasData ? `color-mix(in srgb, ${freeColor} 6%, var(--box-bg))` : undefined,
        }}>
          <div className={`${s.left} ${heroLong ? s.leftLong : ''}`}>
            <div className={s.leftBody}>
              <button type="button" className={s.heroOpen} aria-haspopup="dialog" aria-label={`${free < 0 ? t('home.kpi.short') : t('home.kpi.left')}. ${t('home.detail.open')}`} onClick={() => setDetailOpen(true)}>
                <span className={s.kpiLabel}>{free < 0 ? t('home.kpi.short') : t('home.kpi.left')}<ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" className={s.heroChevron} /></span>
              </button>
              {hasData ? (
                <div className={`num-hero ${s.leftValue}`} style={{ color: freeColor, '--chars': heroText.length }}>
                  {/* key: al cambiar de moneda la cifra arranca de cero otra vez (no anima de Bs a US$) */}
                  {showRef
                    ? <span key="ref" style={{ whiteSpace: 'nowrap' }}>{free < 0 ? '−' : free > 0 ? '+' : ''}<Money><CountUp value={toRef(Math.abs(free), refc.rate.rate)} format={(v) => fmtRef(v, lang)} /></Money></span>
                    : <Amount key="local" value={free} sym={sym} plus hero animate />}
                </div>
              ) : (
                <div className={s.kpiSub} style={{ fontSize: 14, color: 'var(--tm)' }}>{t('verdict.noData')}</div>
              )}
              {hasData && daysLeft > 0 && <div className={s.kpiSub}>{t(`home.kpi.daysLeft.${daysLeft === 1 ? 'one' : 'many'}`, { n: daysLeft })}</div>}
            </div>
            {hasData && pulse && (
              <div className={s.ring}>
                <LivingRing
                  spentRatio={pulse.spentRatio}
                  elapsedRatio={pulse.elapsedRatio}
                  color={pulse.color}
                  centerValue="" centerLabel="" footLabel=""
                  size={72}
                  ariaLabel={t('pulse.aria', { spent: fmtPctPoints(Math.round(pulse.spentRatio * 100)), elapsed: fmtPctPoints(Math.round(pulse.elapsedRatio * 100)) })}
                />
                {/* El ritmo con ícono + palabra, no solo el color del anillo (T15) */}
                <ScoreState level={pulse.level} label={t(`pulse.${pulse.level}`)} size={13} style={{ fontSize: 12 }} />
              </div>
            )}
          </div>
        </div>

      </div>
      <HeroDetailSheet open={detailOpen} onClose={() => setDetailOpen(false)} free={free} hasData={hasData} sym={sym}
        showRef={showRef} refc={refc} delta={deltaOf(free, prev.freeFlow, { hasPrev: prevHasData })} prevMonth={prevMonth} cutDay={cutDay}
        deltaFormat={usdOn ? usdFmt : showRef ? (d) => (d > 0 ? '+' : d < 0 ? '\u2212' : '') + fmtRef(toRef(Math.abs(d), refc.rate.rate), lang) : undefined}
        pulse={pulse} pending={pending} onReviewPending={onReviewPending} dual={!refc && dualOn && hasData ? toUSD(free) : null}
        sub={subParts.join(' · ')} onPanorama={onOpen ? () => onOpen('panorama') : undefined} />

      {/* Poda P1: Ingresos y Gastos en una línea bajo el héroe (antes, dos
          tarjetas con variación; esas tarjetas viven ahora en Panorama).
          Cada mitad abre Movimientos con su filtro. */}
      <div className={s.pairLine}>
        {[
          { key: 'inc', label: t('dash.kpi.income'), raw: cur.totalInc, filter: 'income', sign: '+' },
          { key: 'exp', label: t('dash.kpi.expenses'), raw: cur.totalExp, filter: 'expense', sign: '\u2212' },
        ].map(k => {
          const Tag = onOpen ? 'button' : 'div'
          return (
            <Tag key={k.key} type={onOpen ? 'button' : undefined} data-tour={k.key === 'inc' ? 'kpi-income' : undefined}
              className={s.pairItem} onClick={onOpen ? () => openMovements(onOpen, k.filter) : undefined}>
              <span className={s.pairLabel}>{k.label}</span>
              <span className={`num ${s.pairValue}`} style={{ '--chars': fmtMoney(k.raw, sym).length + 1 }}>{k.raw > 0 ? k.sign : ''}<Money>{fmtMoney(k.raw, sym)}</Money></span>
              {onOpen && <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" className={s.kpiChevron} />}
            </Tag>
          )
        })}
      </div>
      {children}
    </section>
  )
}
