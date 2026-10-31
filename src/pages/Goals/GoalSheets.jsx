// src/pages/Goals/GoalSheets.jsx — R9 Metas (patrones rial #40–#44).
// Bolsas fijas (filas livianas, no tarjetas), cuadrícula de plantillas, alta
// corta en 3 pasos dentro de una hoja y aporte desde una hoja. La lógica pura
// vive en goalFlow.js; acá solo hay presentación. `fmt` ya pasa por
// useMoney().m (ocultar montos), así que las frases con cifras no van en <Money>.
import { useEffect, useRef, useState } from 'react'
import {
  Plane, Car, House, Smartphone, Laptop, GraduationCap, Store, PencilLine, ShieldCheck, PiggyBank, Plus, ChevronRight, Ellipsis,
} from 'lucide-react'
import Sheet from '../../components/ui/Sheet.jsx'
import { EmptyChoices, EmptyChoice } from '../../components/ui/index.jsx'
import SignalIcon from '../../components/icons/SignalIcon.jsx'
import { methodLabel, monthYearLabel } from '../../utils/index.js'
import { GOAL_TEMPLATE_IDS, FLOW_STEPS, stepError, monthlyNeeded, parseAmount, defaultMethod } from './goalFlow.js'
import SheetSelect from '../../components/ui/SheetSelect.jsx'

export const GOAL_ICONS = {
  trip: Plane, vehicle: Car, home: House, phone: Smartphone, computer: Laptop, education: GraduationCap,
  business: Store, custom: PencilLine, emergency: ShieldCheck, general: PiggyBank,
}

const h2 = { margin: '0 0 4px', fontFamily: 'var(--display)', fontSize: 20, fontWeight: 700, color: 'var(--tx)' }
const lead = { fontSize: 13, color: 'var(--tm)', lineHeight: 1.5, margin: '0 0 14px' }
const fieldLabel = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--tx)', marginBottom: 6 }
const input = { width: '100%', boxSizing: 'border-box', minHeight: 44, fontSize: 16 }
const primaryFull = { width: '100%', minHeight: 48, marginTop: 16 }
const linksRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }

