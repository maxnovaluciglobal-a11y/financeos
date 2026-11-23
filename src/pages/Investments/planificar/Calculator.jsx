// src/pages/Investments/planificar/Calculator.jsx — Planificar › Calculadora (F5).
// Invest: renderPBBody / pbCalc (app/index.html:7650-7773) con app/lib/risk.js.
// Vista esencial: "¿Cuánto puedo perder si sale mal?" en palabras: precio de
// compra y cuánto aceptas que baje (8 % si se deja vacío); el resultado dice
// cuántas unidades caben y cuánto perderías. Vista completa: stop, capital y
// regla editables para probar, exposición, aviso de concentración y la tabla
// de escenarios en múltiplos de R, como Invest.
import { useEffect, useMemo, useRef, useState } from 'react'
import Money, { useMoney } from '../../../components/Money.jsx'
import { investApi } from '../../../core/investApi.js'
import { demoInvestQuotes } from '../../../demo/demoInvestBook.js'
import { sampleQuote } from '../../../demo/demoInvestAsset.js'
import { num } from '../../../utils/investTrade.js'
import { currencyOf, rateOf } from '../../../utils/investValuation.js'
import { amount, DEFAULT_STOP_PCT, isFractional, PLAN_CCY_RE, RISK_MAX, RISK_MIN, sizeInUsd, stopFromDrop } from '../../../utils/investPlan.js'
import { shows } from '../../../utils/investView.js'
import { moneyLocale } from '../../../utils/index.js'
import s from './planificar.module.css'

const TICKER_RE = /^[A-Z0-9.\-^=]{1,15}$/
const r2 = (n) => Math.round(n * 100) / 100
// Decimales justos para la regla (1 %, 1,5 %, 0,25 %).
export const ruleDecimals = (v) => (Number.isInteger(v) ? 0 : Number.isInteger(v * 10) ? 1 : 2)

// Formulario → entradas de sizeInUsd según la vista.
// form.capital y form.risk: en la Vista completa los escribe la persona; en
// las dos los carga un plan guardado con capital o regla propios. La esencial
// no los muestra como campos pero SÍ los usa (y lo dice con planOverride):
// así un plan abierto da las mismas unidades en las dos vistas.
export function calcInputs(form, { full, capital, rule }) {
  const entry = num(form.entry)
  const drop = form.drop === '' || form.drop == null ? DEFAULT_STOP_PCT * 100 : num(form.drop)
  const dropBad = !full && !(drop > 0 && drop < 100)
  const dropTyped = !full && form.drop !== '' && form.drop != null
  const riskTyped = form.risk !== '' && form.risk != null
  const riskNum = riskTyped ? num(form.risk) : NaN
  const riskInRange = riskNum >= RISK_MIN && riskNum <= RISK_MAX
  // La regla escrita a mano en la Vista completa tiene los mismos topes que la
  // de la cuenta (0,1 % a 10 %): fuera de eso no se calcula ni se guarda. En la
  // esencial una regla fuera de rango no se usa: vale la de la cuenta.
  const riskPct = full ? (riskTyped ? riskNum : rule.risk) : (riskTyped && riskInRange ? riskNum : rule.risk)
  const riskBad = full && riskTyped && !riskInRange
  const capTyped = form.capital !== '' && form.capital != null
  const capNum = capTyped ? amount(form.capital) : NaN
  const cap = full ? (capTyped ? capNum : capital) : (capTyped && capNum > 0 ? capNum : capital)
  // Sin caída escrita, el stop queda vacío: se estima con −8 % y se marca así.
  const stop = full ? (form.stop === '' ? '' : num(form.stop)) : (dropTyped && entry > 0 && !dropBad ? stopFromDrop(entry, drop) : '')
  return {
    entry, stop, dropBad, riskBad,
    capital: cap,
    riskPct,
    limit: rule.limit / 100,
    // En la esencial la caída que escribió la persona no es una estimación.
    dropTyped,
    // Esencial con el capital o la regla del plan abierto (no los de la cuenta).
    planOverride: !full && (cap !== capital || riskPct !== rule.risk),
  }
}

