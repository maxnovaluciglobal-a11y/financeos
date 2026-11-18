// Logotipo e isotipo de moyiq (D2, D8): SVG con la geometría del manual y
// currentColor; sin el dial ni la placa "IQ" de la marca anterior. Reemplaza a
// logoVariant.test.js, que medía cuándo la placa "IQ" dejaba de leerse: la
// placa se retiró con el rebranding y esa regla ya no existe.
import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Logo, { Isotipo, Logotipo, Wordmark, Monogram, LOGO_RATIO } from './Logo.jsx'

describe('Logo (moyiq)', () => {
  it('el logotipo es un SVG con nombre accesible y color heredable', () => {
    const html = renderToStaticMarkup(h(Logo, { size: 22 }))
    expect(html).toMatch(/^<svg[^>]+role="img"[^>]+aria-label="moyiq"/)
    expect(html).toContain('fill="currentColor"')
    expect(html).toContain('var(--logo-fg)')
    expect(html).not.toMatch(/IQ<|MOY/)
  })
  it('respeta la proporción del manual (≈2,9:1)', () => {
    expect(LOGO_RATIO).toBeGreaterThan(2.85)
    expect(LOGO_RATIO).toBeLessThan(2.95)
    const html = renderToStaticMarkup(h(Logotipo, { size: 20 }))
    const w = Number(html.match(/width="([\d.]+)"/)[1]), ht = Number(html.match(/height="([\d.]+)"/)[1])
    expect(w / ht).toBeCloseTo(LOGO_RATIO, 1)
  })
  it('decorativo: oculto para lectores de pantalla', () => {
    const html = renderToStaticMarkup(h(Isotipo, { size: 16, decorative: true }))
    expect(html).toContain('aria-hidden="true"')
    expect(html).not.toContain('role="img"')
  })
  it('los nombres anteriores siguen funcionando (Monogram = isotipo, Wordmark = logotipo)', () => {
    expect(renderToStaticMarkup(h(Monogram, { size: 24 }))).toBe(renderToStaticMarkup(h(Isotipo, { size: 24 })))
    expect(renderToStaticMarkup(h(Wordmark, { size: 14 }))).toMatch(/aria-label="moyiq"/)
  })
})
