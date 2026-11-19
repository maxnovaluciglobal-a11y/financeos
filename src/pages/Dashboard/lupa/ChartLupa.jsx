// src/pages/Dashboard/lupa/ChartLupa.jsx — el mes día a día con la lupa
// (Entrega 1.5, opción A de investigacion-app/INVESTIGACION-APP.md §3).
//
// SVG propio, sin Recharts. Al arrastrar (o pasar el mouse) la cifra grande
// pasa al día mirado; la lente amplía ×2,2 una copia del gráfico y, con el
// dedo, sube por encima del punto para no quedar tapada. Al soltar vuelve a
// hoy. Rendimiento: durante el arrastre solo cambia `transform` de la lente,
// su copia, el punto, la guía y el mango, una vez por cuadro (rAF). Nada de
// clip-path ni de render de React por cuadro: React solo se entera cuando
// cambia el DÍA (máximo 31 veces por recorrido).
//
// Accesibilidad: role="slider" con aria-valuetext hablado, flechas, Re Pág/
// Av Pág, Inicio, Fin, Intro (abre el día) y Esc (vuelve a hoy). Alternativa
// de un toque (WCAG 2.5.7): tocar un día abre su hoja, y los botones ‹ › de
// la escena recorren el mes sin arrastrar. Con "reducir movimiento" la lente
// salta sin deslizarse. Con "ocultar montos" el gráfico muestra solo la forma
// y el texto hablado dice "•••" (lo arma quien llama con useMoney).

import { forwardRef, memo, useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { CHART_H, CHART_PAD, CHART_W, dayAt, keyStep, lensPlacement, xOf, yDomain, yOf } from '../../../utils/dailyAvailable.js'
import { hapticSelection } from '../../../utils/haptics.js'
import c from './chartLupa.module.css'

const K = 2.2          // aumento de la lente
const D = 88           // diámetro de la lente (px)
const R = D / 2
const TAP_MS = 450
const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Curva monótona (Fritsch–Carlson): suave sin pasarse de los datos (el salto
// del cobro no "rebota" por encima ni por debajo de lo real).
function monotonePath(pts) {
  if (!pts.length) return ''
  if (pts.length === 1) return `M${f(pts[0][0])} ${f(pts[0][1])}`
  const n = pts.length
  const dx = [], m = [], t = new Array(n)
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / (dx[i] || 1) }
  t[0] = m[0]; t[n - 1] = m[n - 2]
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue }
    const a = t[i] / m[i], b = t[i + 1] / m[i], h = a * a + b * b
    if (h > 9) { const k = 3 / Math.sqrt(h); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i] }
  }
  let p = `M${f(pts[0][0])} ${f(pts[0][1])}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    p += ` C${f(pts[i][0] + h)} ${f(pts[i][1] + h * t[i])} ${f(pts[i + 1][0] - h)} ${f(pts[i + 1][1] - h * t[i + 1])} ${f(pts[i + 1][0])} ${f(pts[i + 1][1])}`
  }
  return p
}
const f = (v) => (Math.round(v * 10) / 10).toString()

function geometry(series) {
  const dom = yDomain(series)
  const X = (d) => xOf(d, series.days)
  const Y = (v) => yOf(v, dom)
  const pts = []
  for (let d = 1; d <= series.lastDay; d++) pts.push([X(d), Y(series.spentCum[d])])
  const line = monotonePath(pts)
  const bot = CHART_H - CHART_PAD.b
  const last = pts[pts.length - 1]
  // Un solo relleno suave bajo lo gastado, del día 1 a hoy.
  const area = pts.length > 1 ? `${line} L${f(last[0])} ${f(bot)} L${f(pts[0][0])} ${f(bot)} Z` : ''
  // Ritmo ideal: una recta, de ~0 el día 1 al ingreso del mes el último día.
  const ideal = series.ideal ? `M${f(X(1))} ${f(Y(series.ideal[1]))} L${f(X(series.days))} ${f(Y(series.ideal[series.days]))}` : ''
  const proj = series.projEnd != null && last ? `M${f(last[0])} ${f(last[1])} L${f(X(series.days))} ${f(Y(series.projEnd))}` : ''
  return { X, Y, line, area, ideal, proj, last, bot, payX: series.payday ? X(series.payday) : null, dots: pts }
}

// El dibujo, una vez para el gráfico y otra (con puntos por día) para la lente.
const Plot = memo(function Plot({ g, size, dots, gid }) {
  const sizeProps = size ? { width: size[0], height: size[1], style: { width: size[0], height: size[1] } } : {}
  return (
    <svg className={c.plot} viewBox={`0 0 ${CHART_W} ${CHART_H}`} aria-hidden="true" focusable="false" {...sizeProps}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className={c.areaTop} />
          <stop offset="1" className={c.areaBot} />
        </linearGradient>
      </defs>
      <line className={c.grid} x1={CHART_PAD.l} x2={CHART_W - CHART_PAD.r} y1={g.bot} y2={g.bot} />
      {g.area && <path d={g.area} fill={`url(#${gid})`} />}
      {g.ideal && <path className={c.ideal} d={g.ideal} />}
      {g.proj && <path className={c.proj} d={g.proj} />}
      {g.payX != null && <circle className={c.pay} cx={g.payX} cy={g.bot} r="2.6" />}
      {g.line && <path className={c.line} d={g.line} />}
      {dots && g.dots.map(([x, y], i) => <circle key={i} className={c.dayDot} cx={x} cy={y} r="1.6" />)}
    </svg>
  )
})

