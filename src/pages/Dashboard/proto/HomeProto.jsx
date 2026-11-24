// src/pages/Dashboard/proto/HomeProto.jsx — prototipos del Inicio v2 (rama
// proto/home-v2, 24-nov-2026). Solo con `?home=a|b|c` (homeProto.js); sin el
// parámetro el Inicio es el de producción. Vive en su propio trozo (lazy), así
// el Inicio de siempre no paga nada por él.
//
// Comentarios de Walter (24-nov, referencia: la app venezolana Rial): el héroe
// morado tapaba ~77 % del teléfono y las acciones rápidas quedaban detrás de
// la barra. Las tres variantes dejan el bloque de color en ≤ 50 % de 390×844 y
// 4 botones REDONDOS de 56 px a la vista sin desplazar:
//   A "Compacta"  — la identidad de hoy, apretada: cabecera de app (logo + mes |
//                   IQ + ayuda), cifra, ritmo, gráfico de ~140 px que se toca
//                   para ver el día, Ingresos · Gastos en una línea.
//   B "Rial-like" — bloque más claro (Impulso que se funde con el fondo), logo
//                   al centro, cifra centrada, botones sobre el fundido,
//                   tarjetas de Ingresos y Gastos y barra de 3 pestañas
//                   (Inicio · Movimientos · Más) con "+" aparte. Reversible: la
//                   barra de 5 vuelve en cuanto se sale del Inicio.
//   C "Asistente" — A + "Pregúntale a moyiq": preguntas fijas que se responden
//                   en el teléfono con reglas (askAnswers.js), sin servidor ni IA.
//   D "Mezcla"    — pedida por Walter tras ver A/B/C (24-nov): de C la cabecera
//                   con el asistente, el gráfico (compacto, sin ejes) y la
//                   tarjeta de preguntas; de B los 4 botones redondos DENTRO del
//                   bloque (encaje), las tarjetas de Ingresos/Gastos y la barra
//                   de 3 pestañas con el "+" aparte.
// Cifras: las mismas fuentes que el Inicio (useHomeData → homeMonthTotals /
// monthLeft, useIqScore, dailyAvailable/paceToday, monthPace). Nada nuevo.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown, ChevronRight, Eye, EyeOff, HelpCircle, Minus, Plus, PiggyBank, Upload, ArrowLeftRight,
  Target, Wallet, Repeat, Home, LayoutGrid, Check,
} from 'lucide-react'
import { useT } from '../../../i18n/useT.js'
import Sheet from '../../../components/ui/Sheet.jsx'
import Money, { useMoney } from '../../../components/Money.jsx'
import { Isotipo, Logotipo } from '../../../components/Logo.jsx'
import { openQuickAdd } from '../../../components/quickAddBus.js'
import { useSceneChrome } from '../../../components/layout/useSceneChrome.js'
import { isNativeApp } from '../../../native/platform.js'
import { appHelpHref } from '../../../utils/landingUrls.js'
import { currentMonth, dateLocale, fmtMoney, fmtMoneyParts, fmtSignedMoney, fmtPct, catName } from '../../../utils/index.js'
import { dailyAvailable, paceToday } from '../../../utils/dailyAvailable.js'
import { monthPace } from '../../../utils/monthPace.js'
import { projectEndOfMonth } from '../../../utils/projection.js'
import { SCORE_LEVELS } from '../../../utils/financialScore.js'
import { monthLabel } from '../../shared/constants.js'
import { useHomeData } from '../useHomeData.jsx'
import { useKpiDeltas } from '../HomeKpis.jsx'
import HeroDetailSheet from '../HeroDetailSheet.jsx'
import MonthReading from '../MonthReading.jsx'
import UpcomingPayments from '../UpcomingPayments.jsx'
import BudgetByCategory from '../BudgetByCategory.jsx'
import ScoreCard from '../ScoreCard.jsx'
import { prevMonthOf } from '../dashboardModel.js'
import ChartLupaRaw from '../lupa/ChartLupa.jsx'
import DaySheet from '../lupa/DaySheet.jsx'
import { inspectLines, paceLine, shortDate, valueText } from '../lupa/lupaText.js'
import { ASK_QUESTIONS, answerFor } from './askAnswers.js'
import p from './proto.module.css'

