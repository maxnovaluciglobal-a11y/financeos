// src/pages/Goals/index.jsx — v1.6 (R9: bolsas fijas, alta corta en hoja, aporte en hoja)
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import SignalIcon, { InlineIcon } from '../../components/icons/SignalIcon.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { KPI, Card, CardHeader, FormGroup, FormRow, Btn, Alert, PageHeader, EmptyState, EmptyChoices, EmptyChoice } from '../../components/ui/index.jsx'
import { monthsAheadFirstDay } from '../../utils/monthMath.js'
import { Flag, Pencil, X } from 'lucide-react'
import { fmtMoney as fmtMoneyRaw, fmtPct, currentMonth, localMonthStr, localDateStr, prioLabel, currencySymbol, monthYearLabel, fmtPctPoints } from '../../utils/index.js'
import config from '../../config.js'
import { logRejection } from '../../utils/errorLog.js'
import { fixedBuckets, draftFromTemplate, buildGoal, applyContribution, toFullFormDate, isEmergencyGoal as isEmergencyFlagged, isGeneralGoal } from './goalFlow.js'
import { FixedBuckets, TemplateGrid, GoalFlowSheet, ContributionSheet, GOAL_ICONS } from './GoalSheets.jsx'
import { goalStatuses } from './goalStatus.js'
import { generateGoalSuggestions, totalMonthlyContribution } from '../../utils/goalSuggestions.js'
import { projectEndOfMonth } from '../../utils/projection.js'
import { isEmergencyGoalName } from '../../utils/emergencyGoal.js'
import Money, { useMoney } from '../../components/Money.jsx'

