// src/pages/Dashboard/lupa/InicioScene.jsx — cabecera del Inicio nuevo
// (Entrega 1.5, detrás de uiFlags.inicioLupa). Escena morada a sangre con la
// cifra "Te queda" gigante y la ChartLupa del mes debajo; el resto del Inicio
// sigue abajo, sobre la superficie tranquila. Mismas cifras que HomeKpis:
// kpis.freeFlow, el detalle (HeroDetailSheet) y la línea Ingresos · Gastos.
// La variación contra el mes anterior compara lo registrado (leftReal) con lo
// registrado: el mes anterior a la misma fecha no tiene fijos por pagar.
//
// La escena llega hasta la barra de estado (iOS instalada con
// black-translucent; en Android y TWA el theme-color toma el mismo morado
// mientras la escena está a la vista) y la barra superior flota encima en
// blanco (data-scene en <html>, shell.module.css).

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Money, { useMoney } from '../../../components/Money.jsx'
import { useT } from '../../../i18n/useT.js'
import { currencySymbol, dateLocale, fmtAmount, fmtMoney, fmtMoneyParts, fmtSignedMoney, moneyLocale } from '../../../utils/index.js'
import { toRef } from '../../../utils/refRate.js'
import { useSceneChrome } from '../../../components/layout/useSceneChrome.js'
import LargeTitle from '../../../components/layout/LargeTitle.jsx'
import { monthLabel } from '../../shared/constants.js'
import HeroDetailSheet from '../HeroDetailSheet.jsx'
import { useKpiDeltas } from '../HomeKpis.jsx'
import { fmtRef, currentLensCurrency } from '../RefCurrency.jsx'
import ChartLupaRaw from './ChartLupa.jsx'
import DaySheet from './DaySheet.jsx'
import { inspectLines, paceLine, shortDate, valueText } from './lupaText.js'
import s from './scene.module.css'

const ChartLupa = memo(ChartLupaRaw)
const STEP_IDLE_MS = 6000

// Partes de la cifra grande: signo, símbolo, entero y decimales (a la mitad).
function bigParts(value, { showRef, rate, sym, lang }) {
  if (!showRef) return fmtMoneyParts(value, sym, { signed: true })
  const v = toRef(value, rate) || 0
  const code = currentLensCurrency()
  const symbol = currencySymbol(code, lang)
  const num = fmtAmount(Math.abs(v), 2, moneyLocale())
  const dec = (1.1).toLocaleString(moneyLocale()).charAt(1)
  const i = num.lastIndexOf(dec)
  const after = symbol === '€' && !String(moneyLocale()).startsWith('en')
  return {
    sign: v < 0 && num !== fmtAmount(0, 2, moneyLocale()) ? '−' : '',
    pre: after ? '' : symbol, int: i > 0 ? num.slice(0, i) : num, frac: i > 0 ? num.slice(i) : '', post: after ? ' ' + symbol : '',
  }
}

function BigNumber({ parts }) {
  const chars = (parts.sign + parts.pre + parts.int).length + Math.ceil((parts.frac + parts.post).length / 2)
  return (
    <div className={`num ${s.big}`} style={{ '--chars': chars }} data-lupa="big">
      <Money>
        {parts.sign}
        {parts.pre && <span className={s.cur}>{parts.pre}</span>}
        {parts.int}
        {parts.frac && <span className={s.dec}>{parts.frac}</span>}
        {parts.post && <span className={s.curAfter}>{parts.post}</span>}
      </Money>
    </div>
  )
}

