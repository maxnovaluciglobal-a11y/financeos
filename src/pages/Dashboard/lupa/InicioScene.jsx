// src/pages/Dashboard/lupa/InicioScene.jsx — cabecera del Inicio nuevo
// (Entrega 1.5, detrás de uiFlags.inicioLupa).
//
// Inicio v2 (24-nov-2026, variante D aprobada por Walter; referencia Rial): la
// escena es una cabecera de app — mes a la izquierda, logo al centro, IQ y el
// asistente a la derecha — en vez del título "Inicio"; la cifra, el ritmo, un
// gráfico compacto (tocar un día abre sus movimientos; sin leyenda ni fila de
// pasos) y los 4 botones redondos DENTRO del bloque. Ingresos y Gastos pasan a
// tarjetas debajo (index.jsx). El ojo de "Ocultar montos" va junto a la cifra
// porque la barra superior del Shell no se muestra en el Inicio del teléfono. Escena morada a sangre con la
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
import { Check, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react'
import Money, { useMoney } from '../../../components/Money.jsx'
import { useT } from '../../../i18n/useT.js'
import { currencySymbol, currentMonth, dateLocale, fmtAmount, fmtMoneyParts, fmtSignedMoney, moneyLocale } from '../../../utils/index.js'
import { toRef } from '../../../utils/refRate.js'
import { useSceneChrome } from '../../../components/layout/useSceneChrome.js'
import Sheet from '../../../components/ui/Sheet.jsx'
import { Isotipo, Logotipo } from '../../../components/Logo.jsx'
import { SCORE_LEVELS } from '../../../utils/financialScore.js'
import { prevMonthOf } from '../dashboardModel.js'
import { monthLabel } from '../../shared/constants.js'
import HeroDetailSheet from '../HeroDetailSheet.jsx'
import { useKpiDeltas } from '../HomeKpis.jsx'
import { fmtRef, currentLensCurrency } from '../RefCurrency.jsx'
import ChartLupaRaw from './ChartLupa.jsx'
import DaySheet from './DaySheet.jsx'
import { inspectLines, paceLine, valueText } from './lupaText.js'
import s from './scene.module.css'

const ChartLupa = memo(ChartLupaRaw)

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


// ── Cabecera de app ────────────────────────────────────────────────────────
function IqChip({ healthScore, onOpen, t }) {
  if (!healthScore) return null
  const level = SCORE_LEVELS[healthScore.level] ? healthScore.level : 'attention'
  return (
    <button type="button" className={s.iq} data-level={level} onClick={onOpen} data-tour="home-iq"
      aria-label={t('home.iq.aria', { score: healthScore.score, label: healthScore.label })}>
      <span className={s.iqTag} aria-hidden="true">IQ</span>
      <span className={`num ${s.iqNum}`} aria-hidden="true">{healthScore.score}</span>
    </button>
  )
}

function monthsBack(n, from = currentMonth()) {
  const out = [from]
  let m = from
  for (let i = 1; i < n; i++) { m = prevMonthOf(m); out.push(m) }
  return out
}

function MonthSheet({ open, onClose, activeMonth, onPick, t }) {
  const months = useMemo(() => {
    const list = monthsBack(12)
    return list.includes(activeMonth) ? list : [activeMonth, ...list]
  }, [activeMonth])
  return (
    <Sheet open={open} onClose={onClose} ariaLabel={t('home.month.title')} maxWidth={420}>
      <h2 className={s.sheetTitle}>{t('home.month.title')}</h2>
      <ul className={s.monthList}>
        {months.map(mo => (
          <li key={mo}>
            <button type="button" className={s.monthRow} aria-current={mo === activeMonth ? 'true' : undefined} onClick={() => onPick(mo)}>
              <span>{monthLabel(mo)}</span>
              {mo === activeMonth && <Check size={18} strokeWidth={2.2} aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

export default function InicioScene({ series, pace: paceData, kpis, activeMonth, sym, incomes, expenses, pending, pulse, daysLeft, refc, dualOn, toUSD, onOpen, onReviewPending,
  healthScore, actions = [], onAsk, amountsHidden = false, onToggleAmounts, onPickMonth }) {
  const { t, lang } = useT()
  const { m } = useMoney()
  const sceneRef = useRef(null)
  const chartRef = useRef(null)
  useSceneChrome(sceneRef)
  // En el teléfono esta cabecera reemplaza la barra superior del Shell (scene.module.css).
  useEffect(() => {
    const root = document.documentElement
    root.dataset.homeHeader = 'on'
    return () => { delete root.dataset.homeHeader }
  }, [])

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
  const [monthOpen, setMonthOpen] = useState(false)
  // El ojo anuncia el cambio (la barra superior, con su propio aviso, no está en el Inicio del teléfono).
  const [amountsMsg, setAmountsMsg] = useState('')
  useEffect(() => { setInspect(null) }, [activeMonth])

  const onDay = useCallback((d, mode) => setInspect(mode === 'rest' ? null : d), [])
  const onTap = useCallback((d) => { setSheetDay(d); setSheetOpen(true) }, [])
  const valueTextOf = useCallback((d) => valueText({ series, day: d, activeMonth, t, fmt, locale }), [series, activeMonth, t, fmt, locale])

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

  const subParts = [t('home.kpi.leftSub')]
  if (daysLeft != null) subParts.push(t(`home.kpi.daysLeft.${daysLeft === 1 ? 'one' : 'many'}`, { n: daysLeft }))

  return (
    <section ref={sceneRef} className={s.scene} aria-label={t('home.kpis.aria')}>
      <div className={s.inner}>
        {/* Título de la pantalla para lectores (la cabecera visible es la de la app). */}
        <h1 className="sr-only">{t('home.title')}</h1>
        <div className={s.appHeader}>
          <button type="button" className={s.month} onClick={() => setMonthOpen(true)} aria-haspopup="dialog"
            aria-label={t('home.month.aria', { month: monthLabel(activeMonth) })}>
            <span>{monthLabel(activeMonth)}</span>
            <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
          </button>
          <Logotipo size={20} title="moyiq" className={s.logo} style={{ color: 'var(--on-grad-text)' }} />
          <div className={s.headerEnd}>
            <IqChip healthScore={healthScore} onOpen={onOpen ? () => onOpen('coach') : undefined} t={t} />
            {onAsk && (
              <button type="button" className={s.askBtn} onClick={onAsk} aria-haspopup="dialog" aria-label={t('home.ask.open.aria')} data-tour="home-ask-btn">
                <span className={s.askAvatar} aria-hidden="true"><Isotipo size={15} decorative style={{ color: 'var(--purple-700)' }} /></span>
              </button>
            )}
          </div>
        </div>

        <div className={s.grid}>
          <div className={s.heroCol} data-tour="kpi-free">
            <div className={s.labelRow}>
              <button type="button" className={s.heroOpen} aria-haspopup="dialog"
                aria-label={`${free < 0 ? t('home.kpi.short') : t('home.kpi.left')}. ${t('home.detail.open')}`}
                onClick={() => setDetailOpen(true)}>
                <span className={s.label} data-lupa="label">{label}</span>
                {!looking && <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" className={s.labelChevron} />}
              </button>
              {onToggleAmounts && (
                <button type="button" className={s.eye} aria-pressed={amountsHidden} aria-label={t('money.toggle')}
                  onClick={() => { setAmountsMsg(t(amountsHidden ? 'money.announce.shown' : 'money.announce.hidden')); onToggleAmounts() }}>
                  {amountsHidden ? <EyeOff size={18} strokeWidth={1.8} aria-hidden="true" /> : <Eye size={18} strokeWidth={1.8} aria-hidden="true" />}
                </button>
              )}
              <span className={`sr-only ${s.eyeStatus}`} role="status" aria-live="polite">{amountsMsg}</span>
            </div>
            {hasData
              ? <BigNumber parts={bigParts(value, { showRef, rate, sym, lang })} />
              : <p className={s.noData}>{t('verdict.noData')}</p>}
            {hasData && (
              <p className={`num ${s.sub}`} data-lupa="sub">
                {pace && <span className={pace.kind === 'behind' || pace.kind === 'fixed' ? s.paceChip : s.paceKey}>{pace.text}</span>}
                <span>{sub}</span>
              </p>
            )}
            {/* UX-N2: cuánto de fijos por pagar ya descuenta la cifra lo dice el
                detalle (tocar "Te queda"); el bloque queda en ≤ 55 % de la pantalla. */}
            {!looking && dualOn && !refc && hasData && <p className={s.dual}>{toUSD(free)}</p>}
          </div>

          {hasData && series && (
            <div className={s.chartCol}>
              <ChartLupa ref={chartRef} series={series} invite hold={sheetOpen}
                label={t('home.lupa.aria', { month: monthLabel(activeMonth) })}
                valueTextOf={valueTextOf} onDay={onDay} onTap={onTap} />
            </div>
          )}
        </div>

        {/* Botones redondos dentro del bloque (patrón Rial): círculo de 56 px y
            etiqueta; toda la columna es el área de toque. */}
        {actions.length > 0 && (
          <nav className={s.round} aria-label={t('dash.quick.title')} data-tour="home-quick">
            {actions.map(a => (
              <button key={a.key} type="button" className={s.roundBtn} onClick={a.run}>
                <span className={s.roundIc}><a.Ic size={22} strokeWidth={1.9} aria-hidden="true" /></span>
                <span className={s.roundLb}>{a.label}</span>
              </button>
            ))}
          </nav>
        )}
      </div>

      <HeroDetailSheet open={detailOpen} onClose={() => setDetailOpen(false)} free={free} hasData={hasData} sym={sym}
        showRef={showRef} refc={refc} delta={deltaOf(cur.leftReal ?? free, prev.freeFlow, { hasPrev: prevHasData })} pendingFixed={cur.pendingFixed} prevMonth={prevMonth} cutDay={cutDay}
        deltaFormat={usdOn ? usdFmt : showRef ? (d) => (d > 0 ? '+' : d < 0 ? '−' : '') + fmtRef(toRef(Math.abs(d), refc.rate.rate), lang) : undefined}
        pulse={pulse} pending={pending} onReviewPending={onReviewPending} dual={!refc && dualOn && hasData ? toUSD(free) : null}
        sub={subParts.join(' · ')} onPanorama={onOpen ? () => onOpen('panorama') : undefined} />

      <MonthSheet open={monthOpen} onClose={() => setMonthOpen(false)} activeMonth={activeMonth} t={t}
        onPick={(mo) => { setMonthOpen(false); if (mo !== activeMonth) onPickMonth?.(mo) }} />

      {series && (
        <DaySheet open={sheetOpen} day={sheetDay} series={series} activeMonth={activeMonth} incomes={incomes} expenses={expenses} sym={sym} fmt={fmt}
          onDay={(d) => { setSheetDay(d); chartRef.current?.glideTo(d) }}
          onClose={() => { setSheetOpen(false); chartRef.current?.rest() }} />
      )}
    </section>
  )
}