export default function Goals() {
  const { goals, addGoal, delGoal, updateGoal, incomes: _incAll, expenses: _expAll, settings, deleteWithUndo, showToast } = useApp()
  const { t, lang } = useT()
  const incomes = (_incAll || []).filter(r => !r?.inv)   // "disponible para ahorrar" personal: excluye inversión
  const expenses = (_expAll || []).filter(r => !r?.inv)
  const [show, setShow]               = useState(false)
  const [f, setF]                     = useState({ name:'', target:'', saved:'', targetDate:'', priority:'Media', color:'#14213D' })
  const [err, setErr]                 = useState('')
  const [flow, setFlow]               = useState(null)   // alta corta (R9): { step, draft }
  const [contribGoal, setContribGoal] = useState(null)   // aporte en hoja (R9)
  // Deshacer el alta: addGoal no devuelve el id, así que se busca por createdAt
  // en la lista vigente cuando se toca "Deshacer" (segundos después).
  const goalsRef = useRef(goals)
  useEffect(() => { goalsRef.current = goals }, [goals])
  const [showSuggest, setShowSuggest] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [editingId, setEditingId]     = useState(null)
  const [editForm, setEditForm]       = useState({})

  const sym              = currencySymbol(settings.currency, settings.language)
  // Ocultar montos (T13): fmtMoney enmascara cuando settings.hideAmounts está activo.
  const { m } = useMoney()
  const fmtMoney = (n, s) => m(fmtMoneyRaw(n, s))
  const activeMonth      = settings.activeMonth || currentMonth()

  const ingresoNetoGoals = useMemo(() => {
    return (incomes || []).filter(r => r.date?.startsWith(activeMonth)).reduce((s,r) => s+r.amount, 0)
  }, [incomes, activeMonth])

  const gastoMensualGoals = useMemo(() => {
    return (expenses || []).filter(r => r.date?.startsWith(activeMonth)).reduce((s,r) => s+r.amount, 0)
  }, [expenses, activeMonth])

  // Base para la recomendación de fondo de emergencia (3 meses de gastos):
  // promedio de meses con gastos (sin dilución), o el gasto del mes / ingreso como fallback.
  const emergencyBase = useMemo(() => {
    const { avgExp } = projectEndOfMonth({ incomes, expenses, activeMonth })
    return avgExp > 0 ? avgExp : (gastoMensualGoals > 0 ? gastoMensualGoals : ingresoNetoGoals)
  }, [incomes, expenses, activeMonth, gastoMensualGoals, ingresoNetoGoals])
  const isEmergencyGoal = (g) => isEmergencyGoalName(g.name)
  const buckets = useMemo(() => fixedBuckets(goals, { emergencyBase }), [goals, emergencyBase])

  const totalTarget = useMemo(() => goals.reduce((s,g) => s+g.target, 0), [goals])
  const totalSaved  = useMemo(() => goals.reduce((s,g) => s+g.saved, 0), [goals])
  // Estado por ritmo, no por porcentaje (UI-Q5): "A tiempo" / "Atrasada".
  const statuses = useMemo(() => goalStatuses(goals, { activeMonth, available: ingresoNetoGoals - gastoMensualGoals }),
    [goals, activeMonth, ingresoNetoGoals, gastoMensualGoals])

  function openSuggestions() {
    setSuggestions(generateGoalSuggestions({ ingresoNeto:ingresoNetoGoals, gastoMensual:gastoMensualGoals, existingGoals:goals }, t))
    setShowSuggest(true)
  }

  async function createSuggestedGoals() {
    for (const s of suggestions.filter(s => s.selected && !s.alreadyExists)) {
      const targetDate = monthsAheadFirstDay(new Date(), s.monthsToGoal || 12)
      await addGoal({ name:s.name, target:s.target, saved:0, targetDate:localMonthStr(targetDate), priority:s.goalPriority, color:s.color })
    }
    setShowSuggest(false); setSuggestions([])
  }

  async function saveEdit(goal) {
    if (!editForm.name?.trim() || !editForm.target || Number(editForm.target) <= 0) return
    await updateGoal({ ...goal, name:editForm.name.trim(), target:Number(editForm.target), targetDate:editForm.targetDate||'', priority:editForm.priority||'Media' })
    setEditingId(null); setEditForm({})
  }

  async function submit() {
    if (!f.name.trim() || !f.target || Number(f.target) <= 0) { setErr(t('goals.err.required')); return }
    setErr('')
    await addGoal({ ...f, target:Number(f.target), saved:Number(f.saved)||0 })
    setF({ name:'', target:'', saved:'', targetDate:'', priority:'Media', color:'#14213D' })
    setShow(false)
  }

  // ── R9: alta corta, bolsas fijas y aporte (patrones rial #40–#44) ─────────
  const fmtPlain = (n) => fmtMoney(n, sym)
  function openFlow(step = 0, draft = {}) { setFlow({ step, draft }) }
  // Estables: useDialogA11y re-corre (y mueve el foco) si cambia onClose.
  const closeFlow = useCallback(() => setFlow(null), [])
  const closeContrib = useCallback(() => setContribGoal(null), [])
  function pickTemplate(id) { setFlow({ step: 1, draft: draftFromTemplate(id, t, { emergencyBase }) }) }

  async function createGoal(draft) {
    const goal = buildGoal(draft)
    try { await addGoal(goal) } catch { return }   // addGoal ya avisó el error
    setFlow(null)
    showToast(t('goals.r9.toast.created', { name: goal.name }), 'ok', {
      label: t('common.undo'),
      onAction: () => {
        const g = (goalsRef.current || []).find(x => x.createdAt === goal.createdAt && x.name === goal.name)
        if (g) delGoal(g.id).catch(logRejection('Goals:undoCreate'))
      },
    })
  }

  // Bolsa fija: si existe, aporte (o ir a la tarjeta si ya está completa); si
  // no, el fondo de emergencia con monto calculable se crea de un toque y lo
  // demás abre el alta corta en el paso del monto.
  function onBucket(b) {
    if (b.goal) {
      if (b.goal.target > 0 && b.goal.saved >= b.goal.target) {
        const el = document.getElementById(`goal-card-${b.goal.id}`)
        el?.scrollIntoView?.({ block: 'center', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
        el?.focus?.({ preventScroll: true })
        return
      }
      setContribGoal(b.goal); return
    }
    const draft = draftFromTemplate(b.id, t, { emergencyBase })
    if (b.id === 'emergency' && b.suggested) { createGoal(draft); return }
    openFlow(1, draft)
  }

  // "Más opciones": el formulario completo de siempre, con lo ya escrito.
  function openFullForm(draft = {}) {
    setFlow(null); setErr('')
    setF({ name: draft.name || '', target: draft.target ? String(draft.target) : '', saved: '', targetDate: toFullFormDate(draft.targetDate), priority: draft.priority || 'Media', color: '#14213D', ...(draft.icon ? { icon: draft.icon } : {}), ...(draft.kind ? { kind: draft.kind } : {}) })
    setShow(true)
    setTimeout(() => {
      const el = document.getElementById(draft.name ? (draft.target ? 'goal-new-submit' : 'goal-new-target') : 'goal-new-name')
      el?.scrollIntoView?.({ block: 'center', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
      el?.focus?.({ preventScroll: true })
    }, 0)
  }
  function openSuggestFromFlow() { setFlow(null); openSuggestions() }

  async function confirmContribution(amount, method) {
    const prev = contribGoal
    const r = applyContribution(prev, amount, { method, date: localDateStr() })
    if (!r) return
    try { await updateGoal(r.goal) } catch { return }
    setContribGoal(null)
    const msg = r.done
      ? t('goals.r9.toast.addedDone', { v: fmtPlain(r.added) })
      : t('goals.r9.toast.added', { v: fmtPlain(r.added), r: fmtPlain(r.remaining) })
    showToast(msg, 'ok', { label: t('common.undo'), onAction: () => { updateGoal(prev).catch(logRejection('Goals:undoContribution')) } })
  }

  // Un solo primario Latón por pantalla (sistema-visual, regla 4; V2): "+ Nueva
  // meta" lo es mientras no haya un panel abierto con su propio primario (alta,
  // sugerencias, edición o aporte); ahí pasa a secundario. `data-screen-primary`
  // avisa al demo que esta pantalla ya tiene primario: sus CTA pasan a
  // secundarios (globals.css).
  const panelOpen = show || showSuggest || editingId != null
  const goalIcon = (g) => GOAL_ICONS[g.icon] || (isEmergencyFlagged(g) ? GOAL_ICONS.emergency : isGeneralGoal(g) ? GOAL_ICONS.general : null)

  return (
    <div className="stack" data-screen-primary="">
      {/* Un solo subtítulo (UI-Q11): "goals.sub" repetía lo mismo que la intro. */}
      <PageHeader title={t('goals.title')} sub={t('goals.intro')} />
      {/* R9 (#41): las dos bolsas fijas, siempre visibles, como filas livianas. */}
      <FixedBuckets buckets={buckets} t={t} fmt={fmtPlain} onSelect={onBucket} />
      {/* Sin metas, cuatro ceros no dicen nada: la pregunta guiada va primero. */}
      {goals.length > 0 && <div className="kpi-row">
        <KPI label={t('goals.kpi.active')}  value={goals.length} />
        <KPI label={t('goals.kpi.target')} value={fmtMoney(totalTarget,sym)} />
        <KPI label={t('goals.kpi.saved')} value={fmtMoney(totalSaved,sym)} color="green" sub={totalTarget>0 ? t('goals.kpi.savedSub', { pct: fmtPct(totalSaved/totalTarget) }) : '—'} />
        <KPI label={t('goals.kpi.done')}    value={goals.filter(g=>g.saved>=g.target).length} color="green" />
      </div>}
      {/* Disponible este mes para ahorrar */}
      {(() => {
        const disponible = ingresoNetoGoals - gastoMensualGoals
        if (ingresoNetoGoals <= 0) return null
        const ok = disponible > 0
        return (
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:'var(--r)', background: ok ? 'var(--accent-bg)' : 'var(--red-bg)', border:`.5px solid ${ok ? 'var(--accent)' : 'var(--red)'}`, flexWrap:'wrap' }}>
            <span style={{ fontSize: 12, fontFamily: 'var(--sans)', fontWeight: 600, color:'var(--th)'}}>{t('goals.available')}</span>
            <span style={{ fontSize:15, fontWeight:700, fontFamily: 'var(--num)', color: ok ? 'var(--accent)' : 'var(--red)', marginLeft:'auto' }}>
              {ok ? '' : '−'}<Money>{fmtMoney(Math.abs(disponible), sym)}</Money>
            </span>
            {!ok && <span style={{ fontSize:11, color:'var(--red)', width:'100%' }}>{t('goals.available.negative')}</span>}
          </div>
        )
      })()}
      {/* "+ Nueva meta" abre la hoja con la cuadrícula (R9 #40). "Sugerir metas
          básicas" y el formulario completo siguen dentro de esa hoja. Sin metas,
          la cuadrícula va en el estado vacío y este botón no se repite. */}
      {goals.length > 0 && (
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}} data-tour="goals-new">
          <Btn variant={panelOpen ? 'ghost' : 'primary'} onClick={() => openFlow(0)} aria-haspopup="dialog">{t('goals.toggle.new')}</Btn>
        </div>
      )}

      {show && (
        <Card>
          <CardHeader title={t('goals.new')} />
          {err && <Alert type="danger">{err}</Alert>}
          <FormGroup label={t('goals.form.name')}><input id="goal-new-name" type="text" value={f.name} placeholder={t('goals.form.namePh')} onChange={e=>setF(p=>({...p,name:e.target.value}))} /></FormGroup>
          <FormRow>
            <FormGroup label={t('goals.form.target', { currency: settings.currency||'CLP' })}><input id="goal-new-target" type="number" inputMode="decimal" min="0" step="any" value={f.target} placeholder="0" onChange={e=>setF(p=>({...p,target:e.target.value}))} /></FormGroup>
            <FormGroup label={t('goals.form.saved')}><input type="number" inputMode="decimal" min="0" step="any" value={f.saved} placeholder="0" onChange={e=>setF(p=>({...p,saved:e.target.value}))} /></FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label={t('goals.form.date')}><input type="date" value={f.targetDate} onChange={e=>setF(p=>({...p,targetDate:e.target.value}))} /></FormGroup>
            <FormGroup label={t('goals.form.priority')}><select value={f.priority} onChange={e=>setF(p=>({...p,priority:e.target.value}))}>{['Alta','Media','Baja'].map(p=><option key={p} value={p}>{prioLabel(p, lang)}</option>)}</select></FormGroup>
          </FormRow>
          <div style={{display:'flex',gap:8}}>
            <Btn id="goal-new-submit" variant="primary" onClick={submit}>{t('goals.form.submit')}</Btn>
            <Btn variant="ghost"   onClick={() => setShow(false)}>{t('common.cancel')}</Btn>
          </div>
        </Card>
      )}

      {showSuggest && (
        <Card>
          <CardHeader title={t('goals.suggest.title')} />
          {ingresoNetoGoals > 0 ? (
            <>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14,padding:'8px 12px',background:'var(--sur2)',borderRadius:6}}>
                <span style={{fontSize:11,color:'var(--th)',fontFamily: 'var(--sans)'}}>{t('goals.suggest.basedOn', { month: activeMonth })}</span>
                <span style={{fontSize:13,fontWeight:700,color:'var(--grn)',fontFamily: 'var(--num)'}}><Money>{fmtMoney(ingresoNetoGoals,sym)}</Money></span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:14}}>
                {suggestions.map((s,i) => (
                  <div key={s.id} style={{padding:'12px 14px',borderRadius:8,border:`0.5px solid ${s.selected&&!s.alreadyExists?'rgba(10,92,62,.25)':'var(--brd)'}`,background:s.alreadyExists?'var(--sur2)':s.selected?'rgba(10,92,62,.04)':'var(--bg)',opacity:s.alreadyExists?0.6:1,boxSizing:'border-box',width:'100%',overflow:'hidden'}}>
                    <div style={{display:'grid',gridTemplateColumns:'20px 1fr',gap:10,alignItems:'start'}}>
                      <input type="checkbox" checked={s.selected&&!s.alreadyExists} disabled={s.alreadyExists}
                        onChange={e=>setSuggestions(prev=>prev.map((x,j)=>j===i?{...x,selected:e.target.checked}:x))}
                        style={{marginTop:3,accentColor:'var(--grn)'}}/>
                      <div style={{minWidth:0}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4,flexWrap:'wrap',gap:4}}>
                          <span style={{fontSize:13,fontWeight:600,color:'var(--tx)'}}>{s.name}</span>
                          {s.alreadyExists && <span style={{fontSize:11,padding:'1px 6px',borderRadius:4,background:'var(--sur2)',color:'var(--th)',fontFamily: 'var(--sans)'}}>{t('goals.suggest.exists')}</span>}
                        </div>
                        <div style={{fontSize:11,color:'var(--th)',fontFamily: 'var(--sans)',marginBottom:6,lineHeight:1.4}}>{s.description}</div>
                        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:4}}>
                          <span style={{fontSize:11,fontFamily: 'var(--num)',color:'var(--grn)',fontWeight:600}}>{t('goals.suggest.target', { v: fmtMoney(s.target,sym) })}</span>
                          <span style={{fontSize:11,fontFamily: 'var(--sans)',color:'var(--th)'}}>{t('goals.suggest.monthly', { v: fmtMoney(s.monthlyContribution,sym) })}</span>
                          {s.monthsToGoal && <span style={{fontSize:11,fontFamily: 'var(--sans)',color:'var(--th)'}}>{t('goals.suggest.months', { n: s.monthsToGoal })}</span>}
                        </div>
                        <div style={{fontSize:11.5,color:'var(--th)',fontFamily:'var(--sans)',fontStyle:'italic',lineHeight:1.45}}>{s.hint}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{padding:'10px 14px',background:'var(--sur2)',borderRadius:6,marginBottom:14}}>
                <div style={{fontSize:11,color:'var(--th)',fontFamily: 'var(--sans)'}}>
                  {t('goals.suggest.totalLine')} <span style={{color:'var(--grn)',fontWeight:700}}><Money>{fmtMoney(totalMonthlyContribution(suggestions),sym)}</Money>{t('goals.suggest.perMonthSuffix')}</span>
                  <span style={{marginLeft:8,color:'var(--th)'}}>{t('goals.suggest.pctIncome', { pct: fmtPctPoints(ingresoNetoGoals>0?((totalMonthlyContribution(suggestions)/ingresoNetoGoals)*100).toFixed(0):0) })}</span>
                </div>
              </div>
              <div style={{fontSize:11,color:'var(--th)',fontFamily: 'var(--sans)',marginBottom:12,lineHeight:1.5}}>
                <InlineIcon kind="info" size={12} />{t('goals.suggest.disclaimer')}
              </div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                <Btn variant="primary" onClick={createSuggestedGoals} disabled={suggestions.filter(s=>s.selected&&!s.alreadyExists).length===0}>{t('goals.suggest.create')}</Btn>
                <Btn variant="ghost" onClick={()=>{setShowSuggest(false);setSuggestions([])}}>{t('common.cancel')}</Btn>
              </div>
            </>
          ) : (
            <div style={{fontSize:12,color:'var(--th)',fontFamily: 'var(--sans)',padding:'12px 0'}}>
              <InlineIcon kind="alert" size={13} />{t('goals.suggest.noIncome', { month: activeMonth })}
            </div>
          )}
        </Card>
      )}

      {goals.length === 0 && !show && (
        <div data-tour="goals-new">
          <EmptyState icon={Flag} title={t('goals.first.title')} text={t('goals.first.text')}
            secondary={{ label: t('goals.r9.suggestLink'), onClick: openSuggestions }}>
            <TemplateGrid t={t} onPick={pickTemplate} />
          </EmptyState>
        </div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:10}} data-tour={goals.length > 0 ? 'goals-list' : undefined}>
        {goals.map(g => {
          const p    = g.target > 0 ? Math.min(g.saved/g.target, 1) : 0
          const done = g.saved >= g.target
          // Progreso en Navy (marca); verde solo al cumplirla. El porcentaje ya
          // no se pinta de rojo: el estado lo dice el ritmo, con ícono y palabra.
          const clr  = done ? 'var(--pos)' : 'var(--grn)'
          const st   = statuses[g.id]
          const isEditing = editingId === g.id
          const GIcon = goalIcon(g)
          return (
            <div key={g.id} id={`goal-card-${g.id}`} tabIndex={-1} style={{outline:'none',background:'var(--sur2)',borderRadius:10,padding:'14px 16px',border:`0.5px solid ${isEditing?'rgba(10,92,62,.4)':done?'rgba(10,92,62,.25)':'var(--brd)'}`}}>
              {isEditing ? (
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <div style={{gridColumn:'1/-1'}}>
                      <div style={{fontSize:11,color:'var(--th)',fontFamily: 'var(--sans)',marginBottom:4}}>{t('goals.edit.name')}</div>
                      <input type="text" value={editForm.name||''} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))}
                        style={{width:'100%',padding:'6px 10px',fontSize:13,borderRadius:6,border:'0.5px solid var(--brd)',background:'var(--bg)',color:'var(--tx)',boxSizing:'border-box'}}/>
                    </div>
                    <div>
                      <div style={{fontSize:11,color:'var(--th)',fontFamily: 'var(--sans)',marginBottom:4}}>{t('goals.edit.target')}</div>
                      <input type="number" inputMode="decimal" min="0" step="any" value={editForm.target||''} onChange={e=>setEditForm(f=>({...f,target:e.target.value}))}
                        style={{width:'100%',padding:'6px 10px',fontSize:13,borderRadius:6,border:'0.5px solid var(--brd)',background:'var(--bg)',color:'var(--tx)',boxSizing:'border-box'}}/>
                    </div>
                    <div>
                      <div style={{fontSize:11,color:'var(--th)',fontFamily: 'var(--sans)',marginBottom:4}}>{t('goals.edit.date')}</div>
                      <input type="month" value={(editForm.targetDate||'').slice(0,7)} onChange={e=>setEditForm(f=>({...f,targetDate:e.target.value}))}
                        style={{width:'100%',padding:'6px 10px',fontSize:13,borderRadius:6,border:'0.5px solid var(--brd)',background:'var(--bg)',color:'var(--tx)',boxSizing:'border-box'}}/>
                    </div>
                    <div>
                      <div style={{fontSize:11,color:'var(--th)',fontFamily: 'var(--sans)',marginBottom:4}}>{t('goals.edit.priority')}</div>
                      <select value={editForm.priority||'Media'} onChange={e=>setEditForm(f=>({...f,priority:e.target.value}))}
                        style={{width:'100%',padding:'6px 10px',fontSize:13,borderRadius:6,border:'0.5px solid var(--brd)',background:'var(--bg)',color:'var(--tx)',boxSizing:'border-box'}}>
                        {['Alta','Media','Baja'].map(p=><option key={p} value={p}>{prioLabel(p, lang)}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <Btn variant="primary" size="xs" onClick={()=>saveEdit(g)}>{t('goals.edit.save')}</Btn>
                    <Btn variant="ghost"   size="xs" onClick={()=>{setEditingId(null);setEditForm({})}}>{t('common.cancel')}</Btn>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                    <div style={{flex:1,paddingRight:8}}>
                      <div style={{fontSize:13,fontWeight:600,color:'var(--tx)',marginBottom:2,display:'flex',alignItems:'center',gap:6}}>{GIcon && <GIcon size={14} strokeWidth={1.7} aria-hidden="true" style={{color:'var(--tm)',flexShrink:0}} />}{g.name}</div>
                      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                        {g.priority && <span className="fos-tag">{t('goals.card.priority', { p: prioLabel(g.priority, lang) })}</span>}
                        {g.targetDate && <span style={{fontSize:12,fontFamily:'var(--sans)',color:'var(--th)'}}>{t('goals.card.targetDate', { d: monthYearLabel(g.targetDate.slice(0,7)) })}</span>}
                        {st === 'done' && <span className="fos-state" style={{color:'var(--pos)'}}><SignalIcon kind="ok" size={13} />{t('goals.status.done')}</span>}
                        {st === 'onTrack' && <span className="fos-state" style={{color:'var(--pos)'}}><SignalIcon kind="ok" size={13} />{t('goals.status.onTrack')}</span>}
                        {st === 'behind' && <span className="fos-state" style={{color:'var(--warn)'}}><SignalIcon kind="alert" size={13} />{t('goals.status.behind')}</span>}
                      </div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                      <span className="num" style={{fontSize:14,fontWeight:600,color:'var(--tx)'}}>{fmtPct(p, { decimals: 0 })}</span>
                      <button onClick={()=>{setEditingId(g.id);setEditForm({name:g.name,target:g.target,targetDate:g.targetDate||'',priority:g.priority||'Media'})}}
                        style={{background:'none',border:'none',color:'var(--th)',fontSize:12,cursor:'pointer',padding:'2px 5px',minWidth:44,minHeight:44}} title={t('goals.card.editTitle')} aria-label={t('goals.card.editTitle')}><Pencil size={14} strokeWidth={1.7} aria-hidden="true" /></button>
                      <button onClick={()=>deleteWithUndo('goals', g, t('common.deleted'), t('common.undo'))} aria-label={t('common.confirmDelete')} style={{background:'none',border:'none',color:'var(--th)',fontSize:11,cursor:'pointer',padding:'2px 5px',minWidth:44,minHeight:44,display:'inline-flex',alignItems:'center',justifyContent:'center'}}><X size={16} strokeWidth={1.7} aria-hidden="true" /></button>
                    </div>
                  </div>
                  <div role="progressbar" aria-valuenow={Math.round(p*100)} aria-valuemin={0} aria-valuemax={100} aria-label={g.name} style={{height:8,background:'var(--sur3)',borderRadius:4,overflow:'hidden',marginBottom:8}}>
                    <div style={{height:'100%',width:'100%',transform:`scaleX(${p})`,transformOrigin:'left',background:clr,borderRadius:4,transition:'transform .4s'}}/>
                  </div>
                  {/* Meta de emergencia creada con la recomendación anterior (6 meses):
                      ofrecer ajuste de un tap a la recomendación vigente (3 meses de gastos) */}
                  {(() => {
                    if (!isEmergencyGoal(g) || emergencyBase <= 0) return null
                    const recommended = Math.round(emergencyBase * 3)
                    if (recommended <= 0 || Math.abs(g.target - recommended) / recommended < 0.15) return null
                    return (
                      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',padding:'6px 10px',marginBottom:8,background:'rgba(245,166,35,.07)',border:'.5px solid rgba(245,166,35,.25)',borderRadius:6}}>
                        <span style={{fontSize:11,fontFamily: 'var(--sans)',color:'var(--amb)',flex:1,minWidth:180}}>{t('goals.emergencyAdjust', { v: fmtMoney(recommended, sym) })}</span>
                        <button onClick={() => updateGoal({ ...g, target: recommended, saved: Math.min(g.saved, recommended) })}
                          style={{background:'none',border:'.5px solid var(--amb)',borderRadius:6,padding:'3px 10px',fontSize:11,fontWeight:600,color:'var(--amb)',cursor:'pointer',fontFamily: 'var(--num)',whiteSpace:'nowrap'}}>
                          {t('goals.emergencyAdjustBtn')}
                        </button>
                      </div>
                    )
                  })()}
                  {/* flexWrap: con montos largos (Bs. en millones) la fila no entra en 375px; se reparte en líneas en vez de salirse de la tarjeta */}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'4px 8px'}}>
                    <div style={{display:'flex',flexWrap:'wrap',gap:'2px 6px',alignItems:'baseline',minWidth:0}}>
                      <span className="num" style={{fontSize:12,color:'var(--tx)',fontWeight:600}}><Money>{fmtMoney(g.saved,sym)}</Money></span>
                      <span style={{fontSize:11,fontFamily: 'var(--sans)',color:'var(--th)'}}>{t('goals.card.of', { v: fmtMoney(g.target,sym) })}</span>
                      <span style={{fontSize:11,fontFamily: 'var(--sans)',color:'var(--th)'}}>{t('goals.card.remaining', { v: fmtMoney(g.target-g.saved,sym) })}</span>
                    </div>
                    {!done && <Btn variant="ghost" size="xs" onClick={()=>setContribGoal(g)} aria-haspopup="dialog" style={{minHeight:44}}>{t('goals.card.addSaving')}</Btn>}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      <GoalFlowSheet flow={flow} setFlow={setFlow} onClose={closeFlow} onPickTemplate={pickTemplate}
        onCreate={createGoal} onMore={openFullForm} onSuggest={openSuggestFromFlow}
        t={t} fmt={fmtPlain} currency={settings.currency || 'CLP'} activeMonth={activeMonth} />
      {contribGoal && (
        <ContributionSheet key={contribGoal.id} goal={contribGoal} onClose={closeContrib} onConfirm={confirmContribution}
          t={t} lang={lang} fmt={fmtPlain} currency={settings.currency || 'CLP'}
          methods={config.paymentMethods} lastPaymentMethod={settings.lastPaymentMethod} />
      )}
    </div>
  )
}
