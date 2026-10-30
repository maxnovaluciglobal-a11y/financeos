// src/pages/Movements/index.jsx — v1.7 (B3a + poda P2)
// "Movimientos": ingresos y gastos del mes en una sola lista (decisión D-B),
// con Todos · Gastos · Ingresos, el mes ‹ › (global), totales, lente en US$ y
// los fijos del mes. El gasto detallado (subcategoría, tipo, notas, inversión,
// proyecto) y el alta de suscripción siguen siendo una entrada propia: viven en
// el menú ⋯ junto con "Exportar" y la moneda (lista de protección).
// Poda P2 (30-oct-2026, "¿Qué pasó este mes?"): dos filas antes de la lista.
//   1) Tipo · lupa · calendario · ⋯      2) ‹ mes › con los totales · Filtrar
// Los chips de origen y categoría pasaron a la hoja "Filtrar"; el filtro activo
// queda a la vista como chip quitable. El donut "Por categoría" (que deja el
// Inicio) abre con el resumen, y tocar una porción filtra la lista.

import { useState, useMemo, useEffect, useRef } from 'react'
import SignalIcon, { InlineIcon } from '../../components/icons/SignalIcon.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import MoneyFlow from '../../components/charts/MoneyFlow.jsx'
import ChartCard from '../../components/charts/ChartCard.jsx'
import HorizontalBars from '../../components/charts/HorizontalBars.jsx'
import CategoryDonut from '../../components/charts/CategoryDonut.jsx'
import { parseTransactionText } from '../../utils/smsParser.js'
import { catLabel, catName, subLabel, expSubcatLabel, dateLocale, getCategoriesExpense, getCategoriesIncome, currentMonth, localDateStr, METHODS, methodLabel, currencySymbol, fmtSignedMoney, fmtMoney, fmtPct, monthYearLabel } from '../../utils/index.js'
import { monthPlan, pendingTotals, toLocal } from '../../utils/recurring.js'
import OccurrenceRow from '../../components/recurring/OccurrenceRow.jsx'
import { useOccurrenceActions } from '../../components/recurring/useOccurrenceActions.js'
import rs from '../../components/recurring/recurring.module.css'
import { FormGroup, KPI, Alert, Empty, EmptyState, PageHeader } from '../../components/ui/index.jsx'
import { ArrowLeftRight, CalendarDays, ChevronDown, Download, Ellipsis, Search, SlidersHorizontal, X } from 'lucide-react'
import Sheet from '../../components/ui/Sheet.jsx'
import CategoryIcon from '../../components/CategoryIcon.jsx'
import Amount from '../../components/Amount.jsx'
import MovementsList from './MovementsList.jsx'
import MovementSheet from './MovementSheet.jsx'
import DaySheet from './DaySheet.jsx'
import MonthCalendar from '../../components/calendar/MonthCalendar.jsx'
import UndatedPlanned from '../../components/calendar/UndatedPlanned.jsx'
import { buildCalendar, weekStartFor } from '../../components/calendar/calendarModel.js'
import ms from './movements.module.css'
import { openQuickAdd } from '../../components/quickAddBus.js'
import Money, { useMoney } from '../../components/Money.jsx'
import MonthSelector from '../shared/MonthSelector.jsx'
import { closeKeyToDismiss, shiftMonth } from '../shared/monthNav.js'
import { refEligible, resolveRefRate, SOURCE_LABEL, REF_CURRENCY } from '../../utils/refRate.js'
import { mergeMovements, monthTotals, lensState, inLens, parseExpensePrefill, PREFILL_KEY, normType, filterMovements, categoriesByAmount } from './movementsList.js'
import { ORIGIN_KINDS, toggleKind, toggleCategory, activeFilters, clearFilter, searchVisible, toggleSearch, donutPick, donutRecords } from './movementsFilters.js'

// Filtro de tipo preseleccionado desde otra pantalla (Ingresos, Inicio, Menú):
// sessionStorage['fos_mov_filter'] = 'income' | 'expense' | 'all', igual que
// fos_drill_category. Se lee al montar y se borra.
export const MOV_FILTER_KEY = 'fos_mov_filter'
const readSession = (k) => { try { return sessionStorage.getItem(k) } catch { return null } }
const dropSession = (k) => { try { sessionStorage.removeItem(k) } catch { /* almacenamiento no disponible */ } }
const readLocal = (k) => { try { return localStorage.getItem(k) } catch { return null } }

// Vista Lista | Calendario (B3b): se recuerda en este dispositivo (por cuenta,
// como el resto de las claves fos_*). Por defecto, la lista.
export const MOV_VIEW_KEY = 'fos_mov_view'

// ── Helpers ───────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const todayStr = () => localDateStr()

function toMonthly(amount, frequency) {
  switch (frequency) {
    case 'weekly':    return amount * 4.33
    case 'quarterly': return amount / 3
    case 'annual':
    case 'anual':     return amount / 12
    default:          return amount
  }
}
function toAnnual(amount, frequency) {
  switch (frequency) {
    case 'weekly':    return amount * 52
    case 'quarterly': return amount * 4
    case 'annual':
    case 'anual':     return amount
    default:          return amount * 12
  }
}

// Fecha corta de la tasa ("29 oct") en el idioma de la interfaz.
function fmtRateDay(at) {
  try { return new Date(at).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }) } catch { return '' }
}

// Con los decimales de la moneda y signo "−" si el saldo queda negativo.
const fmtMRaw = (n, sym) => fmtSignedMoney(n, sym)

