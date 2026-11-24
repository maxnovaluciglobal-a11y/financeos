// src/pages/Investments/oportunidades/Oportunidades.jsx — Planificar ›
// Oportunidades (Inversiones v2, 24-nov-2026). Visible en la vista esencial.
//
// Dos partes, las del Plan de Capital de Invest (app/index.html renderCapital,
// CAP_LADDERS, repartoPorDesvio) llevadas a algo que se lee sin saber de bolsa:
//  1. Oportunidades según tus medias: por cada activo que tienes o sigues, dónde
//     está el precio frente a sus medias de 20/50/100/200 días, como tramos de
//     una escalera (signals.js). En palabras, no solo con color.
//  2. Repartir mi capital: un monto (o el capital sin invertir) → entre activos
//     (hacia tus objetivos por desvío, parejo o a mano) → en 4 tramos por la
//     escalera elegida → qué parte cumple HOY tu regla y cuál espera
//     (capital.js), con las cuentas a la vista.
// Encuadre (Chile, CMF): información educativa; un cálculo con las reglas de la
// persona, nunca "compra" ni un orden de conveniencia (la lista sigue el orden
// del portafolio, por valor).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Circle, Info, Minus, X } from 'lucide-react'
import Money, { useMoney } from '../../../components/Money.jsx'
import { investData } from '../../../core/investData.js'
import { DEMO_WATCH } from '../../../demo/demoInvestHoy.js'
import { allocByDrift, allocReady, amount as amountOf, equalAlloc, LADDERS, pctSum } from '../../../utils/investPlan.js'
import { rebalanceBase } from '../../../utils/investRebalance.js'
import { rememberPortTab } from '../../../utils/investNav.js'
import { currencyOf } from '../../../utils/investValuation.js'
import { moneyLocale } from '../../../utils/index.js'
import { num } from '../../../utils/investTrade.js'
import { logRejection } from '../../../utils/errorLog.js'
import { segKeyTarget } from '../planificar/Aportes.jsx'
import { LADDER_KEYS, DEFAULT_LADDER, driftMath, planCapital, uninvested } from './capital.js'
import { joinList, signalKey } from './signals.js'
import { useReadings } from './useReadings.js'
import { useOppT } from './dict.js'
import p from '../planificar/planificar.module.css'
import s from './oportunidades.module.css'

const LADDER_PREF = 'fos_invest_opp_ladder'
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

// Frase de una lectura: "En o bajo la media de 50 días · se cumplen los tramos 1 y 2".
export function signalText(r, t) {
  const k = signalKey(r)
  if (k.key === 'none') return { head: t('opp.sig.none'), tail: null, key: 'none' }
  if (k.key === 'below') {
    return { head: t('opp.sig.below', { n: k.n }), tail: t(k.tramos.length === 1 ? 'opp.tramosOne' : 'opp.tramosMany', { list: joinList(k.tramos, t) }), key: 'below' }
  }
  return { head: t(k.key === 'near' ? 'opp.sig.near' : 'opp.sig.above', { n: k.n }), tail: t('opp.tramosNone'), key: k.key }
}

function Ladder({ r, t, fmt, priceTxt }) {
  return (
    <ul className={s.ladder} aria-label={t('opp.title')}>
      {r.smas.map(m => {
        const st = m.value == null ? 'none' : m.hit ? 'hit' : 'wait'
        const d = m.dist == null ? null : Math.abs(m.dist) < 0.0005 ? t('opp.dist.at') : t(m.dist < 0 ? 'opp.dist.below' : 'opp.dist.above', { p: fmt.pct(Math.abs(m.dist), { decimals: 1 }) })
        const aria = m.value == null ? t('opp.cell.ariaNone', { n: m.n })
          : t('opp.cell.aria', { n: m.n, v: priceTxt(m.value), d, state: t(`opp.cell.${st}`, { k: m.tramo }) })
        const Ic = st === 'hit' ? Check : st === 'wait' ? Circle : Minus
        return (
          <li key={m.n} className={s.cell} data-st={st} aria-label={aria}>
            <span className={s.cellTop} aria-hidden="true"><Ic size={13} strokeWidth={2.6} />{t('opp.cell.short', { n: m.n })}</span>
            <span className={s.cellDist} aria-hidden="true">{m.value == null ? '—' : fmt.pct(m.dist, { signed: true, decimals: 1 })}</span>
          </li>
        )
      })}
    </ul>
  )
}

