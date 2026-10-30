// src/pages/Dashboard/index.jsx — Inicio.
// Poda P1 (aprobada por Walter el 30-oct-2026, propuesta en
// investigacion-ui-2026-10/segunda-ronda/2026-10-30-propuesta-poda.md): el
// Inicio responde UNA pregunta, "¿cuánto me queda y qué tengo que hacer?".
// Orden: Te queda (con Ingresos · Gastos en una línea) → 4 acciones rápidas →
// "Para hacer" (un aviso por vez) → pagos y cobros de 7 días → las 3
// categorías más en riesgo → IQ Score en una línea → tarjetas que la persona
// sumó en "Editar Inicio". La vista detallada de antes es Panorama (en "Más"):
// nada se borró, se movió.

import { useMemo, useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useT } from '../../i18n/useT.js'
import Sheet from '../../components/ui/Sheet.jsx'
import ChartCard from '../../components/charts/ChartCard.jsx'
import CategoryDonut from '../../components/charts/CategoryDonut.jsx'
import DonutEmpty from './DonutEmpty.jsx'
import { SCORE_LEVELS } from '../../utils/financialScore.js'
import { projectEndOfMonth } from '../../utils/projection.js'
import { isSyncEnabled, syncAvailable } from '../../core/sync.js'
import { ScoreState } from '../../components/ScoreState.jsx'
import HomeKpis from './HomeKpis.jsx'
import FirstSteps from './FirstSteps.jsx'
import { firstStepsProgress } from './firstSteps.js'
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
import { prevMonthOf } from './dashboardModel.js'
import hs from './Home.module.css'
import { currentMonth, fmtPct } from '../../utils/index.js'
import { monthLabel } from '../shared/constants.js'
import { BackupReminderBanner } from '../../components/backup/BackupManager.jsx'
import SafariStorageNotice from '../../components/backup/SafariStorageNotice.jsx'
import { PageHeader } from '../../components/ui/index.jsx'
import { Switch } from '../Settings/settingsUi.jsx'
import MonthSheet from '../../components/recurring/MonthSheet.jsx'
import { Plus, Minus, ArrowLeftRight, Upload, PiggyBank, SlidersHorizontal } from 'lucide-react'

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
  const { t } = useT()
  const {
    ctx, settings, incomes, expenses, budgets, goals, subs, debts, sym, activeMonth,
    refOn, refRate, bumpRate, dualOn, toUSD, money,
    kpis, rules, plan, pendingSum, todayStr, monthExpenses, healthScore,
  } = useHomeData()
  const updateSettings = ctx.updateSettings

  // R7/A8: un solo aviso de respaldo. Si "Primeros pasos" ya lo pide, no sale
  // la franja.
  const guide = firstStepsProgress({
    incomes: ctx.incomes, expenses: ctx.expenses, budgets: ctx.budgets,
    lastBackupAt: settings.lastBackupAt, syncOn: isSyncEnabled() && syncAvailable(),
  })
  const firstStepsShown = !settings.isDemo && !guide.complete && !!setPage
  const backupStepPending = firstStepsShown && !guide.steps.find(st => st.id === 'backup')?.done

  // Rial #20: la lente del héroe en US$ o € (settings.refCurrency).
  const lensRate = useLensRate(settings, refRate, refOn)
  setLensCurrency(refOn ? lensRate?.ref : 'USD')

  // ── Modal cierre de mes ───────────────────────────────────────────────────
  const [closeDismissed, setCloseDismissed] = useState(() => {
    try { return localStorage.getItem(`fos_close_${activeMonth}`) === '1' } catch { return false }
  })
  const isMonthClosed = (() => {
    const now = new Date()
    const [y, mo] = activeMonth.split('-').map(Number)
    return now.getFullYear() > y || (now.getFullYear() === y && now.getMonth() + 1 > mo)
  })()
  const showCloseModal = isMonthClosed && !closeDismissed && (kpis.incCount > 0 || kpis.expCount > 0)

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
    setCloseDismissed(true)
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
          <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 12, color:'var(--th)', marginBottom:8 }}>
            {t('dash.close.title')}
          </div>
          <div style={{ fontSize:20, fontWeight:700, color:'var(--tx)', marginBottom:4 }}>
            {activeMonth}
          </div>
          <div style={{ fontSize:13, color: ok ? 'var(--accent)' : 'var(--red)', fontWeight:600, marginBottom:20 }}>
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
                <div style={{ fontSize: 12, fontFamily: 'var(--sans)', fontWeight: 600, color:'var(--th)', marginBottom:3 }}>{k.label}</div>
                <div style={{ fontSize:15, fontWeight:700, fontFamily: 'var(--num)', color:k.color }}>{k.prefix||''}{k.val}</div>
              </div>
            ))}
          </div>

          {healthScore && (
            <div style={{ background:'var(--bg2)', borderRadius:10, padding:'10px 12px', marginBottom:20, display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ fontSize:28, fontWeight:700, fontFamily: 'var(--num)', color:healthScore.color }}>{healthScore.score}</div>
              <div>
                <div style={{ fontSize: 12, fontFamily: 'var(--sans)', fontWeight: 600, color:'var(--th)'}}>{t('dash.health.title')}</div>
                <ScoreState level={healthScore.level} label={healthScore.label} style={{ fontSize:13 }} />
              </div>
            </div>
          )}

          <div style={{ display:'flex', gap:10, flexDirection:'column' }}>
            <button
              onClick={goNextMonth}
              style={{ background:'var(--laton)', color:'var(--navy)', border:'none', borderRadius:9, padding:'11px 18px', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily: 'var(--num)' }}
            >
              {t('dash.close.next')}
            </button>
            <button
              onClick={dismissClose}
              style={{ background:'none', color:'var(--th)', border:'.5px solid var(--brd)', borderRadius:9, padding:'9px 18px', fontSize:12, cursor:'pointer', fontFamily: 'var(--sans)' }}
            >
              {t('dash.close.stay', { m: activeMonth })}
            </button>
          </div>
      </Sheet>
    )
  }

  // ── El Anillo Vivo (Pulso) — firma del producto, visible con datos del mes.
  const pulse = useMemo(() => {
    const { today, daysInMonth, daysLeft } = projectEndOfMonth({ incomes, expenses, activeMonth })
    // Referencia = ingreso del mes (ritmo de gasto vs ritmo del tiempo).
    const reference = kpis.totalInc > 0 ? kpis.totalInc : (kpis.totalExp || 1)
    const spent = kpis.totalExp
    const elapsedRatio = daysInMonth > 0 ? today / daysInMonth : 0
    const spentRatio = reference > 0 ? spent / reference : 0
    const pace = spentRatio - elapsedRatio
    const level = pace <= 0.02 ? 'ok' : pace <= 0.10 ? 'attention' : 'risk'
    const color = SCORE_LEVELS[level].color
    const safePerDay = daysLeft > 0 ? Math.max(0, (reference - spent) / daysLeft) : 0
    return { spentRatio, elapsedRatio, color, level, daysLeft,
             centerValue: money(safePerDay),
             refIsIncome: kpis.totalInc > 0 }
  }, [incomes, expenses, kpis.totalExp, kpis.totalInc, activeMonth, money])

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

      {/* Encabezado único (UI-M8): "Inicio" y el mes que se está mirando. */}
      <PageHeader title={t('home.title')} sub={monthLabel(activeMonth)} />

      <div className={hs.home}>
        <div className={hs.stack}>
          <HomeKpis kpis={kpis} activeMonth={activeMonth} sym={sym} dualOn={dualOn} toUSD={toUSD}
            pending={pendingSum} onReviewPending={() => setReviewOpen(true)}
            pulse={(kpis.incCount > 0 || kpis.expCount > 0) ? pulse : null}
            daysLeft={activeMonth === currentMonth() ? pulse.daysLeft : null}
            onOpen={setPage} refc={refc} />

          {quick.length > 0 && (
            <nav className={hs.quick} aria-label={t('dash.quick.title')} data-tour="home-quick">
              {quick.map(a => (
                <button key={a.key} type="button" className={hs.quickBtn} onClick={a.run}>
                  <a.Ic size={18} strokeWidth={1.7} aria-hidden="true" />
                  <span>{a.label}</span>
                </button>
              ))}
            </nav>
          )}

          {/* "Para hacer": un aviso por vez, en orden de prioridad. Los pagos
              por confirmar ya están en el héroe ("Previsto pendiente · Revisar")
              y la tasa más reciente en su fila ("Usar"). */}
          <TodoStrip>
              <Slot><FirstSteps setPage={setPage} /></Slot>
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
                  ? <CategoryDonut records={monthExpenses} sym={sym} maxCategories={6}
                      onCategoryClick={setPage ? (cat) => { try { sessionStorage.setItem('fos_drill_category', cat) } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ } ; setPage('movements') } : undefined}/>
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
      <Sheet open={editOpen} onClose={() => setEditOpen(false)} ariaLabel={t('home.edit.title')} maxWidth={420}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--tx)' }}>{t('home.edit.title')}</h2>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--tm)', lineHeight: 1.5 }}>{t('home.edit.sub')}</p>
        {HOME_CARDS.map(id => (
          <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 52, borderBottom: '0.5px solid var(--brd)' }}>
            <span id={`home-edit-${id}`} style={{ fontSize: 14, color: 'var(--tx)' }}>{t(`home.edit.card.${id}`)}</span>
            <Switch checked={cardOn(id)} labelledBy={`home-edit-${id}`}
              onChange={() => updateSettings?.({ ...settings, ...toggleHomeCard(settings, id) })} />
          </div>
        ))}
        <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--th)', lineHeight: 1.5 }}>{t('home.edit.note')}</p>
      </Sheet>

      {/* El aviso habla de los gráficos: en el Inicio solo aparece si la
          persona sumó alguno en "Editar Inicio" (Panorama lo muestra siempre). */}
      {HOME_CARDS.some(cardOn) && (
        <div style={{ fontSize:11, color:'var(--th)', fontFamily: 'var(--sans)', lineHeight:1.6, marginTop:16 }}>
          {t('dash.disclaimer')}
        </div>
      )}
    </div>
  )
}
