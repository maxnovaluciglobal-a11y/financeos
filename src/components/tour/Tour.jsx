// src/components/tour/Tour.jsx
// Recorrido guiado genérico (R08, extraído de demo/DemoTour.jsx, T09): un
// overlay con "spotlight" sobre elementos marcados con data-tour="…". La lista
// de pasos se arma con los objetivos que existen y son visibles AL EMPEZAR (en
// móvil no hay sidebar, en escritorio no hay barra inferior), así el contador
// "n de N" siempre es correcto. Lo usan el recorrido del demo (DemoTour.jsx) y
// los recorridos por pantalla (PageTour.jsx).
//
// steps: [{ id, title, body }] — id = valor de data-tour, title/body = claves i18n.
// Atrás / Siguiente / Listo y las flechas ← →; Esc cierra (useDialogA11y, que
// escucha en document y atrapa Tab). El foco va al título de cada paso y "Paso
// X de Y" se anuncia por aria-live. Si un objetivo desaparece a mitad del
// recorrido, ese paso se saltea. En el teléfono la tarjeta va abajo (o arriba
// si el objetivo está abajo), sin tapar el objetivo. Con prefers-reduced-motion
// el desplazamiento es instantáneo y sin transiciones.
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../../i18n/useT.js'
import { useDialogA11y } from '../../hooks/useDialogA11y.js'
import { targetEl, isVisible } from '../help/tourTargets.js'

const PAD = 8          // aire alrededor del objetivo
const CARD_W = 340
const GAP = 12         // entre el objetivo y la tarjeta

const MOBILE_MAX = 700 // mismo corte que el resto de la app (barra inferior)
const isMobile = () => typeof window !== 'undefined' && window.innerWidth <= MOBILE_MAX
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Contenedor con scroll más cercano (en la app es <main>, no la ventana).
function scrollParent(el) {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p
  }
  return null
}

// Si el objetivo no está entero a la vista, desplaza su contenedor (nunca
// scrollIntoView): suave, salvo con prefers-reduced-motion.
function inFixedLayer(el) {
  for (let p = el; p && p !== document.body; p = p.parentElement) {
    if (getComputedStyle(p).position === 'fixed') return true
  }
  return false
}
function bringIntoView(el) {
  if (inFixedLayer(el)) return // barra o "+" fijos: desplazar el contenido no los mueve
  const r = el.getBoundingClientRect()
  const vh = window.innerHeight
  const topSafe = (document.querySelector('.demo-banner')?.getBoundingClientRect().bottom || 0) + 16
  // Espacio para la tarjeta: en el teléfono va abajo, a lo ancho.
  const bottomSafe = vh - (isMobile() ? 240 : 200)
  if (r.top >= topSafe && r.bottom <= bottomSafe) return
  const behavior = prefersReducedMotion() ? 'auto' : 'smooth'
  const delta = r.top - topSafe
  const sp = scrollParent(el)
  if (sp) sp.scrollTo({ top: sp.scrollTop + delta, behavior })
  else window.scrollTo({ top: window.scrollY + delta, behavior })
}

