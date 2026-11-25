// src/pages/Dashboard/index.jsx — Inicio.
// Poda P1 (aprobada por Walter el 30-oct-2026, propuesta en
// investigacion-ui-2026-10/segunda-ronda/2026-10-30-propuesta-poda.md): el
// Inicio responde UNA pregunta, "¿cuánto me queda y qué tengo que hacer?".
// Orden: Te queda (con Ingresos · Gastos en una línea) → 4 acciones rápidas →
// "Para hacer" (un aviso por vez) → pagos y cobros de 7 días → las 3
// categorías más en riesgo → IQ Score en una línea → tarjetas que la persona
// sumó en "Editar Inicio". La vista detallada de antes es Panorama (en "Más"):
// nada se borró, se movió.
//
// Inicio v2 (24-nov-2026, variante D aprobada por Walter): con la escena, la
// cabecera es de app (mes · logo · IQ y asistente), los 4 botones redondos van
// DENTRO del bloque (Presupuestos · Metas · Fijos o Convertir · Importar: con
// la barra de 3 pestañas, Presupuestos y Metas se abren desde acá y desde Más),
// y debajo vienen las tarjetas de Ingresos y Gastos y "Pregúntale a moyiq"
// (respuestas en el teléfono, con reglas; ask/). El Inicio clásico
// (?ui=inicio-clasico) queda como estaba.

import { lazy, Suspense, useMemo, useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useT } from '../../i18n/useT.js'
import Sheet from '../../components/ui/Sheet.jsx'
import ChartCard from '../../components/charts/ChartCard.jsx'
import DonutEmpty from './DonutEmpty.jsx'
import { SCORE_LEVELS } from '../../utils/financialScore.js'
import { projectEndOfMonth } from '../../utils/projection.js'
import { ScoreState } from '../../components/ScoreState.jsx'
import HomeKpis from './HomeKpis.jsx'
import MonthReading from './MonthReading.jsx'
import FirstSteps, { useFirstSteps } from './FirstSteps.jsx'
import ReviewInbox from './review/ReviewInbox.jsx'
// Avisos de tus finanzas de hoy (fijo de mañana, presupuesto al 90 %, lo que queda, cobro).
import LocalAlertsCard from './LocalAlertsCard.jsx'
import ProChecklist from './ProChecklist.jsx'
import BudgetByCategory from './BudgetByCategory.jsx'
import UpcomingPayments from './UpcomingPayments.jsx'
import ScoreCard from './ScoreCard.jsx'
import NetWorthCard from './NetWorthCard.jsx'
import ProjectionCard from './ProjectionCard.jsx'
import { useHomeData } from './useHomeData.jsx'
import { HOME_CARDS, homeCardOn, toggleHomeCard } from './homeCards.js'
import { RateSheet, fetchRateOptions, setLensCurrency } from './RefCurrency.jsx'
import { useLensRate } from '../../hooks/useLensRate.js'
import ConverterSheet from '../../components/ConverterSheet.jsx'
import { openQuickAdd } from '../../components/quickAddBus.js'
import { logRejection } from '../../utils/errorLog.js'
import { rateToolFor, savedRate, isStale, fresherRate, ratePatch } from '../../utils/refRate.js'
import { prevMonthOf, monthCloseDue, MONTH_BROWSE_KEY } from './dashboardModel.js'
import hs from './Home.module.css'
import { currentMonth, fmtMoney, fmtPct } from '../../utils/index.js'
import { monthLabel } from '../shared/constants.js'
import { BackupReminderBanner } from '../../components/backup/BackupStatus.jsx'
import SafariStorageNotice from '../../components/backup/SafariStorageNotice.jsx'
import SyncErrorNotice from '../../components/backup/SyncErrorNotice.jsx'
import { PageHeader } from '../../components/ui/index.jsx'
import { Switch } from '../Settings/settingsUi.jsx'
import MonthSheet from '../../components/recurring/MonthSheet.jsx'
import { Plus, Minus, ArrowLeftRight, Upload, PiggyBank, SlidersHorizontal, Wallet, Target, Repeat, ChevronRight } from 'lucide-react'
import Money from '../../components/Money.jsx'
import { AskCard, AskSheet } from './ask/AskMoyiq.jsx'
import { requestTourReplay } from '../../components/tour/PageTour.jsx'
import ask from './ask/ask.module.css'
import { inicioLupaOn } from '../../utils/uiFlags.js'
import { dailyAvailable, paceToday } from '../../utils/dailyAvailable.js'
import { monthPace } from '../../utils/monthPace.js'

