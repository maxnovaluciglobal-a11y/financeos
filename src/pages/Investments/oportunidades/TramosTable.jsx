// src/pages/Investments/oportunidades/TramosTable.jsx — Planificar › Tus tramos:
// la matriz activos × tramos (rediseño del 24-nov-2026, opción A).
//
// Filas = lo que tienes (con su monto si el reparto lo incluye); columnas = las
// medias de 20, 50, 100 y 200 días con el peso de su tramo. Cada celda: monto
// del tramo y su estado, siempre con ícono y palabra o cifra (nunca solo
// color): "✓ hoy", "+6,1 %" sobre la media, "! RSI" si el precio está en o
// bajo la media pero el RSI cae fuera de 30–45 (o no hay RSI), "—" sin media.
// Al pie, Total y Cumple hoy por columna. Debajo, lo que sigues, solo con la
// distancia a cada media. Tabla real (caption, th scope, tfoot) con la columna
// del activo fija; en 390 px cabe sin scroll horizontal y, con letra grande o
// pantallas más angostas, la región se desplaza con la columna fija.
//
// Componente puro (sin pedidos ni estado): los números salen de planCapital
// (capital.js) y las distancias de readSignal (signals.js), sin cuentas nuevas.
import { Check, Circle, CircleAlert } from 'lucide-react'
import Money from '../../../components/Money.jsx'
import { LADDERS } from '../../../utils/investPlan.js'
import { moneyLocale } from '../../../utils/index.js'
import { SMAS } from './signals.js'
import { DEFAULT_LADDER } from './capital.js'
import s from './oportunidades.module.css'

const cents = (v) => Math.round(Number(v) * 100)

/** Total y "cumple hoy" por columna (tramo), en centavos exactos. */
export function columnTotals(plan) {
  const total = SMAS.map(() => 0), today = SMAS.map(() => 0)
  for (const r of plan?.rows || []) {
    if (!r.tramos) continue
    r.tramos.forEach((tr, i) => {
      if (tr.amount == null) return
      total[i] += cents(tr.amount)
      if (tr.state === 'today') today[i] += cents(tr.amount)
    })
  }
  return { total: total.map(c => c / 100), today: today.map(c => c / 100) }
}

// Monto corto para el teléfono: sin "US$" (lo dice el título) y sin ",00".
export function shortAmount(v) {
  const n = Number(v)
  const whole = cents(n) % 100 === 0
  return n.toLocaleString(moneyLocale(), { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })
}

function Amt({ v, fmt, wide = false }) {
  if (wide) return <Money>{fmt.money(v)}</Money>
  return (
    <Money>
      <span className={s.n}>{shortAmount(v)}</span>
      <span className={s.w}>{fmt.money(v)}</span>
    </Money>
  )
}

// Celda de un tramo con monto.
function TramoCell({ tr, reading, t, fmt }) {
  if (tr.state === 'none') {
    return (
      <td data-st="none">
        <span className={s.st} aria-hidden="true"><span className={s.n}>—</span><span className={s.w}>{t('opp.tbl.noneWide')}</span></span>
        <span className="sr-only">{t('opp.res.st.none')}</span>
      </td>
    )
  }
  const pct = fmt.pct(tr.dist, { signed: true, decimals: 1 })
  let st, sr, key
  if (tr.state === 'today') {
    key = 'today'
    sr = t('opp.res.st.today')
    st = <><Check size={12} strokeWidth={2.8} /><span className={s.n}>{t('opp.tbl.hoy')}</span><span className={s.w}>{t('opp.tbl.today')}</span></>
  } else if (tr.rsiBlocked) {
    key = 'rsi'
    sr = tr.rsiMissing ? t('opp.res.st.rsiNone') : t('opp.res.st.rsi', { v: Math.round(reading.rsi) })
    st = <><CircleAlert size={12} strokeWidth={2.4} /><span className={s.n}>{t('opp.tbl.rsiShort')}</span><span className={s.w}>{t(tr.rsiMissing ? 'opp.tbl.rsiMissingWide' : 'opp.tbl.rsiWide')}</span></>
  } else {
    key = 'wait'
    sr = t('opp.res.st.wait', { p: fmt.pct(Math.abs(tr.dist || 0), { decimals: 1 }) })
    st = <><span className={s.w}><Circle size={10} strokeWidth={2.4} /></span>{pct}</>
  }
  return (
    <td data-st={key}>
      <span className={s.amt}><Amt v={tr.amount} fmt={fmt} /></span>
      <span className={s.st} aria-hidden="true">{st}</span>
      <span className="sr-only">{sr}</span>
    </td>
  )
}

// Celda de solo distancia (lo que sigues, o lo que tienes sin monto en el reparto).
function DistCell({ m, t, fmt }) {
  if (!m || m.value == null) {
    return <td data-st="none"><span className={s.st} aria-hidden="true">—</span><span className="sr-only">{t('opp.tbl.sr.none')}</span></td>
  }
  const pct = fmt.pct(m.dist, { signed: true, decimals: 1 })
  const abs = fmt.pct(Math.abs(m.dist), { decimals: 1 })
  const at = Math.abs(m.dist) < 0.0005
  const sr = at ? t('opp.tbl.sr.at') : m.hit ? t('opp.tbl.sr.below', { p: abs }) : t('opp.tbl.sr.above', { p: abs })
  return (
    <td data-st={m.hit ? 'hit' : 'wait'}>
      <span className={s.st} aria-hidden="true">{m.hit && <Check size={12} strokeWidth={2.8} />}{pct}</span>
      <span className="sr-only">{sr}</span>
    </td>
  )
}

function Ticker({ tk, onOpen, t }) {
  return onOpen
    ? <button type="button" className={s.tk} onClick={() => onOpen(tk)} aria-label={t('opp.open', { t: tk })}>{tk}</button>
    : <span className={s.tk}>{tk}</span>
}

const rsiSub = (r, t) => (r ? (r.rsi == null ? t('opp.tbl.rsiNone') : t('opp.tbl.rsi', { v: Math.round(r.rsi) })) : null)

function DistRow({ it, r, t, fmt, onOpen, mine }) {
  return (
    <tr>
      <th scope="row">
        <Ticker tk={it.t} onOpen={onOpen} t={t} />
        {it.name && <span className={`${s.sub} ${s.w}`}>{it.name}</span>}
        {mine && <span className={`${s.sub} ${s.n}`}>{t('opp.tbl.noAmount')}</span>}
        {r && <span className={s.sub}>{rsiSub(r, t)}</span>}
      </th>
      {r ? SMAS.map((n, i) => <DistCell key={n} m={r.smas[i]} t={t} fmt={fmt} />)
        : <td colSpan={4} className={s.noHist}>{t('opp.tbl.noHistory')}</td>}
      <td className={s.tot}><span className={s.st}>{t('opp.tbl.noAmount')}</span></td>
    </tr>
  )
}

/**
 * plan: planCapital(...) con ok:true, o null (sin monto: solo distancias).
 * mine / watch: [{ t, name? }] en orden; readings: { t: readSignal | null }.
 */
export default function TramosTable({ plan, mine, watch, readings, t, fmt, lad = DEFAULT_LADDER, onOpen }) {
  const w = LADDERS[lad] || LADDERS[DEFAULT_LADDER]
  const rows = plan?.rows || []
  const inPlan = new Set(rows.map(r => r.t))
  const names = Object.fromEntries([...mine, ...watch].map(i => [i.t, i.name]))
  const mineRest = mine.filter(i => !inPlan.has(i.t))
  const watchRest = watch.filter(i => !inPlan.has(i.t))
  const cols = plan ? columnTotals(plan) : null
  const pctW = (x) => `${Math.round(x * 100)}\u00A0%`
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- with large text or narrow screens the table scrolls sideways; the region takes focus so keyboard users can scroll it (axe scrollable-region-focusable)
    <div className={s.tw} tabIndex={0} role="region" aria-labelledby="opp-tbl-cap">
      <table className={s.mx}>
        <caption id="opp-tbl-cap">{t(plan ? 'opp.tbl.caption' : 'opp.tbl.captionDist')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('opp.tbl.asset')}</th>
            {SMAS.map((n, i) => (
              <th key={n} scope="col">
                <span className={s.n}>{t('opp.tbl.colShort', { n })}</span><span className={s.w}>{t('opp.tbl.col', { n })}</span>
                {plan && <small><span className={s.n}>{pctW(w[i])}</span><span className={s.w}>{t('opp.tbl.wWide', { p: pctW(w[i]) })}</span></small>}
              </th>
            ))}
            <th scope="col" className={s.tot}>{t('opp.tbl.total')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.t}>
              <th scope="row">
                <Ticker tk={r.t} onOpen={onOpen} t={t} />
                {names[r.t] && <span className={`${s.sub} ${s.w}`}>{names[r.t]}</span>}
                <span className={`${s.sub} ${s.n}`}><Money>{shortAmount(r.amount)}</Money></span>
                {r.reading && <span className={s.sub}>{rsiSub(r.reading, t)}</span>}
              </th>
              {r.tramos
                ? r.tramos.map(tr => <TramoCell key={tr.n} tr={tr} reading={r.reading} t={t} fmt={fmt} />)
                : <td colSpan={4} className={s.noHist}>{t('opp.tbl.noHistory')}</td>}
              <td className={s.tot}>
                <span className={s.amt}><Money>{fmt.money(r.amount)}</Money></span>
                {r.tramos && <span className={s.st} data-on={r.today > 0 || undefined}>{t('opp.tbl.hoy')} <Money>{fmt.money(r.today)}</Money></span>}
              </td>
            </tr>
          ))}
          {mineRest.map(it => <DistRow key={it.t} it={{ ...it, name: names[it.t] }} r={readings[it.t] || null} t={t} fmt={fmt} onOpen={onOpen} mine={!!plan} />)}
        </tbody>
        {plan && (
          <tfoot>
            <tr>
              <th scope="row">{t('opp.tbl.total')}</th>
              {cols.total.map((v, i) => <td key={SMAS[i]}><span className={s.amt}><Amt v={v} fmt={fmt} /></span></td>)}
              <td className={s.tot}><span className={s.amt}><Amt v={plan.total} fmt={fmt} wide /></span></td>
            </tr>
            <tr className={s.hoyRow}>
              <th scope="row"><span className={s.todayTx}>{t('opp.tbl.today')}</span></th>
              {cols.today.map((v, i) => <td key={SMAS[i]} data-on={v > 0 || undefined}><span className={s.amt}><Amt v={v} fmt={fmt} /></span></td>)}
              <td className={s.tot} data-on={plan.today > 0 || undefined}><span className={s.amt}><Amt v={plan.today} fmt={fmt} wide /></span></td>
            </tr>
          </tfoot>
        )}
        {watchRest.length > 0 && (
          <tbody className={s.watch}>
            <tr className={s.grp}><th scope="rowgroup" colSpan={5}>{t('opp.tbl.watch')}</th><td className={s.tot}>{' '}</td></tr>
            {watchRest.map(it => <DistRow key={it.t} it={{ ...it, name: names[it.t] }} r={readings[it.t] || null} t={t} fmt={fmt} onOpen={onOpen} />)}
          </tbody>
        )}
      </table>
    </div>
  )
}