// La lista de categorías vive en utils/index.js (CATS_EXPENSE) — es la fuente
// compartida con Budgets, para que un presupuesto siempre pueda matchear gasto real.
const SUBCATS = {
  'Alimentación':  ['Supermercado','Delivery','Restaurante','Café / Bar','Panadería','Feria / Mercado','Otro'],
  'Vivienda':      ['Arriendo / Hipoteca','Agua','Luz','Gas','Internet','Seguros hogar','Reparaciones','Otro'],
  'Transporte':    ['Gasolina / Bencina','Taxi / Uber','Transporte público','Estacionamiento','Mantención auto','Peaje','Otro'],
  'Salud':         ['Farmacia','Médico / Consulta','Dentista','Psicología','Exámenes','Seguro médico','Gym / Fitness','Otro'],
  'Educación':     ['Matrícula / Mensualidad','Cursos online','Libros','Material escolar','Certificaciones','Otro'],
  'Ropa':          ['Ropa casual','Calzado','Ropa deportiva','Accesorios','Ropa de trabajo','Otro'],
  'Entretención':  ['Streaming','Cine','Conciertos / Eventos','Videojuegos','Salidas / Bares','Otro'],
  'Servicios':     ['Telefonía','Suscripción software','Limpieza hogar','Lavandería','Otro'],
  'Tecnología':    ['Celular / Accesorios','Computador','Electrónica','Apps / Software','Otro'],
  'Deporte':       ['Cuota gym','Equipamiento','Clases','Membresía club','Otro'],
  'Viajes':        ['Vuelos','Hotel / Alojamiento','Tours','Comida en viaje','Seguros viaje','Otro'],
  'Otros':         ['Regalo','Donación','Multa','Impuesto','Otro'],
}
const SUB_CATS = ['Streaming','Música','Software','Gimnasio','Seguro',
  'Educación','Cloud','Delivery','Suscripción','Productividad','Otros']