export default function Calculator({ pb, fmt, t, view, demo, rule, capital, seed, editing, onSavePlan, onAddToPortfolio }) {
  const full = shows(view, 'riskR')
  const { m } = useMoney()
  const [form, setForm] = useState({ ticker: '', entry: '', stop: '', drop: '', capital: '', risk: '' })
  const [quote, setQuote] = useState({ state: 'idle', t: null, price: null, ccy: null })
  const auto = useRef(false) // el precio lo puso la búsqueda (se puede reemplazar)
  const seq = useRef(0)

  // Abrir un plan guardado o un atajo de "Desde tu portafolio".
  useEffect(() => {
    if (!seed) return
    auto.current = false
    setForm({
      ticker: seed.t || '', entry: seed.entry != null ? String(seed.entry) : '',
      stop: seed.stop != null ? String(seed.stop) : '',
      drop: seed.stop != null && seed.entry > 0 ? String(r2((1 - seed.stop / seed.entry) * 100)) : '',
      capital: seed.cap != null && seed.cap !== capital ? String(seed.cap) : '',
      risk: seed.risk != null && seed.risk !== rule.risk ? String(seed.risk) : '',
    })
    // Con la moneda guardada no hace falta volver a pedir el precio; sin una
    // válida, se vuelve a pedir (t: null) para no tomar peniques por dólares.
    const ccyOk = PLAN_CCY_RE.test(String(seed.ccy || ''))
    setQuote({ state: 'idle', t: ccyOk ? seed.t || null : null, price: null, ccy: ccyOk ? seed.ccy : null })
  }, [seed]) // eslint-disable-line react-hooks/exhaustive-deps -- solo al llegar un plan nuevo, no al cambiar la regla
  // Al dejar de editar el plan, la esencial vuelve al capital y la regla de la
  // cuenta (en la completa quedan a la vista en sus campos).
  useEffect(() => {
    if (!editing && !full) setForm(f => (f.capital !== '' || f.risk !== '' ? { ...f, capital: '', risk: '' } : f))
  }, [editing, full])

  const tk = String(form.ticker || '').toUpperCase().trim()
  // Buscar el precio al escribir el símbolo (con una pausa corta).
  useEffect(() => {
    if (!TICKER_RE.test(tk) || quote.t === tk) return undefined
    const my = ++seq.current
    const id = setTimeout(async () => {
      setQuote({ state: 'loading', t: tk, price: null, ccy: null })
      let q = null
      try {
        q = demo ? (demoInvestQuotes()[tk] || sampleQuote(tk)) : await investApi.quote(tk, { crypto: isFractional(tk) })
      } catch { q = null }
      if (my !== seq.current) return
      const price = Number(q?.price) > 0 ? Number(q.price) : null
      setQuote({ state: price ? 'ready' : 'missing', t: tk, price, ccy: q?.currency || null })
      if (price) setForm(f => (f.entry === '' || auto.current ? { ...f, entry: String(price) } : f))
      if (price) auto.current = true
    }, 450)
    return () => clearTimeout(id)
  }, [tk, demo, quote.t])

  const holdingQuote = pb.market.quotes?.[tk]
  // Moneda desconocida (sufijo que no conocemos y sin cotización, o todavía
  // cargando) = no se calcula: nunca se asume USD (un .JO en ZAc daría ~1.800
  // veces más unidades). rateOf(null) es null → sizeInUsd responde 'no-fx'.
  const ccy = currencyOf(tk, quote.t === tk ? quote.ccy : holdingQuote?.currency)
  const fx = ccy === 'USD' ? 1 : rateOf(ccy, pb.rates.rates)
  const ccyLabel = ccy || t('plan.calc.ccyUnknown')
  const inp = calcInputs(form, { full, capital, rule })
  const res = useMemo(() => {
    if (!tk || !(inp.entry > 0)) return { error: 'empty' }
    if (inp.dropBad) return { error: 'drop' }
    if (inp.riskBad) return { error: 'risk-range' }
    if (!ccy) return { error: 'no-ccy' }
    return sizeInUsd({ entry: inp.entry, stop: inp.stop, fx, capital: inp.capital, riskPct: inp.riskPct, limit: inp.limit, ticker: tk })
  }, [tk, inp.entry, inp.stop, inp.dropBad, inp.riskBad, ccy, fx, inp.capital, inp.riskPct, inp.limit])

  const set = (k) => (e) => {
    const v = e.target.value
    if (k === 'entry') auto.current = false
    setForm(f => ({ ...f, [k]: k === 'ticker' ? v.toUpperCase() : v }))
  }
  const chips = [...new Set((pb.holdings || []).map(h => h.t))].slice(0, 8)
  function fillFrom(tick) {
    const h = pb.holdings.find(x => x.t === tick)
    const price = pb.market.quotes?.[tick]?.price ?? h?.cost
    auto.current = false
    setQuote({ state: 'idle', t: tick, price: null, ccy: pb.market.quotes?.[tick]?.currency || null })
    setForm(f => ({
      ...f, ticker: tick, entry: price ? String(price) : '',
      stop: h?.stop > 0 ? String(h.stop) : '',
      drop: h?.stop > 0 && price > 0 && h.stop < price ? String(r2((1 - h.stop / price) * 100)) : '',
    }))
  }

  const ok = !res.error
  const pctFmt = (f, d = 1) => fmt.pct(f, { decimals: d })
  const money = (usd) => m(fmt.money(usd))
  // Precio en la moneda del activo; sin moneda conocida, la cifra sola.
  const natRaw = (n) => (ccy ? fmt.native(n, ccy) : fmt.units(n))
  const nat = (n) => m(natRaw(n))
  const units = ok ? res.units : 0
  const unitsLabel = ok ? (units === 0 ? t('plan.calc.res.none') : units === 1 ? t('plan.calc.res.unit1') : t('plan.calc.res.units', { n: fmt.units(units) })) : ''
  const errText = res.error && res.error !== 'empty'
    ? t(res.error === 'drop' ? 'plan.calc.err.drop' : `plan.calc.err.${res.error}`, { ccy: ccyLabel, t: tk, min: fmt.pct(RISK_MIN / 100, { decimals: 1 }), max: fmt.pct(RISK_MAX / 100, { decimals: 0 }) })
    : null

  return (
    <section className={s.card} aria-labelledby="plan-calc-title">
      <h2 id="plan-calc-title" className={s.title}>{t(full ? 'plan.calc.titleFull' : 'plan.calc.title')}</h2>
      <p className={s.lead}>{t(full ? 'plan.calc.introFull' : 'plan.calc.intro')}</p>
      {editing && <p className={s.editing}>{t('plan.pl.editing', { name: editing.label })}</p>}

      {chips.length > 0 && (
        <div className={s.field}>
          <span className={s.fieldLabel} id="plan-calc-chips">{t('plan.calc.fromPortfolio')}</span>
          <div className={s.row} role="group" aria-labelledby="plan-calc-chips">
            {chips.map(c => <button key={c} type="button" className={s.chip} onClick={() => fillFrom(c)}>{c}</button>)}
          </div>
        </div>
      )}

      <div className={s.grid}>
        <label className={s.field}>
          <span className={s.fieldLabel}>{t('plan.calc.ticker')}</span>
          <input className={s.input} value={form.ticker} onChange={set('ticker')} maxLength={15} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder={t('plan.calc.tickerPh')} />
        </label>
        <label className={s.field}>
          <span className={s.fieldLabel}>{t('plan.calc.entry', { ccy: ccyLabel })}</span>
          <input className={s.input} value={form.entry} onChange={set('entry')} inputMode="decimal" autoComplete="off" aria-invalid={res.error === 'no-entry' || undefined} />
        </label>
        {full ? (
          <label className={s.field}>
            <span className={s.fieldLabel}>{t('plan.calc.stop', { ccy: ccyLabel })}</span>
            <input className={s.input} value={form.stop} onChange={set('stop')} inputMode="decimal" autoComplete="off"
              placeholder={inp.entry > 0 ? t('plan.calc.stopPh', { v: natRaw(inp.entry * (1 - DEFAULT_STOP_PCT)) }) : ''}
              aria-invalid={res.error === 'stop-not-below-price' || undefined} aria-describedby="plan-calc-stop-help" />
            <span id="plan-calc-stop-help" className={s.help}>{t('plan.calc.stopHelp')}</span>
          </label>
        ) : (
          <label className={s.field}>
            <span className={s.fieldLabel}>{t('plan.calc.drop')}</span>
            <input className={s.input} value={form.drop} onChange={set('drop')} inputMode="decimal" autoComplete="off" placeholder="8"
              aria-invalid={res.error === 'drop' || undefined} aria-describedby="plan-calc-drop-help" />
            <span id="plan-calc-drop-help" className={s.help}>{t('plan.calc.dropHelp')}</span>
          </label>
        )}
        {full && (
          <>
            <label className={s.field}>
              <span className={s.fieldLabel}>{t('plan.calc.capital')}</span>
              <input className={s.input} value={form.capital} onChange={set('capital')} inputMode="decimal" autoComplete="off" placeholder={capital ? String(capital) : ''} aria-invalid={res.error === 'no-capital' || undefined} />
            </label>
            <label className={s.field}>
              <span className={s.fieldLabel}>{t('plan.calc.risk')}</span>
              <input className={s.input} value={form.risk} onChange={set('risk')} inputMode="decimal" autoComplete="off" placeholder={String(rule.risk)} aria-invalid={res.error === 'no-risk' || res.error === 'risk-range' || undefined} aria-describedby={res.error === 'risk-range' ? 'plan-calc-err' : undefined} />
            </label>
          </>
        )}
      </div>
      {full && <p className={s.note}>{t('plan.cap.try')}</p>}
      {inp.planOverride && (
        <p className={s.note} role="note">{t('plan.calc.planRule', { cap: money(inp.capital), pct: pctFmt(inp.riskPct / 100, ruleDecimals(inp.riskPct)) })}</p>
      )}

      <p className={s.note} aria-live="polite">
        {quote.t === tk && quote.state === 'loading' ? t('plan.calc.priceLoading')
          : quote.t === tk && quote.state === 'ready' ? t('plan.calc.priceFrom', { t: tk, v: nat(quote.price) })
            : quote.t === tk && quote.state === 'missing' ? t('plan.calc.priceMissing', { t: tk }) : ''}
      </p>

      <div aria-live="polite">
        {!ok ? (
          <p id="plan-calc-err" className={errText ? s.error : s.note}>{errText || t('plan.calc.empty')}</p>
        ) : (
          <div className={s.result}>
            <span className={s.resultLabel}>{full ? t('plan.calc.full.label', { t: tk, pct: pctFmt(inp.riskPct / 100, ruleDecimals(inp.riskPct)) }) : t('plan.calc.res.fits')}</span>
            <span className={s.big}>{unitsLabel}</span>
            {!full && (units > 0 ? (
              <>
                <p className={s.resultText}>{t('plan.calc.res.cost', { v: money(res.exposure), pct: pctFmt(res.exposurePct, 0) })}</p>
                <p className={s.resultText}>{t('plan.calc.res.bad', { drop: pctFmt(res.dropPct, 1), price: nat(res.stopLocal), loss: money(res.lossAtStop), pct: pctFmt(res.lossPct, 1) })}</p>
                <p className={s.resultText2}>{t('plan.calc.res.good', { gain: money(res.rTable[1].pnl) })}</p>
                {!inp.dropTyped && <p className={s.resultText2}>{t('plan.calc.res.estimated')}</p>}
                {res.exposurePct > rule.limit / 100 && <p className={s.resultText2}>{t('plan.calc.res.over', { w: pctFmt(res.exposurePct, 0), limit: pctFmt(rule.limit / 100, 0) })}</p>}
              </>
            ) : <p className={s.resultText}>{t('plan.calc.res.badNone')}</p>)}
            {full && (
              <div className={s.stats}>
                <div className={s.stat}><span className={s.resultLabel}>{t('plan.calc.full.exposure')}</span><span className={s.statValue}><Money>{fmt.money(res.exposure)}</Money> · {pctFmt(res.exposurePct, 0)}</span></div>
                <div className={s.stat}><span className={s.resultLabel}>{t('plan.calc.full.atStop')}</span><span className={s.statValue}><Money>{fmt.money(-res.lossAtStop)}</Money> · {pctFmt(res.lossPct, 1)}</span></div>
                <div className={s.stat}><span className={s.resultLabel}>{t('plan.calc.full.stop')}</span><span className={s.statValue}><Money>{natRaw(res.stopLocal)}</Money></span><span className={s.resultText2}>{t(res.stopIsEstimate ? 'plan.calc.full.stopEst' : 'plan.calc.full.stopOwn')}</span></div>
              </div>
            )}
          </div>
        )}
      </div>

      {ok && full && ccy && ccy !== 'USD' && (
        <p className={s.note}>{t('plan.calc.full.ccyNote', { ccy, rate: Number(fx).toLocaleString(moneyLocale(), { maximumFractionDigits: ['CLP', 'COP'].includes(ccy) ? 2 : 4 }) })}</p>
      )}
      {ok && full && res.concentration && (
        <p className={s.warn} role="note">
          {res.concentration.maxUnits > 0
            ? t('plan.calc.full.conc', { limit: pctFmt(res.concentration.limit, 0), w: pctFmt(res.concentration.weight, 0), n: fmt.units(res.concentration.maxUnits), w2: pctFmt(res.concentration.weightAtMax, 0) })
            : t('plan.calc.full.concNone', { limit: pctFmt(res.concentration.limit, 0) })}
        </p>
      )}
      {ok && full && units > 0 && (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <caption className={s.between} style={{ captionSide: 'top', textAlign: 'left', padding: '0 0 6px' }}>
              <span className={s.strong}>{t('plan.calc.full.rTitle')}</span>
              <span className={s.note}>{t('plan.calc.full.rSub', { r: nat(res.entryLocal - res.stopLocal) })}</span>
            </caption>
            <thead><tr><th scope="col">{t('plan.calc.full.col.scenario')}</th><th scope="col">{t('plan.calc.full.col.price')}</th><th scope="col">{t('plan.calc.full.col.result')}</th></tr></thead>
            <tbody>
              {res.rTable.map(r => (
                <tr key={r.key}>
                  <th scope="row">{t(`plan.calc.r.${r.key}`)}</th>
                  <td><Money>{natRaw(r.priceLocal)}</Money></td>
                  <td className={r.pnl < 0 ? s.neg : s.pos}><Money>{fmt.money(r.pnl, { signed: true })}</Money></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ok && units > 0 && (
        <div className={s.row}>
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={() => onSavePlan({ ticker: tk, ccy, entry: inp.entry, stop: res.stopIsEstimate ? null : (full ? inp.stop : res.stopLocal), capital: inp.capital, risk: inp.riskPct }, res)}>
            {editing ? t('plan.pl.update') : t('plan.calc.savePlan')}
          </button>
          {editing && <button type="button" className={s.btn} onClick={() => onSavePlan({ ticker: tk, ccy, entry: inp.entry, stop: res.stopIsEstimate ? null : (full ? inp.stop : res.stopLocal), capital: inp.capital, risk: inp.riskPct }, res, { asNew: true })}>{t('plan.pl.saveNew')}</button>}
          <button type="button" className={s.btn} onClick={() => onAddToPortfolio({ type: 'buy', ticker: tk, price: String(inp.entry), qty: String(units), amount: String(r2(inp.entry * units)), assetType: isFractional(tk) ? 'Crypto' : '' })}>
            {t('plan.calc.add')}
          </button>
        </div>
      )}
      <p className={s.note}>{t('plan.calc.foot')} {t('plan.dataNote')}</p>
    </section>
  )
}