// V4: el anillo es una tarjeta opcional ("Editar Inicio") y es lo único del
// Inicio que usa recharts (~100 kB gzip). Lazy, el Inicio pinta sin esperarlo.
const CategoryDonut = lazy(() => import('../../components/charts/CategoryDonut.jsx'))
// Entrega 1.5 (uiFlags.inicioLupa): la escena con la ChartLupa vive en su
// propio trozo, así con el interruptor apagado no pesa nada.
const InicioScene = lazy(() => import('./lupa/InicioScene.jsx'))

function lupaOn(isDemo) {
  let session = null
  try { session = typeof sessionStorage !== 'undefined' ? sessionStorage : null } catch { session = null }
  return inicioLupaOn({
    isDemo, isDev: !!import.meta.env?.DEV, session,
    search: typeof location !== 'undefined' ? location.search : '',
  })
}

const pct = (n) => fmtPct(n)

// "Para hacer": muestra el primer aviso que tenga algo que decir, en el orden
// de prioridad de los hijos (guía → respaldo → almacenamiento de Safari), y un
// "N más" que despliega el resto. Cada aviso decide solo si se muestra (sus
// reglas ya existían); acá solo se cuentan los que quedaron con contenido.
function TodoStrip({ children }) {
  const { t } = useT()
  const ref = useRef(null)
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  // Los avisos cambian solos (se descartan, se completa un paso): se cuentan
  // al montar y cada vez que cambia el DOM de adentro.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const recount = () => setCount(el.querySelectorAll(`:scope > .${hs.todoSlot}:not(:empty)`).length)
    recount()
    if (typeof MutationObserver === 'undefined') return
    const mo = new MutationObserver(recount)
    mo.observe(el, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [])
  const extra = Math.max(0, count - 1)
  return (
    // Sin avisos no ocupa lugar (ni el espacio entre bloques).
    <div className={hs.oTodo} data-tour="first-steps" hidden={count === 0}>
      <div ref={ref} className={`${hs.todo} ${open ? '' : hs.todoCollapsed}`}>
        {children}
      </div>
      {extra > 0 && (
        <button type="button" className={hs.todoMore} aria-expanded={open} onClick={() => setOpen(o => !o)}>
          {open ? t('home.todo.less') : t(`home.todo.more.${extra === 1 ? 'one' : 'many'}`, { n: extra })}
        </button>
      )}
    </div>
  )
}
const Slot = ({ children }) => <div className={hs.todoSlot}>{children}</div>