function AssetRow({ item, r, t, fmt, onOpen }) {
  const { m } = useMoney()
  const ccy = currencyOf(item.t, item.ccy)
  const priceTxt = (v) => m(ccy ? fmt.native(v, ccy) : Number(v).toLocaleString(moneyLocale(), { maximumFractionDigits: 2 }))
  const sig = signalText(r, t)
  const facts = []
  if (r?.rsi != null) {
    const v = Math.round(r.rsi)
    facts.push(t(r.rsiZone === 'low' ? 'opp.fact.rsi.low' : r.rsiZone === 'high' ? 'opp.fact.rsi.high' : 'opp.fact.rsi', { v }))
  }
  if (r?.drawdown != null) facts.push(r.drawdown > -0.0005 ? t('opp.fact.ddZero') : t('opp.fact.dd', { p: fmt.pct(Math.abs(r.drawdown), { decimals: 1 }) }))
  return (
    <li className={s.asset} data-sig={sig.key}>
      <div className={s.assetHead}>
        {onOpen
          ? <button type="button" className={s.ticker} onClick={() => onOpen(item.t)} aria-label={t('opp.open', { t: item.t })}>{item.t}</button>
          : <span className={s.ticker}>{item.t}</span>}
        {item.name && <span className={s.name}>{item.name}</span>}
        {r && <span className={s.price}>{t('opp.price', { v: priceTxt(r.price) })}</span>}
      </div>
      <p className={s.sig}><span className={s.sigHead}>{sig.head}</span>{sig.tail && <span className={s.sigTail}> · {sig.tail}</span>}</p>
      {r && <Ladder r={r} t={t} fmt={fmt} priceTxt={priceTxt} />}
      {facts.length > 0 && <p className={p.note}>{facts.join(' · ')}</p>}
      {r && r.missing.length > 0 && <p className={p.note}>{t('opp.fact.short', { n: r.closes, list: joinList(r.missing, t) })}</p>}
      {r?.crypto && <p className={p.note}>{t('opp.fact.crypto')}</p>}
    </li>
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

  // ── Repartir mi capital ──
  const base = useMemo(() => rebalanceBase(pb.positions.rows), [pb.positions.rows])
  const hasTargets = !!targets && Object.keys(targets).length > 0
  const free = uninvested(capital, pb.positions.totals?.cost)
  const cash = pb.ledger?.usesCash && pb.ledger.cash > 0 ? pb.ledger.cash : null
  const [raw, setRaw] = useState(() => (arriveUsd ? String(arriveUsd) : ''))
  const [src, setSrc] = useState(arriveUsd ? 'arrived' : null)
  const [method, setMethod] = useState(() => (hasTargets ? 'targets' : 'equal'))
  const [manual, setManual] = useState(null) // [{ t, p }] al editar a mano
  const [lad, setLadState] = useState(() => { const v = safe.get(LADDER_PREF); return LADDERS[v] ? v : DEFAULT_LADDER })
  const [rsiRule, setRsiRule] = useState(false)
  const capRef = useRef(null)
  const setLad = (v) => { setLadState(v); safe.set(LADDER_PREF, v) }

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
  const alloc = (method === 'manual' ? manual || [] : autoAlloc || []).filter(a => Number(a.p) > 0)
  function pickMethod(v) {
    if (v === 'manual' && !manual) setManual((autoAlloc && autoAlloc.length ? autoAlloc : equalAlloc(base.map(b => b.t))).map(a => ({ ...a })))
    setMethod(v)
  }
  const setPct = (tk, v) => setManual(list => (list || []).map(a => (a.t === tk ? { ...a, p: v === '' ? '' : num(v) } : a)))
  const addable = items.map(i => i.t).filter(x => !(manual || []).some(a => a.t === x)).slice(0, 8)

  const plan = planCapital({ amount: amt, alloc, readings: rd.readings, ladder: lad, rsiRule })
  const pending = alloc.filter(a => !(a.t in rd.readings)).map(a => a.t)
  const math = method === 'targets' && hasTargets ? driftMath(base, targets) : null
  const pctTxt = (v) => `${Number(v).toLocaleString(moneyLocale(), { maximumFractionDigits: 1 })}\u00A0%`
  const wTxt = (k) => (LADDERS[k] || []).map(w => Math.round(w * 100)).join('/')
  const sampleList = rd.sample

  if (!ready) return <p className={p.note} role="status">{t('opp.loading')}</p>

  const loadingNow = rd.phase === 'loading' && !Object.keys(rd.readings).length
  return (
    <>
      <section className={p.card} aria-labelledby="opp-title">
        <h2 id="opp-title" className={p.title}>{t('opp.title')}</h2>
        <p className={p.lead}>{t('opp.lead')}</p>
        <p className={s.edu} role="note"><Info size={14} strokeWidth={2} aria-hidden="true" />{t('opp.edu')}</p>
        <div aria-live="polite">
          {!items.length && <p className={p.note}>{t('opp.empty')}</p>}
          {loadingNow && <p className={p.note} role="status">{t('opp.loading')}</p>}
          {rd.phase === 'error' && (
            <div className={p.row}><p className={p.error}>{t('opp.error')}</p><button type="button" className={p.btn} onClick={rd.reload}>{t('opp.retry')}</button></div>
          )}
        </div>
        {!loadingNow && rd.phase !== 'error' && [['mine', mine], ['watch', watchItems]].map(([g, list]) => list.length > 0 && (
          <div key={g} className={s.group}>
            <h3 className={s.groupTitle}>{t(`opp.group.${g}`)}</h3>
            <ul className={s.assets}>
              {list.map(it => <AssetRow key={it.t} item={it} r={rd.readings[it.t] || null} t={t} fmt={fmt} onOpen={onOpen} />)}
            </ul>
          </div>
        ))}
        {sampleList.length > 0 && <p className={p.note}>{t('opp.sample', { list: sampleList.join(', ') })}</p>}
        {demo && !sampleList.length && rd.phase === 'ready' && items.length > 0 && <p className={p.note}>{t('opp.live')}</p>}
        <details className={s.how}>
          <summary>{t('opp.how.title')}</summary>
          {['sma', 'tramo', 'days', 'rsi', 'dd', 'data'].map(k => <p key={k} className={p.note}>{t(`opp.how.${k}`)}</p>)}
        </details>
      </section>

      <section ref={capRef} className={p.card} aria-labelledby="opp-cap-title">
        <h2 id="opp-cap-title" className={p.title}>{t('opp.cap.title')}</h2>
        <p className={p.lead}>{t('opp.cap.lead')}</p>
        <label className={p.field}>
          <span className={p.fieldLabel}>{t('opp.cap.amount')}</span>
          <input className={p.input} value={raw} onChange={e => { setRaw(e.target.value); setSrc(null) }} inputMode="decimal" autoComplete="off"
            aria-invalid={amountErr || undefined} aria-describedby={amountErr ? 'opp-amount-err' : undefined} />
        </label>
        {amountErr && <p id="opp-amount-err" className={p.error}>{t('opp.cap.err.amount')}</p>}
        <div className={p.row}>
          {free > 0 && <button type="button" className={p.link} onClick={() => { setRaw(String(free)); setSrc('free') }}>{t('opp.cap.fromFree', { v: m(fmt.money(free)) })}</button>}
          {cash > 0 && <button type="button" className={p.link} onClick={() => { setRaw(String(Math.round(cash * 100) / 100)); setSrc('cash') }}>{t('opp.cap.fromCash', { v: m(fmt.money(cash)) })}</button>}
        </div>
        {src === 'arrived' && <p className={p.note}>{t('opp.cap.arrived', { v: m(fmt.money(amt)) })}</p>}
        {(src === 'free' || src === 'cash') && <p className={p.note}>{t('opp.cap.lumpNote')}</p>}

        <Radios label={t('opp.cap.between')} id="opp-between" value={method} onChange={pickMethod}
          options={[{ value: 'targets', label: t('opp.cap.m.targets') }, { value: 'equal', label: t('opp.cap.m.equal') }, { value: 'manual', label: t('opp.cap.m.manual') }]} />
        {method === 'targets' && !hasTargets && (
          <div className={p.row}>
            <p className={p.note}>{t('opp.cap.noTargets')}</p>
            {onTab && <button type="button" className={p.link} onClick={() => { rememberPortTab('objetivos', safeStore); onTab('portafolio') }}>{t('opp.cap.goTargets')}</button>}
          </div>
        )}
        {method !== 'manual' && !base.length && <p className={p.note}>{t('opp.cap.noBase')}</p>}
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
        {alloc.length > 0 && (
          <p className={allocReady(alloc) ? p.ok : p.error} aria-live="polite">{allocReady(alloc) ? t('opp.cap.sumOk') : t('opp.cap.sumBad', { sum: pctTxt(pctSum(alloc)) })}</p>
        )}

        <Radios label={t('opp.cap.within')} id="opp-within" value={lad} onChange={setLad}
          options={LADDER_KEYS.map(k => ({ value: k, label: t(`opp.lad.${k}`), sub: wTxt(k) }))} />
        <label className={s.check}>
          <input type="checkbox" checked={rsiRule} onChange={e => setRsiRule(e.target.checked)} style={{ width: 16, height: 16, flexShrink: 0 }} />
          <span>{t('opp.cap.rsiRule')}</span>
        </label>

        <div aria-live="polite">
          {!plan.ok ? (
            <p className={p.note}>{plan.error === 'sum' ? t('opp.res.sum') : t('opp.res.none')}</p>
          ) : (
            <Result plan={plan} t={t} fmt={fmt} m={m} pending={pending} pctTxt={pctTxt} lad={lad} rsiRule={rsiRule} method={method} math={math} alloc={alloc} />
          )}
        </div>
        {plan.ok && onDeposit && (
          <div className={p.row}>
            <button type="button" className={p.btn} onClick={() => onDeposit({ type: 'deposit', amount: String(amt), currency: 'USD', source: null })}>{t('opp.res.deposit')}</button>
          </div>
        )}
        <p className={s.edu} role="note"><Info size={14} strokeWidth={2} aria-hidden="true" />{t('opp.edu')}</p>
      </section>
    </>
  )
}

function Result({ plan, t, fmt, m, pending, pctTxt, lad, rsiRule, method, math, alloc }) {
  const money = (v) => <Money>{fmt.money(v)}</Money>
  const wPct = (w) => pctTxt(w * 100)
  return (
    <div className={s.result}>
      <div className={p.result}>
        <p className={p.resultLabel}>{t('opp.res.title', { v: m(fmt.money(plan.total)) })}</p>
        <div className={p.stats}>
          <div className={p.stat}><span className={p.resultLabel}>{t('opp.res.today')}</span><span className={`${p.statValue} ${s.statBig}`}>{money(plan.today)}</span></div>
          <div className={p.stat}><span className={p.resultLabel}>{t('opp.res.wait')}</span><span className={`${p.statValue} ${s.statBig}`}>{money(plan.wait)}</span></div>
          {plan.noData > 0 && <div className={p.stat}><span className={p.resultLabel}>{t('opp.res.noData')}</span><span className={`${p.statValue} ${s.statBig}`}>{money(plan.noData)}</span></div>}
        </div>
      </div>
      {pending.length > 0 && <p className={p.note} role="status">{t('opp.res.pending', { list: pending.join(', ') })}</p>}

      <ul className={s.plan}>
        {plan.rows.map(r => (
          <li key={r.t} className={s.planRow}>
            <p className={s.planHead}><span className={s.ticker}>{r.t}</span><span>{pctTxt(r.p)}</span><span className={s.num}>{money(r.amount)}</span></p>
            {!r.tramos ? <p className={p.note}>{t('opp.res.noHistory')}</p> : (
              <>
                <p className={p.note}>{t('opp.res.assetToday', { a: m(fmt.money(r.today)), b: m(fmt.money(r.wait)) })}</p>
                <ul className={s.tramos}>
                  {r.tramos.map(tr => {
                    const st = tr.state === 'none' ? t('opp.res.st.none')
                      : tr.state === 'today' ? t('opp.res.st.today')
                        : tr.rsiBlocked ? t('opp.res.st.rsi', { v: Math.round(r.reading.rsi ?? 0) })
                          : t('opp.res.st.wait', { p: fmt.pct(Math.abs(tr.dist || 0), { decimals: 1 }) })
                    return (
                      <li key={tr.n} className={s.tramo} data-st={tr.state}>
                        <span className={s.tramoName}>{t('opp.res.tramo', { k: tr.tramo, n: tr.n })} · {wPct(tr.w)}</span>
                        <span className={s.num}>{tr.amount == null ? '—' : money(tr.amount)}</span>
                        <span className={s.tramoState}>{tr.state === 'today' ? <Check size={13} strokeWidth={2.6} aria-hidden="true" /> : null}{st}</span>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </li>
        ))}
      </ul>
      {plan.reassigned && <p className={p.note}>{t('opp.res.reassigned')}</p>}
      <p className={p.note}>{t('opp.res.moves')}</p>

      <details className={s.how}>
        <summary>{t('opp.math.title')}</summary>
        <MathSteps plan={plan} t={t} fmt={fmt} m={m} pctTxt={pctTxt} lad={lad} rsiRule={rsiRule} method={method} math={math} alloc={alloc} />
      </details>
    </div>
  )
}

function MathSteps({ plan, t, fmt, m, pctTxt, lad, rsiRule, method, math, alloc }) {
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
            const v = { t: r.t, a: pctTxt(r.actual), g: pctTxt(r.target), d: pctTxt(r.gap).replace('\u00A0%', ''), sum: pctTxt(gapSum).replace('\u00A0%', ''), p: pctTxt(row?.p ?? 0), v: m(fmt.money(row?.amount ?? 0)) }
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
