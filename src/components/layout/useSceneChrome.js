// src/components/layout/useSceneChrome.js — marca la escena morada en <html>
// (data-scene: la barra superior pasa a blanco sobre el morado, shell.module.css)
// y pinta el theme-color del mismo morado mientras la escena está a la vista.
// Lo usan la escena del Inicio y la de cada pantalla (PageScene).
import { useEffect } from 'react'
import { TOKENS_LIGHT } from '../../styles/tokens.js'

export const SCENE_COLOR = TOKENS_LIGHT['--impulso-0']

export function useSceneChrome(ref) {
  useEffect(() => {
    const root = document.documentElement
    root.dataset.scene = 'on'
    const metas = [...document.querySelectorAll('meta[name="theme-color"]')]
    const original = metas.map(m => m.getAttribute('content'))
    const paint = (on) => metas.forEach((m, i) => m.setAttribute('content', on ? SCENE_COLOR : original[i]))
    paint(true)
    let io = null
    if (ref.current && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(([e]) => paint(e.isIntersecting), { rootMargin: '0px 0px -85% 0px' })
      io.observe(ref.current)
    }
    return () => { io?.disconnect(); paint(false); delete root.dataset.scene }
  }, [ref])
}
