// src/pages/Investments/hoy/ValueChart.jsx — "Valor en el tiempo" (Hoy, F2).
// SVG propio, como Invest (pvhDraw): recharts no trae el recorrido por teclado.
// Línea del portafolio siempre en tinta (no verde/rojo: es un registro, no una
// señal), área suave, "Lo invertido" punteado y el índice rebasado al mismo
// punto de partida en violeta. Accesible: el recorrido es un control deslizante
// (role="slider", el patrón APG con las mismas teclas que Invest: ←/→ un día,
// RePág/AvPág 10, Inicio/Fin; Escape vuelve al resumen). El lector de pantalla
// lee la fecha y el valor de cada paso en aria-valuetext, y hay un resumen en
// texto del período.
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Equal, RefreshCw } from 'lucide-react'
import { useT } from '../../../i18n/useT.js'
import { useMoney } from '../../../components/Money.jsx'
import { dateLocale, fmtPct } from '../../../utils/index.js'
import { PVH_CMP, PVH_RANGES, axisTicks, change, cursorKey } from '../../../utils/investHoy.js'
import s from './hoy.module.css'

const dirOf = (n) => (n > 0 ? 'up' : n < 0 ? 'down' : 'flat')
function Arrow({ n }) {
  const d = dirOf(n)
  const Ic = d === 'up' ? ArrowUp : d === 'down' ? ArrowDown : Equal
  return <Ic size={12} strokeWidth={2.4} aria-hidden="true" />
}
const fmtDay = (ts, long) => {
  try { return new Date(ts * 1000).toLocaleDateString(dateLocale(), long ? { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' }) } catch { return '' }
}
const fmtMonth = (ts) => {
  try { return new Date(ts * 1000).toLocaleDateString(dateLocale(), { month: 'short', year: 'numeric', timeZone: 'UTC' }) } catch { return '' }
}

function useWidth(ref) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    setW(Math.round(el.clientWidth || 0))
    if (typeof ResizeObserver !== 'function') return undefined
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

// points: serie ya recortada al período; index: rebasada o null; invested: US$.
// state: 'loading' · 'error' · 'short' (sin historia suficiente) · 'ready'.
export default function ValueChart({ points, index, invested, range, cmp, cmpOptions, onRange, onCmp, state, notes = [], money, money0, onRetry }) {
  const { t } = useT()
  const { m } = useMoney()
  const box = useRef(null)
  const width = useWidth(box)
  const [cur, setCur] = useState(null)
  const ready = state === 'ready' && points?.length >= 2
  useEffect(() => { setCur(null) }, [range, cmp, points])

  const rangeLabel = t(`invest.hoy.pvh.span.${range}`)
  const cmpLabel = cmp ? t(`invest.hoy.pvh.cmp.${cmp}`) : ''

  const view = useMemo(() => {
    if (!ready) return null
    const W = Math.max(260, width || 600)
    const H = W < 640 ? 184 : 232
    const vals = points.map(p => p.v)
    if (index) for (const p of index) if (p.v != null) vals.push(p.v)
    if (invested > 0) vals.push(invested)
    const { lo, hi, ticks } = axisTicks(vals)
    const labW = Math.max(...ticks.map(v => money0(v).length)) * 6.6 + 10
    const pl = 0, pr = Math.round(labW), pt = 8, pb = 24
    const iw = W - pl - pr, ih = H - pt - pb, n = points.length
    const X = (i) => pl + (n < 2 ? 0 : (i / (n - 1)) * iw)
    const Y = (v) => pt + (1 - (v - lo) / (hi - lo || 1)) * ih
    const path = (arr) => { let d = '', on = false; arr.forEach((p, i) => { if (p.v == null) { on = false; return } d += `${on ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.v).toFixed(1)}`; on = true }); return d }
    const line = path(points)
    const area = `${line}L${X(n - 1).toFixed(1)} ${pt + ih}L${X(0).toFixed(1)} ${pt + ih}Z`
    const long = range === '1A' || range === 'MAX'
    const xi = n >= 4 ? [0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1] : [0, n - 1]
    return { W, H, pl, pt, ih, iw, n, X, Y, ticks, line, area, ixLine: index ? path(index) : null, long, xi }
  }, [ready, width, points, index, invested, range, money0])

  const ch = ready ? change(points) : null
  const ich = ready && index ? change(index) : null
  const summary = ch ? t('invest.hoy.pvh.summary', {
    from: fmtDay(points[0].ts, true), to: fmtDay(points[points.length - 1].ts, true),
    a: m(money0(ch.from)), b: m(money0(ch.to)), pct: fmtPct(ch.pct, { signed: true }),
  }) + (invested > 0 ? ` ${t('invest.hoy.pvh.summaryInvested', { v: m(money0(invested)) })}` : '') : ''

  function onKey(e) {
    if (!view) return
    const next = cursorKey(e.key, cur, view.n)
    if (next === undefined) return
    e.preventDefault()
    setCur(next)
  }
  // Lo que lee el lector de pantalla en cada paso (sin cursor: el último día).
  const at = view ? (cur ?? view.n - 1) : null
  const valueText = at == null ? '' : (() => {
    const pt = points[at], iq = index?.[at]
    return t('invest.hoy.pvh.say', { d: fmtDay(pt.ts, true), v: m(money0(pt.v)) }) + (iq?.v != null ? ` ${t('invest.hoy.pvh.sayIndex', { ix: cmpLabel, v: m(money0(iq.v)) })}` : '')
  })()
  function onMove(e) {
    if (!view) return
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - r.left) / r.width) * (view.n - 1))
    setCur(Math.max(0, Math.min(view.n - 1, i)))
  }

  const p = view && cur != null ? points[cur] : null
  const q = p && index ? index[cur] : null
  const vsStart = p && points[0].v > 0 ? (p.v - points[0].v) / points[0].v : 0

  return (
    <section className={s.card} aria-labelledby="hoy-pvh-title">
      <div className={s.cardHead}>
        <h2 id="hoy-pvh-title" className={s.cardTitle}>{t('invest.hoy.pvh.title')}</h2>
        <div className={s.chips} role="group" aria-label={t('invest.hoy.pvh.cmpLabel')}>
          {(cmpOptions || PVH_CMP).map(c => (
            <button key={c || 'none'} type="button" className={s.chip} aria-pressed={cmp === c} onClick={() => onCmp(c)}>
              {c ? t(`invest.hoy.pvh.cmp.${c}`) : t('invest.hoy.pvh.cmp.none')}
            </button>
          ))}
        </div>
      </div>

      <div className={s.pvhRead} aria-hidden="true">
        {p ? (
          <>
            <span className={s.pvhValue}>{m(money0(p.v))}</span>
            <span className={s.pvhMeta}>{fmtDay(p.ts, true)}</span>
            <span className={s.tone} data-tone={dirOf(vsStart)}><Arrow n={vsStart} />{fmtPct(vsStart, { signed: true })}</span>
            <span className={s.pvhMeta}>{t('invest.hoy.pvh.sinceStart')}</span>
            {q?.v != null && <span className={s.pvhMeta}><i className={s.keyIx} />{cmpLabel} {m(money0(q.v))}</span>}
          </>
        ) : ch ? (
          <>
            <span className={s.pvhValue}>{m(money0(ch.to))}</span>
            <span className={s.tone} data-tone={dirOf(ch.abs)}><Arrow n={ch.abs} />{m(money(ch.abs, true))} · {fmtPct(ch.pct, { signed: true })}</span>
            <span className={s.pvhMeta}>{rangeLabel}</span>
            {invested > 0 && <span className={s.pvhMeta}><i className={s.keyInv} />{t('invest.hoy.pvh.invested')} {m(money0(invested))}</span>}
            {ich && <span className={s.pvhMeta}><i className={s.keyIx} />{cmpLabel} <span className={s.tone} data-tone={dirOf(ich.abs)}>{fmtPct(ich.pct, { signed: true })}</span></span>}
          </>
        ) : null}
      </div>

      <div ref={box} className={s.pvhPlot} {...(view ? {
        role: 'slider', tabIndex: 0, onKeyDown: onKey,
        'aria-label': t('invest.hoy.pvh.aria'), 'aria-describedby': 'hoy-pvh-sum',
        'aria-valuemin': 0, 'aria-valuemax': view.n - 1, 'aria-valuenow': at, 'aria-valuetext': valueText,
      } : {})}>
        {view ? (
          <svg width={view.W} height={view.H} viewBox={`0 0 ${view.W} ${view.H}`} aria-hidden="true" focusable="false" className={s.pvhSvg}
            onPointerMove={onMove} onPointerLeave={() => setCur(null)}>
            {view.ticks.map(v => {
              const y = view.Y(v).toFixed(1)
              return (
                <g key={v}>
                  <line className={s.pvhGrid} x1={view.pl} x2={view.pl + view.iw} y1={y} y2={y} />
                  <text className={s.pvhAxis} x={view.W - 2} y={+y + 4} textAnchor="end">{m(money0(v))}</text>
                </g>
              )
            })}
            {view.xi.map((i, k) => (
              <text key={i} className={s.pvhAxis} x={view.X(i).toFixed(1)} y={view.H - 6} textAnchor={k === 0 ? 'start' : k === view.xi.length - 1 ? 'end' : 'middle'}>
                {view.long ? fmtMonth(points[i].ts) : fmtDay(points[i].ts)}
              </text>
            ))}
            <path className={s.pvhArea} d={view.area} />
            {invested > 0 && <line className={s.pvhInv} x1={view.pl} x2={view.pl + view.iw} y1={view.Y(invested).toFixed(1)} y2={view.Y(invested).toFixed(1)} />}
            {view.ixLine && <path className={s.pvhIx} d={view.ixLine} />}
            <path className={s.pvhLine} d={view.line} />
            {p && (
              <g>
                <line className={s.pvhCursor} x1={view.X(cur)} x2={view.X(cur)} y1={view.pt} y2={view.pt + view.ih} />
                {q?.v != null && <circle className={s.pvhDotIx} cx={view.X(cur)} cy={view.Y(q.v)} r={3.5} />}
                <circle className={s.pvhDot} cx={view.X(cur)} cy={view.Y(p.v)} r={4} />
              </g>
            )}
          </svg>
        ) : state === 'loading' ? (
          <div className={s.skeleton} style={{ height: 184 }} aria-hidden="true" />
        ) : (
          <div className={s.pvhEmpty}>
            <p className={s.muted}>{state === 'error' ? t('invest.hoy.pvh.error') : t('invest.hoy.pvh.short')}</p>
            {onRetry && <button type="button" className={s.btn} onClick={onRetry}><RefreshCw size={16} strokeWidth={2} aria-hidden="true" />{t('invest.card.retry')}</button>}
          </div>
        )}
      </div>
      {state === 'loading' && <p className="sr-only" role="status">{t('invest.hoy.pvh.loading')}</p>}
      <p id="hoy-pvh-sum" className="sr-only">{summary}</p>

      <div className={s.pvhBottom}>
        <div className={s.chips} role="group" aria-label={t('invest.hoy.pvh.rangeLabel')}>
          {PVH_RANGES.map(r => (
            <button key={r} type="button" className={s.chip} aria-pressed={range === r} onClick={() => onRange(r)}>{t(`invest.hoy.pvh.range.${r}`)}</button>
          ))}
        </div>
        <p className={s.pvhKeys} aria-hidden="true">
          <span><i className={s.keyLine} />{t('invest.hoy.pvh.key.value')}</span>
          <span><i className={s.keyInv} />{t('invest.hoy.pvh.invested')}</span>
          {cmp && <span><i className={s.keyIx} />{t('invest.hoy.pvh.key.index', { ix: cmpLabel })}</span>}
        </p>
      </div>
      {ready && <p className={`${s.muted} ${s.kbdOnly}`}>{t('invest.hoy.pvh.keysHint')}</p>}
      {notes.length > 0 && <p className={s.muted}>{notes.join(' ')}</p>}
    </section>
  )
}