function swallowNextClick() {
  const stop = (e) => { e.stopPropagation(); e.preventDefault(); done() }
  const done = () => { window.removeEventListener('click', stop, true); clearTimeout(timer) }
  const timer = setTimeout(done, 450)
  window.addEventListener('click', stop, true)
}

const ChartLupa = forwardRef(function ChartLupa({ series, label, valueTextOf, axis, onDay, onTap, invite = false, hold = false }, ref) {
  const hostRef = useRef(null)
  const lensRef = useRef(null)
  const lensInRef = useRef(null)
  const dotRef = useRef(null)
  const guideRef = useRef(null)
  const handRef = useRef(null)
  const st = useRef({ s: 1, w: 0, cur: series.lastDay, mode: 'rest', down: null, ptype: 'mouse', raf: 0, pendX: null, relT: 0, glideT: 0 })
  const [w, setW] = useState(0)
  const gid = 'cl' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const g = useMemo(() => geometry(series), [series])
  const maxDay = series.lastDay
  // `hold`: con la hoja del día abierta, perder el foco o soltar no vuelve a hoy.
  const live = useRef({ series, g, onDay, valueTextOf, maxDay, hold })
  live.current = { series, g, onDay, valueTextOf, maxDay, hold }

  const place = useCallback((d, mode) => {
    const S = st.current, L = live.current, host = hostRef.current
    if (!host || !S.w) { S.cur = d; S.mode = mode; return }
    const changed = d !== S.cur || mode !== S.mode
    S.cur = d; S.mode = mode
    const x = L.g.X(d) * S.s, y = L.g.Y(L.series.spentCum[d]) * S.s
    const { cx, cy, scale } = lensPlacement({ x, y, mode, width: S.w, R })
    lensRef.current.style.transform = `translate(${f(cx - R * scale)}px,${f(cy - R * scale)}px) scale(${scale})`
    lensInRef.current.style.transform = `translate(${f(R - x * K)}px,${f(R - y * K)}px) scale(${K})`
    dotRef.current.style.transform = `translate(${f(x - 6)}px,${f(y - 6)}px)`
    guideRef.current.style.transform = `translateX(${f(x)}px)`
    const hand = handRef.current
    const dx = x - cx, dy = y - cy, dist = Math.hypot(dx, dy)
    if (mode === 'rest' || dist < R + 8) {
      hand.style.opacity = mode === 'rest' ? '1' : '0'
      hand.style.transform = `translate(${f(cx - 6)}px,${f(cy)}px) rotate(-45deg) translateY(${f(R * scale - 2)}px) scale(${scale})`
    } else {
      hand.style.opacity = '1'
      hand.style.transform = `translate(${f(cx - 6)}px,${f(cy)}px) rotate(${Math.atan2(-dx, dy).toFixed(3)}rad) translateY(${f(R - 2)}px) scale(${Math.min(1, (dist - R) / 34).toFixed(2)},1)`
    }
    host.setAttribute('aria-valuenow', String(d))
    host.setAttribute('aria-valuetext', L.valueTextOf(d))
    // Estado en data-*, no en className: React reescribe className cuando
    // termina la invitación y se llevaba puestas estas clases (la lente en
    // reposo volvía a pintarse llena).
    host.dataset.mode = mode === 'rest' ? 'rest' : 'active'
    if (changed) L.onDay?.(d, mode)
  }, [])

  const glide = useCallback((on) => {
    const host = hostRef.current
    if (!host) return
    if (on && !reduced()) host.dataset.glide = '1'
    else delete host.dataset.glide
  }, [])
  const rest = useCallback(() => {
    clearTimeout(st.current.glideT)
    glide(true); place(live.current.maxDay, 'rest')
    st.current.glideT = setTimeout(() => glide(false), 600)
  }, [glide, place])

  useImperativeHandle(ref, () => ({
    // Ir a un día sin arrastrar (botones ‹ ›, hoja del día).
    glideTo: (d) => { clearTimeout(st.current.relT); glide(true); place(Math.max(1, Math.min(live.current.maxDay, d)), 'key') },
    rest,
    get cur() { return st.current.cur },
    get mode() { return st.current.mode },
    focus: () => hostRef.current?.focus({ preventScroll: true }),
  }), [glide, place, rest])

  // Ancho real: la copia de la lente se dibuja al tamaño del gráfico en px.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    const measure = () => {
      const width = host.clientWidth
      if (!width) return
      st.current.w = width
      st.current.s = width / CHART_W
      setW(width)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(measure)
    ro.observe(host)
    return () => ro.disconnect()
  }, [])
  // Cada cambio de tamaño o de datos vuelve a ubicar la lente donde estaba.
  useEffect(() => {
    if (!w) return
    const S = st.current
    const d = S.mode === 'rest' ? maxDay : Math.min(S.cur, maxDay)
    place(d, S.mode)
  }, [w, g, maxDay, place])
  // Dos pulsos de la lente al llegar, para que se note que se puede tocar.
  const [inviting, setInviting] = useState(invite)
  useEffect(() => {
    if (!inviting) return undefined
    if (reduced()) { setInviting(false); return undefined }
    const id = setTimeout(() => setInviting(false), 3400)
    return () => clearTimeout(id)
  }, [inviting])
  useEffect(() => () => { const S = st.current; cancelAnimationFrame(S.raf); clearTimeout(S.relT); clearTimeout(S.glideT) }, [])

  function frame() {
    const S = st.current
    S.raf = 0
    if (S.pendX == null) return
    const d = dayAt(S.pendX, hostRef.current.getBoundingClientRect(), { days: live.current.series.days, maxDay: live.current.maxDay })
    S.pendX = null
    const mode = S.ptype === 'mouse' ? 'mouse' : 'touch'
    if (d !== S.cur && mode === 'touch') hapticSelection()
    place(d, mode)
  }
  function sched(clientX) {
    const S = st.current
    S.pendX = clientX
    if (!S.raf) S.raf = requestAnimationFrame(frame)
  }
  function release(delay) {
    const S = st.current
    clearTimeout(S.relT)
    S.relT = setTimeout(() => { if (!live.current.hold) rest() }, delay || 0)
  }

  function onPointerDown(e) {
    const S = st.current
    clearTimeout(S.relT); glide(false)
    if (inviting) setInviting(false)
    S.ptype = e.pointerType || 'mouse'
    S.down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false }
    try { hostRef.current.setPointerCapture(e.pointerId) } catch { /* sin captura: el arrastre igual funciona dentro del gráfico */ }
    if (S.ptype !== 'mouse') hapticSelection()
    sched(e.clientX)
  }
  function onPointerMove(e) {
    const S = st.current
    if (S.down && Math.hypot(e.clientX - S.down.x, e.clientY - S.down.y) > 8) S.down.moved = true
    if (S.down || e.pointerType === 'mouse') {
      if (!S.down) { S.ptype = 'mouse'; clearTimeout(S.relT); glide(false) }
      sched(e.clientX)
    }
  }
  function onPointerUp() {
    const S = st.current
    const tap = S.down && !S.down.moved && performance.now() - S.down.t < TAP_MS
    S.down = null
    if (tap && onTap) {
      // El toque cae en el día recién calculado: se resuelve el cuadro pendiente.
      if (S.raf) { cancelAnimationFrame(S.raf); frame() }
      // El clic de compatibilidad que el navegador manda después de un toque
      // caería sobre el velo de la hoja recién abierta y la cerraría.
      if (S.ptype !== 'mouse') swallowNextClick()
      onTap(S.cur)
      return
    }
    release(S.ptype === 'mouse' ? 900 : 650)
  }
  function onPointerCancel() { st.current.down = null; release(200) }
  function onPointerLeave(e) { if (!st.current.down && e.pointerType === 'mouse') release(400) }
  function onKeyDown(e) {
    const S = st.current
    if (e.key === 'Escape') { if (S.mode !== 'rest') { e.preventDefault(); e.stopPropagation(); rest() } return }
    if ((e.key === 'Enter' || e.key === ' ') && onTap) { e.preventDefault(); onTap(S.cur); return }
    const d = keyStep(e.key, S.mode === 'rest' ? live.current.maxDay : S.cur, live.current.maxDay)
    if (d == null) return
    e.preventDefault()
    clearTimeout(S.relT)
    glide(true); place(d, 'key')
  }
  function onFocus() { if (st.current.mode === 'rest') { glide(true); place(st.current.cur, 'key') } }
  function onBlur() { release(0) }

  const lensSize = w ? [w, w * CHART_H / CHART_W] : null

  return (
    <div className={c.wrap}>
      {/* aria-valuenow/valuetext los actualiza place() en el DOM: el valor de
          React (hoy) no cambia entre renders, así que React no lo pisa. */}
      <div ref={hostRef} className={`${c.chart} ${inviting ? c.invite : ''}`} role="slider" tabIndex={0} data-mode="rest"
        aria-label={label} aria-valuemin={1} aria-valuemax={maxDay} aria-valuenow={maxDay} aria-orientation="horizontal"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel} onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown} onFocus={onFocus} onBlur={onBlur}>
        <Plot g={g} gid={gid + 'a'} />
        <div ref={guideRef} className={c.guide} style={lensSize ? { height: lensSize[1] } : undefined} />
        <div ref={handRef} className={c.hand} />
        <div ref={dotRef} className={c.dot} />
        <div ref={lensRef} className={c.lens} data-lupa="lens">
          <div ref={lensInRef} className={c.lensIn}>{lensSize && <Plot g={g} size={lensSize} dots gid={gid + 'b'} />}</div>
        </div>
      </div>
      {axis && (
        <div className={c.axis} aria-hidden="true">
          {axis.map(a => (
            <span key={a.key} className={a.align === 'end' ? c.axisEnd : a.align === 'mid' ? c.axisMid : undefined}
              style={a.align === 'mid' ? { left: `${(xOf(a.day, series.days) / CHART_W * 100).toFixed(1)}%` } : undefined}>{a.text}</span>
          ))}
        </div>
      )}
    </div>
  )
})

export default ChartLupa
