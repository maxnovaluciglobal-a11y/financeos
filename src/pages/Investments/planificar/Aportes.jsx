// src/pages/Investments/planificar/Aportes.jsx — Planificar › Aportes (F5).
// Invest: renderCapital (app/index.html:8496-8598), CAP_LADDERS, repartoPorDesvio,
// capImportFromPortfolio y la cadencia (inventario 04 §2 y §C6-C10).
// Vista esencial: el aporte mensual, cómo se reparte entre tus símbolos (a
// mano, parejo entre tus posiciones o hacia tus objetivos sin vender) y
// "¿Cuánto podrías tener?" con un rendimiento supuesto que eliges tú.
// Vista completa: además el capital sin invertir como monto y la escalera de
// compra sobre las medias de 20, 50, 100 y 200 días con el RSI, como Invest.
import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import Money, { useMoney } from '../../../components/Money.jsx'
import { investApi } from '../../../core/investApi.js'
import { demoHistory } from '../../../demo/demoInvestHoy.js'
import { runLimited } from '../../../utils/investHoy.js'
import { num } from '../../../utils/investTrade.js'
import { rebalanceBase } from '../../../utils/investRebalance.js'
import {
  CADENCES, DEFAULT_PROJ, LADDERS, addAlloc, allocByDrift, allocReady, equalAlloc, ladderReading, ladderSplit,
  amount as amountOf, pctSum, perContribution, projectContributions, splitAmount,
} from '../../../utils/investPlan.js'
import { shows } from '../../../utils/investView.js'
import { rememberPortTab } from '../../../utils/investNav.js'
import { moneyLocale } from '../../../utils/index.js'
import { APORTE_EVENT, readAporte } from '../hoy/aporteStore.js'
import s from './planificar.module.css'

const readKey = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const safeStore = { setItem: (k, v) => { try { localStorage.setItem(k, v) } catch { /* modo privado: queda en el historial */ } } }
const LADDER_KEYS = Object.keys(LADDERS)

function Segs({ label, id, value, options, onChange }) {
  return (
    <div className={s.field}>
      <span className={s.fieldLabel} id={id}>{label}</span>
      <div className={s.segs} role="radiogroup" aria-labelledby={id}>
        {options.map(o => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={s.seg} onClick={() => onChange(o.value)}>{o.label}</button>
        ))}
      </div>
    </div>
  )
}

