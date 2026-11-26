// src/pages/Investments/planificar/Planificar.jsx — pestaña Planificar (F5).
// Dos partes (rediseño del 26-nov-2026, propuesta 9 de la auditoría del flujo
// de Inversiones): Tus tramos (oportunidades) y Aportes.
//  · Tus tramos: la tabla de distancias y el reparto (../oportunidades) y, al
//    pie, la calculadora "¿Cuánto puedo perder si sale mal?" plegada, con tu
//    regla de riesgo adentro (antes era su propia sub-pestaña).
//  · Aportes: el aporte, cómo lo repartes y, al pie, "¿Cuánto podrías tener?"
//    y los planes guardados, plegados (antes Planes guardados era otra
//    sub-pestaña).
// Lo que pedía una parte vieja cae en la nueva (normPlanSub): 'calc' abre
// Tus tramos con la calculadora desplegada; 'planes', Aportes con los planes.
// La regla va en los metadatos de la cuenta (invest_risk_rule, decisión de
// Walter del 20-nov-2026), 1 % por defecto; el capital, en profiles.capital
// (core/investData.js); los planes, en los metadatos de la cuenta
// (invest_plans, con topes). En el demo todo vive en memoria
// (demo/demoInvestBook.js). Nada de esto se guarda en el dispositivo: llevan
// tickers.
// Vista esencial: "¿Cuánto puedo perder si sale mal?" en palabras, el aporte
// mensual y el reparto de tu capital disponible; stop, R, límite por posición
// y la escalera de medias móviles, solo en Vista completa. "Repartir" en
// Resumen abre Aportes con el monto (investNav.queuePlanAporte).
import { INVEST_ORIGIN } from '../../../core/investBridge.js'
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../../context/AppContext.jsx'
import { makeFmt } from '../portfolio/format.js'
import { TradeSheet } from '../portfolio/sheets.jsx'
import { usePT } from '../portfolio/text.js'
import { usePortfolioBook } from '../portfolio/usePortfolioBook.js'
import { useTargets } from '../portfolio/targetsStore.js'
import { validateCapital, validateRiskRule } from '../../../core/investData.js'
import { amount, applyPlanChange, MAX_PLANS, newPlanId, normalizePlan, tradePlanFrom } from '../../../utils/investPlan.js'
import { shows } from '../../../utils/investView.js'
import { takePlanQueue } from '../../../utils/investNav.js'
import Calculator, { ruleDecimals } from './Calculator.jsx'
import Aportes from './Aportes.jsx'
import Plans, { planLabel } from './Plans.jsx'
import Fold from './Fold.jsx'
import { usePlanT } from './dict.js'
import s from './planificar.module.css'
import { takeOppQueue } from '../oportunidades/queue.js'

// Oportunidades (Inversiones v2): su propio chunk, con sus textos.
const Oportunidades = lazy(() => import('../oportunidades/Oportunidades.jsx'))

export const PLAN_SUBS = ['oportunidades', 'aportes']
export const DEFAULT_PLAN_SUB = 'oportunidades'
// Partes de antes del 26-nov-2026 → la nueva y qué sección se despliega.
export function normPlanSub(sub) {
  if (sub === 'calc') return { sub: 'oportunidades', calc: true, plans: false }
  if (sub === 'planes') return { sub: 'aportes', calc: false, plans: true }
  return { sub: PLAN_SUBS.includes(sub) ? sub : DEFAULT_PLAN_SUB, calc: false, plans: false }
}

const USD = { ccy: 'USD', rate: 1, fallback: false, missing: false }