export default function InicioScene({ series, pace: paceData, kpis, activeMonth, sym, incomes, expenses, pending, pulse, daysLeft, refc, dualOn, toUSD, onOpen, onReviewPending }) {
  const { t, lang } = useT()
  const { m } = useMoney()
  const sceneRef = useRef(null)
  const chartRef = useRef(null)
  useSceneChrome(sceneRef)

  const { cur } = kpis
  const free = cur.freeFlow
  // Un mes con solo apartados también tiene datos: hay que poder verlos y quitarlos.
  const hasData = cur.incCount > 0 || cur.expCount > 0 || (cur.setAsideCount || 0) > 0
  const showRef = !!(refc?.rate && refc.mode === 'ref')
  const rate = showRef ? refc.rate.rate : null
  const locale = dateLocale()

  // Montos de los textos (frases, aria): en la moneda que se está mirando y
  // con "ocultar montos" aplicado.
  const fmt = useCallback((n) => m(showRef ? (n < 0 ? '−' : '') + fmtRef(Math.abs(toRef(n, rate) || 0), lang) : fmtSignedMoney(n, sym)), [m, showRef, rate, lang, sym])

  const [inspect, setInspect] = useState(null)   // día mirado, o null en reposo
  const [sheetDay, setSheetDay] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const idleT = useRef(0)
  useEffect(() => () => clearTimeout(idleT.current), [])
  useEffect(() => { setInspect(null) }, [activeMonth])

  const onDay = useCallback((d, mode) => setInspect(mode === 'rest' ? null : d), [])
  const onTap = useCallback((d) => { setSheetDay(d); setSheetOpen(true) }, [])
  const valueTextOf = useCallback((d) => valueText({ series, day: d, activeMonth, t, fmt, locale }), [series, activeMonth, t, fmt, locale])
  const axis = useMemo(() => {
    if (!series) return null
    const out = [
      { key: 's', day: 1, text: shortDate(activeMonth, 1, locale) },
      { key: 'e', day: series.days, align: 'end', text: shortDate(activeMonth, series.days, locale) },
    ]
    const p = series.payday
    if (p) {
      const pay = t('home.lupa.axis.payday', { day: p })
      // Cerca de un borde, el cobro reemplaza la fecha de ese borde (no se pisan).
      if (p <= 5) out[0] = { key: 's', day: 1, text: pay }
      if (p >= series.days - 4) out[1] = { ...out[1], text: pay }
      if (p > 5 && p < series.days - 4) out.push({ key: 'p', day: p, align: 'mid', text: pay })
    }
    return out
  }, [series, activeMonth, locale, t])

  const { prevMonth, prev, cutDay, usdOn, usdFmt, deltaOf } = useKpiDeltas({ kpis, activeMonth, country: refc?.country })
  const prevHasData = prev.incCount > 0 || prev.expCount > 0

  // Lo que dice la escena: hoy (reposo) o el día bajo la lupa.
  const isCurrent = series?.mode === 'current'
  const looking = inspect != null && series && !(isCurrent && inspect === series.lastDay)
  // Mirando un día, la cifra grande es lo gastado hasta ese día.
  const value = looking ? series.spentCum[inspect] : free
  const label = looking ? inspectLines({ series, day: inspect, activeMonth, t, fmt, locale }).label : (free < 0 ? t('home.kpi.short') : t('home.kpi.left'))
  const pace = !looking && isCurrent ? paceLine(paceData, { t, fmt }) : null
  const sub = looking
    ? inspectLines({ series, day: inspect, activeMonth, t, fmt, locale }).sub
    : daysLeft > 0 ? t(`home.kpi.daysLeft.${daysLeft === 1 ? 'one' : 'many'}`, { n: daysLeft }) : t('home.kpi.leftSub')

  function step(dir) {
    const c = chartRef.current
    if (!c || !series) return
    const from = c.mode === 'rest' ? series.lastDay : c.cur
    const d = Math.max(1, Math.min(series.lastDay, from + dir))
    if (dir > 0 && from >= series.lastDay) { c.rest(); return }
    c.glideTo(d)
    clearTimeout(idleT.current)
    idleT.current = setTimeout(() => chartRef.current?.rest(), STEP_IDLE_MS)
  }

  const subParts = [t('home.kpi.leftSub')]
  if (daysLeft != null) subParts.push(t(`home.kpi.daysLeft.${daysLeft === 1 ? 'one' : 'many'}`, { n: daysLeft }))

  return (
    <section ref={sceneRef} className={s.scene} aria-label={t('home.kpis.aria')}>
      <div className={s.inner}>
        <div className={s.head}>
          <LargeTitle title={t('home.title')} sub={monthLabel(activeMonth)} />
        </div>

        <div className={s.grid}>
          <div className={s.heroCol} data-tour="kpi-free">
            <button type="button" className={s.heroOpen} aria-haspopup="dialog"
              aria-label={`${free < 0 ? t('home.kpi.short') : t('home.kpi.left')}. ${t('home.detail.open')}`}
              onClick={() => setDetailOpen(true)}>
              <span className={s.label} data-lupa="label">{label}</span>
              {!looking && <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" className={s.labelChevron} />}
            </button>
            {hasData
              ? <BigNumber parts={bigParts(value, { showRef, rate, sym, lang })} />
              : <p className={s.noData}>{t('verdict.noData')}</p>}
            {hasData && (
              <p className={`num ${s.sub}`} data-lupa="sub">
                {pace && <span className={pace.kind === 'behind' || pace.kind === 'fixed' ? s.paceChip : s.paceKey}>{pace.text}</span>}
                <span>{sub}</span>
              </p>
            )}
            {/* UX-N2: la cifra ya descuenta los fijos que faltan; se dice cuánto. */}
            {!looking && hasData && cur.pendingFixed > 0 && <p className={`num ${s.dual}`}>{t('home.kpi.pendingFixed', { v: fmt(cur.pendingFixed) })}</p>}
            {!looking && dualOn && !refc && hasData && <p className={s.dual}>{toUSD(free)}</p>}
          </div>

          {hasData && series && (
            <div className={s.chartCol}>
              <ChartLupa ref={chartRef} series={series} invite hold={sheetOpen}
                label={t('home.lupa.aria', { month: monthLabel(activeMonth) })}
                valueTextOf={valueTextOf} axis={axis} onDay={onDay} onTap={onTap} />
              <div className={s.legend} aria-hidden="true">
                <span className={s.lgLine}>{t('home.lupa.legend.spent')}</span>
                {series.ideal && <span className={s.lgIdeal}>{t('home.lupa.legend.ideal')}</span>}
                {series.projEnd != null && <span className={s.lgProj}>{t('home.lupa.legend.proj')}</span>}
              </div>
              <div className={s.step}>
                <button type="button" className={s.stepBtn} onClick={() => step(-1)} aria-label={t('home.lupa.prev')}>
                  <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
                </button>
                <span className={s.stepHint}>{t('home.lupa.hint')}</span>
                <button type="button" className={s.stepBtn} onClick={() => step(1)} aria-label={t('home.lupa.next')}>
                  <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Ingresos · Gastos en una línea (poda P1), cada mitad abre Movimientos. */}
        <div className={s.pairLine}>
          {[
            { key: 'inc', label: t('dash.kpi.income'), raw: cur.totalInc, filter: 'income', sign: '+' },
            { key: 'exp', label: t('dash.kpi.expenses'), raw: cur.totalExp, filter: 'expense', sign: '−' },
          ].map(k => {
            const Tag = onOpen ? 'button' : 'div'
            return (
              <Tag key={k.key} type={onOpen ? 'button' : undefined} data-tour={k.key === 'inc' ? 'kpi-income' : undefined}
                className={s.pairItem} onClick={onOpen ? () => openMovements(onOpen, k.filter) : undefined}>
                <span className={s.pairLabel}>{k.label}{onOpen && <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />}</span>
                <span className={`num ${s.pairValue}`} style={{ '--chars': fmtMoney(k.raw, sym).length + 1 }}>{k.raw > 0 ? k.sign : ''}<Money>{fmtMoney(k.raw, sym)}</Money></span>
              </Tag>
            )
          })}
        </div>
      </div>

      <HeroDetailSheet open={detailOpen} onClose={() => setDetailOpen(false)} free={free} hasData={hasData} sym={sym}
        showRef={showRef} refc={refc} delta={deltaOf(cur.leftReal ?? free, prev.freeFlow, { hasPrev: prevHasData })} pendingFixed={cur.pendingFixed} prevMonth={prevMonth} cutDay={cutDay}
        deltaFormat={usdOn ? usdFmt : showRef ? (d) => (d > 0 ? '+' : d < 0 ? '−' : '') + fmtRef(toRef(Math.abs(d), refc.rate.rate), lang) : undefined}
        pulse={pulse} pending={pending} onReviewPending={onReviewPending} dual={!refc && dualOn && hasData ? toUSD(free) : null}
        sub={subParts.join(' · ')} onPanorama={onOpen ? () => onOpen('panorama') : undefined} />

      {series && (
        <DaySheet open={sheetOpen} day={sheetDay} series={series} activeMonth={activeMonth} incomes={incomes} expenses={expenses} sym={sym} fmt={fmt}
          onDay={(d) => { setSheetDay(d); chartRef.current?.glideTo(d) }}
          onClose={() => { setSheetOpen(false); chartRef.current?.rest() }} />
      )}
    </section>
  )
}

function openMovements(onOpen, filter) {
  if (filter) { try { sessionStorage.setItem('fos_mov_filter', filter) } catch { /* modo privado: abre sin filtro */ } }
  onOpen('movements')
}