export default function Aportes({ pb, fmt, t, view, demo, capital, targets, seed, editing, onSavePlan, onDeposit, onTab }) {
  const full = shows(view, 'ladder')
  const { m } = useMoney()
  const [monthly, setMonthly] = useState('')
  const [amountErr, setAmountErr] = useState(null)
  const [source, setSource] = useState(null) // 'month' | 'capital' | 'cash' | null
  const [cad, setCad] = useState('monthly')
  const [alloc, setAlloc] = useState([])
  const [add, setAdd] = useState({ t: '', p: '', err: null })
  const [preset, setPreset] = useState(null) // mensaje del último "Partir de"
  const [lad, setLad] = useState('even')
  const [ladState, setLadState] = useState({ phase: 'idle', readings: {}, key: '' })
  const [proj, setProj] = useState({ years: String(DEFAULT_PROJ.years), rate: String(DEFAULT_PROJ.rate), initial: '' })
  const [monthAporte, setMonthAporte] = useState(() => readAporte(readKey))
  const run = useRef(0)

  // El aporte del mes que Resumen pasa a Planificar (hoy/aporteStore.js).
  useEffect(() => {
    const on = (e) => { const v = Number(e?.detail?.usd); if (v > 0) { setMonthAporte(v); setMonthly(String(v)); setSource('month') } }
    window.addEventListener(APORTE_EVENT, on)
    return () => window.removeEventListener(APORTE_EVENT, on)
  }, [])
  // Al entrar, si llegó un aporte desde Resumen y no hay monto escrito, se usa.
  useEffect(() => {
    if (monthAporte && monthly === '' && !seed) { setMonthly(String(monthAporte)); setSource('month') }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- solo al montar

  useEffect(() => {
    if (!seed) return
    setMonthly(String(seed.m)); setSource(null); setCad(seed.cad); setLad(seed.lad)
    setAlloc(seed.alloc.map(a => ({ ...a })))
    setProj(p => ({ ...p, years: String(seed.yrs), rate: String(seed.rate) }))
    setPreset(null); setLadState({ phase: 'idle', readings: {}, key: '' })
  }, [seed])

  const amount = amountOf(monthly)
  const base = useMemo(() => rebalanceBase(pb.positions.rows), [pb.positions.rows])
  const invested = pb.positions.totals?.cost || 0
  const free = capital > 0 ? Math.max(0, capital - invested) : null
  const cash = pb.ledger?.usesCash && pb.ledger.cash > 0 ? pb.ledger.cash : null
  const portValue = pb.positions.totals?.value || 0

  function pickAmount(v, src) { setMonthly(String(Math.round(v * 100) / 100)); setSource(src); setAmountErr(null) }
  function onAmount(e) {
    setMonthly(e.target.value); setSource(null)
    const v = amountOf(e.target.value)
    setAmountErr(e.target.value === '' ? null : v > 0 ? null : 'amount_invalid')
  }
  function addRow(e) {
    e?.preventDefault?.()
    const r = addAlloc(alloc, add.t, add.p)
    if (!r.ok) { setAdd(a => ({ ...a, err: r.error })); return }
    setAlloc(r.alloc); setAdd({ t: '', p: '', err: null }); setPreset(null)
  }
  function setPct(tk, v) { setAlloc(list => list.map(a => (a.t === tk ? { ...a, p: v === '' ? '' : num(v) } : a))) }
  function fromTargets() {
    if (!targets) { setPreset('noTargets'); return }
    const next = allocByDrift(base, targets)
    if (!next.length) { setPreset('zeroTargets'); return }
    setAlloc(next); setPreset('targetsOk')
  }
  function fromEqual() { setAlloc(equalAlloc(base.map(b => b.t))); setPreset(null) }

  const cleanAlloc = alloc.filter(a => Number(a.p) > 0)
  const split = splitAmount(amount, cleanAlloc)
  const sum = pctSum(cleanAlloc)
  const pctTxt = (p) => `${Number(p).toLocaleString(moneyLocale(), { maximumFractionDigits: 1 })} %`
  const ladRes = ladState.phase === 'ready' && ladState.key === cleanAlloc.map(a => a.t).join(',') ? ladderSplit(amount, cleanAlloc, ladState.readings, lad) : null

  async function calcLadder() {
    if (!split.ok) return
    const my = ++run.current
    const tickers = cleanAlloc.map(a => a.t)
    setLadState({ phase: 'loading', readings: {}, key: tickers.join(',') })
    const rows = await runLimited(tickers.map(tk => async () => (demo ? demoHistory(tk, '1y') : await investApi.history(tk, '1y', '1d'))), 4, () => my === run.current)
    if (my !== run.current) return
    const readings = {}
    tickers.forEach((tk, i) => { readings[tk] = rows[i] ? ladderReading(rows[i].map(r => r.close)) : null })
    const allFailed = !demo && rows.every(r => r == null)
    setLadState({ phase: allFailed ? 'error' : 'ready', readings, key: tickers.join(',') })
  }

  const pr = projectContributions({ monthly: amount, years: num(proj.years), rate: num(proj.rate), initial: proj.initial === '' ? 0 : amountOf(proj.initial) })
  const prErr = !pr.ok ? Object.entries(pr.fields).find(([k]) => k !== 'monthly' || amount > 0 || monthly !== '') : null

  const perOne = cad !== 'monthly' ? perContribution(amount, cad) : null

  return (
    <>
      <section className={s.card} aria-labelledby="plan-ap-title">
        <h2 id="plan-ap-title" className={s.title}>{t('plan.ap.title')}</h2>
        <p className={s.lead}>{t('plan.ap.intro')}</p>
        {editing && <p className={s.editing}>{t('plan.pl.editing', { name: editing.label })}</p>}

        <label className={s.field}>
          <span className={s.fieldLabel}>{t('plan.ap.amount')}</span>
          <input className={s.input} value={monthly} onChange={onAmount} inputMode="decimal" autoComplete="off" aria-invalid={!!amountErr || undefined} aria-describedby={amountErr ? 'plan-ap-amount-err' : undefined} />
        </label>
        {amountErr && <p id="plan-ap-amount-err" className={s.error}>{t(`plan.ap.err.${amountErr}`)}</p>}
        <div className={s.row}>
          {monthAporte > 0 && <button type="button" className={s.link} onClick={() => pickAmount(monthAporte, 'month')}>{t('plan.ap.fromMonth', { v: m(fmt.money(monthAporte)) })}</button>}
          {full && free > 0 && <button type="button" className={s.link} onClick={() => pickAmount(free, 'capital')}>{t('plan.ap.fromCapital', { v: m(fmt.money(free)) })}</button>}
          {cash > 0 && <button type="button" className={s.link} onClick={() => pickAmount(cash, 'cash')}>{t('plan.ap.fromCash', { v: m(fmt.money(cash)) })}</button>}
        </div>
        {source === 'capital' && <p className={s.note}>{t('plan.ap.fromCapitalNote', { v: m(fmt.money(amount)) })}</p>}

        <Segs label={t('plan.ap.cad.label')} id="plan-ap-cad" value={cad} onChange={setCad}
          options={CADENCES.map(c => ({ value: c, label: t(`plan.ap.cad.${c}`) }))} />
        {perOne > 0 && <p className={s.note}>{t('plan.ap.cad.note', { v: m(fmt.money(perOne)) })}</p>}
      </section>

      <section className={s.card} aria-labelledby="plan-alloc-title">
        <div className={s.between}>
          <h2 id="plan-alloc-title" className={s.title}>{t('plan.ap.alloc.title')}</h2>
          {cleanAlloc.length > 0 && <span className={allocReady(cleanAlloc) ? s.ok : s.error} aria-live="polite">{allocReady(cleanAlloc) ? t('plan.ap.alloc.sumOk') : t('plan.ap.alloc.sumBad', { sum: pctTxt(sum) })}</span>}
        </div>
        {base.length > 0 && (
          <div className={s.row}>
            <span className={s.note}>{t('plan.ap.alloc.from')}</span>
            <button type="button" className={s.chip} onClick={fromTargets}>{t('plan.ap.alloc.fromTargets')}</button>
            <button type="button" className={s.chip} onClick={fromEqual}>{t('plan.ap.alloc.fromEqual')}</button>
          </div>
        )}
        {preset && (
          <div className={s.row} aria-live="polite">
            <p className={preset === 'targetsOk' ? s.ok : s.note}>{t(`plan.ap.alloc.${preset}`)}</p>
            {preset === 'noTargets' && onTab && <button type="button" className={s.link} onClick={() => { rememberPortTab('objetivos', safeStore); onTab('portafolio') }}>{t('plan.ap.alloc.goTargets')}</button>}
          </div>
        )}
        {alloc.length === 0 ? <p className={s.note}>{t('plan.ap.alloc.empty')}</p> : (
          <ul className={s.allocList}>
            {alloc.map(a => (
              <li key={a.t} className={s.allocRow}>
                <span className={s.allocTicker}>{a.t}</span>
                <input className={s.input} value={a.p === '' ? '' : String(a.p)} onChange={e => setPct(a.t, e.target.value)} inputMode="decimal" aria-label={t('plan.ap.alloc.pctOf', { t: a.t })} />
                <button type="button" className={s.iconBtn} onClick={() => setAlloc(list => list.filter(x => x.t !== a.t))} aria-label={t('plan.ap.alloc.remove', { t: a.t })}><X size={18} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        )}
        <form className={s.addRow} onSubmit={addRow}>
          <label className={s.field}>
            <span className={s.fieldLabel}>{t('plan.ap.alloc.ticker')}</span>
            <input className={s.input} value={add.t} onChange={e => setAdd({ ...add, t: e.target.value.toUpperCase(), err: null })} maxLength={15} autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-invalid={add.err?.startsWith('ticker') || undefined} />
          </label>
          <label className={s.field}>
            <span className={s.fieldLabel}>{t('plan.ap.alloc.pct')}</span>
            <input className={s.input} value={add.p} onChange={e => setAdd({ ...add, p: e.target.value, err: null })} inputMode="decimal" autoComplete="off" aria-invalid={add.err === 'pct_range' || undefined} />
          </label>
          <button type="submit" className={s.btn}>{t('plan.ap.alloc.add')}</button>
        </form>
        {add.err && <p className={s.error} role="alert">{t(`plan.ap.alloc.err.${add.err}`)}</p>}
      </section>

      <section className={s.card} aria-labelledby="plan-res-title" aria-live="polite">
        <h2 id="plan-res-title" className={s.title}>{split.ok ? t('plan.ap.res.title', { v: m(fmt.money(split.total)) }) : t('plan.ap.alloc.title')}</h2>
        {!split.ok ? (
          <p className={s.note}>{split.error === 'sum' ? t('plan.ap.res.sum', { sum: pctTxt(sum) }) : t('plan.ap.res.none')}</p>
        ) : (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead><tr><th scope="col">{t('plan.ap.res.col.ticker')}</th><th scope="col">{t('plan.ap.res.col.pct')}</th><th scope="col">{t('plan.ap.res.col.amount')}</th></tr></thead>
              <tbody>{split.rows.map(r => <tr key={r.t}><th scope="row">{r.t}</th><td>{pctTxt(r.p)}</td><td><Money>{fmt.money(r.amount)}</Money></td></tr>)}</tbody>
              <tfoot><tr><td colSpan={2}>{t('plan.ap.res.total')}</td><td><Money>{fmt.money(split.total)}</Money></td></tr></tfoot>
            </table>
          </div>
        )}
        {split.ok && (
          <div className={s.row}>
            <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => onSavePlan({ m: amount, cad, lad, alloc: cleanAlloc, yrs: num(proj.years), rate: num(proj.rate) })}>{editing ? t('plan.pl.update') : t('plan.ap.savePlan')}</button>
            {editing && <button type="button" className={s.btn} onClick={() => onSavePlan({ m: amount, cad, lad, alloc: cleanAlloc, yrs: num(proj.years), rate: num(proj.rate) }, { asNew: true })}>{t('plan.pl.saveNew')}</button>}
            <button type="button" className={s.btn} onClick={() => onDeposit({ type: 'deposit', amount: String(amount), currency: 'USD', source: source === 'month' ? 'moyiq' : null })}>{t('plan.ap.deposit')}</button>
          </div>
        )}
        <p className={s.note}>{t('plan.ap.foot')}</p>
      </section>

      {full && (
        <section className={s.card} aria-labelledby="plan-lad-title">
          <h2 id="plan-lad-title" className={s.title}>{t('plan.lad.title')}</h2>
          <p className={s.lead}>{t('plan.lad.intro')}</p>
          <Segs label={t('plan.lad.label')} id="plan-lad-kind" value={lad} onChange={setLad}
            options={LADDER_KEYS.map(k => ({ value: k, label: t(`plan.lad.${k}`) }))} />
          <div className={s.row}>
            <button type="button" className={s.btn} onClick={calcLadder} disabled={!split.ok || ladState.phase === 'loading'}>
              {ladState.phase === 'loading' ? t('plan.lad.loading') : t('plan.lad.calc')}
            </button>
          </div>
          <div aria-live="polite">
            {ladState.phase === 'error' && <p className={s.error}>{t('plan.lad.error')}</p>}
            {!ladRes && ladState.phase !== 'error' && ladState.phase !== 'loading' && split.ok && <p className={s.note}>{t('plan.lad.pending')}</p>}
            {ladRes?.ok && (
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th scope="col">{t('plan.ap.res.col.ticker')}</th>
                      <th scope="col">{t('plan.ap.res.col.amount')}</th>
                      <th scope="col">{t('plan.lad.rsi')}</th>
                      {(LADDERS[lad] || LADDERS.even).map((w, i) => <th key={i} scope="col">{t('plan.lad.col', { n: [20, 50, 100, 200][i], w: pctTxt(w * 100) })}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {ladRes.rows.map(r => (
                      <tr key={r.t}>
                        <th scope="row">{r.t}</th>
                        <td><Money>{fmt.money(r.amount)}</Money></td>
                        {r.noHistory ? <td colSpan={5} style={{ textAlign: 'left' }}>{t('plan.lad.noHistory')}</td> : (
                          <>
                            <td>{r.rsi != null ? Math.round(r.rsi) : '—'}</td>
                            {r.tramos.map(tr => (
                              <td key={tr.n} className={tr.below ? s.strong : undefined} title={tr.sma != null ? t('plan.lad.smaTip', { n: tr.n, v: m(fmt.money(tr.sma)) }) : undefined}>
                                {tr.amount == null ? '—' : <><Money>{fmt.money(tr.amount)}</Money>{tr.below && <><span aria-hidden="true"> ·</span><span className={s.srOnly}> ({t('plan.lad.below')})</span></>}</>}
                              </td>
                            ))}
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td>{t('plan.ap.res.total')}</td><td><Money>{fmt.money(ladRes.total)}</Money></td></tr></tfoot>
                </table>
              </div>
            )}
            {ladRes?.ok && ladRes.rows.some(r => r.reassigned) && <p className={s.note}>{t('plan.lad.reassigned')}</p>}
          </div>
          <p className={s.note}>{t('plan.lad.foot')}</p>
        </section>
      )}

      <section className={s.card} aria-labelledby="plan-proj-title">
        <h2 id="plan-proj-title" className={s.title}>{t('plan.proj.title')}</h2>
        <div className={s.grid}>
          <label className={s.field}>
            <span className={s.fieldLabel}>{t('plan.proj.years')}</span>
            <input className={s.input} value={proj.years} onChange={e => setProj({ ...proj, years: e.target.value })} inputMode="numeric" autoComplete="off" aria-invalid={prErr?.[0] === 'years' || undefined} />
          </label>
          <label className={s.field}>
            <span className={s.fieldLabel}>{t('plan.proj.rate')}</span>
            <input className={s.input} value={proj.rate} onChange={e => setProj({ ...proj, rate: e.target.value })} inputMode="decimal" autoComplete="off" aria-invalid={prErr?.[0] === 'rate' || undefined} aria-describedby="plan-proj-rate-help" />
            <span id="plan-proj-rate-help" className={s.help}>{t('plan.proj.rateHelp')}</span>
          </label>
          <label className={s.field}>
            <span className={s.fieldLabel}>{t('plan.proj.initial')}</span>
            <input className={s.input} value={proj.initial} onChange={e => setProj({ ...proj, initial: e.target.value })} inputMode="decimal" autoComplete="off" placeholder="0" aria-invalid={prErr?.[0] === 'initial' || undefined} />
          </label>
        </div>
        {portValue > 0 && <button type="button" className={s.link} onClick={() => setProj({ ...proj, initial: String(Math.round(portValue)) })}>{t('plan.proj.useValue', { v: m(fmt.money(portValue)) })}</button>}
        <div aria-live="polite">
          {pr.ok ? (
            <div className={s.result}>
              <p className={s.resultText}>{t('plan.proj.result', { m: m(fmt.money(pr.monthly)), y: pr.years, r: fmt.pct(pr.rate / 100, { decimals: Number.isInteger(pr.rate) ? 0 : 1 }), v: m(fmt.money(pr.value)) })}</p>
              <div className={s.stats}>
                <div className={s.stat}><span className={s.resultLabel}>{t('plan.proj.put')}</span><span className={s.statValue}><Money>{fmt.money(pr.put)}</Money></span></div>
                <div className={s.stat}><span className={s.resultLabel}>{t(pr.growth < 0 ? 'plan.proj.growthNeg' : 'plan.proj.growth')}</span><span className={s.statValue}><Money>{fmt.money(Math.abs(pr.growth))}</Money></span></div>
              </div>
              {pr.byYear.length > 1 && (
                <p className={s.resultText2}>{pr.byYear.filter(y => y.year === 1 || y.year % 5 === 0 || y.year === pr.years).map(y => t('plan.proj.byYear', { y: y.year, v: m(fmt.money(y.value)) })).join(' · ')}</p>
              )}
            </div>
          ) : prErr ? <p className={s.error}>{t(`plan.proj.err.${prErr[1]}`)}</p> : null}
        </div>
        <p className={s.warn} role="note">{t('plan.proj.warn')}</p>
      </section>
    </>
  )
}