// Métodos de pago: lista única en config.paymentMethods (METHODS en utils)
// label = key de traducción (el value guardado no cambia)
const FREQS    = [
  { value:'monthly',   label:'mov.freq.monthly' },
  { value:'annual',    label:'mov.freq.annual' },
  { value:'quarterly', label:'mov.freq.quarterly' },
  { value:'weekly',    label:'mov.freq.weekly' },
]
// ── Formulario Gasto ──────────────────────────────────────────────────────────
function FormGasto({ onSave, onCancel, sym, projects = [], onImport, settings, initial }) {
  const { t, lang } = useT()
  // initial: prellenado del alta rápida ("Más detalles", B4a), ya validado.
  const [f, setF] = useState(() => ({
    description:'', amount:'', date:todayStr(),
    category:'Alimentación', subcategory:'', method:'Débito', type:'Necesidad', notes:'', project:'',
    ...(initial || {}),
  }))
  const set = (k,v) => setF(p => ({ ...p, [k]:v }))
  const categoriesExpense = getCategoriesExpense(settings)
  const inp = { background:'var(--sur)', border:'.5px solid var(--brd)', borderRadius:6,
    padding:'7px 10px', fontSize:13, color:'var(--tx)', width:'100%',
    boxSizing:'border-box', fontFamily: 'var(--sans)' }
  const lbl = { fontSize: 12, color:'var(--th)', fontFamily: 'var(--sans)', fontWeight: 600,
    marginBottom:3, display:'block' }

  const subcatOptions = SUBCATS[f.category] || []

  function handleCatChange(e) {
    set('category', e.target.value)
    set('subcategory', '') // reset subcategory when category changes
  }

  // ── Pegar SMS/notificación del banco → prellenar el formulario ──────────────
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteMsg, setPasteMsg] = useState(null) // {ok:bool, text:string}

  function detectFromPaste() {
    const r = parseTransactionText(pasteText)
    if (!r || (r.amount == null && !r.merchant)) {
      setPasteMsg({ ok:false, text:t('mov.form.pasteFail') })
      return
    }
    if (r.amount != null) set('amount', String(r.amount))
    if (r.merchant) set('description', r.merchant)
    if (r.date) set('date', r.date)
    setPasteMsg({ ok:true, text: r.confidence === 'high' ? t('mov.form.pasteOk') : t('mov.form.pastePartial') })
    setShowPaste(false)
  }

  return (
    <div style={{ background:'var(--sur)', border:'.5px solid var(--brd)',
      borderRadius:'var(--r)', padding:'16px', marginBottom:12 }}>
      <div style={{ fontSize:13, fontWeight:600, color:'var(--tx)', marginBottom:12 }}>
        {t('mov.form.expTitle')}
      </div>

      {onImport && (
        <button type="button" onClick={onImport}
          style={{ background:'none', border:'none', padding:0, marginBottom:4, minHeight:44, fontSize:12, fontFamily:'var(--sans)', color:'var(--accent)', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center' }}>
          <InlineIcon kind="upload" size={13} />{t('common.importShortcut')}
        </button>
      )}
      {/* Pegar SMS/notificación del banco */}
      <div style={{ marginBottom:12 }}>
        {!showPaste ? (
          <button type="button" onClick={() => { setShowPaste(true); setPasteMsg(null) }}
            style={{ background:'var(--sur2)', border:'.5px dashed var(--brd2)', borderRadius:6,
              padding:'7px 12px', fontSize:12, color:'var(--tm)', cursor:'pointer', width:'100%', textAlign:'left' }}>
            {t('mov.form.pasteBtn')}
          </button>
        ) : (
          <div style={{ background:'var(--sur2)', border:'.5px solid var(--brd2)', borderRadius:8, padding:10 }}>
            <label style={lbl}>{t('mov.form.pasteLabel')}</label>
            <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={3}
              placeholder={t('mov.form.pastePh')}
              style={{ ...inp, fontFamily:'var(--sans)', resize:'vertical' }} />
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button type="button" onClick={detectFromPaste} disabled={!pasteText.trim()}
                style={{ background:'var(--laton)', color:'var(--navy)', border:'none', borderRadius:6,
                  padding:'6px 14px', fontSize:12, fontWeight:600, cursor: pasteText.trim() ? 'pointer' : 'default', opacity: pasteText.trim() ? 1 : .5 }}>
                {t('mov.form.detect')}
              </button>
              <button type="button" onClick={() => { setShowPaste(false); setPasteText('') }}
                style={{ background:'none', border:'.5px solid var(--brd)', borderRadius:6,
                  padding:'6px 14px', fontSize:12, color:'var(--th)', cursor:'pointer' }}>
                {t('common.cancel')}
              </button>
            </div>
            <div style={{ fontSize:11, color:'var(--th)', fontFamily: 'var(--sans)', marginTop:6, lineHeight:1.5 }}>
              {t('mov.form.pasteLocal')}
            </div>
          </div>
        )}
        {pasteMsg && (
          <div style={{ marginTop:8, fontSize:11, color: pasteMsg.ok ? 'var(--grn)' : 'var(--red)', fontFamily: 'var(--sans)' }}>
            <InlineIcon kind={pasteMsg.ok ? 'ok' : 'alert'} size={13} />{pasteMsg.text}
          </div>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10, marginBottom:10 }}>
        <FormGroup label={t('mov.form.desc')}>
          <input style={inp} value={f.description} placeholder={t('mov.form.descPh')}
            onChange={e => set('description', e.target.value)}/></FormGroup>
        <FormGroup label={t('mov.form.amount', { sym })}>
          <input style={inp} type="number" inputMode="decimal" min="0" step="any" value={f.amount} placeholder="0"
            onChange={e => set('amount', e.target.value)}/></FormGroup>
        <FormGroup label={t('mov.form.date')}>
          <input style={inp} type="date" value={f.date}
            onChange={e => set('date', e.target.value)}/></FormGroup>
        <FormGroup label={t('mov.form.category')}>
          <select style={inp} value={f.category} onChange={handleCatChange}>
            {categoriesExpense.map(c => <option key={c} value={c}>{catLabel(c, lang)}</option>)}
          </select>
        </FormGroup>
        {subcatOptions.length > 0 && (
          <div style={{ gridColumn:'1 / -1' }}>
            <label style={lbl}>
              {t('mov.form.subcat')} <span style={{ color:'var(--accent)', fontSize:11 }}>{t('mov.form.optional')}</span>
            </label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              {subcatOptions.map(sc => (
                <button key={sc} type="button"
                  onClick={() => set('subcategory', f.subcategory === sc ? '' : sc)}
                  style={{
                    padding:'4px 10px', borderRadius:16, fontSize:11, cursor:'pointer',
                    fontFamily:'var(--sans)', border:`.5px solid ${f.subcategory === sc ? 'var(--accent)' : 'var(--brd2)'}`,
                    background: f.subcategory === sc ? 'var(--accent-bg)' : 'var(--sur2)',
                    color: f.subcategory === sc ? 'var(--accent)' : 'var(--th)',
                    fontWeight: f.subcategory === sc ? 600 : 400,
                    transition:'.12s',
                  }}>
                  {expSubcatLabel(sc, lang)}
                </button>
              ))}
            </div>
          </div>
        )}
        <FormGroup label={t('mov.form.method')}>
          <select style={inp} value={f.method} onChange={e => set('method', e.target.value)}>
            {METHODS.map(m => <option key={m} value={m}>{methodLabel(m, lang)}</option>)}</select></FormGroup>
        <FormGroup label={t('mov.form.type')}>
          <select style={inp} value={f.type} onChange={e => set('type', e.target.value)}>
            <option value="Necesidad">{t('mov.form.typeNeed')}</option><option value="Deseo">{t('mov.form.typeWant')}</option></select></FormGroup>
      </div>
      <label style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:12, color:'var(--tm)', cursor:'pointer', marginBottom:12, lineHeight:1.4 }}>
        <input type="checkbox" checked={!!f.inv} onChange={e => set('inv', e.target.checked)} style={{ width:16, height:16, flexShrink:0, marginTop:1 }} />
        <span style={{ minWidth:0 }}>{t('mov.form.invCheck')}</span>
      </label>
      <div style={{ marginBottom:12 }}>
        <FormGroup label={t('mov.form.project')}>
          <input style={inp} list="fnos-projects-exp" value={f.project} placeholder={t('mov.form.projectPh')}
            onChange={e => set('project', e.target.value)}/>
        </FormGroup>
        {/* eslint-disable-next-line jsx-a11y/control-has-associated-label -- datalist suggestion: per HTML an option without text is labelled by its value, which is the project name itself */}
        <datalist id="fnos-projects-exp">{projects.map(p => <option key={p} value={p} />)}</datalist>
      </div>
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <button onClick={onCancel} style={{ background:'none', border:'.5px solid var(--brd)',
          borderRadius:6, padding:'6px 14px', fontSize:12, color:'var(--th)', cursor:'pointer' }}>
          {t('common.cancel')}
        </button>
        <button onClick={() => {
          if (!f.description.trim() || !f.amount) return
          onSave({ ...f, id:uid(), amount:parseFloat(f.amount)||0,
            createdAt:new Date().toISOString() })
        }} style={{ background:'var(--laton)', color:'var(--navy)', border:'none',
          borderRadius:6, padding:'6px 16px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
          {t('mov.form.saveExp')}
        </button>
      </div>
    </div>
  )
}

// ── Formulario Suscripción ────────────────────────────────────────────────────
function FormSub({ onSave, onCancel }) {
  const { t, lang } = useT()
  const [f, setF] = useState({
    name:'', amount:'', frequency:'monthly', category:'Streaming',
    status:'active', notes:'', nextPaymentDate:''
  })
  const set = (k,v) => setF(p => ({ ...p, [k]:v }))
  const inp = { background:'var(--sur)', border:'.5px solid var(--brd)', borderRadius:6,
    padding:'7px 10px', fontSize:13, color:'var(--tx)', width:'100%',
    boxSizing:'border-box', fontFamily: 'var(--sans)' }

  return (
    <div style={{ background:'var(--sur)', border:'.5px solid var(--brd)',
      borderRadius:'var(--r)', padding:'16px', marginBottom:12 }}>
      <div style={{ fontSize:13, fontWeight:600, color:'var(--tx)', marginBottom:12 }}>
        {t('mov.form.subTitle')}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10, marginBottom:10 }}>
        <FormGroup label={t('mov.form.name')}>
          <input style={inp} value={f.name} placeholder={t('mov.form.namePh')}
            onChange={e => set('name', e.target.value)}/></FormGroup>
        <FormGroup label={t('mov.form.amountSimple')}>
          <input style={inp} type="number" inputMode="decimal" value={f.amount} placeholder="0"
            onChange={e => set('amount', e.target.value)}/></FormGroup>
        <FormGroup label={t('mov.form.freq')}>
          <select style={inp} value={f.frequency} onChange={e => set('frequency', e.target.value)}>
            {FREQS.map(fr => <option key={fr.value} value={fr.value}>{t(fr.label)}</option>)}
          </select></FormGroup>
        <FormGroup label={t('mov.form.category')}>
          <select style={inp} value={f.category} onChange={e => set('category', e.target.value)}>
            {SUB_CATS.map(c => <option key={c} value={c}>{subLabel(c, lang)}</option>)}</select></FormGroup>
        <FormGroup label={t('mov.form.nextPay')}>
          <input style={inp} type="date" value={f.nextPaymentDate}
            onChange={e => set('nextPaymentDate', e.target.value)}/></FormGroup>
      </div>
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <button onClick={onCancel} style={{ background:'none', border:'.5px solid var(--brd)',
          borderRadius:6, padding:'6px 14px', fontSize:12, color:'var(--th)', cursor:'pointer' }}>
          {t('common.cancel')}
        </button>
        <button onClick={() => {
          if (!f.name.trim() || !f.amount) return
          onSave({ ...f, id:uid(), amount:parseFloat(f.amount)||0,
            createdAt:new Date().toISOString() })
        }} style={{ background:'var(--laton)', color:'var(--navy)', border:'none',
          borderRadius:6, padding:'6px 16px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
          {t('mov.form.saveSub')}
        </button>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Movements({ setPage }) {
  const ctx           = useApp() || {}
  const { t, lang }   = useT()
  const incomes       = useMemo(() => (Array.isArray(ctx.incomes) ? ctx.incomes : []), [ctx.incomes])
  const expenses      = useMemo(() => (Array.isArray(ctx.expenses) ? ctx.expenses : []), [ctx.expenses])
  const subscriptions = useMemo(() => (Array.isArray(ctx.subscriptions) ? ctx.subscriptions : []), [ctx.subscriptions])
  const settings      = useMemo(() => ctx.settings || {}, [ctx.settings])
  const addExpense      = ctx.addExpense
  const delExpense      = ctx.delExpense
  const updateExpense   = ctx.updateExpense
  const addSubscription    = ctx.addSubscription
  const deleteWithUndo     = ctx.deleteWithUndo
  const updateIncome       = ctx.updateIncome
  const exportCSV          = ctx.exportCSV

  const sym         = currencySymbol(settings.currency, settings.language)
  // Ocultar montos (T13): toda cifra de esta pantalla pasa por fmtL → m().
  const { m } = useMoney()
  const activeMonth = settings.activeMonth || currentMonth()
  const categoriesExpense = useMemo(() => getCategoriesExpense(settings), [settings])

  // Prellenado del gasto detallado desde el alta rápida (contrato B4a): si
  // existe, abre FormGasto con esos datos. Se lee en el initializer y se borra
  // en un efecto (StrictMode monta 2× en dev, como fos_drill_category).
  const [prefill] = useState(() => parseExpensePrefill(readSession(PREFILL_KEY), {
    categories: getCategoriesExpense(ctx.settings || {}), methods: METHODS, today: todayStr(),
  }))
  useEffect(() => { dropSession(PREFILL_KEY) }, [])

  const [showGasto, setShowGasto] = useState(() => !!prefill)
  const [showSub,   setShowSub]   = useState(false)
  const [openExp,   setOpenExp]   = useState(null)     // detalle en hoja (UI-M3): ítem { kind, rec }
  const [showSummary, setShowSummary] = useState(false) // resumen plegado: la lista primero
  // Poda P2: menú ⋯, hoja "Filtrar", lupa y filtros que antes vivían en la lista.
  const [moreOpen, setMoreOpen]     = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery]           = useState('')
  const [kind, setKind]             = useState('all') // origen: 'all' | 'oneoff' | 'fixed'
  const formsRef  = useRef(null)
  const searchRef = useRef(null)

  // Filtro de categoría por drilldown desde el Dashboard (donut clicable)
  // NB: no se borra en el initializer (StrictMode monta 2× en dev y perdería el valor)
  const [drillCat, setDrillCat] = useState(() => {
    try { return sessionStorage.getItem('fos_drill_category') || null } catch { return null }
  })
  useEffect(() => {
    try { sessionStorage.removeItem('fos_drill_category') } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ }
  }, [])

  // Todos · Gastos · Ingresos (B3a). El drilldown del donut es de gastos.
  const [type, setType] = useState(() => {
    const preset = readSession(MOV_FILTER_KEY)
    if (preset) return normType(preset)
    return drillCat ? 'expense' : 'all'
  })
  useEffect(() => { dropSession(MOV_FILTER_KEY) }, [])
  const pickType = (v) => { setType(v); setDrillCat(null) }
  const filterState = { kind, category: drillCat }
  const applyFilters = (next) => { setKind(next.kind); setDrillCat(next.category) }
  const clearAllFilters = () => { applyFilters(clearFilter(filterState, 'all')); setQuery('') }

  // Mes ‹ ›: cambia el mes GLOBAL. Elegir un mes pasado marca su cierre como
  // visto para que el Inicio no abra la hoja de cierre sin motivo.
  const beforeMonthChange = (next) => {
    const key = closeKeyToDismiss(next, currentMonth())
    if (key) { try { localStorage.setItem(key, '1') } catch { /* modo privado */ } }
  }

  // Lente de moneda (R12): el mismo interruptor VES/USD del Inicio.
  const [refMode, setRefModeState] = useState(() => (readLocal('fos_home_refcur') === 'ref' ? 'ref' : 'local'))
  const setRefMode = (v) => { setRefModeState(v); try { localStorage.setItem('fos_home_refcur', v) } catch { /* modo privado */ } }
  const eligible = refEligible(settings)
  const refRate = useMemo(() => (eligible ? resolveRefRate(settings, readLocal) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [eligible, settings.usdRate, settings.usdRateAt, settings.usdRateSource, settings.country, settings.currency])
  const lens = useMemo(() => lensState({ eligible, rate: refRate, mode: refMode }), [eligible, refRate, refMode])
  const usdSym = currencySymbol(REF_CURRENCY, settings.language)
  const lsym = lens.on ? usdSym : sym
  // Cifra en la lente activa, con "ocultar montos".
  const fmtL = (n) => m(fmtMRaw(inLens(n, lens), lsym))

  const [view, setViewState] = useState(() => (readLocal(MOV_VIEW_KEY) === 'cal' ? 'cal' : 'list'))
  const setView = (v) => { setViewState(v); try { localStorage.setItem(MOV_VIEW_KEY, v) } catch { /* modo privado */ } }
  const [openDay, setOpenDay] = useState(null) // fecha 'YYYY-MM-DD' con la hoja del día abierta

  // ── Cálculos ─────────────────────────────────────────────────────────────────
  const monthExp   = useMemo(() =>
    expenses.filter(e => e?.date?.startsWith(activeMonth))
      .sort((a,b) => new Date(b.date) - new Date(a.date))
  , [expenses, activeMonth])

  const monthInc   = useMemo(() =>
    incomes.filter(r => r?.date?.startsWith(activeMonth))
  , [incomes, activeMonth])

  // Lista unificada (D-B): ingresos y gastos del mes, más reciente primero.
  const items = useMemo(() => mergeMovements(monthExp, monthInc), [monthExp, monthInc])
  const totals = useMemo(() => monthTotals(items), [items])
  const categoriesIncome = useMemo(() => getCategoriesIncome(settings), [settings])
  // Categorías del tipo elegido, de mayor a menor (los chips de la hoja "Filtrar").
  const ofType = useMemo(() => filterMovements(items, { type }), [items, type])
  const filterCats = useMemo(() => categoriesByAmount(ofType), [ofType])
  const resultCount = useMemo(
    () => filterMovements(ofType, { query, category: drillCat, kind, catNameOf: (c) => catName(c, lang) }).length,
    [ofType, query, drillCat, kind, lang])
  const active = activeFilters(filterState)
  const searchShown = view === 'list' && searchVisible({ open: searchOpen, query })

  const activeSubs = useMemo(() =>
    subscriptions.filter(s => s?.status === 'active')
  , [subscriptions])

  const totalInc   = useMemo(() =>
    incomes.filter(r => r?.date?.startsWith(activeMonth))
      .reduce((s,r) => s + (Number(r.amount)||0), 0)
  , [incomes, activeMonth])

  const totalExp   = useMemo(() =>
    monthExp.reduce((s,e) => s + (Number(e.amount)||0), 0)
  , [monthExp])

  const invExp     = useMemo(() =>
    monthExp.filter(e => e.inv).reduce((s,e) => s + (Number(e.amount)||0), 0)
  , [monthExp])

  // Flujos PERSONALES del mes (excluyen inversión 💼) — para el "Disponible", coherente con el Dashboard
  const invInc     = useMemo(() =>
    incomes.filter(r => r?.date?.startsWith(activeMonth) && r.inv).reduce((s,r) => s + (Number(r.amount)||0), 0)
  , [incomes, activeMonth])
  const personalInc = totalInc - invInc
  const personalExp = totalExp - invExp

  // Nombres de propiedades/proyectos ya usados (autocompletar en el form)
  const projectOptions = useMemo(() => [...new Set([...incomes, ...expenses].map(r => r?.project).filter(Boolean))], [incomes, expenses])

  const totalSubs  = useMemo(() =>
    activeSubs.reduce((s,sub) => s + toMonthly(Number(sub.amount)||0, sub.frequency), 0)
  , [activeSubs])

  const totalAnnual = useMemo(() =>
    activeSubs.reduce((s,sub) => s + toAnnual(Number(sub.amount)||0, sub.frequency), 0)
  , [activeSubs])

  // Movimientos fijos del mes: suscripciones, cuotas y fijos manuales son
  // reglas (unificación 08-oct-2026). Lo previsto NO se suma a lo real: antes
  // el "Disponible" restaba siempre suscripciones y cuotas, y un gasto que
  // además estaba registrado se contaba dos veces.
  const rules = useMemo(() => (Array.isArray(ctx.recurring) ? ctx.recurring : []), [ctx.recurring])
  const todayStr2 = localDateStr()
  const plan = useMemo(() => monthPlan(rules, activeMonth, { incomes, expenses, today: todayStr2 }), [rules, activeMonth, incomes, expenses, todayStr2])
  const fixedExp = useMemo(() => plan.filter(o => o.kind === 'expense'), [plan])
  const pendingFixed = pendingTotals(plan).expense
  const { confirm, skip, unskip, live } = useOccurrenceActions()

  // Calendario (B3b + D4): lo real por día con el filtro de tipo y
  // la lente; lo previsto de hoy en adelante, aparte. Los chips de categoría
  // son de la lista: el calendario no filtra por algo que no se ve. La semana
  // empieza según el país de Ajustes o el idioma.
  const calLocale = dateLocale()
  const weekStart = useMemo(() => weekStartFor(calLocale, settings.country), [calLocale, settings.country])
  const calendar = useMemo(() => {
    if (view !== 'cal') return null
    return buildCalendar({
      ym: activeMonth, items, plan, today: todayStr2, type, weekStart,
      debts: ctx.debts || [], subscriptions, amount: (n) => inLens(n, lens),
    })
  }, [view, items, activeMonth, plan, todayStr2, type, weekStart, ctx.debts, subscriptions, lens])
  const dayCell = useMemo(() => (calendar && openDay ? calendar.weeks.flat().find(c => c && c.date === openDay) || null : null), [calendar, openDay])
  // En el calendario se puede avanzar un mes más allá de los datos: es donde se
  // ve lo que viene ("por pagar", rial #46). El selector solo mira las fechas.
  const navExpenses = useMemo(() => (view === 'cal' ? [...expenses, { date: `${shiftMonth(currentMonth(), 1)}-01` }] : expenses), [view, expenses])

  // Disponible PERSONAL = ingresos personales − gastos personales (solo lo real,
  // igual que "Te queda" del Inicio; excluye inversión 💼).
  const balance      = personalInc - personalExp

  // Datos para gráficos — solo gastos REGISTRADOS del mes. Antes se sumaban
  // además las suscripciones activas: una suscripción también registrada como
  // gasto (el gimnasio, Netflix) aparecía dos veces y el total quedaba inflado.
  // Donut "Por categoría" (poda P2: el que deja el Inicio, con la lente).
  const catRecords = useMemo(() => donutRecords(monthExp, (n) => inLens(n, lens)), [monthExp, lens])

  const topBarRecords = useMemo(() => {
    const items = [
      // La barra muestra la descripción del gasto (sin emoji: un solo sistema de ícono, UI-M4).
      ...monthExp.map(e => ({ category: e.description || catName(e.category, lang), amount: inLens(Number(e.amount)||0, lens) })),
    ]
    return items.sort((a,b) => b.amount-a.amount).slice(0,8)
  }, [monthExp, lang, lens])

  // Alertas de suscripciones
  const alerts = useMemo(() => {
    const al = []
    const catGroups = {}
    activeSubs.forEach(s => { catGroups[s.category] = [...(catGroups[s.category]||[]), s] })
    Object.entries(catGroups).forEach(([cat, items]) => {
      if (items.length >= 2) al.push({ type:'dup', msg:t('mov.alert.dup', { n: items.length, cat }) })
    })
    if (totalInc > 0 && totalSubs/totalInc > 0.15)
      al.push({ type:'income', msg:t('mov.alert.income', { pct: fmtPct(totalSubs/totalInc) }) })
    const todayD = new Date(), in7 = new Date(); in7.setDate(todayD.getDate()+7)
    activeSubs.filter(s=>s.nextPaymentDate).forEach(s => {
      const d = toLocal(s.nextPaymentDate)
      if (d >= todayD && d <= in7)
        al.push({ type:'upcoming', msg:t('mov.alert.upcoming', { name: s.name, date: d.toLocaleDateString(dateLocale()) }) })
    })
    return al
  }, [activeSubs, totalSubs, totalInc, t])

  // ── Handlers ─────────────────────────────────────────────────────────────────
  async function handleSaveGasto(item) {
    if (addExpense) await addExpense(item)
    setShowGasto(false)
  }
  async function handleSaveSub(item) {
    if (addSubscription) await addSubscription(item)
    setShowSub(false)
  }

  // Menú ⋯ → formulario: se cierra la hoja y se lleva la vista al formulario
  // (después de que la hoja devuelve el foco al botón ⋯).
  function openForm(which) {
    setMoreOpen(false)
    setShowGasto(which === 'gasto'); setShowSub(which === 'sub')
    setTimeout(() => {
      const el = formsRef.current
      el?.scrollIntoView?.({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
      el?.focus?.({ preventScroll: true })
    }, 60)
  }
  function onSearchBtn() {
    const next = toggleSearch({ open: searchShown, query })
    setSearchOpen(next)
    if (next) setTimeout(() => searchRef.current?.focus?.(), 0)
  }
  // Porción del donut → filtra la lista por esa categoría.
  function onDonutCategory(cat) {
    const next = donutPick({ type, view }, cat)
    setType(next.type)
    if (next.view !== view) { setView(next.view); setOpenDay(null) }
    setDrillCat(next.category)
  }
  const filterLabel = (f) => (f.id === 'kind' ? t(`movl.filter.${f.value}`) : catName(f.value, lang))

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* Encabezado único (UI-M3/M8): "Movimientos", como la pestaña. Sin
          subtítulo desde la poda P2: el mes y el tipo ya están en las filas 1 y 2. */}
      <PageHeader title={t('mov.title')} />

      {/* Fila 1 (poda P2): tipo · lupa · calendario · ⋯. El tipo es de la lista y del calendario. */}
      <div className={ms.controls} data-tour="mov-type">
        <div className={ms.seg} role="group" aria-label={t('movl.type.label')}>
          {['all', 'expense', 'income'].map(v => (
            <button key={v} type="button" className={ms.segOpt} aria-pressed={type === v} onClick={() => pickType(v)}>
              {t(`movl.type.${v}`)}
            </button>
          ))}
        </div>
        <div className={ms.ctrlIcons}>
          {/* Lupa: abre el buscador; con una búsqueda escrita queda visible. Solo en la lista. */}
          {view === 'list' && (
            <button type="button" className={ms.iconBtn} aria-label={t('movl.search.label')} title={t('movl.search.label')}
              aria-expanded={searchShown} aria-controls="mov-search" onClick={onSearchBtn}>
              <Search size={18} strokeWidth={1.7} aria-hidden="true" />
            </button>
          )}
          {/* Lista | Calendario (B3b): un botón de 44 px; la palabra solo con ancho de sobra. */}
          <button type="button" className={ms.viewBtn} aria-pressed={view === 'cal'}
            aria-label={t('movl.cal.toggle')} title={t('movl.cal.toggleHint')}
            onClick={() => { setView(view === 'cal' ? 'list' : 'cal'); setOpenDay(null) }}>
            <CalendarDays size={18} strokeWidth={1.7} aria-hidden="true" />
            <span className={ms.viewBtnWord} aria-hidden="true">{t('movl.cal.toggle')}</span>
          </button>
          {/* ⋯: gasto detallado, suscripción, exportar y la moneda (antes en la barra de la lista). */}
          <button type="button" className={ms.iconBtn} data-tour="mov-add" aria-label={t('mov.more')} title={t('mov.more')}
            aria-haspopup="dialog" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}>
            <Ellipsis size={18} strokeWidth={1.7} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Fila 2: ‹ mes › (GLOBAL: también mueve el Inicio y Presupuestos) con los
          totales del mes; tocarlos abre el resumen y el donut. Luego "Filtrar". */}
      <div className={ms.monthRow}>
        <MonthSelector variant="stepper" incomes={incomes} expenses={navExpenses} onBeforeChange={beforeMonthChange} />
        <button type="button" className={ms.totals} aria-expanded={showSummary} aria-controls="mov-summary"
          onClick={() => setShowSummary(v => !v)} data-tour="mov-kpis">
          <span className={ms.totalsMain}>
            <span className={ms.summaryItem}>
              <span className="sr-only">{t('movl.type.income')}</span>
              <Amount className={`${ms.summaryTotal} ${ms.summaryIn}`} value={inLens(totals.income, lens)} sym={lsym} plus />
            </span>
            <span aria-hidden="true" className={ms.totalsSep}>·</span>
            <span className={ms.summaryItem}>
              <span className="sr-only">{t('movl.type.expense')}</span>
              <Amount className={ms.summaryTotal} value={-inLens(totals.expense, lens)} sym={lsym} />
            </span>
          </span>
          <span className="sr-only">{showSummary ? t('movl.summary.hide') : t('movl.summary.show')}</span>
          <ChevronDown className={ms.totalsChevron} size={16} strokeWidth={1.7} aria-hidden="true" />
        </button>
        {view === 'list' && (
          <button type="button" className={ms.viewBtn} aria-label={t('mov.filter.btn')} title={t('mov.filter.btn')}
            aria-haspopup="dialog" aria-expanded={filterOpen} onClick={() => setFilterOpen(true)}>
            <SlidersHorizontal size={18} strokeWidth={1.7} aria-hidden="true" />
            <span className={ms.viewBtnWord} aria-hidden="true">{t('mov.filter.btn')}</span>
          </button>
        )}
      </div>

      {/* Buscador (la lupa lo abre; con texto escrito no se esconde). */}
      {searchShown && (
        <div className={ms.search} role="search" id="mov-search">
          <Search size={16} strokeWidth={1.7} aria-hidden="true" />
          <input ref={searchRef} type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={t('movl.search.ph')} aria-label={t('movl.search.label')} />
        </div>
      )}

      {/* Filtro activo como chip quitable: un toque lo quita. */}
      {view === 'list' && active.length > 0 && (
        <div className={ms.chips} role="group" aria-label={t('mov.filter.active')}>
          {active.map(f => (
            <button key={f.id} type="button" className={`fos-chip ${ms.chipOn}`} onClick={() => applyFilters(clearFilter(filterState, f.id))}>
              {f.id === 'category' && <CategoryIcon category={f.value} size={20} />}
              <span className="sr-only">{t('mov.filter.remove')} </span>{filterLabel(f)}
              <X size={14} strokeWidth={1.8} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      {/* Resumen plegado (UI-M3): la lista primero. Arriba, "Por categoría". */}
      <div id="mov-summary" className={ms.summaryBody} hidden={!showSummary}>
        <div style={{ marginBottom: 16 }}>
          <ChartCard title={t('mov.byCat.title')} subtitle={monthYearLabel(activeMonth)} minHeight={160}>
            {catRecords.length > 0
              ? <CategoryDonut records={catRecords} sym={lsym} maxCategories={6} onCategoryClick={onDonutCategory} />
              : <Empty text={t('mov.byCat.empty')} />}
          </ChartCard>
          {catRecords.length > 0 && <p className={ms.lens} style={{ marginTop: -12 }}>{t('mov.byCat.hint')}</p>}
        </div>

        {/* H17 (ola A7): el Inicio excluye la inversión de Gastos; aquí se dice cuánta incluye. */}
        {invExp > 0 && <p className={ms.summaryInv} style={{ margin: '0 0 12px' }}>{t('mov.summary.invNote', { v: fmtL(invExp) })}</p>}

        {/* KPIs */}
        <div className="kpi-row" style={{ marginBottom:20 }}>
          <KPI label={t('mov.kpi.income')} value={fmtL(totalInc)} color="green"
            sub={invInc > 0 ? t('mov.kpi.invTag', { v: fmtL(invInc) }) : undefined} />
          <KPI label={t('mov.kpi.totalOut')} value={fmtL(totalExp)}
            sub={invExp > 0 ? t('mov.kpi.invTag', { v: fmtL(invExp) }) : undefined} />
          <KPI label={t('rec.mov.pendingKpi')} value={fmtL(pendingFixed)} color="amber" sub={t('rec.mov.pendingSub')} />
          <KPI label={t('mov.kpi.available')} value={fmtL(balance)} color={balance >= 0 ? 'green' : 'red'}
            alert={balance < 0 ? t('ui.state.overdrawn') : undefined}
            sub={(invInc > 0 || invExp > 0) ? t('mov.kpi.personalExcl') : t('rec.mov.realOnly')} />
        </div>

        {/* Banner impacto anual suscripciones */}
        {activeSubs.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <Alert type={totalSubs > totalInc * 0.15 ? 'danger' : 'warn'}>
              <div>
                <div style={{ fontSize:12, fontWeight:600, fontFamily: 'var(--sans)', marginBottom:3 }}>
                  {t('mov.banner.title')}
                </div>
                <div style={{ fontSize:13, color:'var(--tx)', fontFamily: 'var(--sans)' }}>
                  <strong style={{ color:'var(--amb)' }}>{t('mov.banner.perMonth', { v: fmtL(totalSubs) })}</strong>
                  {' → '}
                  <strong style={{ color:'var(--tx)' }}>{t('mov.banner.perYear', { v: fmtL(totalAnnual) })}</strong>
                  {t('mov.banner.inServices', { n: activeSubs.length })}
                </div>
              </div>
            </Alert>
          </div>
        )}

        {/* Top gastos (el donut por categoría está arriba, en "Por categoría"). */}
        {monthExp.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <ChartCard title={t('mov.chart.top')} minHeight={180}>
              <HorizontalBars records={topBarRecords} sym={lsym} maxItems={8}/>
            </ChartCard>
          </div>
        )}

        {/* Alertas */}
        {alerts.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
            {alerts.map((a,i) => (
              <Alert key={i} type={a.type==='upcoming' ? 'warn' : 'info'}>{a.msg}</Alert>
            ))}
          </div>
        )}
      </div>

      {/* Leyenda de la lente: con qué tasa se convirtió, su fuente y su fecha. */}
      {lens.on && (
        <p className={ms.lens}>
          {t('movl.lens.legend', {
            usd: usdSym,
            rate: fmtMoney(lens.rate.rate, sym),
            source: t(SOURCE_LABEL[lens.rate.source] || SOURCE_LABEL.manual),
            date: lens.rate.at ? fmtRateDay(lens.rate.at) : t('refcur.noDate'),
          })}
        </p>
      )}

      {/* Formularios de alta (gasto detallado / suscripción); se abren desde el menú ⋯ */}
      <div ref={formsRef} tabIndex={-1} style={{ marginTop: (showGasto || showSub) ? 12 : 0, outline: 'none' }}>
        {showGasto && <FormGasto sym={sym} projects={projectOptions} settings={settings} initial={prefill} onSave={handleSaveGasto} onCancel={() => setShowGasto(false)} onImport={setPage ? () => setPage('import') : undefined}/>}
        {showSub   && <FormSub              onSave={handleSaveSub}   onCancel={() => setShowSub(false)}/>}
      </div>

      {view === 'list' ? (
        <MovementsList items={items} type={type} sym={lsym} lens={lens}
          query={query} kind={kind} category={drillCat} onClearFilters={clearAllFilters}
          onOpen={setOpenExp}
          empty={type === 'income'
            ? <EmptyState compact icon={ArrowLeftRight} title={t('movl.emptyInc.title')} text={t('movl.emptyInc.text')}
                cta={t('movl.emptyInc.cta')} onCta={() => openQuickAdd('income')} />
            : <EmptyState compact icon={ArrowLeftRight} title={t('empty.mov.title')} text={t('empty.mov.text')}
                cta={t('empty.mov.cta')} onCta={() => openQuickAdd('expense')} />} />
      ) : calendar && (
        <section aria-labelledby="movc-title" data-tour="mov-list" className={ms.listSection}>
          <h2 id="movc-title" className="sr-only">{t('movl.cal.title', { month: monthYearLabel(activeMonth) })}</h2>
          <MonthCalendar ym={activeMonth} weeks={calendar.weeks} weekStart={weekStart} today={todayStr2} locale={calLocale}
            labelledBy="movc-title" fmtFull={(n) => m(fmtSignedMoney(n, lsym))}
            onOpenDay={(cell) => setOpenDay(cell.date)} />
          <UndatedPlanned items={calendar.undated} sym={sym} />
        </section>
      )}

      {/* Menú ⋯ (poda P2): lo que antes estaba en la barra de la lista y junto al mes. */}
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} ariaLabel={t('mov.more')}>
        <h2 className={ms.sheetTitle}>{t('mov.more')}</h2>
        <ul className={ms.menu}>
          <li>
            <button type="button" className={ms.menuItem} onClick={() => openForm('gasto')}>
              <span className={ms.menuLabel}>{t('mov.more.detailed')}</span>
              <span className={ms.menuDesc}>{t('mov.more.detailedDesc')}</span>
            </button>
          </li>
          <li>
            <button type="button" className={ms.menuItem} onClick={() => openForm('sub')}>
              <span className={ms.menuLabel}>{t('mov.more.sub')}</span>
              <span className={ms.menuDesc}>{t('mov.addSubDesc')}</span>
            </button>
          </li>
          {exportCSV && (
            <li>
              <button type="button" className={ms.menuItem} onClick={() => { setMoreOpen(false); exportCSV() }}>
                <span className={ms.menuLabel}><Download size={16} strokeWidth={1.7} aria-hidden="true" />{t('movl.export')}</span>
              </button>
            </li>
          )}
        </ul>
        {/* Lente de moneda (R12): el mismo VES | USD del Inicio, solo si hay tasa con fecha. */}
        {lens.available && (
          <div className={ms.menuGroup}>
            <h3 id="mov-lens-title" className={ms.sheetSub}>{t('movl.lens.switchAria')}</h3>
            <span className={ms.lensSwitch} role="group" aria-labelledby="mov-lens-title">
              {[['local', String(settings.currency || '').toUpperCase()], ['ref', REF_CURRENCY]].map(([v, code]) => (
                <button key={v} type="button" className={ms.lensOpt} aria-pressed={refMode === v} onClick={() => setRefMode(v)}>{code}</button>
              ))}
            </span>
          </div>
        )}
      </Sheet>

      {/* Hoja "Filtrar" (poda P2): los chips de origen y categoría que estaban sobre la lista. */}
      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} ariaLabel={t('mov.filter.title')}>
        <h2 className={ms.sheetTitle}>{t('mov.filter.title')}</h2>
        <h3 id="mov-f-origin" className={ms.sheetSub}>{t('movl.sheet.origin')}</h3>
        <div className={ms.chipWrap} role="group" aria-labelledby="mov-f-origin">
          {ORIGIN_KINDS.map(k => (
            <button key={k} type="button" className="fos-chip" aria-pressed={kind === k} onClick={() => setKind(toggleKind(kind, k))}>
              {t(`movl.filter.${k}`)}
            </button>
          ))}
        </div>
        {(filterCats.length > 0 || drillCat) && (
          <>
            <h3 id="mov-f-cat" className={ms.sheetSub}>{t('movl.sheet.category')}</h3>
            <div className={ms.chipWrap} role="group" aria-labelledby="mov-f-cat">
              {(drillCat && !filterCats.includes(drillCat) ? [drillCat, ...filterCats] : filterCats).map(c => (
                <button key={c} type="button" className="fos-chip" aria-pressed={drillCat === c} onClick={() => setDrillCat(toggleCategory(drillCat, c))}>
                  <CategoryIcon category={c} size={20} />{catName(c, lang)}
                </button>
              ))}
            </div>
          </>
        )}
        <div className={ms.sheetActions}>
          {active.length > 0 && (
            <button type="button" className="fos-link" onClick={() => applyFilters(clearFilter(filterState, 'all'))}>{t('movl.clear')}</button>
          )}
          <button type="button" className="fos-btn-secondary" onClick={() => setFilterOpen(false)}>{t('mov.filter.show', { n: resultCount })}</button>
        </div>
      </Sheet>
      {dayCell && (
        <DaySheet cell={dayCell} type={type} sym={lsym} lens={lens} localSym={sym}
          onClose={() => setOpenDay(null)}
          onOpenMovement={(e) => { setOpenDay(null); setOpenExp(e) }}
          onConfirm={confirm} onSkip={skip} onUnskip={unskip} live={live} />
      )}

      {openExp && openExp.kind === 'income' && (
        <MovementSheet kind="income" expense={openExp.rec} sym={sym} categories={categoriesIncome}
          onClose={() => setOpenExp(null)}
          onSave={updateIncome ? (r) => updateIncome(r) : undefined}
          onDelete={deleteWithUndo ? (r) => deleteWithUndo('incomes', r, t('common.deleted'), t('common.undo')) : undefined} />
      )}
      {openExp && openExp.kind !== 'income' && (
        <MovementSheet expense={openExp.rec || openExp} sym={sym} categories={categoriesExpense} subcats={SUBCATS}
          onClose={() => setOpenExp(null)}
          onSave={updateExpense ? (e) => updateExpense(e) : undefined}
          onDelete={delExpense ? (e) => deleteWithUndo('expenses', e, t('common.deleted'), t('common.undo')) : undefined} />
      )}

      <div style={{ marginTop:24 }}>
      {/* Fijos del mes — suscripciones, cuotas y fijos manuales (reglas) */}
      <div data-tour="mov-fixed" style={{ background:'var(--sur)', border:'.5px solid var(--brd)',
        borderRadius:'var(--r)', overflow:'hidden' }}>
        <div style={{ padding:'10px 14px', borderBottom:'.5px solid var(--brd)',
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
          <div style={{ fontSize: 12, fontWeight:600, color:'var(--amb)',
            fontFamily: 'var(--sans)'}}>
            {t('rec.mov.title', { n: fixedExp.length })}
          </div>
          {setPage && (
            <button type="button" className="fos-link" style={{ fontSize:12 }} onClick={() => setPage('recurring')}>{t('rec.sheet.goList')} →</button>
          )}
        </div>
        <div style={{ maxHeight:460, overflowY:'auto', padding:'0 14px' }}>
          {fixedExp.length === 0 ? (
            <Empty text={t('rec.mov.empty')} />
          ) : (
            <ul className={rs.rows}>
              {fixedExp.map(o => <OccurrenceRow key={o.key} occ={o} sym={sym} onConfirm={confirm} onSkip={skip} onUnskip={unskip} />)}
            </ul>
          )}
        </div>
        <div role="status" aria-live="polite" className="sr-only">{live}</div>
      </div>
      </div>

      {/* Disclaimer */}
      <div style={{ fontSize:11, color:'var(--th)', fontFamily: 'var(--sans)', marginTop:4 }}>
        {t('mov.disclaimer')}
      </div>
    </div>
  )
}