const ChartLupa = memo(ChartLupaRaw)

// ── Cifra grande (misma partición que la escena: decimales a la mitad) ─────
function BigNumber({ value, sym, center }) {
  const parts = fmtMoneyParts(value, sym, { signed: true })
  const chars = (parts.sign + parts.pre + parts.int).length + Math.ceil((parts.frac + parts.post).length / 2)
  return (
    <div className={`num ${p.big} ${center ? p.bigCenter : ''}`} style={{ '--chars': chars }}>
      <Money>
        {parts.sign}
        {parts.pre && <span className={p.cur}>{parts.pre}</span>}
        {parts.int}
        {parts.frac && <span className={p.dec}>{parts.frac}</span>}
        {parts.post && <span className={p.cur}>{parts.post}</span>}
      </Money>
    </div>
  )
}

// ── Cabecera de app (reemplaza el título "Inicio") ─────────────────────────
function IqChip({ healthScore, onOpen, t, tone }) {
  if (!healthScore) return null
  const lv = SCORE_LEVELS[healthScore.level] ? healthScore.level : 'attention'
  return (
    <button type="button" className={`${p.iq} ${tone === 'light' ? p.iqLight : ''}`} data-level={lv} onClick={onOpen}
      aria-label={t('home.proto.iq.aria', { score: healthScore.score, label: healthScore.label })}>
      <span className={p.iqTag} aria-hidden="true">IQ</span>
      <span className={`num ${p.iqNum}`} aria-hidden="true">{healthScore.score}</span>
    </button>
  )
}

function MonthButton({ activeMonth, onOpen, t, center }) {
  return (
    <button type="button" className={`${p.month} ${center ? p.monthCenter : ''}`} onClick={onOpen} aria-haspopup="dialog"
      aria-label={t('home.proto.month.aria', { month: monthLabel(activeMonth) })}>
      <span>{monthLabel(activeMonth)}</span>
      <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
    </button>
  )
}

function Header({ variant, activeMonth, healthScore, onMonth, onIq, onAsk, t, lang }) {
  if (variant === 'b') {
    return (
      <div className={`${p.header} ${p.headerB}`}>
        <MonthButton activeMonth={activeMonth} onOpen={onMonth} t={t} />
        <Logotipo size={20} title="moyiq" style={{ color: 'var(--on-grad-text)' }} />
        <div className={p.headerEnd}><IqChip healthScore={healthScore} onOpen={onIq} t={t} /></div>
      </div>
    )
  }
  return (
    <div className={p.header}>
      <div className={p.headerStart}>
        <Logotipo size={18} title="moyiq" style={{ color: 'var(--on-grad-text)' }} />
        <MonthButton activeMonth={activeMonth} onOpen={onMonth} t={t} />
      </div>
      <div className={p.headerEnd}>
        <IqChip healthScore={healthScore} onOpen={onIq} t={t} />
        {variant === 'c' || variant === 'd'
          ? (
            <button type="button" className={p.iconBtn} onClick={onAsk} aria-label={t('home.proto.ask.title')} aria-haspopup="dialog">
              <span className={p.askAvatar} aria-hidden="true"><Isotipo size={15} decorative style={{ color: 'var(--purple-700)' }} /></span>
            </button>
          )
          : (
            <a className={p.iconBtn} href={appHelpHref(lang, isNativeApp())} target="_blank" rel="noopener noreferrer" aria-label={t('home.proto.help')}>
              <HelpCircle size={22} strokeWidth={1.8} aria-hidden="true" />
            </a>
          )}
      </div>
    </div>
  )
}

