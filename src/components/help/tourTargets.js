// src/components/help/tourTargets.js — ¿qué pasos de un recorrido tienen su
// objetivo (data-tour) a la vista? Los que no, se saltean (Tour.jsx).
export const targetEl = (id, doc = globalThis.document) => doc?.querySelector?.(`[data-tour="${id}"]`) || null

export function isVisible(el) {
  if (!el?.getBoundingClientRect) return false
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

export const visibleSteps = (steps, doc) => (steps || []).filter(s => isVisible(targetEl(s.id, doc)))
export const anyTargetVisible = (steps, doc) => visibleSteps(steps, doc).length > 0
