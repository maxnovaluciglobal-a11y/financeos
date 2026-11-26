// src/pages/Investments/oportunidades/Oportunidades.jsx — Planificar › Tus
// tramos (Inversiones v2; rediseño del 24-nov-2026, opción A "matriz").
//
// Una sola tarjeta, lo del Plan de Capital de Invest (app/index.html
// renderCapital, CAP_LADDERS, repartoPorDesvio) llevado a algo que se lee sin
// saber de bolsa y sin repetir cada activo:
//  1. Arriba, el monto (o el capital sin invertir, o el efectivo) y una fila que
//     resume cómo se reparte (entre activos · escalera · regla de RSI), con
//     "Cambiar" que abre los controles en el lugar.
//  2. El resumen: qué parte cumple HOY tu regla y cuál espera (capital.js).
//  3. La matriz activos × tramos (TramosTable.jsx): monto y estado de cada
//     tramo, totales por columna y, aparte, lo que sigues con su distancia a
//     cada media (signals.js).
//  4. Leyenda, "¿Cómo se calcula?" con las cuentas, depósito y un solo aviso.
// Encuadre (Chile, CMF): información educativa; un cálculo con las reglas de la
// persona, nunca "compra" ni un orden de conveniencia (la lista sigue el orden
// del portafolio, por valor).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Circle, CircleAlert, Info, SlidersHorizontal, X } from 'lucide-react'
import Money, { useMoney } from '../../../components/Money.jsx'
import { investData } from '../../../core/investData.js'
import { DEMO_WATCH } from '../../../demo/demoInvestHoy.js'
import { allocByDrift, allocReady, amount as amountOf, equalAlloc, LADDERS, pctSum } from '../../../utils/investPlan.js'
import { rebalanceBase } from '../../../utils/investRebalance.js'
import { rememberPortTab } from '../../../utils/investNav.js'
import { moneyLocale } from '../../../utils/index.js'
import { num } from '../../../utils/investTrade.js'
import { logRejection } from '../../../utils/errorLog.js'
import { segKeyTarget } from '../planificar/Aportes.jsx'
import { LADDER_KEYS, DEFAULT_LADDER, driftMath, planCapital, uninvested } from './capital.js'
import { readLadder, readRsiRule, writeLadder, writeRsiRule } from '../reglas/rulePrefs.js'
import { useReadings } from './useReadings.js'
import { currentInvestLimits, splitForTramos, announceInvestLimit } from '../../../utils/investLimits.js'
import { useOppT } from './dict.js'
import TramosTable, { pctIn } from './TramosTable.jsx'
import p from '../planificar/planificar.module.css'
import s from './oportunidades.module.css'

const safe = {
  get: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch { /* modo privado: vale en esta visita */ } },
}
const safeStore = { setItem: (k, v) => safe.set(k, v) }

