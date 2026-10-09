// src/pages/Movements/index.jsx — v1.5
// Hub "Egresos del mes" — vista unificada Gastos + Recurrentes

import { useState, useMemo, useEffect } from 'react'
import SignalIcon, { InlineIcon } from '../../components/icons/SignalIcon.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import MoneyFlow from '../../components/charts/MoneyFlow.jsx'
import ChartCard from '../../components/charts/ChartCard.jsx'
import HorizontalBars from '../../components/charts/HorizontalBars.jsx'
import CategoryDonut from '../../components/charts/CategoryDonut.jsx'
import { parseTransactionText } from '../../utils/smsParser.js'
import { catLabel, catEmoji, subLabel, expSubcatLabel, dateLocale, CAT_COLORS, getCategoriesExpense, currentMonth, localDateStr, METHODS, methodLabel, currencySymbol, fmtSignedMoney } from '../../utils/index.js'
import { monthPlan, pendingTotals, toLocal } from '../../utils/recurring.js'
import OccurrenceRow from '../../components/recurring/OccurrenceRow.jsx'
import { useOccurrenceActions } from '../../components/recurring/useOccurrenceActions.js'
import rs from '../../components/recurring/recurring.module.css'
import { FormGroup, KPI, Alert, Empty, EmptyState } from '../../components/ui/index.jsx'
import { ArrowLeftRight } from 'lucide-react'
import { openQuickAdd } from '../../components/quickAddBus.js'
import Money, { useMoney } from '../../components/Money.jsx'

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
function FormGasto({ onSave, onCancel, sym, projects = [], onImport, settings }) {
  const { t, lang } = useT()
  const [f, setF] = useState({
    description:'', amount:'', date:todayStr(),
    category:'Alimentación', subcategory:'', method:'Débito', type:'Necesidad', notes:'', project:''
  })
  const set = (k,v) => setF(p => ({ ...p, [k]:v }))
  const categoriesExpense = getCategoriesExpense(settings)
  const inp = { background:'var(--sur)', border:'.5px solid var(--brd)', borderRadius:6,
    padding:'7px 10px', fontSize:13, color:'var(--tx)', width:'100%',
    boxSizing:'border-box', fontFamily:'var(--mono)' }
  const lbl = { fontSize:10, color:'var(--th)', fontFamily:'var(--mono)',
    textTransform:'uppercase', letterSpacing:'.5px', marginBottom:3, display:'block' }

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
          style={{ background:'none', border:'none', padding:0, marginBottom:10, fontSize:11, fontFamily:'var(--mono)', color:'var(--accent, #00b8d9)', cursor:'pointer', textAlign:'left', display:'block' }}>
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
            <div style={{ fontSize:9, color:'var(--th)', fontFamily:'var(--mono)', marginTop:6, lineHeight:1.5 }}>
              {t('mov.form.pasteLocal')}
            </div>
          </div>
        )}
        {pasteMsg && (
          <div style={{ marginTop:8, fontSize:11, color: pasteMsg.ok ? 'var(--grn)' : 'var(--red)', fontFamily:'var(--mono)' }}>
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
              {t('mov.form.subcat')} <span style={{ color:'var(--accent)', fontSize:9 }}>{t('mov.form.optional')}</span>
            </label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              {subcatOptions.map(sc => (
                <button key={sc} type="button"
                  onClick={() => set('subcategory', f.subcategory === sc ? '' : sc)}
                  style={{
                    padding:'4px 10px', borderRadius:16, fontSize:11, cursor:'pointer',
                    fontFamily:'var(--mono)', border:`.5px solid ${f.subcategory === sc ? 'var(--accent)' : 'var(--brd2)'}`,
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
            <option>Necesidad</option><option>Deseo</option></select></FormGroup>
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
    boxSizing:'border-box', fontFamily:'var(--mono)' }
  const lbl = { fontSize:10, color:'var(--th)', fontFamily:'var(--mono)',
    textTransform:'uppercase', letterSpacing:'.5px', marginBottom:3, display:'block' }

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
  const incomes       = Array.isArray(ctx.incomes)       ? ctx.incomes       : []
  const expenses      = Array.isArray(ctx.expenses)      ? ctx.expenses      : []
  const subscriptions = Array.isArray(ctx.subscriptions) ? ctx.subscriptions : []
  const debts         = Array.isArray(ctx.debts)         ? ctx.debts         : []
  const settings      = ctx.settings || {}
  const addExpense      = ctx.addExpense
  const delExpense      = ctx.delExpense
  const updateExpense   = ctx.updateExpense
  const addSubscription    = ctx.addSubscription
  const deleteSubscription = ctx.deleteSubscription
  const updateSubscription = ctx.updateSubscription
  const deleteWithUndo     = ctx.deleteWithUndo

  const sym         = currencySymbol(settings.currency, settings.language)
  // Ocultar montos (T13): toda cifra de esta pantalla pasa por fmtM → m().
  const { m } = useMoney()
  const fmtM = (n, s) => m(fmtMRaw(n, s))
  const activeMonth = settings.activeMonth || currentMonth()
  const categoriesExpense = useMemo(() => getCategoriesExpense(settings), [settings])

  const [showAdd,   setShowAdd]   = useState(false)
  const [showGasto, setShowGasto] = useState(false)
  const [showSub,   setShowSub]   = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm,  setEditForm]  = useState({})

  // Filtro de categoría por drilldown desde el Dashboard (donut clicable)
  // NB: no se borra en el initializer (StrictMode monta 2× en dev y perdería el valor)
  const [drillCat, setDrillCat] = useState(() => {
    try { return sessionStorage.getItem('fos_drill_category') || null } catch { return null }
  })
  useEffect(() => {
    try { sessionStorage.removeItem('fos_drill_category') } catch {}
  }, [])

  async function saveEdit(e) {
    if (!editForm.description?.trim() || !editForm.amount || Number(editForm.amount) <= 0) return
    if (updateExpense) {
      await updateExpense({ ...e,
        description: editForm.description.trim(),
        amount:      Number(editForm.amount),
        date:        editForm.date || e.date,
        category:    editForm.category || e.category,
        subcategory: editForm.subcategory ?? e.subcategory ?? '',
      })
    }
    setEditingId(null); setEditForm({})
  }

  // ── Cálculos ─────────────────────────────────────────────────────────────────
  const monthExp   = useMemo(() =>
    expenses.filter(e => e?.date?.startsWith(activeMonth))
      .sort((a,b) => new Date(b.date) - new Date(a.date))
  , [expenses, activeMonth])

  // Lista visible — aplica filtro de categoría del drilldown si está activo
  const listExp = useMemo(
    () => drillCat ? monthExp.filter(e => (e.category || '') === drillCat) : monthExp,
    [monthExp, drillCat]
  )

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
  const rules = Array.isArray(ctx.recurring) ? ctx.recurring : []
  const todayStr2 = localDateStr()
  const plan = useMemo(() => monthPlan(rules, activeMonth, { incomes, expenses, today: todayStr2 }), [rules, activeMonth, incomes, expenses, todayStr2])
  const fixedExp = useMemo(() => plan.filter(o => o.kind === 'expense'), [plan])
  const pendingFixed = pendingTotals(plan).expense
  const { confirm, skip, unskip, live } = useOccurrenceActions()
  const [showAllExp, setShowAllExp] = useState(false)

  // Disponible PERSONAL = ingresos personales − gastos personales (solo lo real,
  // igual que "Te queda" del Inicio; excluye inversión 💼).
  const balance      = personalInc - personalExp

  // Datos para gráficos — solo gastos REGISTRADOS del mes. Antes se sumaban
  // además las suscripciones activas: una suscripción también registrada como
  // gasto (el gimnasio, Netflix) aparecía dos veces y el total quedaba inflado.
  const chartRecords = useMemo(() => {
    const map = {}
    monthExp.forEach(e => { map[e.category] = (map[e.category]||0) + (Number(e.amount)||0) })
    return Object.entries(map)
      .sort((a,b) => b[1]-a[1])
      .slice(0,8)
      .map(([category, amount]) => ({ category, amount }))
  }, [monthExp])

  const topBarRecords = useMemo(() => {
    const items = [
      // La barra muestra la descripción del gasto; el emoji viene de SU categoría.
      ...monthExp.map(e => ({ category: [catEmoji(e.category), e.description || e.category].filter(Boolean).join(' '), amount: Number(e.amount)||0 })),
    ]
    return items.sort((a,b) => b.amount-a.amount).slice(0,8)
  }, [monthExp])

  // Alertas de suscripciones
  const alerts = useMemo(() => {
    const al = []
    const catGroups = {}
    activeSubs.forEach(s => { catGroups[s.category] = [...(catGroups[s.category]||[]), s] })
    Object.entries(catGroups).forEach(([cat, items]) => {
      if (items.length >= 2) al.push({ type:'dup', msg:t('mov.alert.dup', { n: items.length, cat }) })
    })
    if (totalInc > 0 && totalSubs/totalInc > 0.15)
      al.push({ type:'income', msg:t('mov.alert.income', { pct: (totalSubs/totalInc*100).toFixed(1) }) })
    const todayD = new Date(), in7 = new Date(); in7.setDate(todayD.getDate()+7)
    activeSubs.filter(s=>s.nextPaymentDate).forEach(s => {
      const d = toLocal(s.nextPaymentDate)
      if (d >= todayD && d <= in7)
        al.push({ type:'upcoming', msg:t('mov.alert.upcoming', { name: s.name, date: d.toLocaleDateString(dateLocale()) }) })
    })
    return al
  }, [activeSubs, totalSubs, totalInc])

  // ── Handlers ─────────────────────────────────────────────────────────────────
  async function handleSaveGasto(item) {
    if (addExpense) await addExpense(item)
    setShowGasto(false); setShowAdd(false)
  }
  async function handleSaveSub(item) {
    if (addSubscription) await addSubscription(item)
    setShowSub(false); setShowAdd(false)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontFamily:'var(--mono)', fontSize:10, color:'var(--grn)',
          textTransform:'uppercase', letterSpacing:'1.2px', marginBottom:4 }}>{t('mov.kicker')}</div>
        <h1 className="display" style={{ fontSize:24, fontWeight:700, color:'var(--tx)', marginBottom:2 }}>
          {t('mov.title')}
        </h1>
        <p style={{ fontSize:12, color:'var(--th)', fontFamily:'var(--mono)' }}>
          {t('mov.sub', { month: activeMonth })}
        </p>
      </div>

      {/* KPIs */}
      <div className="kpi-row" style={{ marginBottom:20 }} data-tour="mov-kpis">
        <KPI label={t('mov.kpi.income')} value={fmtM(totalInc, sym)} color="green"
          sub={invInc > 0 ? t('mov.kpi.invTag', { v: fmtM(invInc, sym) }) : undefined} />
        <KPI label={t('mov.kpi.totalOut')} value={fmtM(totalExp, sym)} color="red"
          sub={invExp > 0 ? t('mov.kpi.invTag', { v: fmtM(invExp, sym) }) : undefined} />
        <KPI label={t('rec.mov.pendingKpi')} value={fmtM(pendingFixed, sym)} color="amber" sub={t('rec.mov.pendingSub')} />
        <KPI label={t('mov.kpi.available')} value={fmtM(balance, sym)} color={balance >= 0 ? 'green' : 'red'}
          sub={(invInc > 0 || invExp > 0) ? t('mov.kpi.personalExcl') : t('rec.mov.realOnly')} />
      </div>

      {/* Banner impacto anual suscripciones */}
      {activeSubs.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <Alert type={totalSubs > totalInc * 0.15 ? 'danger' : 'warn'}>
            <div>
              <div style={{ fontSize:12, fontWeight:600, fontFamily:'var(--mono)', marginBottom:3 }}>
                {t('mov.banner.title')}
              </div>
              <div style={{ fontSize:13, color:'var(--tx)', fontFamily:'var(--mono)' }}>
                <strong style={{ color:'var(--amb)' }}>{t('mov.banner.perMonth', { v: fmtM(totalSubs, sym) })}</strong>
                {' → '}
                <strong style={{ color:'var(--red)' }}>{t('mov.banner.perYear', { v: fmtM(totalAnnual, sym) })}</strong>
                {t('mov.banner.inServices', { n: activeSubs.length })}
              </div>
            </div>
          </Alert>
        </div>
      )}

      {/* Botón agregar */}
      <div style={{ marginBottom:16 }} data-tour="mov-add">
        {!showAdd && !showGasto && !showSub && (
          <button onClick={() => setShowAdd(true)} style={{
            background:'var(--laton)', color:'var(--navy)', border:'none', borderRadius:8,
            padding:'8px 20px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            {t('mov.addBtn')}
          </button>
        )}

        {showAdd && !showGasto && !showSub && (
          <div style={{ background:'var(--sur)', border:'.5px solid var(--brd)',
            borderRadius:'var(--r)', padding:'16px', marginBottom:4 }}>
            <div style={{ fontSize:13, color:'var(--tx)', fontWeight:600, marginBottom:12 }}>
              {t('mov.addWhich')}
            </div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <button onClick={() => { setShowAdd(false); setShowGasto(true) }}
                style={{ background:'var(--sur)', border:'.5px solid var(--red)', borderRadius:8,
                  padding:'10px 18px', fontSize:12, fontWeight:600, color:'var(--red)',
                  cursor:'pointer', flex:1, minWidth:140, textAlign:'left' }}>
                {t('mov.addExpense')}
                <div style={{ fontSize:10, fontWeight:400, color:'var(--th)', marginTop:3 }}>
                  {t('mov.addExpenseDesc')}
                </div>
              </button>
              <button onClick={() => { setShowAdd(false); setShowSub(true) }}
                style={{ background:'var(--sur)', border:'.5px solid var(--amb)', borderRadius:8,
                  padding:'10px 18px', fontSize:12, fontWeight:600, color:'var(--amb)',
                  cursor:'pointer', flex:1, minWidth:140, textAlign:'left' }}>
                {t('mov.addSub')}
                <div style={{ fontSize:10, fontWeight:400, color:'var(--th)', marginTop:3 }}>
                  {t('mov.addSubDesc')}
                </div>
              </button>
              <button onClick={() => setShowAdd(false)}
                style={{ background:'none', border:'.5px solid var(--brd)', borderRadius:8,
                  padding:'10px 14px', fontSize:12, color:'var(--th)', cursor:'pointer' }}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        {showGasto && <FormGasto sym={sym} projects={projectOptions} settings={settings} onSave={handleSaveGasto} onCancel={() => setShowGasto(false)} onImport={setPage ? () => setPage('import') : undefined}/>}
        {showSub   && <FormSub              onSave={handleSaveSub}   onCancel={() => setShowSub(false)}/>}
      </div>

      {/* Gráficos unificados */}
      {(monthExp.length > 0 || activeSubs.length > 0) && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:16, marginBottom:16 }}>
          <ChartCard title={t('mov.chart.top')} minHeight={180}>
            <HorizontalBars records={topBarRecords} sym={sym} maxItems={8}/>
          </ChartCard>
          <ChartCard title={t('mov.chart.byCat')} minHeight={180}>
            <CategoryDonut records={chartRecords} sym={sym}/>
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

      {/* Dos secciones compactas separadas */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:16, marginBottom:16 }}>

        {/* Gastos únicos */}
        <div data-tour="mov-list" style={{ background:'var(--sur)', border:'.5px solid var(--brd)',
          borderRadius:'var(--r)', overflow:'hidden' }}>
          <div style={{ padding:'10px 14px', borderBottom:'.5px solid var(--brd)',
            display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--red)',
              fontFamily:'var(--mono)', textTransform:'uppercase', letterSpacing:'.5px' }}>
              {t('mov.list.expenses', { n: listExp.length })}
            </div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--red)',
              fontFamily:'var(--mono)' }}><Money>{fmtM(totalExp, sym)}</Money></div>
          </div>
          {drillCat && (
            <div style={{ padding:'8px 14px', borderBottom:'.5px solid var(--brd)', display:'flex', alignItems:'center', gap:8, background:'var(--accent-bg)' }}>
              <span style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--tx)' }}>{t('mov.list.filtering')} <strong>{drillCat}</strong></span>
              <button onClick={() => setDrillCat(null)} aria-label={t('mov.list.removeFilter')}
                style={{ marginLeft:'auto', background:'none', border:'.5px solid var(--brd2)', borderRadius:6, padding:'4px 10px', fontSize:11, fontFamily:'var(--mono)', color:'var(--tm)', cursor:'pointer' }}>
                {t('mov.list.clearFilter')}
              </button>
            </div>
          )}
          <div style={{ maxHeight:460, overflowY:'auto' }}>
            {listExp.length === 0 ? (
              drillCat
                ? <Empty text={t('mov.list.emptyCat', { cat: drillCat })} />
                : <EmptyState compact icon={ArrowLeftRight} title={t('empty.mov.title')} text={t('empty.mov.text')}
                    cta={t('empty.mov.cta')} onCta={() => openQuickAdd('expense')} />
            ) : (showAllExp ? listExp : listExp.slice(0, 10)).map((e,i) => editingId === e.id ? (
              <div key={e.id} style={{padding:'10px 14px',borderBottom:i<listExp.length-1?'.5px solid var(--brd)':'none',background:'rgba(232,65,66,.03)'}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:6,marginBottom:6}}>
                  <input type="text" value={editForm.description||''} placeholder={t('mov.edit.descPh')} aria-label={t('mov.form.desc')}
                    onChange={ev=>setEditForm(f=>({...f,description:ev.target.value}))}
                    style={{gridColumn:'1/-1',padding:'5px 8px',fontSize:11,borderRadius:5,border:'.5px solid var(--brd)',background:'var(--bg)',color:'var(--tx)',boxSizing:'border-box'}}/>
                  <input type="number" inputMode="decimal" min="0" step="any" value={editForm.amount||''} placeholder={t('mov.edit.amountPh')} aria-label={t('mov.form.amount', { sym })}
                    onChange={ev=>setEditForm(f=>({...f,amount:ev.target.value}))}
                    style={{padding:'5px 8px',fontSize:11,borderRadius:5,border:'.5px solid var(--brd)',background:'var(--bg)',color:'var(--tx)',boxSizing:'border-box'}}/>
                  <input type="date" value={editForm.date||''} aria-label={t('mov.form.date')}
                    onChange={ev=>setEditForm(f=>({...f,date:ev.target.value}))}
                    style={{padding:'5px 8px',fontSize:11,borderRadius:5,border:'.5px solid var(--brd)',background:'var(--bg)',color:'var(--tx)',boxSizing:'border-box'}}/>
                  <select value={editForm.category||e.category} aria-label={t('mov.form.category')}
                    onChange={ev=>setEditForm(f=>({...f,category:ev.target.value,subcategory:''}))}
                    style={{padding:'5px 8px',fontSize:11,borderRadius:5,border:'.5px solid var(--brd)',background:'var(--bg)',color:'var(--tx)',boxSizing:'border-box'}}>
                    {categoriesExpense.map(c=><option key={c} value={c}>{catLabel(c, lang)}</option>)}
                  </select>
                  <select value={editForm.subcategory??e.subcategory??''} aria-label={t('mov.form.subcat')}
                    onChange={ev=>setEditForm(f=>({...f,subcategory:ev.target.value}))}
                    style={{padding:'5px 8px',fontSize:11,borderRadius:5,border:'.5px solid var(--brd)',background:'var(--bg)',color:'var(--tx)',boxSizing:'border-box'}}>
                    <option value="">{t('mov.edit.subcatNone')}</option>
                    {(SUBCATS[editForm.category||e.category]||[]).map(sc=><option key={sc} value={sc}>{expSubcatLabel(sc, lang)}</option>)}
                  </select>
                </div>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>saveEdit(e)} style={{fontSize:10,padding:'3px 10px',borderRadius:4,border:'none',background:'var(--laton)',color:'var(--navy)',cursor:'pointer',fontFamily:'var(--mono)',fontWeight:600}}>{t('mov.edit.save')}</button>
                  <button onClick={()=>{setEditingId(null);setEditForm({})}} style={{fontSize:10,padding:'3px 10px',borderRadius:4,border:'.5px solid var(--brd)',background:'none',color:'var(--th)',cursor:'pointer',fontFamily:'var(--mono)'}}>{t('common.cancel')}</button>
                </div>
              </div>
            ) : (
              <div key={e.id} style={{ display:'flex', alignItems:'center', gap:8,
                padding:'8px 14px',
                borderBottom: i < listExp.length-1 ? '.5px solid var(--brd)' : 'none' }}>
                <div style={{ width:6, height:6, borderRadius:'50%', flexShrink:0,
                  background: CAT_COLORS[e.category]||'#888' }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, color:'var(--tx)', fontWeight:500,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {e.inv && <InlineIcon kind="investment" size={11} />}{e.description || e.category}
                  </div>
                  <div style={{ fontSize:10, color:'var(--th)', fontFamily:'var(--mono)' }}>
                    {e.subcategory
                      ? <><span style={{ color:'var(--accent)', opacity:.75 }}>{catLabel(e.category, lang)}</span>{' › '}{expSubcatLabel(e.subcategory, lang)}{' · '}{e.date?.slice(5)}</>
                      : <>{catLabel(e.category, lang)}{' · '}{e.date?.slice(5)}</>
                    }
                  </div>
                </div>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--red)',
                  fontFamily:'var(--mono)', flexShrink:0 }}>
                  -<Money>{fmtM(e.amount, sym)}</Money>
                </div>
                {updateExpense && (
                  <button onClick={()=>{setEditingId(e.id);setEditForm({description:e.description||'',amount:e.amount,date:e.date,category:e.category,subcategory:e.subcategory||''})}}
                    style={{background:'none',border:'none',color:'var(--th)',fontSize:11,cursor:'pointer',padding:0,minWidth:44,minHeight:44,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}
                    title={t('mov.edit.editTitle')} aria-label={`${t('mov.edit.editTitle')}: ${e.description || catLabel(e.category, lang)}`}>✏️</button>
                )}
                {delExpense && (
                  <button onClick={()=>deleteWithUndo('expenses', e, t('common.deleted'), t('common.undo'))}
                    style={{background:'none',border:'none',color:'var(--th)',fontSize:10,cursor:'pointer',padding:0,minWidth:44,minHeight:44,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}
                    title={t('mov.edit.delTitle')} aria-label={`${t('mov.edit.delTitle')}: ${e.description || catLabel(e.category, lang)}`}>✕</button>
                )}
              </div>
            ))}
            {/* Antes decía "+N gastos más" pero la lista ya mostraba todos: ahora
                muestra 10 y el botón despliega el resto (o los vuelve a ocultar). */}
            {listExp.length > 10 && (
              <div style={{ borderTop:'.5px solid var(--brd)', textAlign:'center' }}>
                <button type="button" className="fos-link" aria-expanded={showAllExp} onClick={() => setShowAllExp(v => !v)}
                  style={{ fontSize:12, minHeight:44 }}>
                  {showAllExp ? t('mov.list.showLess') : t('mov.list.showMore', { n: listExp.length - 10 })}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Fijos del mes — suscripciones, cuotas y fijos manuales (reglas) */}
        <div data-tour="mov-fixed" style={{ background:'var(--sur)', border:'.5px solid var(--brd)',
          borderRadius:'var(--r)', overflow:'hidden' }}>
          <div style={{ padding:'10px 14px', borderBottom:'.5px solid var(--brd)',
            display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--amb)',
              fontFamily:'var(--mono)', textTransform:'uppercase', letterSpacing:'.5px' }}>
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
      <div style={{ fontSize:10, color:'var(--th)', fontFamily:'var(--mono)', marginTop:4 }}>
        {t('mov.disclaimer')}
      </div>
    </div>
  )
}
