// src/pages/Movements/index.jsx — v1.5
// Hub "Egresos del mes" — vista unificada Gastos + Recurrentes

import { useState, useMemo, useEffect } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import MoneyFlow from '../../components/charts/MoneyFlow.jsx'
import ChartCard from '../../components/charts/ChartCard.jsx'
import HorizontalBars from '../../components/charts/HorizontalBars.jsx'
import CategoryDonut from '../../components/charts/CategoryDonut.jsx'
import { parseTransactionText } from '../../utils/smsParser.js'
import { catLabel, catEmoji, subLabel, moneyLocale, dateLocale, CAT_COLORS, getCategoriesExpense } from '../../utils/index.js'
import { pendingDebtMonthly } from '../../utils/personal.js'
import { FormGroup } from '../../components/ui/index.jsx'

// ── Helpers ───────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const todayStr = () => new Date().toISOString().slice(0, 10)

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

const SYM   = { CLP:'$', USD:'US$', EUR:'€', VES:'Bs.', MXN:'$', ARS:'$', COP:'$' }
const fmt   = n => (Number(n)||0).toLocaleString(moneyLocale(), { maximumFractionDigits:0 })
const fmtM  = (n, sym) => `${sym}${fmt(n)}`

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
const METHODS  = ['Débito','Crédito','Efectivo','Transferencia','Otro']
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
          {t('common.importShortcut')}
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
            {pasteMsg.text}
          </div>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:10, marginBottom:10 }}>
        <FormGroup label={t('mov.form.desc')}>
          <input style={inp} value={f.description} placeholder={t('mov.form.descPh')}
            onChange={e => set('description', e.target.value)}/></FormGroup>
        <FormGroup label={t('mov.form.amount', { sym })}>
          <input style={inp} type="number" inputMode="decimal" min="0" value={f.amount} placeholder="0"
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
                  {sc}
                </button>
              ))}
            </div>
          </div>
        )}
        <FormGroup label={t('mov.form.method')}>
          <select style={inp} value={f.method} onChange={e => set('method', e.target.value)}>
            {METHODS.map(m => <option key={m}>{m}</option>)}</select></FormGroup>
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
  const { t } = useT()
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
            {SUB_CATS.map(c => <option key={c} value={c}>{subLabel(c)}</option>)}</select></FormGroup>
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

  const sym         = SYM[settings.currency] || '$'
  const activeMonth = settings.activeMonth || new Date().toISOString().slice(0,7)
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

  const [editingSubId, setEditingSubId] = useState(null)
  const [editSubForm,  setEditSubForm]  = useState({})

  async function saveSubEdit(sub) {
    if (!editSubForm.name?.trim() || !editSubForm.amount || Number(editSubForm.amount) <= 0) return
    if (updateSubscription) {
      await updateSubscription({ ...sub, name:editSubForm.name.trim(), amount:Number(editSubForm.amount), frequency:editSubForm.frequency||sub.frequency, category:editSubForm.category||sub.category })
    }
    setEditingSubId(null); setEditSubForm({})
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

  // Deudas: solo personales (excluye hipotecas de propiedades) y restando las
  // cuotas ya registradas como egreso del mes (categoría 'Deudas') — sin duplicar.
  const totalDebt  = useMemo(() =>
    pendingDebtMonthly(debts, monthExp)
  , [debts, monthExp])

  const totalEgresos = totalExp + totalSubs
  // Disponible PERSONAL = ingresos personales − gastos personales − suscripciones − deudas
  // (excluye inversión 💼, coherente con el Balance neto del Dashboard)
  const balance      = personalInc - personalExp - totalSubs - totalDebt

  // Lista unificada cronológica — gastos del mes + recurrentes con badge
  const unifiedList = useMemo(() => {
    const gastos = monthExp.map(e => ({
      ...e,
      _type: 'gasto',
      _monthly: Number(e.amount)||0,
      _sortDate: e.date || activeMonth + '-01',
    }))
    const recur = activeSubs.map(s => ({
      ...s,
      _type: 'recurrente',
      _monthly: toMonthly(Number(s.amount)||0, s.frequency),
      _annual:  toAnnual(Number(s.amount)||0, s.frequency),
      _freq:    FREQS.find(f => f.value === s.frequency)?.label || s.frequency,
      _sortDate: s.nextPaymentDate || activeMonth + '-15',
    }))
    return [...gastos, ...recur].sort((a,b) => new Date(b._sortDate) - new Date(a._sortDate))
  }, [monthExp, activeSubs, activeMonth])

  // Datos para gráficos — combinados
  const chartRecords = useMemo(() => {
    const map = {}
    monthExp.forEach(e => { map[e.category] = (map[e.category]||0) + (Number(e.amount)||0) })
    activeSubs.forEach(s => { map[s.category] = (map[s.category]||0) + toMonthly(Number(s.amount)||0, s.frequency) })
    return Object.entries(map)
      .sort((a,b) => b[1]-a[1])
      .slice(0,8)
      .map(([category, amount]) => ({ category, amount }))
  }, [monthExp, activeSubs])

  const topBarRecords = useMemo(() => {
    const items = [
      // La barra muestra la descripción del gasto; el emoji viene de SU categoría.
      ...monthExp.map(e => ({ category: [catEmoji(e.category), e.description || e.category].filter(Boolean).join(' '), amount: Number(e.amount)||0 })),
      ...activeSubs.map(s => ({ category: `${s.name} 🔄`, amount: toMonthly(Number(s.amount)||0, s.frequency) })),
    ]
    return items.sort((a,b) => b.amount-a.amount).slice(0,8)
  }, [monthExp, activeSubs])

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
      const d = new Date(s.nextPaymentDate)
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
  const kpiBox = { background:'var(--sur)', border:'.5px solid var(--brd)',
    borderRadius:'var(--rl)', padding:'14px 16px', minWidth:0, boxShadow:'var(--sh-1)' }

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
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',
        gap:10, marginBottom:20 }}>
        {[
          { label:t('mov.kpi.income'),      value:fmtM(totalInc, sym),      color:'var(--accent)', sub: invInc > 0 ? t('mov.kpi.invTag', { v: fmtM(invInc, sym) }) : null },
          { label:t('mov.kpi.oneOff'), value:fmtM(totalExp, sym),      color:'var(--red)', sub: invExp > 0 ? t('mov.kpi.invTag', { v: fmtM(invExp, sym) }) : null },
          { label:t('mov.kpi.recurring'),   value:fmtM(totalSubs, sym),     color:'var(--amb,#f5a623)' },
          { label:t('mov.kpi.totalOut'), value:fmtM(totalEgresos, sym),  color:'var(--red)' },
          { label:t('mov.kpi.available'),    value:fmtM(balance, sym),       color: balance >= 0 ? 'var(--accent)' : 'var(--red)', sub: (invInc > 0 || invExp > 0) ? t('mov.kpi.personalExcl') : t('mov.kpi.afterDebts') },
        ].map((k,i) => (
          <div key={i} style={kpiBox}>
            <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--th)',
              textTransform:'uppercase', letterSpacing:'.8px', marginBottom:5 }}>{k.label}</div>
            <div style={{ fontFamily:'var(--display)', fontSize:19, fontWeight:700, letterSpacing:'-0.01em', fontFeatureSettings:"'tnum' 1", color:k.color, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {k.value}
            </div>
            {k.sub && <div style={{ fontFamily:'var(--mono)', fontSize:9, color:'var(--th)', marginTop:3 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Banner impacto anual suscripciones */}
      {activeSubs.length > 0 && (
        <div style={{ marginBottom:16, padding:'12px 16px', borderRadius:'var(--r)',
          background: totalSubs > totalInc * 0.15
            ? 'rgba(255,77,106,.08)' : 'rgba(245,166,35,.07)',
          border: `.5px solid ${totalSubs > totalInc * 0.15 ? 'var(--red)' : 'var(--amb,#f5a623)'}`,
          display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
          <div style={{ fontSize:20 }}>
            {totalSubs > totalInc * 0.15 ? '⚠️' : '💡'}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:600, fontFamily:'var(--mono)',
              color: totalSubs > totalInc * 0.15 ? 'var(--red)' : 'var(--amb,#f5a623)',
              marginBottom:3 }}>
              {t('mov.banner.title')}
            </div>
            <div style={{ fontSize:13, color:'var(--tx)', fontFamily:'var(--mono)' }}>
              <strong style={{ color:'var(--amb,#f5a623)' }}>{t('mov.banner.perMonth', { v: fmtM(totalSubs, sym) })}</strong>
              {' → '}
              <strong style={{ color:'var(--red)' }}>{t('mov.banner.perYear', { v: fmtM(totalAnnual, sym) })}</strong>
              {t('mov.banner.inServices', { n: activeSubs.length })}
            </div>
          </div>
        </div>
      )}

      {/* Botón agregar */}
      <div style={{ marginBottom:16 }}>
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
                style={{ background:'var(--sur)', border:'.5px solid var(--amb,#f5a623)', borderRadius:8,
                  padding:'10px 18px', fontSize:12, fontWeight:600, color:'var(--amb,#f5a623)',
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
            <div key={i} style={{ padding:'8px 12px', borderRadius:8, fontSize:12,
              fontFamily:'var(--mono)', color:'var(--tx)',
              background: a.type==='upcoming' ? 'rgba(245,166,35,.08)' : 'rgba(0,184,217,.06)',
              border: `.5px solid ${a.type==='upcoming' ? 'var(--amb,#f5a623)' : 'var(--brd)'}` }}>
              {a.type==='upcoming' ? '📅 ' : a.type==='income' ? '⚠️ ' : '💡 '}{a.msg}
            </div>
          ))}
        </div>
      )}

      {/* Dos secciones compactas separadas */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:16, marginBottom:16 }}>

        {/* Gastos únicos */}
        <div style={{ background:'var(--sur)', border:'.5px solid var(--brd)',
          borderRadius:'var(--r)', overflow:'hidden' }}>
          <div style={{ padding:'10px 14px', borderBottom:'.5px solid var(--brd)',
            display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--red)',
              fontFamily:'var(--mono)', textTransform:'uppercase', letterSpacing:'.5px' }}>
              {t('mov.list.expenses', { n: listExp.length })}
            </div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--red)',
              fontFamily:'var(--mono)' }}>{fmtM(totalExp, sym)}</div>
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
              <div style={{ padding:'20px', textAlign:'center', fontSize:12,
                color:'var(--th)', fontFamily:'var(--mono)' }}>
                {drillCat ? t('mov.list.emptyCat', { cat: drillCat }) : t('mov.list.empty')}
              </div>
            ) : listExp.map((e,i) => editingId === e.id ? (
              <div key={e.id} style={{padding:'10px 14px',borderBottom:i<listExp.length-1?'.5px solid var(--brd)':'none',background:'rgba(232,65,66,.03)'}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:6,marginBottom:6}}>
                  <input type="text" value={editForm.description||''} placeholder={t('mov.edit.descPh')} aria-label={t('mov.form.desc')}
                    onChange={ev=>setEditForm(f=>({...f,description:ev.target.value}))}
                    style={{gridColumn:'1/-1',padding:'5px 8px',fontSize:11,borderRadius:5,border:'.5px solid var(--brd)',background:'var(--bg)',color:'var(--tx)',boxSizing:'border-box'}}/>
                  <input type="number" inputMode="decimal" min="0" value={editForm.amount||''} placeholder={t('mov.edit.amountPh')} aria-label={t('mov.form.amount', { sym })}
                    onChange={ev=>setEditForm(f=>({...f,amount:ev.target.value}))}
                    style={{padding:'5px 8px',fontSize:11,borderRadius:5,border:'.5px solid var(--brd)',background:'var(--bg)',color:'var(--tx)',boxSizing:'border-box'}}/>
                  <input type="date" value={editForm.date||''} aria-label={t('mov.form.date')}
                    onChange={ev=>setEditForm(f=>({...f,date:ev.target.value}))}
                    style={{padding:'5px 8px',fontSize:11,borderRadius:5,border:'.5px solid var(--brd)',background:'var(--bg)',color:'var(--tx)',boxSizing:'border-box'}}/>
                  <select value={editForm.category||e.category} aria-label={t('mov.form.category')}
                    onChange={ev=>setEditForm(f=>({...f,category:ev.target.value,subcategory:''}))}
                    style={{padding:'5px 8px',fontSize:11,borderRadius:5,border:'.5px solid var(--brd)',background:'var(--bg)',color:'var(--tx)',boxSizing:'border-box'}}>
                    {categoriesExpense.map(c=><option key={c}>{c}</option>)}
                  </select>
                  <select value={editForm.subcategory??e.subcategory??''} aria-label={t('mov.form.subcat')}
                    onChange={ev=>setEditForm(f=>({...f,subcategory:ev.target.value}))}
                    style={{padding:'5px 8px',fontSize:11,borderRadius:5,border:'.5px solid var(--brd)',background:'var(--bg)',color:'var(--tx)',boxSizing:'border-box'}}>
                    <option value="">{t('mov.edit.subcatNone')}</option>
                    {(SUBCATS[editForm.category||e.category]||[]).map(sc=><option key={sc}>{sc}</option>)}
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
                    {e.inv ? '💼 ' : ''}{e.description || e.category}
                  </div>
                  <div style={{ fontSize:10, color:'var(--th)', fontFamily:'var(--mono)' }}>
                    {e.subcategory
                      ? <><span style={{ color:'var(--accent)', opacity:.75 }}>{catLabel(e.category, lang)}</span>{' › '}{e.subcategory}{' · '}{e.date?.slice(5)}</>
                      : <>{catLabel(e.category, lang)}{' · '}{e.date?.slice(5)}</>
                    }
                  </div>
                </div>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--red)',
                  fontFamily:'var(--mono)', flexShrink:0 }}>
                  -{fmtM(e.amount, sym)}
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
            {listExp.length > 10 && (
              <div style={{ padding:'8px 14px', fontSize:11, color:'var(--th)',
                fontFamily:'var(--mono)', textAlign:'center', borderTop:'.5px solid var(--brd)' }}>
                {t('mov.list.more', { n: listExp.length - 10 })}
              </div>
            )}
          </div>
        </div>

        {/* Recurrentes */}
        <div style={{ background:'var(--sur)', border:'.5px solid var(--brd)',
          borderRadius:'var(--r)', overflow:'hidden' }}>
          <div style={{ padding:'10px 14px', borderBottom:'.5px solid var(--brd)',
            display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--amb,#f5a623)',
              fontFamily:'var(--mono)', textTransform:'uppercase', letterSpacing:'.5px' }}>
              {t('mov.list.subs', { n: activeSubs.length })}
            </div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--amb,#f5a623)',
              fontFamily:'var(--mono)' }}>{t('mov.list.perMonth', { v: fmtM(totalSubs, sym) })}</div>
          </div>
          <div style={{ maxHeight:460, overflowY:'auto' }}>
            {activeSubs.length === 0 ? (
              <div style={{ padding:'20px', textAlign:'center', fontSize:12,
                color:'var(--th)', fontFamily:'var(--mono)' }}>
                {t('mov.list.subsEmpty')}
              </div>
            ) : [...activeSubs]
              .sort((a,b) => toMonthly(Number(b.amount)||0,b.frequency) - toMonthly(Number(a.amount)||0,a.frequency))
              .map((sub,i,arr) => {
                const monthly = toMonthly(Number(sub.amount)||0, sub.frequency)
                const freqKey = FREQS.find(f => f.value === sub.frequency)?.label
                const freq = freqKey ? t(freqKey) : sub.frequency
                if (editingSubId === sub.id) {
                  return (
                    <div key={sub.id} style={{padding:'10px 14px',borderBottom:i<arr.length-1?'.5px solid var(--brd)':'none',background:'rgba(245,166,35,.05)'}}>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:6,marginBottom:6}}>
                        <input type="text" value={editSubForm.name||''} placeholder={t('mov.edit.namePh')} aria-label={t('mov.form.name')}
                          onChange={ev=>setEditSubForm(f=>({...f,name:ev.target.value}))}
                          style={{gridColumn:'1/-1',padding:'5px 8px',fontSize:11,borderRadius:5,border:'.5px solid var(--brd)',background:'var(--bg)',color:'var(--tx)',boxSizing:'border-box'}}/>
                        <input type="number" inputMode="decimal" min="0" value={editSubForm.amount||''} placeholder={t('mov.edit.amountPh')} aria-label={t('mov.form.amountSimple')}
                          onChange={ev=>setEditSubForm(f=>({...f,amount:ev.target.value}))}
                          style={{padding:'5px 8px',fontSize:11,borderRadius:5,border:'.5px solid var(--brd)',background:'var(--bg)',color:'var(--tx)',boxSizing:'border-box'}}/>
                        <select value={editSubForm.frequency||sub.frequency} aria-label={t('mov.form.freq')}
                          onChange={ev=>setEditSubForm(f=>({...f,frequency:ev.target.value}))}
                          style={{padding:'5px 8px',fontSize:11,borderRadius:5,border:'.5px solid var(--brd)',background:'var(--bg)',color:'var(--tx)',boxSizing:'border-box'}}>
                          {FREQS.map(f => <option key={f.value} value={f.value}>{t(f.label)}</option>)}
                        </select>
                      </div>
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>saveSubEdit(sub)} style={{fontSize:10,padding:'3px 10px',borderRadius:4,border:'none',background:'var(--laton)',color:'var(--navy)',cursor:'pointer',fontFamily:'var(--mono)',fontWeight:600}}>{t('mov.edit.save')}</button>
                        <button onClick={()=>{setEditingSubId(null);setEditSubForm({})}} style={{fontSize:10,padding:'3px 10px',borderRadius:4,border:'.5px solid var(--brd)',background:'none',color:'var(--th)',cursor:'pointer',fontFamily:'var(--mono)'}}>{t('common.cancel')}</button>
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={sub.id} style={{ display:'flex', alignItems:'center', gap:8,
                    padding:'8px 14px',
                    borderBottom: i < arr.length-1 ? '.5px solid var(--brd)' : 'none' }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', flexShrink:0,
                      background: CAT_COLORS[sub.category]||'#00b8d9' }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, color:'var(--tx)', fontWeight:500,
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {sub.name}
                      </div>
                      <div style={{ fontSize:10, color:'var(--th)', fontFamily:'var(--mono)' }}>
                        {sub.category} · {freq}
                      </div>
                    </div>
                    <div style={{ fontSize:12, fontWeight:600, color:'var(--amb,#f5a623)',
                      fontFamily:'var(--mono)', flexShrink:0 }}>
                      {t('mov.list.perMonth', { v: fmtM(monthly, sym) })}
                    </div>
                    {updateSubscription && (
                      <button onClick={()=>{setEditingSubId(sub.id);setEditSubForm({name:sub.name||'',amount:sub.amount,frequency:sub.frequency,category:sub.category})}}
                        style={{background:'none',border:'none',color:'var(--th)',fontSize:11,cursor:'pointer',padding:0,minWidth:44,minHeight:44,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}
                        title={t('mov.edit.editTitle')} aria-label={`${t('mov.edit.editTitle')}: ${sub.name}`}>✏️</button>
                    )}
                    {deleteSubscription && (
                      <button onClick={()=>deleteWithUndo('subscriptions', sub, t('common.deleted'), t('common.undo'))}
                        style={{background:'none',border:'none',color:'var(--th)',fontSize:10,cursor:'pointer',padding:0,minWidth:44,minHeight:44,display:'inline-flex',alignItems:'center',justifyContent:'center',flexShrink:0}}
                        title={t('mov.edit.delTitle')} aria-label={`${t('mov.edit.delTitle')}: ${sub.name}`}>✕</button>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      </div>



      {/* Disclaimer */}
      <div style={{ fontSize:10, color:'var(--th)', fontFamily:'var(--mono)', marginTop:4 }}>
        {t('mov.disclaimer')}
      </div>
    </div>
  )
}
