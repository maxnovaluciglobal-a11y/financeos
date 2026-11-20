import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import Sparkline, { sparkPath } from './Sparkline.jsx'

describe('Sparkline', () => {
  it('menos de 2 puntos válidos: no dibuja', () => {
    expect(sparkPath([1], 80, 24)).toBeNull()
    expect(sparkPath([1, 'x', null, NaN], 80, 24)).toBeNull()
    expect(renderToStaticMarkup(createElement(Sparkline, { values: [] }))).toBe('')
  })
  it('dirección por primer y último valor, dentro de la caja', () => {
    const p = sparkPath([1, 3, 2, 5], 80, 24)
    expect(p.dir).toBe('up')
    expect(sparkPath([5, 3], 80, 24).dir).toBe('down')
    expect(sparkPath([2, 2, 2], 80, 24).dir).toBe('flat')
    for (const [, x, y] of p.d.matchAll(/[ML]([\d.]+),([\d.]+)/g)) {
      expect(Number(x)).toBeGreaterThanOrEqual(0); expect(Number(x)).toBeLessThanOrEqual(80)
      expect(Number(y)).toBeGreaterThanOrEqual(0); expect(Number(y)).toBeLessThanOrEqual(24)
    }
  })
  it('con etiqueta es una imagen accesible; sin etiqueta, decorativo', () => {
    const a = renderToStaticMarkup(createElement(Sparkline, { values: [1, 2], label: 'AAPL sube' }))
    expect(a).toContain('role="img"')
    expect(a).toContain('aria-label="AAPL sube"')
    expect(a).toContain('var(--pos)')
    const b = renderToStaticMarkup(createElement(Sparkline, { values: [2, 1] }))
    expect(b).toContain('aria-hidden="true"')
    expect(b).toContain('var(--neg)')
  })
})