// ── Botones redondos (patrón Rial: círculo de 56 px + etiqueta) ────────────
function RoundActions({ items, t, tone }) {
  return (
    <nav className={`${p.round} ${tone === 'float' ? p.roundFloat : ''} ${tone === 'inset' ? p.roundInset : ''}`} aria-label={t('dash.quick.title')}>
      {items.map(a => (
        <button key={a.key} type="button" className={p.roundBtn} onClick={a.run}>
          <span className={`${p.roundIc} ${a.strong ? p.roundIcStrong : ''}`}><a.Ic size={22} strokeWidth={1.9} aria-hidden="true" /></span>
          <span className={p.roundLb}>{a.label}</span>
        </button>
      ))}
    </nav>
  )
}

// ── Mes: hoja con los últimos 12 meses ─────────────────────────────────────
function monthsBack(n, from = currentMonth()) {
  const out = [from]
  let m = from
  for (let i = 1; i < n; i++) { m = prevMonthOf(m); out.push(m) }
  return out
}

function MonthSheet({ open, onClose, activeMonth, onPick, t }) {
  const months = useMemo(() => monthsBack(12), [])
  return (
    <Sheet open={open} onClose={onClose} ariaLabel={t('home.proto.month.title')} maxWidth={420}>
      <h2 className={p.sheetTitle}>{t('home.proto.month.title')}</h2>
      <ul className={p.monthList}>
        {months.map(m => (
          <li key={m}>
            <button type="button" className={p.monthRow} aria-current={m === activeMonth ? 'true' : undefined} onClick={() => onPick(m)}>
              <span>{monthLabel(m)}</span>
              {m === activeMonth && <Check size={18} strokeWidth={2.2} aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}

// ── Pregúntale a moyiq (C) ─────────────────────────────────────────────────
function AskCard({ onAsk, t }) {
  return (
    <section className={p.ask} aria-labelledby="home-proto-ask">
      <div className={p.askHead}>
        <span className={p.askAvatarLg} aria-hidden="true"><Isotipo size={18} decorative style={{ color: 'var(--on-grad-text)' }} /></span>
        <div className={p.askHeadText}>
          <h2 id="home-proto-ask" className={p.askTitle}>{t('home.proto.ask.title')}</h2>
          <p className={p.askSub}>{t('home.proto.ask.sub')}</p>
        </div>
      </div>
      <div className={p.chips}>
        {ASK_QUESTIONS.map(id => (
          <button key={id} type="button" className={p.chip} onClick={() => onAsk(id)} aria-haspopup="dialog">
            {t(`home.proto.ask.q.${id}`)}
          </button>
        ))}
      </div>
    </section>
  )
}

function Diff({ d, money, t, invert = false }) {
  if (Math.round(d) === 0) return <span className={p.diffSame}>{t('home.proto.ask.compare.same')}</span>
  const up = d > 0
  const good = invert ? !up : up
  return (
    <span className={good ? p.diffGood : p.diffBad}>
      <span aria-hidden="true">{up ? '↑ ' : '↓ '}</span>
      {t(up ? 'home.proto.ask.compare.more' : 'home.proto.ask.compare.less', { v: money(Math.abs(d)) })}
    </span>
  )
}

function AskSheet({ open, q, onQ, onClose, data, sym, lang, setPage, t }) {
  const { m } = useMoney()
  const money = useCallback((n) => m(fmtMoney(n, sym)), [m, sym])
  const a = q ? answerFor(q, data) : null
  let body = null
  if (q === 'spent' && a) {
    body = a.count === 0 ? <p className={p.ansLead}>{t('home.proto.ask.spent.none')}</p> : (
      <>
        <p className={p.ansLead}>{t('home.proto.ask.spent.body', { v: money(a.spent), count: t(`home.proto.count.${a.count === 1 ? 'one' : 'many'}`, { n: a.count }) })}</p>
        {a.share != null && <p className={p.ansText}>{t('home.proto.ask.spent.share', { pct: fmtPct(a.share), inc: money(a.income) })}</p>}
      </>
    )
  } else if (q === 'top' && a) {
    body = a.rows.length === 0 ? <p className={p.ansLead}>{t('home.proto.ask.spent.none')}</p> : (
      <>
        <p className={p.ansText}>{t('home.proto.ask.top.total', { v: money(a.total) })}</p>
        <ol className={p.topList}>
          {a.rows.map((r, i) => (
            <li key={r.category} className={p.topRow}>
              <span className={p.topRank} aria-hidden="true">{i + 1}</span>
              <span className={p.topMain}>
                <span className={p.topName}>{catName(r.category, lang)}</span>
                <span className={p.topBar} aria-hidden="true"><span style={{ width: `${Math.max(4, Math.round(r.share * 100))}%` }} /></span>
              </span>
              <span className={`num ${p.topAmt}`}><Money>{fmtMoney(r.amount, sym)}</Money><small>{fmtPct(r.share)}</small></span>
            </li>
          ))}
        </ol>
        {a.more > 0 && <p className={p.ansNote}>{t(`home.proto.ask.top.more.${a.more === 1 ? 'one' : 'many'}`, { n: a.more })}</p>}
      </>
    )
  } else if (q === 'compare' && a) {
    const prevKey = prevMonthOf(data.activeMonth)
    body = !a.hasPrev ? <p className={p.ansLead}>{t('home.proto.ask.compare.noPrev', { month: monthLabel(prevKey) })}</p> : (
      <>
        <p className={p.ansText}>{a.cutDay ? t('home.proto.ask.compare.toDay', { month: monthLabel(prevKey), day: a.cutDay }) : t('home.proto.ask.compare.full', { month: monthLabel(prevKey) })}</p>
        <dl className={p.cmp}>
          {[
            { k: 'income', label: t('dash.kpi.income'), row: a.income },
            { k: 'spent', label: t('dash.kpi.expenses'), row: a.spent, invert: true },
            { k: 'left', label: t('home.proto.ask.compare.left'), row: a.left },
          ].map(r => (
            <div key={r.k} className={p.cmpRow}>
              <dt>{r.label}</dt>
              <dd>
                <span className={`num ${p.cmpVal}`}><Money>{fmtMoney(r.row.cur, sym)}</Money></span>
                <span className={`num ${p.cmpPrev}`}>{monthLabel(prevKey)}: <Money>{fmtMoney(r.row.prev, sym)}</Money></span>
                <Diff d={r.row.diff} money={money} t={t} invert={r.invert} />
              </dd>
            </div>
          ))}
        </dl>
      </>
    )
  } else if (q === 'perDay' && a) {
    body = a.short ? <p className={p.ansLead}>{t('home.proto.ask.perDay.short', { v: money(Math.abs(a.free)) })}</p>
      : a.closed ? <p className={p.ansLead}>{t('home.proto.ask.perDay.closed', { v: money(a.free) })}</p>
        : (
          <>
            <p className={p.ansBig}><span className="num"><Money>{fmtMoney(a.perDay, sym)}</Money></span></p>
            <p className={p.ansLead}>{t(a.daysLeft === 1 ? 'home.proto.ask.perDay.one' : 'home.proto.ask.perDay.many', { v: money(a.perDay), n: a.daysLeft })}</p>
            <p className={p.ansNote}>{t('home.proto.ask.perDay.note', { v: money(a.free) })}</p>
          </>
        )
  }
  const others = ASK_QUESTIONS.filter(id => id !== q)
  return (
    <Sheet open={open} onClose={onClose} ariaLabel={q ? t(`home.proto.ask.q.${q}`) : t('home.proto.ask.title')} maxWidth={460}>
      <div className={p.ansHead}>
        <span className={p.askAvatarLg} aria-hidden="true"><Isotipo size={18} decorative style={{ color: 'var(--on-grad-text)' }} /></span>
        <h2 className={p.sheetTitle}>{q ? t(`home.proto.ask.q.${q}`) : t('home.proto.ask.title')}</h2>
      </div>
      <div className={p.ans} aria-live="polite">{body}</div>
      {q && q !== 'perDay' && setPage && (
        <button type="button" className={p.ansCta} onClick={() => { onClose(); setPage('movements') }}>
          {t('home.proto.ask.cta')}<ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
      <p className={p.ansOthersLb}>{q ? t('home.proto.ask.others') : t('home.proto.ask.open')}</p>
      <div className={p.chipsSheet}>
        {(q ? others : ASK_QUESTIONS).map(id => (
          <button key={id} type="button" className={p.chipSheet} onClick={() => onQ(id)}>{t(`home.proto.ask.q.${id}`)}</button>
        ))}
      </div>
      <p className={p.ansSource}>{t('home.proto.ask.source')}</p>
    </Sheet>
  )
}

// ── Barra de 3 pestañas de B (propuesta de consolidación, reversible) ──────
function BottomBarB({ setPage, t }) {
  const tabs = [
    { id: 'dashboard', Ic: Home, lb: t('nav.dashboard'), active: true },
    { id: 'movements', Ic: ArrowLeftRight, lb: t('nav.movements') },
    { id: 'more', Ic: LayoutGrid, lb: t('nav.menuLabel') },
  ]
  return (
    <div className={p.barB}>
      <nav className={p.barPill} aria-label={t('home.proto.tabs.aria')}>
        {tabs.map(tb => (
          <button key={tb.id} type="button" className={`${p.barTab} ${tb.active ? p.barTabOn : ''}`}
            aria-current={tb.active ? 'page' : undefined} onClick={() => !tb.active && setPage?.(tb.id)}>
            <tb.Ic size={22} strokeWidth={tb.active ? 2.2 : 1.8} aria-hidden="true" />
            <span>{tb.lb}</span>
          </button>
        ))}
      </nav>
      <button type="button" className={p.barAdd} onClick={() => openQuickAdd('expense')} aria-label={t('home.proto.add')}>
        <Plus size={26} strokeWidth={2.2} aria-hidden="true" />
      </button>
    </div>
  )
}

// ── El Inicio prototipo ────────────────────────────────────────────────────
export default function HomeProto({ variant = 'a', setPage }) {
  const { t, lang } = useT()
  const { m } = useMoney()
  const {
    ctx, settings, incomes, expenses, setAsides, budgets, subs, debts, sym, activeMonth,
    kpis, rules, plan, pendingSum, monthExpenses, healthScore, dualOn, toUSD,
  } = useHomeData()
  const updateSettings = ctx.updateSettings
  const sceneRef = useRef(null)
  const chartRef = useRef(null)
  useSceneChrome(sceneRef)
  const tabs3 = variant === 'b' || variant === 'd'   // barra de 3 pestañas
  const asks = variant === 'c' || variant === 'd'    // Pregúntale a moyiq

  // La barra superior del Shell (título compacto, ? y ojo) se esconde en el
  // teléfono: la cabecera nueva ya lleva logo, mes, IQ y ayuda, y el ojo va
  // junto a la cifra. En B también se esconde la barra de 5 (va la de 3).
  useEffect(() => {
    const root = document.documentElement
    root.dataset.homeProto = variant
    return () => { delete root.dataset.homeProto }
  }, [variant])

  const { cur } = kpis
  const free = cur.freeFlow
  const hasData = cur.incCount > 0 || cur.expCount > 0 || (cur.setAsideCount || 0) > 0
  const isCurrent = activeMonth === currentMonth()
  const locale = dateLocale()
  const fmt = useCallback((n) => m(fmtSignedMoney(n, sym)), [m, sym])

  // Mismo veredicto del mes que el Inicio (anillo, píldora, frase).
  const pulse = useMemo(() => {
    const { daysLeft } = projectEndOfMonth({ incomes, expenses, activeMonth })
    const v = monthPace(kpis, activeMonth)
    if (!v) return { daysLeft, level: null }
    const fixed = v.cause === 'fixed'
    return { spentRatio: Number.isFinite(v.ratio) ? Math.max(0, v.ratio) : 1, elapsedRatio: v.elapsed, color: SCORE_LEVELS[v.level].color,
      level: v.level, daysLeft, verdict: v, labelKey: fixed ? 'pulse.fixed' : `pulse.${v.level}`, ariaKey: fixed ? 'pulse.ariaFixed' : 'pulse.aria' }
  }, [incomes, expenses, kpis, activeMonth])
  const daysLeft = isCurrent ? pulse.daysLeft : null

  const series = useMemo(() => {
    if (variant === 'b') return null
    const sr = dailyAvailable({ incomes, expenses, setAsides, activeMonth, income: kpis.totalInc, plan, pending: pendingSum, pendingFixed: kpis.pendingFixed, fixedPaid: kpis.fixedPaid })
    return sr.lastDay >= 1 ? sr : null
  }, [variant, incomes, expenses, setAsides, activeMonth, plan, pendingSum, kpis.totalInc, kpis.pendingFixed, kpis.fixedPaid])
  const paceData = useMemo(() => paceToday(series || dailyAvailable({ incomes, expenses, setAsides, activeMonth, income: kpis.totalInc, plan, pending: pendingSum, pendingFixed: kpis.pendingFixed, fixedPaid: kpis.fixedPaid })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la serie ya depende de lo mismo
    [series, activeMonth, kpis.totalInc])

  // Día bajo el dedo (arrastrar) y hoja del día (tocar).
  const [inspect, setInspect] = useState(null)
  const [sheetDay, setSheetDay] = useState(null)
  const [daySheet, setDaySheet] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [monthOpen, setMonthOpen] = useState(false)
  const [askQ, setAskQ] = useState(null)
  const [askOpen, setAskOpen] = useState(false)
  useEffect(() => { setInspect(null) }, [activeMonth])
  const onDay = useCallback((d, mode) => setInspect(mode === 'rest' ? null : d), [])
  const onTap = useCallback((d) => { setSheetDay(d); setDaySheet(true) }, [])
  const valueTextOf = useCallback((d) => valueText({ series, day: d, activeMonth, t, fmt, locale }), [series, activeMonth, t, fmt, locale])
  const axis = useMemo(() => series && variant !== 'd' ? [
    { key: 's', day: 1, text: shortDate(activeMonth, 1, locale) },
    { key: 'e', day: series.days, align: 'end', text: shortDate(activeMonth, series.days, locale) },
  ] : null, [series, activeMonth, locale, variant])

  const looking = inspect != null && series && !(series.mode === 'current' && inspect === series.lastDay)
  const value = looking ? series.spentCum[inspect] : free
  const label = looking ? inspectLines({ series, day: inspect, activeMonth, t, fmt, locale }).label : (free < 0 ? t('home.kpi.short') : t('home.kpi.left'))
  const pace = !looking && isCurrent ? paceLine(paceData, { t, fmt }) : null
  const sub = looking ? inspectLines({ series, day: inspect, activeMonth, t, fmt, locale }).sub
    : daysLeft > 0 ? t(`home.kpi.daysLeft.${daysLeft === 1 ? 'one' : 'many'}`, { n: daysLeft }) : t('home.kpi.leftSub')

  const { prevMonth, prev, cutDay, usdOn, usdFmt, deltaOf } = useKpiDeltas({ kpis, activeMonth, country: settings.country })
  const prevHasData = prev.incCount > 0 || prev.expCount > 0

  const hidden = !!settings.hideAmounts
  const toggleAmounts = () => updateSettings?.({ ...settings, hideAmounts: !hidden })
  const pickMonth = (mo) => { setMonthOpen(false); if (mo !== activeMonth) updateSettings?.({ ...settings, activeMonth: mo }) }
  const ask = (id) => { setAskQ(id); setAskOpen(true) }
  const openMov = (filter) => {
    if (!setPage) return
    try { sessionStorage.setItem('fos_mov_filter', filter) } catch { /* modo privado */ }
    setPage('movements')
  }

  const go = (page) => () => setPage?.(page)
  const actionsA = [
    { key: 'exp', label: t('home.quick.expense'), Ic: Minus, run: () => openQuickAdd('expense'), strong: true },
    { key: 'inc', label: t('home.quick.income'), Ic: Plus, run: () => openQuickAdd('income') },
    { key: 'bud', label: t('nav.budgets'), Ic: PiggyBank, run: go('budgets') },
    { key: 'imp', label: t('home.quick.import'), Ic: Upload, run: go('import') },
  ]
  const actionsB = [
    { key: 'bud', label: t('nav.budgets'), Ic: Wallet, run: go('budgets') },
    { key: 'goal', label: t('nav.goals'), Ic: Target, run: go('goals') },
    { key: 'rec', label: t('nav.recurring'), Ic: Repeat, run: go('recurring') },
    { key: 'imp', label: t('home.quick.import'), Ic: Upload, run: go('import') },
  ]

  const eye = (
    <button type="button" className={p.eye} onClick={toggleAmounts} aria-pressed={hidden} aria-label={t('money.toggle')}>
      {hidden ? <EyeOff size={18} strokeWidth={1.8} aria-hidden="true" /> : <Eye size={18} strokeWidth={1.8} aria-hidden="true" />}
    </button>
  )

  const hero = (
    <section ref={sceneRef} className={`${p.hero} ${variant === 'b' ? p.heroB : ''}`} aria-label={t('home.kpis.aria')}>
      <Header variant={variant} activeMonth={activeMonth} healthScore={healthScore} t={t} lang={lang}
        onMonth={() => setMonthOpen(true)} onIq={go('coach')} onAsk={() => { setAskQ(null); setAskOpen(true) }} />

      <div className={`${p.heroBody} ${variant === 'b' ? p.heroBodyB : ''}`}>
        <div className={p.labelRow}>
          <button type="button" className={p.heroOpen} aria-haspopup="dialog"
            aria-label={`${free < 0 ? t('home.kpi.short') : t('home.kpi.left')}. ${t('home.detail.open')}`}
            onClick={() => setDetailOpen(true)}>
            <span className={p.label}>{label}</span>
            {!looking && <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" />}
          </button>
          {eye}
        </div>
        {hasData ? <BigNumber value={value} sym={sym} center={variant === 'b'} /> : <p className={p.noData}>{t('verdict.noData')}</p>}
        {hasData && (
          <p className={`num ${p.sub} ${variant === 'b' ? p.subB : ''}`}>
            {pace && <span className={pace.kind === 'behind' || pace.kind === 'fixed' ? p.paceChip : p.paceKey}>{pace.text}</span>}
            <span>{sub}</span>
          </p>
        )}
        {variant === 'b' && dualOn && hasData && <p className={p.dual}>{toUSD(free)}</p>}
      </div>

      {variant !== 'b' && hasData && series && (
        <div className={`${p.chart} ${variant === 'd' ? p.chartD : ''}`}>
          <ChartLupa ref={chartRef} series={series} hold={daySheet}
            label={t('home.lupa.aria', { month: monthLabel(activeMonth) })}
            valueTextOf={valueTextOf} axis={axis} onDay={onDay} onTap={onTap} />
        </div>
      )}

      {variant === 'd' && <RoundActions items={actionsB} t={t} tone="inset" />}

      {(variant === 'a' || variant === 'c') && (
        <div className={p.pair}>
          {[
            { key: 'inc', label: t('dash.kpi.income'), raw: cur.totalInc, filter: 'income', sign: '+' },
            { key: 'exp', label: t('dash.kpi.expenses'), raw: cur.totalExp, filter: 'expense', sign: '−' },
          ].map(k => (
            <button key={k.key} type="button" className={p.pairItem} onClick={() => openMov(k.filter)}>
              <span className={p.pairLabel}>{k.label}</span>
              <span className={`num ${p.pairValue}`}>{k.raw > 0 ? k.sign : ''}<Money>{fmtMoney(k.raw, sym)}</Money></span>
              <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" className={p.pairChev} />
            </button>
          ))}
        </div>
      )}
    </section>
  )

  return (
    <div className={p.root} data-variant={variant}>
      {hero}

      <div className={p.below}>
        {variant !== 'd' && <RoundActions items={variant === 'b' ? actionsB : actionsA} t={t} tone={variant === 'b' ? 'float' : undefined} />}

        {tabs3 && (
          <div className={p.cards}>
            {[
              { key: 'inc', label: t('dash.kpi.income'), raw: cur.totalInc, n: cur.incCount, filter: 'income', sign: '+', cls: p.cardInc },
              { key: 'exp', label: t('dash.kpi.expenses'), raw: cur.totalExp, n: cur.expCount, filter: 'expense', sign: '−', cls: p.cardExp },
            ].map(k => (
              <button key={k.key} type="button" className={`${p.card} ${k.cls}`} onClick={() => openMov(k.filter)}>
                <span className={p.cardLabel}>{k.label}<ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" /></span>
                <span className={`num ${p.cardValue}`}>{k.raw > 0 ? k.sign : ''}<Money>{fmtMoney(k.raw, sym)}</Money></span>
                <span className={p.cardSub}>{t(`home.proto.count.${k.n === 1 ? 'one' : 'many'}`, { n: k.n })}</span>
              </button>
            ))}
          </div>
        )}

        {asks && <AskCard onAsk={ask} t={t} />}

        <MonthReading kpis={kpis} expenses={expenses} budgets={budgets} pending={pendingSum} activeMonth={activeMonth} settings={settings} sym={sym} setPage={setPage} />

        <div className={p.pairBlocks}>
          {variant === 'b' && (
            <BudgetByCategory budgets={budgets} expenses={expenses} monthExpenses={monthExpenses}
              activeMonth={activeMonth} settings={settings} sym={sym} setPage={setPage} maxRows={3} short />
          )}
          <UpcomingPayments rules={rules} incomes={ctx.incomes} expenses={ctx.expenses} debts={debts} subscriptions={subs} sym={sym} setPage={setPage}
            days={7} limit={3} short />
          {variant !== 'b' && (
            <BudgetByCategory budgets={budgets} expenses={expenses} monthExpenses={monthExpenses}
              activeMonth={activeMonth} settings={settings} sym={sym} setPage={setPage} maxRows={3} short />
          )}
        </div>

        <ScoreCard healthScore={healthScore} activeMonth={activeMonth} compact isCurrentMonth={isCurrent} setPage={setPage} />
      </div>

      {tabs3 && <BottomBarB setPage={setPage} t={t} />}

      <MonthSheet open={monthOpen} onClose={() => setMonthOpen(false)} activeMonth={activeMonth} onPick={pickMonth} t={t} />

      <HeroDetailSheet open={detailOpen} onClose={() => setDetailOpen(false)} free={free} hasData={hasData} sym={sym}
        showRef={false} refc={null} delta={deltaOf(cur.leftReal ?? free, prev.freeFlow, { hasPrev: prevHasData })} pendingFixed={cur.pendingFixed}
        prevMonth={prevMonth} cutDay={cutDay} deltaFormat={usdOn ? usdFmt : undefined}
        pulse={hasData && pulse.level ? pulse : null} pending={pendingSum} onReviewPending={undefined} dual={dualOn && hasData ? toUSD(free) : null}
        sub={[t('home.kpi.leftSub'), daysLeft != null ? t(`home.kpi.daysLeft.${daysLeft === 1 ? 'one' : 'many'}`, { n: daysLeft }) : null].filter(Boolean).join(' · ')}
        onPanorama={setPage ? () => setPage('panorama') : undefined} />

      {series && (
        <DaySheet open={daySheet} day={sheetDay} series={series} activeMonth={activeMonth} incomes={incomes} expenses={expenses} sym={sym} fmt={fmt}
          onDay={(d) => { setSheetDay(d); chartRef.current?.glideTo(d) }}
          onClose={() => { setDaySheet(false); chartRef.current?.rest() }} />
      )}

      {asks && (
        <AskSheet open={askOpen} q={askQ} onQ={setAskQ} onClose={() => setAskOpen(false)} sym={sym} lang={lang} setPage={setPage} t={t}
          data={{ kpis, monthExpenses, activeMonth }} />
      )}
    </div>
  )
}
