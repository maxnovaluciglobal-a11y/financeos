// src/hooks/usePageStack.js — historial para la navegación "empujada" (R14).
// Envuelve el setPage de siempre (App.jsx / DemoShell.jsx): las páginas siguen
// llamando setPage('goals') igual que antes, pero ahora cada pantalla
// secundaria queda en el historial del navegador (misma URL, el id viaja en
// history.state), así funcionan el "‹" de la barra superior, el botón atrás
// del navegador/Android y el gesto de iOS. La lógica de qué apilar vive pura
// en components/layout/pageStack.js (con tests).
import { useCallback, useEffect, useRef, useState } from 'react'
import { navAction, bootEntries, backAction, backTarget, isStackState } from '../components/layout/pageStack.js'

// Contenedor que scrollea (main del Shell). Se guarda su scroll por entrada
// para que volver no te deje arriba de todo.
const SCROLL_ROOT = '[data-scroll-root]'
const scrollRoot = () => (typeof document !== 'undefined' ? document.querySelector(SCROLL_ROOT) : null)

function setNavDir(dir) {
  try { document.documentElement.dataset.navDir = dir } catch { /* SSR/test */ }
}

// Restaura el scroll cuando la página (lazy) ya tiene alto suficiente.
function restoreScroll(top) {
  if (!top) { const el = scrollRoot(); if (el) el.scrollTop = 0; return }
  let tries = 0
  const tick = () => {
    const el = scrollRoot()
    if (el && el.scrollHeight - el.clientHeight >= top - 2) { el.scrollTop = top; return }
    if (++tries < 40) requestAnimationFrame(tick)
    else if (el) el.scrollTop = top
  }
  requestAnimationFrame(tick)
}

function withTransition(fn) {
  if (typeof document !== 'undefined' && document.startViewTransition) document.startViewTransition(fn)
  else fn()
}

export function usePageStack(page, setPageState) {
  const pageRef = useRef(page)
  pageRef.current = page
  const booted = useRef(false)
  const inAppBack = useRef(false)
  // Lo que necesita la barra superior: a dónde vuelve "‹".
  const [stackState, setStackState] = useState(() => (typeof history !== 'undefined' ? history.state : null))

  useEffect(() => {
    if (typeof window === 'undefined' || booted.current) return
    booted.current = true
    const cur = history.state
    if (isStackState(cur)) {
      // Recarga: el navegador conserva history.state de la entrada actual.
      if (cur.fosPage !== pageRef.current) setPageState(cur.fosPage)
      setStackState(cur)
    } else {
      const entries = bootEntries(pageRef.current)
      const base = cur && typeof cur === 'object' ? cur : {}
      history.replaceState({ ...base, ...entries[0] }, '')
      for (const e of entries.slice(1)) history.pushState(e, '')
      setStackState(history.state)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Separado del arranque: en StrictMode (dev) el efecto se monta, desmonta y
  // vuelve a montar; el listener tiene que volver a engancharse siempre.
  useEffect(() => {
    if (typeof window === 'undefined') return
    function onPop(e) {
      const st = e.state
      if (!isStackState(st)) return
      const fromButton = inAppBack.current
      inAppBack.current = false
      const apply = () => { setPageState(st.fosPage); setStackState(st) }
      setNavDir('pop')
      // El gesto del navegador ya anima; el "‹" propio usa la transición.
      if (fromButton) withTransition(apply)
      else apply()
      restoreScroll(Number(st.fosScroll) || 0)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // setPage "con historial". Mismo contrato que antes: setPage(id).
  const go = useCallback((to) => {
    const from = pageRef.current
    const act = navAction(from, to)
    if (act === 'none') return
    const cur = isStackState(history.state) ? history.state : { fosPage: from, fosDepth: 0 }
    const depth = Number(cur.fosDepth) || 0
    if (act === 'push') {
      const el = scrollRoot()
      history.replaceState({ ...cur, fosScroll: el ? el.scrollTop : 0 }, '')
      history.pushState({ fosPage: to, fosDepth: depth + 1, fosFrom: from }, '')
      setNavDir('push')
    } else {
      history.replaceState({ fosPage: to, fosDepth: depth }, '')
      setNavDir('tab')
    }
    setStackState(history.state)
    setPageState(to)
    // Una pantalla nueva (o una pestaña) arranca arriba; volver restaura.
    restoreScroll(0)
  }, [setPageState])

  const back = useCallback(() => {
    const a = backAction(history.state, pageRef.current)
    if (a.type === 'history') {
      inAppBack.current = true
      history.back()
      return
    }
    history.replaceState({ fosPage: a.page, fosDepth: 0 }, '')
    setNavDir('pop')
    withTransition(() => { setStackState(history.state); setPageState(a.page) })
  }, [setPageState])

  return { go, back, backTo: backTarget(stackState, page) }
}