export function RuleCard({ t, fmt, rule, capital, view, demo, onSaveRule, onSaveCapital, flat = false }) {
  const H = flat ? 'h3' : 'h2'
  const full = shows(view, 'riskR')
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ risk: '', limit: '' })
  const [errs, setErrs] = useState({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [cap, setCap] = useState('')
  const [capErr, setCapErr] = useState(null)
  const pct = (v) => fmt.pct(v / 100, { decimals: ruleDecimals(v) })

  function start() { setF({ risk: String(rule.risk), limit: String(rule.limit) }); setErrs({}); setMsg(null); setOpen(true) }
  async function save(e) {
    e.preventDefault()
    const v = validateRiskRule({ risk: f.risk, limit: full ? f.limit : rule.limit })
    if (!v.ok) { setErrs(v.fields); return }
    setBusy(true)
    const r = await onSaveRule(v.value)
    setBusy(false)
    if (r.ok) { setOpen(false); setMsg(demo ? 'plan.rule.savedDemo' : 'plan.rule.saved') } else setErrs({ form: 'save' })
  }
  async function saveCap(e) {
    e.preventDefault()
    if (String(cap).trim() === '') { setCapErr('required'); return }
    const v = validateCapital(amount(cap))
    if (!v.ok) { setCapErr('invalid'); return }
    setBusy(true)
    const r = await onSaveCapital(v.value)
    setBusy(false)
    if (r.ok) { setCap(''); setCapErr(null) } else setCapErr('save')
  }

  return (
    <section className={flat ? `${s.card} ${s.inner}` : s.card} aria-labelledby="plan-rule-title">
      <div className={s.between}>
        <H id="plan-rule-title" className={s.title}>{t('plan.rule.title')}</H>
        {!open && <button type="button" className={s.link} onClick={start}>{t('plan.rule.edit')}</button>}
      </div>
      {!open && <p className={s.lead}>{full ? t('plan.rule.lineFull', { pct: pct(rule.risk), limit: pct(rule.limit) }) : t('plan.rule.line', { pct: pct(rule.risk) })}</p>}
      {open && (
        <form className={s.wrap} onSubmit={save} noValidate>
          <div className={s.grid}>
            <label className={s.field}>
              <span className={s.fieldLabel}>{t('plan.rule.risk')}</span>
              <input className={s.input} value={f.risk} onChange={e => { setF({ ...f, risk: e.target.value }); setErrs({}) }} inputMode="decimal" autoComplete="off" aria-invalid={!!errs.risk || undefined} aria-describedby="plan-rule-risk-help" />
              <span id="plan-rule-risk-help" className={s.help}>{t('plan.rule.riskHelp')}</span>
              {errs.risk && <span className={s.error}>{t(`plan.rule.err.${errs.risk}`)}</span>}
            </label>
            {full && (
              <label className={s.field}>
                <span className={s.fieldLabel}>{t('plan.rule.limit')}</span>
                <input className={s.input} value={f.limit} onChange={e => { setF({ ...f, limit: e.target.value }); setErrs({}) }} inputMode="decimal" autoComplete="off" aria-invalid={!!errs.limit || undefined} aria-describedby="plan-rule-limit-help" />
                <span id="plan-rule-limit-help" className={s.help}>{t('plan.rule.limitHelp')}</span>
                {errs.limit && <span className={s.error}>{t(`plan.rule.err.${errs.limit}`)}</span>}
              </label>
            )}
          </div>
          {errs.form && <p className={s.error} role="alert">{t('plan.rule.err.save')}</p>}
          <p className={s.note}>{t('plan.rule.where')}</p>
          <div className={s.row}>
            <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={busy}>{t('plan.rule.save')}</button>
            <button type="button" className={s.btn} onClick={() => setOpen(false)}>{t('plan.rule.cancel')}</button>
          </div>
        </form>
      )}
      {msg && !open && <p className={s.ok} role="status">{t(msg)}</p>}

      {capital > 0 ? (
        <p className={s.note}>{t('plan.cap.line', { v: fmt.money(capital) })}</p>
      ) : (
        <form className={s.addRow} onSubmit={saveCap} noValidate>
          <p className={s.note} style={{ gridColumn: '1 / -1' }}>{t('plan.cap.none')}</p>
          <label className={s.field}>
            <span className={s.fieldLabel}>{t('plan.cap.label')}</span>
            <input className={s.input} value={cap} onChange={e => { setCap(e.target.value); setCapErr(null) }} inputMode="decimal" autoComplete="off" aria-invalid={!!capErr || undefined} />
          </label>
          <span />
          <button type="submit" className={s.btn} disabled={busy}>{t('plan.cap.save')}</button>
          {capErr && <p className={s.error} role="alert" style={{ gridColumn: '1 / -1' }}>{t(`plan.cap.err.${capErr}`)}</p>}
        </form>
      )}
    </section>
  )
}

export default function Planificar({ demo = false, view, onTab, onOpen }) {
  const { t, ready } = usePlanT()
  const { t: tp } = usePT()
  const app = useApp() || {}
  const settings = app.settings || {}
  const showToast = app.showToast
  const toast = useCallback((msg, type = 'ok', action = null) => showToast?.(msg, type, action), [showToast])
  const pb = usePortfolioBook({ demo })
  const fmt = useMemo(() => makeFmt({ disp: USD, currency: settings.currency, language: settings.language }), [settings.currency, settings.language])
  const [targets] = useTargets()
  // Lo pedido desde Resumen: Oportunidades (queue.js) o Aportes (investNav).
  const [arrival] = useState(() => { const o = takeOppQueue(); const a = takePlanQueue(); return o || a })
  const [boot] = useState(() => normPlanSub(arrival?.sub))
  const [sub, setSub] = useState(boot.sub)
  const [calcOpen, setCalcOpen] = useState(boot.calc)
  const [plansOpen, setPlansOpen] = useState(boot.plans)
  const refs = useRef({})
  const calcHead = useRef(null)
  const plansHead = useRef(null)
  const [rule, setRule] = useState(pb.rule)
  const ruleTouched = useRef(false)
  const [plans, setPlans] = useState({ phase: 'loading', list: [] })
  const [editing, setEditing] = useState(null) // { id, k, label, name, ts }
  const [calcSeed, setCalcSeed] = useState(null)
  const [apSeed, setApSeed] = useState(null)
  const [trade, setTrade] = useState(null)

  // La regla llega con el perfil; si la persona ya la cambió aquí, manda la suya.
  useEffect(() => { if (!ruleTouched.current) setRule(pb.rule) }, [pb.rule])

  const store = pb.store
  const plansSeq = useRef(0)
  // Devuelve cómo cancelarla (al desmontar). Solo cuenta la última carga.
  const loadPlans = useCallback(() => {
    const my = ++plansSeq.current
    let alive = true
    setPlans(p => (p.phase === 'ready' ? p : { phase: 'loading', list: [] }))
    Promise.resolve(store.getPlans ? store.getPlans() : { ok: true, data: [] }).then(r => {
      if (alive && my === plansSeq.current) setPlans({ phase: r.ok ? 'ready' : 'error', list: r.ok ? r.data : [] })
    })
    return () => { alive = false }
  }, [store])
  useEffect(() => loadPlans(), [loadPlans])

  const saveRule = useCallback(async (value) => {
    const r = store.setRiskRule ? await store.setRiskRule(value) : { ok: false }
    if (r.ok) { ruleTouched.current = true; setRule(r.data) }
    return r
  }, [store])
  const saveCapital = useCallback(async (usd) => {
    const r = await pb.setCapital(usd)
    if (r.ok) toast(t('plan.cap.saved'))
    return r
  }, [pb, toast, t])

  // Aplica un cambio puntual (upsert/remove/restore) y lo guarda en la cuenta;
  // devuelve true si quedó guardado. El store lo aplica sobre la lista fresca
  // de la cuenta (updatePlans), no sobre la que se cargó al abrir. Si la lista
  // no se pudo cargar, no se guarda: se perderían los planes que ya están.
  const persist = useCallback(async (change) => {
    if (plans.phase !== 'ready') {
      toast(t('plan.pl.err.notLoaded'), 'error', { label: t('plan.retry'), onAction: loadPlans })
      return false
    }
    let r
    if (store.updatePlans) r = await store.updatePlans(change)
    else {
      const next = applyPlanChange(plans.list, change)
      r = next.ok ? await store.savePlans(next.list) : { ok: false, error: next.error }
    }
    if (!r.ok) {
      const key = r.error === 'plans_full' || r.error === 'plans_too_big' ? `plan.pl.err.${r.error}` : 'plan.pl.err.save'
      toast(t(key, { n: MAX_PLANS }), 'error')
      return false
    }
    setPlans({ phase: 'ready', list: r.data })
    return true
  }, [store, toast, t, plans, loadPlans])

  async function savePlan(build, okKey, okVars, { asNew = false } = {}) {
    const keep = editing && !asNew ? editing : null
    const plan = build(keep)
    if (!plan) { toast(t('plan.pl.err.save'), 'error'); return }
    if (await persist({ op: 'upsert', plan })) {
      setEditing({ id: plan.id, k: plan.k, name: plan.name, ts: plan.ts, label: planLabel(plan, t, fmt) })
      toast(keep ? t('plan.pl.updated') : t(okKey, okVars))
    }
  }
  const saveTradePlan = (input, sized, opts) => savePlan((keep) => tradePlanFrom({ ...input, name: keep?.name || '' }, sized, { id: keep?.id, now: Date.now() }), 'plan.calc.planSaved', { t: input.ticker }, opts)
  const saveAportePlan = (input, opts) => savePlan((keep) => normalizePlan({ ...input, id: keep?.id || newPlanId(), k: 'aporte', ts: Date.now(), name: keep?.name || '' }), 'plan.ap.planSaved', {}, opts)

  function openPlan(p) {
    setEditing({ id: p.id, k: p.k, name: p.name, ts: p.ts, label: planLabel(p, t, fmt) })
    if (p.k === 'trade') { setCalcSeed({ ...p }); go('calc') } else { setApSeed({ ...p }); go('aportes', { top: true }) }
  }
  async function renamePlan(p, name) {
    const ok = await persist({ op: 'upsert', plan: { ...p, name: String(name || '').trim() } })
    if (ok && editing?.id === p.id) setEditing(e => ({ ...e, name, label: planLabel({ ...p, name }, t, fmt) }))
    return ok
  }
  async function deletePlan(p) {
    const index = plans.list.findIndex(x => x.id === p.id)
    if (index < 0) return
    if (!(await persist({ op: 'remove', id: p.id }))) return
    if (editing?.id === p.id) setEditing(null)
    toast(t('plan.pl.deleted'), 'ok', {
      label: t('plan.pl.undo'),
      onAction: () => persist({ op: 'restore', plan: p, index }),
    })
  }

  // go('calc') y go('planes') siguen valiendo: abren la sección en su parte.
  function go(next, { top = false } = {}) {
    const n = normPlanSub(next)
    setSub(n.sub)
    if (n.calc) setCalcOpen(true)
    if (n.plans) setPlansOpen(true)
    const target = n.calc ? calcHead : n.plans ? plansHead : null
    const run = () => {
      const el = target?.current || refs.current[n.sub]
      if (target?.current || top) el?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
      el?.focus?.({ preventScroll: !!(target?.current || top) })
    }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run)
  }
  function onSubKey(e) {
    const i = PLAN_SUBS.indexOf(sub)
    const next = e.key === 'ArrowRight' ? PLAN_SUBS[(i + 1) % PLAN_SUBS.length]
      : e.key === 'ArrowLeft' ? PLAN_SUBS[(i - 1 + PLAN_SUBS.length) % PLAN_SUBS.length]
        : e.key === 'Home' ? PLAN_SUBS[0] : e.key === 'End' ? PLAN_SUBS[PLAN_SUBS.length - 1] : null
    if (!next) return
    e.preventDefault()
    go(next)
  }
  function changeSub(raw) {
    const next = normPlanSub(raw).sub
    // Cambiar de parte a mano deja de editar el plan abierto si es de otro tipo.
    if (editing && ((next === 'oportunidades' && editing.k !== 'trade') || (next === 'aportes' && editing.k !== 'aporte'))) setEditing(null)
    setSub(next)
  }

  async function recordTrade(form) {
    const r = await pb.recordTrade(form)
    if (!r.ok) return r
    setTrade(null)
    const tk = r.op.ticker
    if (r.effectFailed) toast(tp('pf.toast.effectFailed', { t: tk }), 'error')
    else if (r.effect.kind === 'create') toast(tp('pf.toast.created', { t: tk }))
    else if (r.effect.kind === 'lots') toast(tp('pf.toast.lots', { t: tk, n: r.effect.count }), 'error')
    else toast(tp('pf.toast.opSaved'))
    return r
  }

  if (!ready || pb.phase === 'loading') return <p className={s.note} role="status">{t('plan.loading')}</p>
  if (pb.phase === 'error') {
    return (
      <div className={s.card} role="alert">
        <p className={s.lead}>{t('plan.error')}</p>
        <div className={s.row}><button type="button" className={s.btn} onClick={pb.reload}>{t('plan.retry')}</button></div>
      </div>
    )
  }

  const knownTickers = [...new Set(pb.holdings.map(h => h.t))]
  const common = { pb, fmt, t, view, demo }
  const stopEditing = (k) => editing?.k === k && (
    <div className={s.row}><button type="button" className={s.link} onClick={() => setEditing(null)}>{t('plan.pl.stopEditing')}</button></div>
  )
  const full = shows(view, 'riskR')
  return (
    <div className={s.wrap}>
      {demo && <p className={s.sample}>{t('plan.sample')}</p>}
      <div role="tablist" aria-label={t('plan.subLabel')} className={s.subtabs}>
        {PLAN_SUBS.map(k => (
          <button key={k} ref={el => { refs.current[k] = el }} type="button" role="tab" id={`plan-sub-${k}`}
            aria-selected={sub === k} aria-controls={`plan-panel-${k}`} tabIndex={sub === k ? 0 : -1}
            className={s.subtab} onClick={() => changeSub(k)} onKeyDown={onSubKey}>
            {t(`plan.sub.${k}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`plan-panel-${sub}`} aria-labelledby={`plan-sub-${sub}`} className={s.wrap}>
        {sub === 'oportunidades' && (
          <>
            <Suspense fallback={<p className={s.note} role="status">{t('plan.loading')}</p>}>
              <Oportunidades pb={pb} fmt={fmt} demo={demo} capital={pb.capital} targets={targets} arriveUsd={arrival?.sub === 'oportunidades' ? arrival.usd : null}
                focus={arrival?.sub === 'oportunidades' ? arrival.focus : null} onTab={onTab} onOpen={onOpen} onDeposit={(prefill) => setTrade(prefill)} />
            </Suspense>
            <Fold id="plan-calc" title={t(full ? 'plan.calc.titleFull' : 'plan.calc.title')} open={calcOpen} onToggle={() => setCalcOpen(o => !o)} headRef={calcHead}>
              <RuleCard t={t} fmt={fmt} rule={rule} capital={pb.capital} view={view} demo={demo} onSaveRule={saveRule} onSaveCapital={saveCapital} flat />
              {stopEditing('trade')}
              <Calculator {...common} rule={rule} capital={pb.capital} seed={calcSeed} editing={editing?.k === 'trade' ? editing : null}
                onSavePlan={saveTradePlan} onAddToPortfolio={(prefill) => setTrade(prefill)} embedded />
            </Fold>
          </>
        )}
        {sub === 'aportes' && (
          <>
            {stopEditing('aporte')}
            <Aportes {...common} capital={pb.capital} targets={targets} seed={apSeed} editing={editing?.k === 'aporte' ? editing : null}
              onSavePlan={saveAportePlan} onDeposit={(prefill) => setTrade(prefill)} onTab={onTab} onGoOpp={() => go('oportunidades')} arriveUsd={arrival?.sub === 'aportes' ? arrival.usd || null : null} />
            <Fold id="plan-pl" title={t('plan.pl.title')} count={plans.phase === 'ready' ? plans.list.length : null} open={plansOpen} onToggle={() => setPlansOpen(o => !o)} headRef={plansHead}>
              <Plans plans={plans} fmt={fmt} t={t} demo={demo} rates={pb.rates.rates} embedded
                onOpen={openPlan} onRename={renamePlan} onDelete={deletePlan} onGoCalc={() => go('calc')} onRetry={loadPlans} />
            </Fold>
          </>
        )}
      </div>

      {/* Pie: fuentes y licencias, como en Resumen, Portafolio y Mercado. */}
      <p className={s.sourcesFoot}>
        <a href={`${INVEST_ORIGIN}/datos-y-licencias.html`} target="_blank" rel="noopener noreferrer" className={s.link}>{t('plan.sources')}</a>
      </p>

      <TradeSheet open={!!trade} onClose={() => setTrade(null)} prefill={trade} onSave={recordTrade}
        tickers={knownTickers} knownTickers={knownTickers} hasDeposits={pb.ops.some(o => o.type === 'deposit')} />
    </div>
  )
}
