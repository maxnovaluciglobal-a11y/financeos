// src/utils/focusAfter.js — a dónde va el foco cuando lo que lo tenía
// desaparece (descartar una tarjeta, ocultar "Primeros pasos"): al título de
// la sección que sigue, o al contenedor principal. Sin esto el foco cae al
// <body> y el lector de pantalla vuelve al principio de la página.

/**
 * Busca (ahora, mientras `el` sigue en la página) el primer título (h2/h3)
 * que viene después de `el` y, en el próximo ciclo (cuando `el` ya se fue),
 * le pasa el foco; sin ninguno, al contenedor con scroll de la app.
 * @param {Element | null | undefined} el
 */
export function focusAfter(el) {
  if (typeof document === 'undefined') return
  const root = document.querySelector('[data-scroll-root]') || document.body
  const next = el ? [...root.querySelectorAll('h2, h3')].find(h => !el.contains(h)
    && (el.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING)) : null
  const target = next || root
  if (target !== root && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
  setTimeout(() => target.focus?.(), 0)
}
