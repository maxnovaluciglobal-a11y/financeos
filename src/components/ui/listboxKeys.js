// src/components/ui/listboxKeys.js — lógica pura de teclado del patrón WAI-ARIA
// APG "select-only combobox" (lo usa CountrySelect.jsx). Sin React ni DOM, para
// poder testearla en el environment 'node' de vitest.

// Normaliza para comparar nombres: minúsculas y sin diacríticos ("Perú" ≈ "peru",
// "México" ≈ "mexico"), así el type-ahead funciona aunque se tipee sin tildes.
export const normalize = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Flechas / Home / End → índice nuevo, sin dar la vuelta (APG: no wrap).
export function moveIndex(key, current, count) {
  if (count <= 0) return -1
  const cur = current < 0 ? 0 : current
  switch (key) {
    case 'ArrowDown': return Math.min(cur + 1, count - 1)
    case 'ArrowUp':   return Math.max(cur - 1, 0)
    case 'Home':      return 0
    case 'End':       return count - 1
    case 'PageDown':  return Math.min(cur + 10, count - 1)
    case 'PageUp':    return Math.max(cur - 10, 0)
    default:          return cur
  }
}

// Type-ahead. `buffer` es lo tipeado hasta ahora (se resetea afuera tras ~500ms).
// - Si el buffer es una misma letra repetida ("mmm"), cicla entre las opciones que
//   empiezan con esa letra, a partir de la siguiente a la activa.
// - Si no, busca la primera opción cuyo nombre empieza con el buffer, empezando
//   por la activa (para que seguir tipeando "co" → "col" no salte de opción).
// Devuelve -1 si nada coincide.
export function typeaheadIndex(buffer, labels, current) {
  const q = normalize(buffer)
  if (!q) return -1
  const n = labels.length
  const norm = labels.map(normalize)
  const sameChar = q.length > 1 && q.split('').every(ch => ch === q[0])
  if (sameChar || q.length === 1) {
    const ch = q[0]
    for (let i = 1; i <= n; i++) {
      const idx = ((current < 0 ? -1 : current) + i) % n
      if (norm[idx].startsWith(ch)) return idx
    }
    return -1
  }
  for (let i = 0; i < n; i++) {
    const idx = ((current < 0 ? 0 : current) + i) % n
    if (norm[idx].startsWith(q)) return idx
  }
  return -1
}

// Una tecla imprimible que cuenta para type-ahead (sin modificadores).
export const isTypeaheadKey = (e) =>
  e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey
