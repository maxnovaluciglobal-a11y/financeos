import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import CountUp, { countUpFrame } from './CountUp.jsx'

describe('CountUp (ola A4, H21)', () => {
  it('al montar dibuja el valor final, no 0', () => {
    const html = renderToStaticMarkup(createElement(CountUp, { value: 1234, format: (v) => String(Math.round(v)) }))
    expect(html).toContain('1234')
    expect(html).not.toMatch(/>0</)
  })
  it('anima desde el valor anterior, no desde 0', () => {
    expect(countUpFrame(100, 200, 0)).toBe(100)
    expect(countUpFrame(100, 200, 0.5)).toBeGreaterThan(100)
    expect(countUpFrame(100, 200, 0.5)).toBeLessThan(200)
    expect(countUpFrame(100, 200, 1)).toBe(200)
  })
  it('el resorte termina exacto en el destino', () => {
    expect(countUpFrame(0, 60, 1, true)).toBe(60)
  })
})
