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
import { useLayoutEffect, useRef, useState } from 'react'
import { Check, Circle, CircleAlert } from 'lucide-react'
import Money, { useMoney } from '../../../components/Money.jsx'
import { LADDERS } from '../../../utils/investPlan.js'
import { currencyOf } from '../../../utils/investValuation.js'
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

// Porcentaje en la convención del idioma (opp.pct): "10 %" en es/pt/de,
// "10%" en inglés. Recibe la salida de fmt.pct o una cifra sin signo de %.
export const pctIn = (t, str) => t('opp.pct', { p: String(str).replace(/[\u202F\u00A0 ]?%$/, '') })

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
  const pct = pctIn(t, fmt.pct(tr.dist, { signed: true, decimals: 1 }))
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
    sr = t('opp.res.st.wait', { p: pctIn(t, fmt.pct(Math.abs(tr.dist || 0), { decimals: 1 })) })
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
  const pct = pctIn(t, fmt.pct(m.dist, { signed: true, decimals: 1 }))
  const abs = pctIn(t, fmt.pct(Math.abs(m.dist), { decimals: 1 }))
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
    ? <button type="button" className={s.tk} data-long={tk.length > 6 || undefined} onClick={() => onOpen(tk)} aria-label={t('opp.open', { t: tk })}>{tk}</button>
    : <span className={s.tk} data-long={tk.length > 6 || undefined}>{tk}</span>
}

const rsiSub = (r, t) => (r ? (r.rsi == null ? t('opp.tbl.rsiNone') : t('opp.tbl.rsi', { v: Math.round(r.rsi) })) : null)

// Solo en la forma ancha: precio y caída desde el máximo de 1 año.
function Facts({ it, r, t, fmt }) {
  if (!r) return null
  const ccy = currencyOf(it.t, it.ccy)
  const dd = r.drawdown == null ? null : r.drawdown > -0.0005 ? t('opp.tbl.ddZero') : t('opp.tbl.dd', { p: pctIn(t, fmt.pct(Math.abs(r.drawdown), { decimals: 1 })) })
  return (
    <span className={`${s.sub} ${s.wb}`}>
      {t('opp.tbl.price')} <Money>{ccy ? fmt.native(r.price, ccy) : Number(r.price).toLocaleString(moneyLocale(), { maximumFractionDigits: 2 })}</Money>
      {dd && <> · {dd}</>}
    </span>
  )
}

// Sin lectura: "Leyendo…" mientras llega la historia; sin historia, solo si de verdad no hay.
function NoReading({ loading, t }) {
  return <td colSpan={4} className={s.noHist}>{t(loading ? 'opp.tbl.loading' : 'opp.tbl.noHistory')}</td>
}

function DistRow({ it, r, loading, t, fmt, onOpen, mine }) {
  return (
    <tr>
      <th scope="row">
        <Ticker tk={it.t} onOpen={onOpen} t={t} />
        {it.name && <span className={`${s.sub} ${s.w}`}>{it.name}</span>}
        {mine && <span className={`${s.sub} ${s.n}`}>{t('opp.tbl.noAmount')}</span>}
        {r && <span className={s.sub}>{rsiSub(r, t)}</span>}
        <Facts it={it} r={r} t={t} fmt={fmt} />
      </th>
      {r ? SMAS.map((n, i) => <DistCell key={n} m={r.smas[i]} t={t} fmt={fmt} />) : <NoReading loading={loading} t={t} />}
      <td className={s.tot}><span className={s.st}>{t('opp.tbl.noAmount')}</span></td>
    </tr>
  )
}

/**
 * Cuánto tapa la barra superior de la app el borde de arriba del contenedor de
 * scroll ([data-scroll-root]) que contiene a `el`: en el teléfono la barra
 * flota sobre el contenido (position absolute o fixed); en el escritorio
 * ocupa su propia fila y no tapa nada. El navegador ya deja el sticky debajo
 * del padding superior del contenedor, así que se descuenta.
 * → px relativo a ese padding (−padding si no hay nada encima).
 */
export function coveredTop(el) {
  const root = el?.closest?.('[data-scroll-root]')
  if (!root || typeof getComputedStyle !== 'function') return 0
  const top = root.getBoundingClientRect().top
  let cover = 0
  for (const sib of root.parentElement?.children || []) {
    if (sib === root) continue
    const pos = getComputedStyle(sib).position
    if (pos !== 'absolute' && pos !== 'fixed') continue
    const r = sib.getBoundingClientRect()
    if (r.height > 0 && r.top <= top + 1 && r.bottom > top) cover = Math.max(cover, r.bottom - top)
  }
  // Suele ser negativo: el encabezado debe quedar pegado al borde de la barra
  // (o al del contenedor, si nada lo tapa), sin la franja del padding por
  // donde asomarían las filas al bajar.
  const pad = parseFloat(getComputedStyle(root).paddingTop) || 0
  return Math.round(cover - pad)
}

