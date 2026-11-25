import { describe, it, expect } from 'vitest'
import { exampleVars, niceRound } from './exampleMoney.js'
import es from './strings.es.js'
import en from './strings.en.js'
import pt from './strings.pt.js'
import de from './strings.de.js'

describe('cifras de los avisos de ejemplo', () => {
  const money = (n) => `#${n}`
  it('en la escala de la moneda de la persona', () => {
    expect(exampleVars(money, 'CLP')).toEqual({ amount: '#450000', spent: '#92000', limit: '#100000', left: '#310000', daily: '#22000' })
    expect(exampleVars(money, 'EUR').amount).toBe('#450')
    expect(exampleVars(money, 'USD').limit).toBe('#100')
    expect(exampleVars(money, 'XYZ').amount).toBe('#900')
    expect(niceRound(1234567)).toBe(1200000)
  })
  it('los textos de ejemplo no traen "$" ni cifras de una moneda fija', () => {
    for (const d of [es, en, pt, de]) {
      for (const k of ['la.ex.fixedDue.body', 'la.ex.budget.body', 'la.ex.left.title', 'la.ex.left.body']) {
        expect(d[k], k).not.toMatch(/\$|\d{3}[.,]\d{3}/)
      }
      expect(d['la.ex.price.body']).toMatch(/AAPL/)
    }
  })
})
