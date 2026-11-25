// @ts-check
// src/utils/reviewFlags.js — lo mínimo de "Por revisar" que necesita el JS
// inicial (Registro rápido y registro automático de fijos, vía AppContext).
// La bandeja (reviewQueue, markReviewed, seedDemoReview) vive en review.js,
// que solo cargan el Inicio, Importar y el demo (lazy). Ver review.js para el
// significado del flag `needsReview` y de `origin`.

/**
 * Marca un registro recién creado. Devuelve una copia; sin `needs`, solo la
 * etiqueta de origen (para saber de dónde vino aunque no pida revisión).
 * @param {any} rec @param {string} origin @param {{ needs?: boolean }} [opts]
 */
export function withReview(rec, origin, { needs = true } = {}) {
  const out = { ...rec, origin }
  if (needs) out.needsReview = true
  else delete out.needsReview
  return out
}

/**
 * ¿Un alta rápida pide revisión? Solo si vino de afuera (Apple Pay, enlace,
 * dictado) y la persona no eligió la categoría a mano.
 * @param {{ origin?: string|null, categoryChosen?: boolean }} o
 */
export const quickAddNeedsReview = ({ origin, categoryChosen }) => !!origin && !categoryChosen