export default function Dashboard({ setPage }) {
  const { t, lang } = useT()
  const {
    ctx, settings, incomes, expenses, setAsides, budgets, goals, subs, debts, sym, activeMonth,
    refOn, refRate, bumpRate, dualOn, toUSD, money,
    kpis, rules, plan, pendingSum, todayStr, monthExpenses, healthScore,
  } = useHomeData()
  const updateSettings = ctx.updateSettings
  const [lupa] = useState(() => lupaOn(!!settings.isDemo))

  // R7/A8: un solo aviso de respaldo. Si "Primeros pasos" ya lo pide, no sale
  // la franja. La tarjeta va arriba del contenido, fuera de "Para hacer".
  const steps = useFirstSteps()
  const firstStepsShown = steps.visible && !!setPage
  const backupStepPending = firstStepsShown && steps.progress.steps.some(st => st.id === 'backup' && !st.done)

  // Rial #20: la lente del héroe en US$ o € (settings.refCurrency).
  const lensRate = useLensRate(settings, refRate, refOn)
  setLensCurrency(refOn ? lensRate?.ref : 'USD')

  // ── Modal cierre de mes ───────────────────────────────────────────────────
  // Solo con el cambio natural de mes; elegir un mes pasado en el selector de
  // la cabecera no lo dispara (monthCloseDue, dashboardModel.js).
  const [closeTick, setCloseTick] = useState(0)
  const closeDismissed = (() => {
    void closeTick
    try { return localStorage.getItem(`fos_close_${activeMonth}`) === '1' } catch { return false }
  })()
  const browsedMonth = (() => { try { return sessionStorage.getItem(MONTH_BROWSE_KEY) } catch { return null } })()
  const showCloseModal = monthCloseDue({ activeMonth, dismissed: closeDismissed, browsed: browsedMonth, hasData: kpis.incCount > 0 || kpis.expCount > 0 })

  // Hoja de inicio de mes (fusionada con el cierre): la primera vez que se
  // abre el Inicio en el mes en curso muestra cómo cerró el anterior y los
  // fijos previstos. "Revisar" la reabre cuando sea.
  const isCurrent = activeMonth === currentMonth()
  const prevMonthKey = prevMonthOf(activeMonth)
  const prevHasData = kpis.prev.incCount > 0 || kpis.prev.expCount > 0
  const [startDismissed, setStartDismissed] = useState(() => {
    try { return localStorage.getItem(`fos_mstart_${activeMonth}`) === '1' } catch { return false }
  })
  useEffect(() => {
    try { setStartDismissed(localStorage.getItem(`fos_mstart_${activeMonth}`) === '1') } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ }
  }, [activeMonth])
  const [reviewOpen, setReviewOpen] = useState(false)
  const autoStart = isCurrent && !startDismissed && !settings.isDemo &&
    (plan.some(o => !o.rule.inv) || prevHasData) && (kpis.incCount > 0 || kpis.expCount > 0 || rules.length > 0)
  const sheetOpen = reviewOpen || autoStart
  const closeSheet = useCallback(() => {
    try { localStorage.setItem(`fos_mstart_${activeMonth}`, '1') } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ }
    setStartDismissed(true)
    setReviewOpen(false)
  }, [activeMonth])

  function dismissClose() {
    try { localStorage.setItem(`fos_close_${activeMonth}`, '1') } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ }
    setCloseTick(n => n + 1)
  }

  function goNextMonth() {
    const [y, mo] = activeMonth.split('-').map(Number)
    const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`
    updateSettings?.({ ...settings, activeMonth: next })
    dismissClose()
  }

  function MonthlyCloseModal() {
    const balance = kpis.balance
    const ok = balance >= 0
    return (
      <Sheet open={showCloseModal} onClose={dismissClose} ariaLabel={t('dash.close.title')} maxWidth={380}>
          <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 'var(--t-footnote)', color:'var(--th)', marginBottom:8 }}>
            {t('dash.close.title')}
          </div>
          <div style={{ fontSize:'var(--t-title-2)', fontWeight:700, color:'var(--tx)', marginBottom:4 }}>
            {activeMonth}
          </div>
          <div style={{ fontSize:'var(--t-subhead)', color: ok ? 'var(--accent)' : 'var(--red)', fontWeight:600, marginBottom:20 }}>
            {ok ? t('dash.close.positive') : t('dash.close.negative')}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
            {[
              { label:t('dash.kpi.income'),    val:money(kpis.totalInc),  color:'var(--accent)' },
              { label:t('dash.kpi.expenses'),      val:money(kpis.totalExp),  color:'var(--tx)' },
              { label:t('dash.kpi.balance'),     val:money(Math.abs(balance)), color: ok ? 'var(--accent)' : 'var(--red)', prefix: ok ? '+' : '−' },
              { label:t('dash.close.savings'),      val:pct(kpis.savingRate),            color: kpis.savingRate >= 0.2 ? 'var(--accent)' : 'var(--amb)' },
            ].map(k => (
              <div key={k.label} style={{ background:'var(--bg2)', borderRadius:10, padding:'10px 12px' }}>
                <div style={{ fontSize: 'var(--t-footnote)', fontFamily: 'var(--sans)', fontWeight: 600, color:'var(--th)', marginBottom:3 }}>{k.label}</div>
                <div style={{ fontSize:'var(--t-headline)', fontWeight:700, fontFamily: 'var(--num)', color:k.color }}>{k.prefix||''}{k.val}</div>
              </div>
            ))}
          </div>

          {healthScore && (
            <div style={{ background:'var(--bg2)', borderRadius:10, padding:'10px 12px', marginBottom:20, display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ fontSize:'var(--t-title)', fontWeight:700, fontFamily: 'var(--num)', color:healthScore.color }}>{healthScore.score}</div>
              <div>
                <div style={{ fontSize: 'var(--t-footnote)', fontFamily: 'var(--sans)', fontWeight: 600, color:'var(--th)'}}>{t('dash.health.title')}</div>
                <ScoreState level={healthScore.level} label={healthScore.label} style={{ fontSize:'var(--t-subhead)' }} />
              </div>
            </div>
          )}

          <div style={{ display:'flex', gap:10, flexDirection:'column' }}>
            <button
              onClick={goNextMonth}
              style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-fg)', border:'none', borderRadius:9, padding:'11px 18px', fontSize:'var(--t-subhead)', fontWeight:700, cursor:'pointer', fontFamily: 'var(--num)' }}
            >
              {t('dash.close.next')}
            </button>
            <button
              onClick={dismissClose}
              style={{ background: 'var(--fill)', color:'var(--th)', border: 0, borderRadius:9, padding:'9px 18px', fontSize:'var(--t-footnote)', cursor:'pointer', fontFamily: 'var(--sans)' }}
            >
              {t('dash.close.stay', { m: activeMonth })}
            </button>
          </div>
      </Sheet>
    )
  }

  // ── El Anillo Vivo (Pulso) — firma del producto, visible con datos del mes.
  // I-22: el nivel es EL veredicto del mes (utils/monthPace.js), el mismo de
  // la píldora de la Lupa y de la frase del mes en el Inicio y en Panorama:
  // contra el ingreso, con lo apartado y los fijos como "Te queda".
  const pulse = useMemo(() => {
    const { daysLeft } = projectEndOfMonth({ incomes, expenses, activeMonth })
    const v = monthPace(kpis, activeMonth)
    if (!v) return { daysLeft, level: null }
    const color = SCORE_LEVELS[v.level].color
    const spentRatio = Number.isFinite(v.ratio) ? Math.max(0, v.ratio) : 1
    // Fijos + apartado se llevan todo el ingreso: texto y aria propios (no es "gasto rápido").
    const fixed = v.cause === 'fixed'
    return { spentRatio, elapsedRatio: v.elapsed, color, level: v.level, daysLeft, verdict: v,
             labelKey: fixed ? 'pulse.fixed' : `pulse.${v.level}`, ariaKey: fixed ? 'pulse.ariaFixed' : 'pulse.aria' }
  }, [incomes, expenses, kpis, activeMonth])

  // Entrega 1.5: gasto acumulado del mes contra el ritmo ideal. La píldora
  // (paceToday) es el mismo veredicto que `pulse` (anillo y etiqueta del
  // detalle) y que la frase del mes: paceVerdict (utils/monthPace.js).
  const lupaSeries = useMemo(() => {
    if (!lupa) return null
    const sr = dailyAvailable({ incomes, expenses, setAsides, activeMonth, income: kpis.totalInc, plan, pending: pendingSum, pendingFixed: kpis.pendingFixed, fixedPaid: kpis.fixedPaid })
    return sr.lastDay >= 1 ? sr : null
  }, [lupa, incomes, expenses, setAsides, activeMonth, plan, pendingSum, kpis.totalInc, kpis.pendingFixed, kpis.fixedPaid])
  const lupaPace = useMemo(() => paceToday(lupaSeries), [lupaSeries])

  // R12/R13: moneda de referencia del hero + calculadora del país.
  const [refMode, setRefModeState] = useState(() => { try { return localStorage.getItem('fos_home_refcur') === 'ref' ? 'ref' : 'local' } catch { return 'local' } })
  const setRefMode = (m) => { setRefModeState(m); try { localStorage.setItem('fos_home_refcur', m) } catch { /* modo privado */ } }
  const [rateSheetOpen, setRateSheetOpen] = useState(false)
  // B2: la fila de tasa abre el conversor GRATIS; el panel PRO del país queda
  // como enlace dentro de la hoja (y en "Más" › Herramientas).
  const [convOpen, setConvOpen] = useState(false)
  const rateTool = rateToolFor(settings.country)
  // B1: con la tasa vieja o sin fecha, se consulta en segundo plano y se
  // ofrece la más reciente con "Usar". Nada se reemplaza solo.
  const [freshRate, setFreshRate] = useState(null)
  useEffect(() => {
    if (!refOn || (refRate?.at && !isStale(refRate.at, settings.country))) { setFreshRate(null); return }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return
    let alive = true
    fetchRateOptions(settings).then(({ options }) => {
      if (!alive) return
      setFreshRate(fresherRate(refRate, options, settings.country))
      // Sin tasa guardada, el Inicio usa la caché: releerla tras la consulta.
      if (!savedRate(settings)) bumpRate()
    }).catch(logRejection('home.freshRate'))
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia la tasa en uso o la moneda
  }, [refOn, refRate?.at, refRate?.rate, settings.country, settings.currency])
  const refc = refOn ? {
    rate: lensRate, mode: lensRate ? refMode : 'local', setMode: setRefMode,
    localCode: String(settings.currency || '').toUpperCase(), country: settings.country,
    onEdit: () => setRateSheetOpen(true),
    // Poda P1: "Convertir" vive en las acciones rápidas; la fila de tasa
    // queda con la tasa, su fecha y "Editar tasa".
    tool: !setPage, onTool: () => setConvOpen(true),
    fresh: freshRate, onUseFresh: () => saveRate(ratePatch(freshRate)),
  } : null
  function saveRate(patch) {
    if (!patch) return
    updateSettings?.({ ...settings, ...patch })
    bumpRate()
    setRateSheetOpen(false)
    setFreshRate(null)
    ctx.showToast?.(t('refcur.saved'))
  }

  // Acciones rápidas (patrón rial #19): + Gasto · + Ingreso · Convertir ·
  // Importar. Sin moneda de referencia (fuera de VE/AR y sin moneda dual) no
  // hay nada que convertir: el tercer atajo es Presupuestos.
  const quick = setPage ? [
    { key: 'exp', label: t('home.quick.expense'), Ic: Minus, run: () => openQuickAdd('expense') },
    { key: 'inc', label: t('home.quick.income'),  Ic: Plus,  run: () => openQuickAdd('income') },
    refOn
      ? { key: 'conv', label: t('home.quick.convert'), Ic: ArrowLeftRight, run: () => setConvOpen(true) }
      : { key: 'bud',  label: t('nav.budgets'),        Ic: PiggyBank,      run: () => setPage('budgets') },
    { key: 'imp', label: t('home.quick.import'),  Ic: Upload, run: () => setPage('import') },
  ] : []

  // Inicio v2: botones redondos de la escena. Con moneda de referencia (VE/AR o
  // moneda dual) el tercero es Convertir, como en los atajos de antes; Fijos
  // sigue en Más y en Movimientos.
  const go = (page) => () => setPage?.(page)
  const roundActions = setPage ? [
    { key: 'bud', label: t('nav.budgets'), Ic: Wallet, run: go('budgets') },
    { key: 'goal', label: t('nav.goals'), Ic: Target, run: go('goals') },
    refOn
      ? { key: 'conv', label: t('home.quick.convert'), Ic: ArrowLeftRight, run: () => setConvOpen(true) }
      : { key: 'rec', label: t('nav.recurring'), Ic: Repeat, run: go('recurring') },
    { key: 'imp', label: t('home.quick.import'), Ic: Upload, run: go('import') },
  ] : []
  const [askOpen, setAskOpen] = useState(false)
  const [askQ, setAskQ] = useState(null)
  const openAsk = (id = null) => { setAskQ(id); setAskOpen(true) }
  const openMovements = (filter) => {
    if (!setPage) return
    try { sessionStorage.setItem('fos_mov_filter', filter) } catch { /* modo privado: abre sin filtro */ }
    setPage('movements')
  }

  // P3: "Editar Inicio" — tarjetas opcionales, apagadas por defecto.
  const [editOpen, setEditOpen] = useState(false)
  const cardOn = (id) => homeCardOn(settings, id)

  return (
    <div>
      {!isCurrent && <MonthlyCloseModal />}
      {refOn && <RateSheet open={rateSheetOpen} onClose={() => setRateSheetOpen(false)} settings={settings} sym={sym}
        current={refRate} onSave={saveRate} />}
      {refOn && <ConverterSheet open={convOpen} onClose={() => setConvOpen(false)} settings={settings} sym={sym}
        refRate={refRate} fresh={freshRate} onUseFresh={() => saveRate(ratePatch(freshRate))}
        onRefCurrency={(c) => updateSettings?.({ ...settings, refCurrency: c })}
        onEditRate={() => { setConvOpen(false); setRateSheetOpen(true) }}
        panelId={rateTool}
        onOpenPanel={rateTool && setPage ? () => { setConvOpen(false); setPage(rateTool) } : undefined} />}
      <MonthSheet open={sheetOpen} onClose={closeSheet} month={activeMonth} plan={plan} today={todayStr} sym={sym}
        prev={autoStart && prevHasData ? { month: prevMonthKey, balance: kpis.prev.balance } : null}
        onGoToList={setPage ? () => { closeSheet(); setPage('recurring') } : undefined} />

      {lupa ? (
        <Suspense fallback={<div className={hs.sceneFallback} aria-hidden="true" />}>
          <InicioScene series={lupaSeries} pace={lupaPace} kpis={kpis} activeMonth={activeMonth} sym={sym} incomes={incomes} expenses={expenses}
            pending={pendingSum} onReviewPending={() => setReviewOpen(true)}
            pulse={(kpis.incCount > 0 || kpis.expCount > 0) && pulse.level ? pulse : null}
            daysLeft={activeMonth === currentMonth() ? pulse.daysLeft : null}
            dualOn={dualOn} toUSD={toUSD} onOpen={setPage} refc={refc}
            healthScore={healthScore} actions={roundActions} onAsk={() => openAsk()}
            amountsHidden={!!settings.hideAmounts} onToggleAmounts={() => updateSettings?.({ ...settings, hideAmounts: !settings.hideAmounts })}
            onPickMonth={(mo) => {
              try { sessionStorage.setItem(MONTH_BROWSE_KEY, mo) } catch { /* modo privado */ }
              updateSettings?.({ ...settings, activeMonth: mo })
            }} />
        </Suspense>
      ) : (
        /* Encabezado único (UI-M8): "Inicio" y el mes que se está mirando. */
        <PageHeader title={t('home.title')} sub={monthLabel(activeMonth)} />
      )}

      <div className={`${hs.home} ${lupa ? hs.calm : ''}`}>
        <div className={hs.stack}>
          {/* Primeros pasos: arriba del contenido, solo en una cuenta nueva. */}
          <FirstSteps setPage={setPage} steps={steps} />
          <Suspense fallback={null}><LocalAlertsCard setPage={setPage} /></Suspense>
          {!lupa && (
            <HomeKpis kpis={kpis} activeMonth={activeMonth} sym={sym} dualOn={dualOn} toUSD={toUSD}
              pending={pendingSum} onReviewPending={() => setReviewOpen(true)}
              pulse={(kpis.incCount > 0 || kpis.expCount > 0) && pulse.level ? pulse : null}
              daysLeft={activeMonth === currentMonth() ? pulse.daysLeft : null}
              onOpen={setPage} refc={refc} />
          )}
          {/* Por revisar: debajo de las cifras del mes; sin pendientes no ocupa lugar. */}
          {!lupa && <ReviewInbox sym={sym} />}
          {lupa && (
            <div className={ask.cards}>
              {[
                { key: 'inc', label: t('dash.kpi.income'), raw: kpis.cur.totalInc, n: kpis.cur.incCount, filter: 'income', sign: '+', cls: ask.cardInc },
                { key: 'exp', label: t('dash.kpi.expenses'), raw: kpis.cur.totalExp, n: kpis.cur.expCount, filter: 'expense', sign: '−', cls: ask.cardExp },
              ].map(k => {
                const Tag = setPage ? 'button' : 'div'
                return (
                  <Tag key={k.key} type={setPage ? 'button' : undefined} className={`${ask.card} ${k.cls}`} data-tour={k.key === 'inc' ? 'kpi-income' : undefined}
                    onClick={setPage ? () => openMovements(k.filter) : undefined}>
                    <span className={ask.cardLabel}>{k.label}{setPage && <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />}</span>
                    <span className={`num ${ask.cardValue}`}>{k.raw > 0 ? k.sign : ''}<Money>{fmtMoney(k.raw, sym)}</Money></span>
                    <span className={ask.cardSub}>{t(`home.count.${k.n === 1 ? 'one' : 'many'}`, { n: k.n })}</span>
                  </Tag>
                )
              })}
            </div>
          )}
          {lupa && <ReviewInbox sym={sym} />}
          {lupa && <div data-tour="home-ask"><AskCard onAsk={openAsk} t={t} activeMonth={activeMonth} /></div>}

          <MonthReading kpis={kpis} expenses={expenses} budgets={budgets} pending={pendingSum} activeMonth={activeMonth} settings={settings} sym={sym} setPage={setPage} />

          {!lupa && quick.length > 0 && (
            <nav className={hs.quick} aria-label={t('dash.quick.title')} data-tour="home-quick">
              {quick.map(a => (
                <button key={a.key} type="button" className={hs.quickBtn} onClick={a.run}>
                  <span className={hs.quickIc}><a.Ic size={20} strokeWidth={1.7} aria-hidden="true" /></span>
                  <span>{a.label}</span>
                </button>
              ))}
            </nav>
          )}

          {/* "Para hacer": un aviso por vez, en orden de prioridad. Los pagos
              por confirmar y la tasa más reciente ("Usar") están en el detalle
              del héroe, a un toque. */}
          <TodoStrip>
              <Slot><SyncErrorNotice setPage={setPage} /></Slot>
              <Slot><ProChecklist setPage={setPage} suppressed={firstStepsShown} /></Slot>
              <Slot><BackupReminderBanner suppress={backupStepPending} /></Slot>
              <Slot><SafariStorageNotice /></Slot>
          </TodoStrip>

          <div className={hs.pair}>
            <UpcomingPayments rules={rules} incomes={ctx.incomes} expenses={ctx.expenses} debts={debts} subscriptions={subs} sym={sym} setPage={setPage}
              days={7} limit={3} short />
            <BudgetByCategory budgets={budgets} expenses={expenses} monthExpenses={monthExpenses}
              activeMonth={activeMonth} settings={settings} sym={sym} setPage={setPage} maxRows={3} short />
          </div>

          {/* IQ Score en una línea; su detalle vive en Panorama. */}
          <ScoreCard healthScore={healthScore} activeMonth={activeMonth} compact
            isCurrentMonth={activeMonth === currentMonth()} setPage={setPage} />

          <div className={hs.oExtra}>
            {cardOn('donut') && (
              <ChartCard title={t('dash.chart.cat.title')} subtitle={monthLabel(activeMonth)} minHeight={160}>
                {monthExpenses.some(r => Number(r?.amount) > 0)
                  ? <Suspense fallback={null}><CategoryDonut records={monthExpenses} sym={sym} maxCategories={6}
                      onCategoryClick={setPage ? (cat) => { try { sessionStorage.setItem('fos_drill_category', cat) } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ } ; setPage('movements') } : undefined}/></Suspense>
                  : <DonutEmpty />}
              </ChartCard>
            )}
            {cardOn('networth') && (
              <NetWorthCard goals={goals} debts={debts} incomes={ctx.incomes} expenses={ctx.expenses}
                settings={settings} sym={sym} setPage={setPage} />
            )}
            {cardOn('projection') && (
              <ProjectionCard incomes={incomes} expenses={expenses} activeMonth={activeMonth} pending={pendingSum}
                kpis={kpis} money={money} dualOn={dualOn} toUSD={toUSD} setPage={setPage} />
            )}
          </div>
        </div>
      </div>

      {setPage && (
        <div className={hs.homeFoot}>
          <button type="button" className={hs.homeFootBtn} onClick={() => setEditOpen(true)} aria-haspopup="dialog" data-tour="home-edit">
            <SlidersHorizontal size={16} strokeWidth={1.7} aria-hidden="true" />{t('home.edit.cta')}
          </button>
        </div>
      )}
      {lupa && (
        <AskSheet open={askOpen} q={askQ} onQ={setAskQ} onClose={() => setAskOpen(false)} sym={sym} lang={lang} setPage={setPage} t={t}
          onTour={() => requestTourReplay('dashboard')}
          data={{ kpis, monthExpenses, activeMonth }} />
      )}
      <Sheet open={editOpen} onClose={() => setEditOpen(false)} ariaLabel={t('home.edit.title')} maxWidth={420}>
        <h2 style={{ margin: '0 0 4px', fontSize: 'var(--t-headline)', fontWeight: 700, color: 'var(--tx)' }}>{t('home.edit.title')}</h2>
        <p style={{ margin: '0 0 12px', fontSize: 'var(--t-subhead)', color: 'var(--tm)', lineHeight: 1.5 }}>{t('home.edit.sub')}</p>
        {HOME_CARDS.map(id => (
          <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 52, borderBottom: '0.5px solid var(--brd)' }}>
            <span id={`home-edit-${id}`} style={{ fontSize: 'var(--t-body)', color: 'var(--tx)' }}>{t(`home.edit.card.${id}`)}</span>
            <Switch checked={cardOn(id)} labelledBy={`home-edit-${id}`}
              onChange={() => updateSettings?.({ ...settings, ...toggleHomeCard(settings, id) })} />
          </div>
        ))}
        <p style={{ margin: '12px 0 0', fontSize: 'var(--t-footnote)', color: 'var(--th)', lineHeight: 1.5 }}>{t('home.edit.note')}</p>
      </Sheet>

      {/* El aviso habla de los gráficos: en el Inicio solo aparece si la
          persona sumó alguno en "Editar Inicio" (Panorama lo muestra siempre). */}
      {HOME_CARDS.some(cardOn) && (
        <div style={{ fontSize:'var(--t-footnote)', color:'var(--th)', fontFamily: 'var(--sans)', lineHeight:1.6, marginTop:16 }}>
          {t('dash.disclaimer')}
        </div>
      )}
    </div>
  )
}
