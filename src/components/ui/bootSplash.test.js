import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import BootSplash from './BootSplash.jsx'
import { LOGO_SVG } from '../logoPaths.js'

describe('BootSplash', () => {
  it('pinta el mismo logotipo SVG que la pantalla de arranque de index.html', () => {
    const html = renderToStaticMarkup(createElement(BootSplash))
    expect(html).toContain('class="boot-logo"')
    expect(html).toContain(`viewBox="${LOGO_SVG.viewBox}"`)
    const index = readFileSync(fileURLToPath(new URL('../../../index.html', import.meta.url)), 'utf8')
    expect(index).toContain(`viewBox="${LOGO_SVG.viewBox}"`)
    for (const d of LOGO_SVG.paths) expect(index).toContain(d.slice(0, 40))
  })
})
