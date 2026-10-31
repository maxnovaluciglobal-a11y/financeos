// src/hooks/usePageStack.js — historial para la navegación "empujada" (R14).
// Envuelve el setPage de siempre (App.jsx / DemoShell.jsx): las páginas siguen
// llamando setPage('goals') igual que antes, pero ahora cada pantalla
// secundaria queda en el historial del navegador (misma URL, el id viaja en
// history.state), así funcionan el "‹" de la barra superior, el botón atrás
// del navegador/Android y el gesto de iOS. La lógica de qué apilar vive pura
// en components/layout/pageStack.js (con tests).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { navAction, bootEntries, backAction, backTarget, isStackState, isRootPage } from '../components/layout/pageStack.js'
import { runViewTransition } from '../components/layout/viewTransition.js'

// Contenedor que scrollea (main del Shell). Se guarda su scroll por entrada
// para que volver no te deje arriba de todo.
const SCROLL_ROOT = '[data-scroll-root]'
const scrollRoot = () => (typeof document !== 'undefined' ? document.querySelector(SCROLL_ROOT) : null)

function setNavDir(dir) {
  try { document.documentElement.dataset.navDir = dir } catch { /* SSR/test */ }
}

// Restaura el scroll cuando la página (lazy) ya tiene alto suficiente.
function restoreScroll(top) {
  const el0 = scrollRoot()
  if (!top) { if (el0) el0.scrollTop = 0; return }
  // Primero sin esperar (la pestaña suele estar ya cargada): así la transición
  // captura la pantalla en su lugar. Si es lazy, se reintenta cuando tenga alto.
  if (el0) el0.scrollTop = top
  let tries = 0
  const tick = () => {
    const el = scrollRoot()
    if (el && el.scrollHeight - el.clientHeight >= top - 2) { el.scrollTop = top; return }
    if (++tries < 40) requestAnimationFrame(tick)
    else if (el) el.scrollTop = top
  }
  if (!el0 || el0.scrollHeight - el0.clientHeight < top - 2) requestAnimationFrame(tick)
}

export function usePageStack(page, setPageState) {
  const pageRef = useRef(page)
  pageRef.current = page
  const booted = useRef(false)
  const inAppBack = useRef(false)
  // Scroll por pestaña (causa 10): cada raíz vuelve donde se la dejó.
  const tabScroll = useRef({})
  const pendingScroll = useRef(null)
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
      pendingScroll.current = Number(st.fosScroll) || 0
      if (fromButton) runViewTransition(apply)
      else apply()
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
    const el = scrollRoot()
    if (isRootPage(from) && el) tabScroll.current[from] = el.scrollTop
    if (act === 'push') {
      history.replaceState({ ...cur, fosScroll: el ? el.scrollTop : 0 }, '')
      history.pushState({ fosPage: to, fosDepth: depth + 1, fosFrom: from }, '')
      setNavDir('push')
    } else {
      history.replaceState({ fosPage: to, fosDepth: depth }, '')
      setNavDir('tab')
    }
    setStackState(history.state)
    // Una pantalla nueva arranca arriba; una pestaña, donde se la dejó.
    pendingScroll.current = isRootPage(to) ? (tabScroll.current[to] || 0) : 0
    setPageState(to)
  }, [setPageState])

  // Después de pintar la página nueva y antes de que se vea (ni la transición
  // ni la persona alcanzan a ver el salto).
  useLayoutEffect(() => {
    if (pendingScroll.current == null) return
    const top = pendingScroll.current
    pendingScroll.current = null
    restoreScroll(top)
  }, [page])

  const back = useCallback(() => {
    const a = backAction(history.state, pageRef.current)
    if (a.type === 'history') {
      inAppBack.current = true
      history.back()
      return
    }
    history.replaceState({ fosPage: a.page, fosDepth: 0 }, '')
    setNavDir('pop')
    runViewTransition(() => { setStackState(history.state); setPageState(a.page) })
  }, [setPageState])

  return { go, back, backTo: backTarget(stackState, page) }
}
