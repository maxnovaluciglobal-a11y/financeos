// REC-N6: piso de 11 px para el texto de la interfaz. Falla si vuelve un
// fontSize/font-size de 8, 9 o 10 px en src/.
// Excepciones justificadas:
//  - PDF (*PDF.jsx): react-pdf mide en puntos de una hoja A4 impresa, no en px
//    de pantalla.
//  - MoneyFlow.jsx: etiquetas dentro de los nodos del diagrama SVG, que se
//    achican para caber en el alto del nodo (el SVG escala con su viewBox).
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')
const EXEMPT = new Set(['components/charts/MoneyFlow.jsx'])
const SMALL = /fontSize\s*:\s*['"]?(?:8|9|10)(?:\.5)?(?:px)?['"]?\s*[,}\n]|fontSize\s*:[^,}\n]*[?:]\s*(?:8|9|10)(?:\.5)?\s*[,}\n]|font-size\s*:\s*(?:8|9|10)(?:\.5)?px|--fs-xs:\s*(?:8|9|10)px/g

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(jsx?|css)$/.test(n) && !/\.test\.jsx?$/.test(n) && !/PDF\.jsx$/.test(n)) out.push(p)
  }
  return out
}

describe('tamaño mínimo de texto (REC-N6)', () => {
  it('ningún estilo de src/ baja de 11 px (salvo las excepciones documentadas)', () => {
    const bad = []
    for (const f of walk(SRC)) {
      const rel = relative(SRC, f)
      if (EXEMPT.has(rel)) continue
      for (const m of readFileSync(f, 'utf8').matchAll(SMALL)) bad.push(`${rel}: ${m[0].trim()}`)
    }
    expect(bad).toEqual([])
  })
})