/**
 * plan: planCapital(...) con ok:true, o null (sin monto: solo distancias).
 * mine / watch: [{ t, name? }] en orden; readings: { t: readSignal | null }.
 */
export default function TramosTable({ plan, mine, watch, readings, t, fmt, lad = DEFAULT_LADDER, onOpen }) {
  const { m } = useMoney()
  const w = LADDERS[lad] || LADDERS[DEFAULT_LADDER]
  // Dos modos, según el ancho:
  //  · la tabla cabe: la región no se desplaza (overflow visible, sin tabindex)
  //    y el encabezado de columnas queda fijo al bajar, justo debajo de lo que
  //    tapa el borde superior del contenedor de scroll de la app (en el
  //    teléfono, la barra superior flotante; en el escritorio, nada). Se mide.
  //  · la tabla no cabe (letra grande, 320 px): scroll horizontal con la
  //    columna del activo fija y la región enfocable; sin encabezado fijo
  //    (un sticky vertical no funciona dentro de un overflow horizontal).
  // useLayoutEffect: se decide antes de pintar, sin salto visible.
  const twRef = useRef(null)
  const [scrolls, setScrolls] = useState(false)
  const [headTop, setHeadTop] = useState(0)
  useLayoutEffect(() => {
    const el = twRef.current
    if (!el) return undefined
    const check = () => {
      setScrolls(el.scrollWidth > el.clientWidth + 1)
      setHeadTop(coveredTop(el))
    }
    check()
    // La barra superior puede cambiar de alto sin que cambie la tabla
    // (rotación, safe-area): también se recalcula con la ventana.
    window.addEventListener('resize', check)
    if (typeof ResizeObserver !== 'function') return () => window.removeEventListener('resize', check)
    const ro = new ResizeObserver(check)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => { ro.disconnect(); window.removeEventListener('resize', check) }
  }, [])
  const loading = (tk) => !(tk in readings)
  const rows = plan?.rows || []
  const inPlan = new Set(rows.map(r => r.t))
  const info = Object.fromEntries([...mine, ...watch].map(i => [i.t, i]))
  const names = Object.fromEntries([...mine, ...watch].map(i => [i.t, i.name]))
  const mineRest = mine.filter(i => !inPlan.has(i.t))
  const watchRest = watch.filter(i => !inPlan.has(i.t))
  const cols = plan ? columnTotals(plan) : null
  const pctW = (x) => pctIn(t, Math.round(x * 100))
  return (
    <>
    <div ref={twRef} className={s.tw} data-scroll={scrolls ? 'x' : undefined} style={{ '--opp-head-top': `${headTop}px` }}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- only when the table overflows sideways (large text, narrow screens): the region takes focus so keyboard users can scroll it (axe scrollable-region-focusable)
      tabIndex={scrolls ? 0 : undefined} role="region" aria-labelledby="opp-tbl-cap">
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
                <Facts it={info[r.t] || { t: r.t }} r={r.reading} t={t} fmt={fmt} />
                {r.tramos && <span className={`${s.n} sr-only`}>{t('opp.tbl.sr.row', { a: m(fmt.money(r.today)), b: m(fmt.money(r.wait)) })}</span>}
              </th>
              {r.tramos
                ? r.tramos.map(tr => <TramoCell key={tr.n} tr={tr} reading={r.reading} t={t} fmt={fmt} />)
                : <NoReading loading={loading(r.t)} t={t} />}
              <td className={s.tot}>
                <span className={s.amt}><Money>{fmt.money(r.amount)}</Money></span>
                {r.tramos && <span className={s.st} data-on={r.today > 0 || undefined}>{t('opp.tbl.hoy')} <Money>{fmt.money(r.today)}</Money></span>}
              </td>
            </tr>
          ))}
          {mineRest.map(it => <DistRow key={it.t} it={it} r={readings[it.t] || null} loading={loading(it.t)} t={t} fmt={fmt} onOpen={onOpen} mine={!!plan} />)}
        </tbody>
        {watchRest.length > 0 && (
          <tbody className={s.watch}>
            <tr className={s.grp}><th scope="rowgroup" colSpan={5}>{t('opp.tbl.watch')}</th><td className={s.tot}>{' '}</td></tr>
            {watchRest.map(it => <DistRow key={it.t} it={it} r={readings[it.t] || null} loading={loading(it.t)} t={t} fmt={fmt} onOpen={onOpen} />)}
          </tbody>
        )}
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
      </table>
    </div>
    {plan && plan.noData > 0 && <p className={s.tblNote}>{t('opp.tbl.noDataNote', { v: m(fmt.money(plan.noData)) })}</p>}
    </>
  )
}