// ── Bolsas fijas (#41) ───────────────────────────────────────────────────────
// Poda P2: con la meta creada, la bolsa reemplaza su tarjeta de la lista; el
// botón ⋯ abre esa tarjeta (editar, borrar, ajuste del fondo) en una hoja.
export function FixedBuckets({ buckets, t, fmt, onSelect, onDetails }) {
  return (
    <section data-tour="goals-buckets" aria-label={t('goals.r9.buckets')}>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '1px solid var(--brd2)' }}>
        {buckets.map(b => {
          const name = b.id === 'emergency' ? t('gs.emergency.name') : t('goals.r9.generalName')
          const g = b.goal
          const done = g && g.target > 0 && g.saved >= g.target
          const Icon = GOAL_ICONS[b.id]
          return (
            <li key={b.id} style={{ borderBottom: '1px solid var(--brd)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {/* El nombre accesible sale del texto visible (nombre, avance y acción): axe
                  label-content-name-mismatch pide que el texto visible esté en el nombre. */}
              <button type="button" onClick={() => onSelect(b)}
                style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) auto', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, width: '100%', minHeight: 56, padding: '8px 2px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--tx)', fontFamily: 'var(--sans)' }}>
                <span aria-hidden="true" className="cat-icon" style={{ width: 28, height: 28, background: `color-mix(in srgb, var(--cat-${b.id === 'emergency' ? 1 : 3}) 12%, transparent)` }}>
                  <Icon size={16} strokeWidth={1.7} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g ? g.name : name}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--th)', marginTop: 1 }}>
                    {g
                      ? t('goals.r9.bucket.progress', { saved: fmt(g.saved), target: fmt(g.target) })
                      : b.suggested ? t('goals.r9.bucket.suggested', { v: fmt(b.suggested) }) : t('goals.r9.bucket.empty')}
                  </span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500, color: done ? 'var(--pos)' : 'var(--tm)' }}>
                  {done
                    ? <><SignalIcon kind="ok" size={13} />{t('goals.status.done')}</>
                    : <><Plus size={14} strokeWidth={1.7} />{g ? t('goals.r9.bucket.add') : t('goals.r9.bucket.create')}<ChevronRight size={14} strokeWidth={1.7} /></>}
                </span>
              </button>
              {g && onDetails && (
                <button type="button" onClick={() => onDetails(b)} aria-haspopup="dialog"
                  aria-label={t('goals.p2.bucketMore', { name: g.name })} title={t('goals.p2.bucketMore', { name: g.name })}
                  style={{ flexShrink: 0, width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--fill)', border: 0, borderRadius: 'var(--r)', color: 'var(--tm)', cursor: 'pointer' }}>
                  <Ellipsis size={18} strokeWidth={1.7} aria-hidden="true" />
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ── Cuadrícula de plantillas (#40) ───────────────────────────────────────────
export function TemplateGrid({ t, onPick }) {
  return (
    <EmptyChoices label={t('goals.r9.pick.title')}>
      {GOAL_TEMPLATE_IDS.map(id => (
        <EmptyChoice key={id} icon={GOAL_ICONS[id]} label={t(`goals.r9.tpl.${id}`)} onClick={() => onPick(id)} />
      ))}
    </EmptyChoices>
  )
}

function StepDots({ step, t }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 10px' }}>
      <span aria-hidden="true" style={{ display: 'inline-flex', gap: 6 }}>
        {Array.from({ length: FLOW_STEPS }, (_, i) => (
          <span key={i} style={{ width: 8, height: 8, borderRadius: 2, background: i < step ? 'var(--tx)' : 'var(--brd2)' }} />
        ))}
      </span>
      <span style={{ fontSize: 12, color: 'var(--th)', fontFamily: 'var(--sans)' }}>{t('goals.r9.step', { n: step, total: FLOW_STEPS })}</span>
    </div>
  )
}

// ── Alta corta en 3 pasos (#42) ──────────────────────────────────────────────
// flow = { step: 0..3, draft }. Paso 0 = cuadrícula; 1 monto; 2 nombre y
// fecha; 3 resumen. "Más opciones" abre el formulario completo con lo escrito.
export function GoalFlowSheet({ flow, setFlow, onClose, onPickTemplate, onCreate, onMore, onSuggest, t, fmt, currency, activeMonth }) {
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  // Foco inicial (y al cambiar de paso): el campo del paso, o el título.
  const sheetFocus = useRef(null)
  const step = flow?.step ?? 0
  const draft = flow?.draft || {}

  useEffect(() => {
    setErr('')
    const tm = setTimeout(() => sheetFocus.current?.focus?.({ preventScroll: true }), 0)
    return () => clearTimeout(tm)
  }, [step])

  const set = (patch) => setFlow(f => ({ ...f, draft: { ...f.draft, ...patch } }))
  const go = (s) => setFlow(f => ({ ...f, step: s }))

  async function next(e) {
    e?.preventDefault?.()
    const k = stepError(step, draft)
    if (k) { setErr(t(k)); return }
    if (step < FLOW_STEPS) { go(step + 1); return }
    if (busy) return
    setBusy(true)
    try { await onCreate(draft) } finally { setBusy(false) }
  }

  const monthly = step === 3 ? monthlyNeeded({ target: draft.target, targetDate: draft.targetDate, activeMonth }) : null
  const title = step === 0 ? t('goals.r9.pick.title') : step === 1 ? t('goals.r9.amount.title') : step === 2 ? t('goals.r9.name.title') : t('goals.r9.summary.title')
  const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--brd)', fontSize: 14 }

  return (
    <Sheet open={!!flow} onClose={onClose} ariaLabel={title} maxWidth={480} initialFocusRef={sheetFocus}>
      {step > 0 && <StepDots step={step} t={t} />}
      <h2 ref={step === 0 || step === 3 ? sheetFocus : undefined} tabIndex={-1} style={{ ...h2, outline: 'none' }}>{title}</h2>
      {step === 0 && (
        <>
          <p style={lead}>{t('goals.r9.pick.text')}</p>
          <TemplateGrid t={t} onPick={onPickTemplate} />
          <div style={linksRow}>
            <button type="button" className="fos-link" onClick={onSuggest}>{t('goals.r9.suggestLink')}</button>
            <button type="button" className="fos-link" onClick={() => onMore({})}>{t('goals.r9.more')}</button>
          </div>
        </>
      )}
      {step > 0 && (
        <form onSubmit={next} noValidate>
          {step === 1 && (
            <>
              <label htmlFor="goal-flow-amount" style={{ ...fieldLabel, marginTop: 8 }}>{t('goals.r9.amount.label', { currency })}</label>
              <input id="goal-flow-amount" ref={sheetFocus} className="num" type="number" inputMode="decimal" min="0" step="any" placeholder="0"
                value={draft.target ?? ''} onChange={e => { set({ target: e.target.value }); setErr('') }}
                aria-invalid={!!err} aria-describedby={err ? 'goal-flow-err' : undefined}
                style={{ ...input, fontSize: 28, fontWeight: 600, padding: '8px 12px' }} />
            </>
          )}
          {step === 2 && (
            <>
              <label htmlFor="goal-flow-name" style={{ ...fieldLabel, marginTop: 8 }}>{t('goals.r9.name.label')}</label>
              <input id="goal-flow-name" ref={sheetFocus} type="text" value={draft.name ?? ''} maxLength={80} placeholder={t('goals.form.namePh')}
                onChange={e => { set({ name: e.target.value }); setErr('') }}
                aria-invalid={!!err} aria-describedby={err ? 'goal-flow-err' : undefined} style={input} />
              <label htmlFor="goal-flow-date" style={{ ...fieldLabel, marginTop: 14 }}>{t('goals.r9.date.label')}</label>
              <input id="goal-flow-date" type="month" value={draft.targetDate ?? ''} min={activeMonth}
                onChange={e => set({ targetDate: e.target.value })} style={input} />
            </>
          )}
          {step === 3 && (
            <div style={{ borderTop: '1px solid var(--brd2)', marginTop: 8 }}>
              <div style={row}><span style={{ fontWeight: 600, color: 'var(--tx)', minWidth: 0, overflowWrap: 'anywhere' }}>{draft.name}</span></div>
              <div style={row}><span style={{ color: 'var(--tm)' }}>{t('goals.r9.summary.target')}</span><span className="num" style={{ fontWeight: 600 }}>{fmt(parseAmount(draft.target))}</span></div>
              <div style={row}><span style={{ color: 'var(--tm)' }}>{t('goals.r9.summary.date')}</span><span>{draft.targetDate ? monthYearLabel(String(draft.targetDate).slice(0, 7)) : t('goals.r9.summary.noDate')}</span></div>
              {monthly != null && (
                <div style={row}><span style={{ color: 'var(--tm)' }}>{t('goals.r9.summary.monthly')}</span><span className="num">{fmt(monthly)}{t('goals.suggest.perMonthSuffix')}</span></div>
              )}
            </div>
          )}
          {err && <p id="goal-flow-err" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--neg)', margin: '8px 0 0' }}><SignalIcon kind="alert" size={13} />{err}</p>}
          <button type="submit" className="fos-btn-primary" style={primaryFull} disabled={busy}>
            {step < FLOW_STEPS ? t('goals.r9.next') : t('goals.r9.create')}
          </button>
          <div style={linksRow}>
            <button type="button" className="fos-link" onClick={() => go(step - 1)}>{t('goals.r9.back')}</button>
            <button type="button" className="fos-link" onClick={() => onMore(draft)}>{t('goals.r9.more')}</button>
          </div>
        </form>
      )}
    </Sheet>
  )
}

// ── Aporte desde una hoja (#43) ──────────────────────────────────────────────
export function ContributionSheet({ goal, onClose, onConfirm, t, lang, fmt, currency, methods, lastPaymentMethod }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState(() => defaultMethod(goal, methods, lastPaymentMethod))
  const [busy, setBusy] = useState(false)
  const amtRef = useRef(null)
  if (!goal) return null
  const remaining = Math.max(0, (Number(goal.target) || 0) - (Number(goal.saved) || 0))
  const n = parseAmount(amount)
  const capped = remaining > 0 && n > remaining

  async function submit(e) {
    e.preventDefault()
    if (n <= 0 || busy) return
    setBusy(true)
    try { await onConfirm(amount, method) } finally { setBusy(false) }
  }

  return (
    <Sheet open onClose={onClose} ariaLabel={t('goals.r9.add.title')} maxWidth={440} initialFocusRef={amtRef}>
      <h2 style={h2}>{t('goals.r9.add.title')}</h2>
      <p style={{ ...lead, marginBottom: 12 }}>
        <span style={{ color: 'var(--tx)', fontWeight: 600 }}>{goal.name}</span>{' · '}
        {t('goals.r9.add.remaining', { v: fmt(remaining) })}
      </p>
      <form onSubmit={submit} noValidate>
        <label htmlFor="goal-add-amount" style={fieldLabel}>{t('goals.r9.add.amount', { currency })}</label>
        <input id="goal-add-amount" ref={amtRef} className="num" type="number" inputMode="decimal" min="0" step="any" placeholder="0"
          value={amount} onChange={e => setAmount(e.target.value)}
          aria-describedby={capped ? 'goal-add-capped' : undefined}
          style={{ ...input, fontSize: 28, fontWeight: 600, padding: '8px 12px' }} />
        {capped && <p id="goal-add-capped" style={{ fontSize: 12, color: 'var(--th)', margin: '6px 0 0' }}>{t('goals.r9.add.capped', { v: fmt(remaining) })}</p>}
        <label htmlFor="goal-add-method" style={{ ...fieldLabel, marginTop: 14 }}>{t('goals.r9.add.from')}</label>
        <SheetSelect id="goal-add-method" value={method} onChange={e => setMethod(e.target.value)} style={{ ...input, padding: '8px 10px' }}>
          {methods.map(m => <option key={m} value={m}>{methodLabel(m, lang)}</option>)}
        </SheetSelect>
        <button type="submit" className="fos-btn-primary" style={primaryFull} disabled={n <= 0 || busy}>{t('goals.r9.add.submit')}</button>
      </form>
    </Sheet>
  )
}