export default function Tour({ open, steps: allSteps, onClose, labelledBy = 'fos-tour-title' }) {
  const { t } = useT()
  const [steps, setSteps] = useState(null)   // null = buscando objetivos
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const cardRef = useRef(null)
  const nextRef = useRef(null)
  const titleRef = useRef(null)

  const close = useCallback(() => { onClose?.() }, [onClose])
  useDialogA11y(open && !!steps?.length, close, cardRef, titleRef)

  // Al abrir: espera a que la página (lazy) monte su primer objetivo y arma la lista
  useEffect(() => {
    if (!open) { setSteps(null); setI(0); setRect(null); return }
    let tries = 0, timer
    const first = allSteps?.[0]?.id
    const find = () => {
      const avail = (allSteps || []).filter(s => isVisible(targetEl(s.id)))
      if (avail.some(s => s.id === first) || tries++ > 25) {
        if (avail.length === 0) { close(); return }
        setSteps(avail); setI(0)
      } else timer = setTimeout(find, 120)
    }
    find()
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const step = steps?.[i]

  // Mide el objetivo; vuelve a medir con scroll (en cualquier contenedor) y resize
  useLayoutEffect(() => {
    if (!step) return
    const el = targetEl(step.id)
    // El objetivo ya no está (se cerró una sección, cambió la vista): se saltea.
    if (!isVisible(el)) {
      if (i < steps.length - 1) setI(n => n + 1)
      else close()
      return
    }
    bringIntoView(el)
    let raf = 0
    const measure = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el2 = targetEl(step.id)
        const r = el2?.getBoundingClientRect()
        // Un objetivo circular (el "+") lleva un hueco circular, no un cuadrado.
        const round = el2 ? getComputedStyle(el2).borderRadius === '50%' : false
        if (r) setRect({ top: r.top, left: r.left, width: r.width, height: r.height, round })
      })
    }
    measure()
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- i/steps/close solo importan cuando cambia el paso
  }, [step])

  // Foco en el título de cada paso (el lector lo lee entero)
  useEffect(() => { if (step && rect) titleRef.current?.focus({ preventScroll: true }) }, [step, !!rect]) // eslint-disable-line react-hooks/exhaustive-deps -- solo al cambiar de paso o al aparecer la tarjeta

  // Flechas: → siguiente, ← anterior (fuera de campos de texto)
  useEffect(() => {
    if (!open || !steps?.length) return
    const onKey = (e) => {
      if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return
      const el = e.target
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      if (e.key === 'ArrowRight') { e.preventDefault(); setI(n => (n < steps.length - 1 ? n + 1 : n)) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setI(n => (n > 0 ? n - 1 : n)) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, steps])

  if (!open || !steps?.length || !step || !rect) return null

  const isLast = i === steps.length - 1
  const vw = window.innerWidth, vh = window.innerHeight
  const hole = {
    top: rect.top - PAD, left: rect.left - PAD,
    width: rect.width + PAD * 2, height: rect.height + PAD * 2,
  }
  const cardH = cardRef.current?.offsetHeight || 190
  let cardW, top, left
  if (vw <= MOBILE_MAX) {
    // Teléfono: a lo ancho, abajo; si el objetivo cae en esa franja, arriba.
    cardW = vw - 24
    left = 12
    const bottomTop = vh - cardH - 12
    top = hole.top + hole.height > bottomTop - GAP ? 12 : bottomTop
  } else {
    // Escritorio: debajo del objetivo si entra, si no arriba; centrada y dentro de la pantalla
    cardW = Math.min(CARD_W, vw - 32)
    const below = hole.top + hole.height + GAP
    const above = hole.top - GAP - cardH
    top = below + cardH <= vh - 16 ? below : Math.max(16, above)
    left = Math.min(Math.max(16, rect.left + rect.width / 2 - cardW / 2), vw - cardW - 16)
  }
  const count = t('tour.count', { n: i + 1, total: steps.length })

  // En un portal a <body>: un ancestro con transform o backdrop-filter recortaría el fixed.
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 900 }}>
      {/* Capa que bloquea la interacción con la página mientras dura el recorrido */}
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0 }} />
      {/* Spotlight: un hueco con sombra gigante que oscurece todo lo demás */}
      <div aria-hidden="true" className="demo-tour__hole" style={{
        position: 'absolute', ...hole, borderRadius: rect.round ? '50%' : 'var(--rl)', pointerEvents: 'none',
        boxShadow: '0 0 0 9999px color-mix(in srgb, var(--purple-900) 62%, transparent)',
        outline: '2px solid var(--color-accent)', outlineOffset: 0,
      }} />
      <div
        ref={cardRef}
        role="dialog" aria-modal="true" aria-labelledby={labelledBy} aria-describedby={`${labelledBy}-body`}
        className="demo-tour__card"
        style={{
          position: 'absolute', top, left, width: cardW,
          background: 'var(--box-bg)', color: 'var(--tx)', border: 0,
          borderRadius: 'var(--rxl)', boxShadow: 'var(--sh-3)', padding: '14px 16px 12px',
        }}
      >
        <span className="sr-only" role="status" aria-live="polite">{count}</span>
        <div>
          <div className="num" aria-hidden="true" style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 'var(--t-footnote)', color: 'var(--th)', marginBottom: 6 }}>
            {count}
          </div>
          <h2 id={labelledBy} ref={titleRef} tabIndex={-1} style={{ margin: '0 0 4px', fontFamily: 'var(--display)', fontSize: 'var(--t-headline)', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--tx)', outline: 'none' }}>
            {t(step.title)}
          </h2>
          <p id={`${labelledBy}-body`} style={{ margin: 0, fontFamily: 'var(--sans)', fontSize: 'var(--t-body)', lineHeight: 1.5, color: 'var(--tm)' }}>{t(step.body)}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 12 }}>
          <button type="button" className="fos-link" onClick={close} style={{ marginLeft: -4 }}>{t('tour.exit')}</button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {i > 0 && (
              <button type="button" className="fos-link" onClick={() => setI(n => n - 1)}>{t('tour.back')}</button>
            )}
            <button type="button" ref={nextRef} className="fos-btn-primary" style={{ width: 'auto', fontSize: 'var(--t-body)' }}
              onClick={() => (isLast ? close() : setI(n => n + 1))}>
              {isLast ? t('tour.finish') : t('tour.next')}
            </button>
          </span>
        </div>
      </div>
    </div>
    ,
    document.body,
  )
}