function Radios({ label, id, value, options, onChange }) {
  const refs = useRef({})
  const values = options.map(o => o.value)
  const sel = values.includes(value) ? value : values[0]
  function onKey(e) {
    const next = segKeyTarget(e.key, value, values)
    if (next == null) return
    e.preventDefault(); onChange(next); refs.current[next]?.focus()
  }
  return (
    <div className={p.field}>
      <span className={p.fieldLabel} id={id}>{label}</span>
      <div className={p.segs} role="radiogroup" aria-labelledby={id}>
        {options.map(o => (
          <button key={o.value} ref={el => { refs.current[o.value] = el }} type="button" role="radio" aria-checked={sel === o.value}
            tabIndex={sel === o.value ? 0 : -1} className={p.seg} onClick={() => onChange(o.value)} onKeyDown={onKey}>
            {o.label}{o.sub && <span className={s.segSub}> · {o.sub}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Oportunidades({ pb, fmt, demo, capital, targets, arriveUsd = null, focus = null, onTab, onOpen, onDeposit }) {
  const { t, ready } = useOppT()
  const { m } = useMoney()

  // ── Universo: lo que tienes (orden del portafolio, por valor) + lo que sigues ──
  const mine = useMemo(() => {
    const seen = new Map()
    for (const r of pb.positions.rows || []) if (!seen.has(r.t)) seen.set(r.t, { t: r.t, type: r.type, name: r.name, ccy: pb.market?.quotes?.[r.t]?.currency })
    return [...seen.values()]
  }, [pb.positions.rows, pb.market?.quotes])
  const [watch, setWatch] = useState([])
  useEffect(() => {
    let alive = true
    if (demo) { setWatch([...DEMO_WATCH]); return undefined }
    Promise.resolve(investData.listWatchlist?.()).then(r => { if (alive && r?.ok) setWatch(r.data || []) }).catch(logRejection('oportunidades:watchlist'))
    return () => { alive = false }
  }, [demo])
  const watchItems = useMemo(() => watch.filter(w => !mine.some(x => x.t === w)).map(w => ({ t: w, type: /-USD$/.test(w) ? 'Crypto' : 'Stock' })), [watch, mine])
  const items = useMemo(() => [...mine, ...watchItems], [mine, watchItems])
  const rd = useReadings({ demo, items })

  // ── Reparto ──
  // Límites de Starter (apagados por defecto: limits = null y no cambia nada).
  const limits = currentInvestLimits()
  const baseAll = useMemo(() => rebalanceBase(pb.positions.rows), [pb.positions.rows])
  const base = useMemo(() => splitForTramos(baseAll, limits).shown, [baseAll, limits])
  const lockedN = limits ? Math.max(0, baseAll.length - limits.tramos) : 0
  const hasTargets = !!targets && Object.keys(targets).length > 0
  const free = uninvested(capital, pb.positions.totals?.cost)
  const cash = pb.ledger?.usesCash && pb.ledger.cash > 0 ? pb.ledger.cash : null
  const [raw, setRaw] = useState(() => (arriveUsd ? String(arriveUsd) : ''))
  const [src, setSrc] = useState(arriveUsd ? 'arrived' : null)
  const [method, setMethod] = useState(() => (hasTargets ? 'targets' : 'equal'))
  const [manual, setManual] = useState(null) // [{ t, p }] al editar a mano
  // La escalera y la regla de RSI se recuerdan en el dispositivo (sin tickers):
  // "Tus reglas hoy" en Resumen las lee para contar tus tramos igual que aquí.
  const [lad, setLadState] = useState(readLadder)
  const [rsiRule, setRsiState] = useState(readRsiRule)
  const setRsiRule = (on) => { setRsiState(on); writeRsiRule(on) }
  const [setOpen, setSetOpen] = useState(false)
  const capRef = useRef(null)
  const setLad = (v) => { setLadState(v); writeLadder(v) }

  useEffect(() => {
    if (focus === 'split' && capRef.current && typeof capRef.current.scrollIntoView === 'function') {
      capRef.current.scrollIntoView({ block: 'start' })
      capRef.current.querySelector('input')?.focus({ preventScroll: true })
    }
  }, [focus, ready])

  const amt = amountOf(raw)
  const amountErr = raw !== '' && !(amt > 0)
  const autoAlloc = useMemo(() => {
    if (method === 'targets') return hasTargets ? allocByDrift(base, targets) : []
    if (method === 'equal') return equalAlloc(base.map(b => b.t))
    return null
  }, [method, hasTargets, base, targets])
  const alloc = splitForTramos((method === 'manual' ? manual || [] : autoAlloc || []).filter(a => Number(a.p) > 0), limits).shown
  function pickMethod(v) {
    if (v === 'manual' && !manual) setManual((autoAlloc && autoAlloc.length ? autoAlloc : equalAlloc(base.map(b => b.t))).map(a => ({ ...a })))
    setMethod(v)
  }
  const setPct = (tk, v) => setManual(list => (list || []).map(a => (a.t === tk ? { ...a, p: v === '' ? '' : num(v) } : a)))
  const addable = limits && (manual || []).length >= limits.tramos ? [] : items.map(i => i.t).filter(x => !(manual || []).some(a => a.t === x)).slice(0, 8)

  const plan = planCapital({ amount: amt, alloc, readings: rd.readings, ladder: lad, rsiRule })
  const pending = alloc.filter(a => !(a.t in rd.readings)).map(a => a.t)
  const math = method === 'targets' && hasTargets ? driftMath(base, targets) : null
  const numTxt = (v) => Number(v).toLocaleString(moneyLocale(), { maximumFractionDigits: 1 })
  const pctTxt = (v) => pctIn(t, numTxt(v))
  const wTxt = (k) => (LADDERS[k] || []).map(w => Math.round(w * 100)).join('/')
  const sampleList = rd.sample
  const money = (v) => <Money>{fmt.money(v)}</Money>

  if (!ready) return <p className={p.note} role="status">{t('opp.loading')}</p>

  const loadingNow = rd.phase === 'loading' && !Object.keys(rd.readings).length
  const showTable = !loadingNow && rd.phase !== 'error' && items.length > 0
  const bar = (v) => (plan.ok && plan.total > 0 ? `${(v / plan.total) * 100}%` : '0%')
  return (
    <section ref={capRef} className={`${p.card} ${s.card}`} aria-labelledby="opp-title">
      <h2 id="opp-title" className={p.title}>{t('opp.title')}</h2>
      <p className={p.lead}>{t('opp.lead')}</p>

      {/* 1 · Monto y cómo se reparte */}
      <label className={p.field}>
        <span className={p.fieldLabel}>{t('opp.cap.amount')}</span>
        <input className={p.input} value={raw} onChange={e => { setRaw(e.target.value); setSrc(null) }} inputMode="decimal" autoComplete="off"
          aria-invalid={amountErr || undefined} aria-describedby={amountErr ? 'opp-amount-err' : undefined} />
      </label>
      {amountErr && <p id="opp-amount-err" className={p.error}>{t('opp.cap.err.amount')}</p>}
      {(free > 0 || cash > 0) && (
        <div className={s.chips}>
          {free > 0 && <button type="button" className={s.chip} aria-pressed={src === 'free'} aria-label={t('opp.cap.fromFreeAria', { v: m(fmt.money(free)) })}
            onClick={() => { setRaw(String(free)); setSrc('free') }}>{t('opp.cap.fromFree', { v: m(fmt.money(free)) })}</button>}
          {cash > 0 && <button type="button" className={s.chip} aria-pressed={src === 'cash'} aria-label={t('opp.cap.fromCashAria', { v: m(fmt.money(cash)) })}
            onClick={() => { setRaw(String(Math.round(cash * 100) / 100)); setSrc('cash') }}>{t('opp.cap.fromCash', { v: m(fmt.money(cash)) })}</button>}
        </div>
      )}
      {src === 'arrived' && <p className={p.note}>{t('opp.cap.arrived', { v: m(fmt.money(amt)) })}</p>}

      <div className={s.setRow}>
        <SlidersHorizontal size={18} strokeWidth={2} aria-hidden="true" className={s.setIc} />
        <p className={s.setTxt} id="opp-set-sum">
          <b>{t(`opp.set.m.${method}`)}</b>{' · '}
          <span>{t('opp.set.lad', { w: wTxt(lad) })}</span>{' · '}
          <span>{t(rsiRule ? 'opp.set.rsiOn' : 'opp.set.rsiOff')}</span>
        </p>
        <button type="button" className={p.link} aria-expanded={setOpen} aria-controls="opp-settings" aria-describedby="opp-set-sum"
          onClick={() => setSetOpen(o => !o)}>{t(setOpen ? 'opp.set.close' : 'opp.set.change')}</button>
      </div>
      <div id="opp-settings" className={s.settings} hidden={!setOpen}>
        <Radios label={t('opp.cap.between')} id="opp-between" value={method} onChange={pickMethod}
          options={[{ value: 'targets', label: t('opp.cap.m.targets') }, { value: 'equal', label: t('opp.cap.m.equal') }, { value: 'manual', label: t('opp.cap.m.manual') }]} />
        {method === 'manual' && (
          <>
            <ul className={p.allocList}>
              {(manual || []).map(a => (
                <li key={a.t} className={p.allocRow}>
                  <span className={p.allocTicker}>{a.t}</span>
                  <input className={p.input} value={a.p === '' ? '' : String(a.p)} onChange={e => setPct(a.t, e.target.value)} inputMode="decimal" aria-label={t('opp.cap.pctOf', { t: a.t })} />
                  <button type="button" className={p.iconBtn} onClick={() => setManual(list => list.filter(x => x.t !== a.t))} aria-label={t('opp.cap.remove', { t: a.t })}><X size={18} aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
            {addable.length > 0 && (
              <div className={p.row}>
                <span className={p.note}>{t('opp.cap.addFrom')}</span>
                {addable.map(x => <button key={x} type="button" className={p.chip} onClick={() => setManual(list => [...(list || []), { t: x, p: 0 }])}>{x}</button>)}
              </div>
            )}
          </>
        )}
        <Radios label={t('opp.cap.within')} id="opp-within" value={lad} onChange={setLad}
          options={[DEFAULT_LADDER, ...LADDER_KEYS.filter(k => k !== DEFAULT_LADDER)].map(k => ({ value: k, label: t(`opp.lad.${k}`), sub: wTxt(k) }))} />
        <label className={s.check}>
          <input type="checkbox" checked={rsiRule} onChange={e => setRsiRule(e.target.checked)} aria-describedby="opp-rsi-help" style={{ width: 16, height: 16, flexShrink: 0 }} />
          <span>{t('opp.cap.rsiRule')}</span>
        </label>
        <p id="opp-rsi-help" className={p.note}>{t(rsiRule ? 'opp.cap.rsiHelpOn' : 'opp.cap.rsiHelpOff')}</p>
      </div>
      {method === 'targets' && !hasTargets && (
        <div className={p.row}>
          <p className={p.note}>{t('opp.cap.noTargets')}</p>
          {onTab && <button type="button" className={p.link} onClick={() => { rememberPortTab('objetivos', safeStore); onTab('portafolio') }}>{t('opp.cap.goTargets')}</button>}
        </div>
      )}
      {method !== 'manual' && !base.length && <p className={p.note}>{t('opp.cap.noBase')}</p>}
      {method === 'manual' && alloc.length > 0 && (
        <p className={allocReady(alloc) ? p.ok : p.error} aria-live="polite">{allocReady(alloc) ? t('opp.cap.sumOk') : t('opp.cap.sumBad', { sum: pctTxt(pctSum(alloc)) })}</p>
      )}

      {/* 2 · Resumen */}
      <div aria-live="polite">
        {plan.ok ? (
          <div className={`${p.result} ${s.sum}`} role="group" aria-label={t('opp.res.title', { v: m(fmt.money(plan.total)) })}>
            <p className={p.resultLabel}>{t('opp.res.title', { v: m(fmt.money(plan.total)) })}</p>
            <div className={s.sumKv}>
              <div className={p.stat}><span className={p.resultLabel}>{t('opp.res.today')}</span><span className={`${p.statValue} ${s.statBig} ${s.lime}`}>{money(plan.today)}</span></div>
              <div className={p.stat}><span className={p.resultLabel}>{t('opp.res.wait')}</span><span className={`${p.statValue} ${s.statBig}`}>{money(plan.wait)}</span></div>
              {plan.noData > 0 && <div className={p.stat}><span className={p.resultLabel}>{t('opp.res.noData')}</span><span className={`${p.statValue} ${s.statBig}`}>{money(plan.noData)}</span></div>}
            </div>
            <div className={s.bar} aria-hidden="true"><i data-k="today" style={{ width: bar(plan.today) }} /><i data-k="wait" style={{ width: bar(plan.wait) }} /></div>
          </div>
        ) : (
          <p className={p.note}>{plan.error === 'sum' ? t('opp.res.sum') : t('opp.res.none')}</p>
        )}
        {plan.ok && pending.length > 0 && <p className={p.note} role="status">{t('opp.res.pending', { list: pending.join(', ') })}</p>}
      </div>

      {/* 3 · Matriz */}
      <div aria-live="polite">
        {!items.length && <p className={p.note}>{t('opp.empty')}</p>}
        {loadingNow && <p className={p.note} role="status">{t('opp.loading')}</p>}
        {rd.phase === 'error' && (
          <div className={p.row}><p className={p.error}>{t('opp.error')}</p><button type="button" className={p.btn} onClick={rd.reload}>{t('opp.retry')}</button></div>
        )}
      </div>
      {showTable && <TramosTable plan={plan.ok ? plan : null} mine={mine} watch={watchItems} readings={rd.readings} t={t} fmt={fmt} lad={lad} onOpen={onOpen} />}
      {lockedN > 0 && (
        <div className={p.row}>
          <p className={p.note}>{t('invest.limit.lockedRow', { n: lockedN })}</p>
          <button type="button" className={p.btn} onClick={() => announceInvestLimit('tramos')}>{t('invest.limit.cta')}</button>
        </div>
      )}

      {/* 4 · Leyenda, cuentas, depósito y aviso */}
      {showTable && (
        <p className={s.legend}>
          <span className={s.todayTx}><Check size={13} strokeWidth={2.8} aria-hidden="true" />{t('opp.leg.today')}</span>
          <span><Circle size={11} strokeWidth={2.4} aria-hidden="true" />{t('opp.leg.wait')}</span>
          {rsiRule && <span className={s.rsiTx}><CircleAlert size={13} strokeWidth={2.4} aria-hidden="true" />{t('opp.leg.rsi')}</span>}
          <span><span aria-hidden="true">—</span>{t('opp.leg.none')}</span>
        </p>
      )}
      {plan.ok && plan.reassigned && <p className={p.note}>{t('opp.res.reassigned')}</p>}
      {sampleList.length > 0 && <p className={p.note}>{t('opp.sample', { list: sampleList.join(', ') })}</p>}
      {demo && !sampleList.length && rd.phase === 'ready' && items.length > 0 && <p className={p.note}>{t('opp.live')}</p>}
      <div className={s.foot}>
        <details className={s.how}>
          <summary>{t('opp.math.title')}</summary>
          <p className={p.note}>{t('opp.cap.lumpNote')}</p>
          {plan.ok && <MathSteps plan={plan} t={t} fmt={fmt} m={m} pctTxt={pctTxt} numTxt={numTxt} lad={lad} rsiRule={rsiRule} method={method} math={math} alloc={alloc} />}
          {['sma', 'tramo', 'days', 'rsi', 'data'].map(k => <p key={k} className={p.note}>{t(`opp.how.${k}`)}</p>)}
        </details>
        {plan.ok && onDeposit && (
          <button type="button" className={p.link} onClick={() => onDeposit({ type: 'deposit', amount: String(amt), currency: 'USD', source: null })}>{t('opp.res.deposit')}</button>
        )}
      </div>
      <p className={s.edu} role="note"><Info size={14} strokeWidth={2} aria-hidden="true" />{t('opp.edu')} {t('opp.res.moves')}</p>
    </section>
  )
}

function MathSteps({ plan, t, fmt, m, pctTxt, numTxt, lad, rsiRule, method, math, alloc }) {
  const byT = Object.fromEntries(plan.rows.map(r => [r.t, r]))
  let step1
  if (method === 'targets' && math) {
    const gapSum = math.rows.filter(r => r.counts).reduce((a, r) => a + (math.mode === 'gap' ? r.gap : r.target), 0)
    step1 = (
      <>
        <p className={p.note}>{t(math.mode === 'gap' ? 'opp.math.step1.targets' : 'opp.math.step1.targetsAll')}</p>
        <ul className={s.mathList}>
          {math.rows.map(r => {
            const row = byT[r.t]
            const v = { t: r.t, a: pctTxt(r.actual), g: pctTxt(r.target), d: numTxt(r.gap), sum: numTxt(gapSum), p: pctTxt(row?.p ?? 0), v: m(fmt.money(row?.amount ?? 0)) }
            return <li key={r.t}>{!r.counts ? t('opp.math.skipRow', v) : math.mode === 'gap' ? t('opp.math.gapRow', v) : t('opp.math.targetRow', v)}</li>
          })}
        </ul>
      </>
    )
  } else step1 = <p className={p.note}>{t(method === 'equal' ? 'opp.math.step1.equal' : 'opp.math.step1.manual', { n: alloc.length })}</p>
  const w = LADDERS[lad] || LADDERS[DEFAULT_LADDER]
  return (
    <div className={s.math}>
      {step1}
      <p className={p.note}>{t('opp.math.step2', { lad: t(`opp.lad.${lad}`) })}</p>
      <ul className={s.mathList}>
        {plan.rows.filter(r => r.tramos).map(r => <li key={r.t}>{t('opp.math.step2Row', { t: r.t, v: m(fmt.money(r.amount)), w: w.map(x => pctTxt(x * 100)).join(' / ') })}</li>)}
      </ul>
      <p className={p.note}>{t(rsiRule ? 'opp.math.step3Rsi' : 'opp.math.step3')}</p>
      <p className={p.note}>{t('opp.math.cents')}</p>
    </div>
  )
}
