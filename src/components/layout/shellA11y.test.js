// Accesibilidad de la shell móvil (auditoría 360 del 19-nov-2026): reglas de
// CSS que no se pueden ver en jsdom (no hay layout), así que se fijan leyendo
// las hojas. Si alguien las quita, este test lo dice antes del despliegue.
//   A11Y-N1 · texto agrandado: la cápsula pasa a solo íconos y los títulos parten.
//   A11Y-N4 · Foco no oculto (WCAG 2.2, 2.4.11): margen de desplazamiento bajo
//             la cápsula y el "+".
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')
const shell = strip(readFileSync(join(here, 'shell.module.css'), 'utf8'))
const title = strip(readFileSync(join(here, 'largeTitle.module.css'), 'utf8'))

// Cuerpo de la primera regla cuyo selector es exactamente `sel` (dentro de `css`).
function rule(css, sel) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = css.match(new RegExp(`(?:^|[}\\s])${esc}\\s*\\{([^{}]*)\\}`))
  return m ? m[1] : null
}
// Contenido de un bloque @-regla (un nivel de anidamiento) cuyo preludio contiene `head`.
function atBlock(css, head) {
  const i = css.indexOf(head)
  if (i < 0) return null
  const open = css.indexOf('{', i)
  let depth = 0
  for (let j = open; j < css.length; j++) {
    if (css[j] === '{') depth++
    else if (css[j] === '}' && --depth === 0) return css.slice(open + 1, j)
  }
  return null
}

describe('A11Y-N1 · cápsula inferior con texto agrandado', () => {
  it('la cápsula es contenedor de consulta con la letra de las etiquetas', () => {
    const pill = rule(shell, '.tabPill')
    expect(pill).toMatch(/container:\s*tabpill\s*\/\s*inline-size/)
    expect(pill).toMatch(/font-size:\s*var\(--t-caption\)/)
  })

  it('por debajo de 25 em de su letra, las etiquetas quedan solo para lectores de pantalla', () => {
    const q = atBlock(shell, '@container tabpill (max-width: 25em)')
    expect(q).not.toBeNull()
    const lb = rule(q, '.tabLb')
    expect(lb).toMatch(/position:\s*absolute/)
    expect(lb).toMatch(/clip:\s*rect\(0 0 0 0\)/)
    // Nunca display:none: la etiqueta es el nombre accesible del botón.
    expect(lb).not.toMatch(/display:\s*none/)
  })

  it('una etiqueta más ancha que su pestaña se corta dentro de ella (no pisa la de al lado)', () => {
    expect(rule(shell, '.tab')).toMatch(/overflow:\s*hidden/)
    const lb = rule(shell, '.tabLb')
    expect(lb).toMatch(/max-width:\s*100%/)
    expect(lb).toMatch(/text-overflow:\s*ellipsis/)
  })

  it('el título de página parte las palabras largas en vez de salirse', () => {
    expect(rule(title, '.pageHeader h1, .pageHeader p')).toMatch(/overflow-wrap:\s*anywhere/)
  })
})

describe('A11Y-N4 · el foco no queda bajo la cápsula ni el "+"', () => {
  it('el área de contenido móvil reserva la cápsula y el "+" al desplazar', () => {
    const blocks = []
    let rest = shell
    for (;;) {
      const b = atBlock(rest, '@media (max-width: 700px)')
      if (b == null) break
      blocks.push(b)
      rest = rest.slice(rest.indexOf('@media (max-width: 700px)') + 10)
    }
    const content = blocks.map(b => rule(b, '.content')).find(r => r && /scroll-padding-bottom/.test(r))
    expect(content).toBeTruthy()
    const pb = content.match(/scroll-padding-bottom:\s*([^;]+);/)[1]
    expect(pb).toContain('var(--tabbar-h)')
    expect(pb).toContain('var(--fab-clear)')
    expect(content).toMatch(/scroll-padding-top:\s*[^;]*var\(--nav-h\)/)
  })
})
