// Test de la matemática pura extraída del handler (ver computeCrossRates en
// fixer.js) — protege contra el escenario que la auditoría 2026-08-21 marcó
// como riesgo: si se invierte un operando en el cross-rate, las tasas quedan
// mal sin que nada lo note antes de llegar al Dashboard del usuario.
import { describe, it, expect } from 'vitest'
import { computeCrossRates } from './fixer.js'

describe('computeCrossRates', () => {
  it('convierte de "X por EUR" a "X por USD" correctamente', () => {
    // Caso real de forma: 1 EUR = 1.08 USD, 1 EUR = 950 CLP
    // => 1 USD = 950 / 1.08 CLP ≈ 879.629630
    const rates = computeCrossRates({ USD: 1.08, CLP: 950 })
    expect(rates.CLP).toBeCloseTo(879.62963, 5)
  })

  it('USD siempre da exactamente 1', () => {
    const rates = computeCrossRates({ USD: 1.08, CLP: 950, MXN: 19.5 })
    expect(rates.USD).toBe(1)
  })

  it('deriva EUR (que Fixer no devuelve como símbolo propio)', () => {
    // 1 EUR = 1.08 USD => 1 USD = 1/1.08 EUR ≈ 0.925926
    const rates = computeCrossRates({ USD: 1.08 })
    expect(rates.EUR).toBeCloseTo(0.925926, 5)
  })

  it('redondea a 6 decimales', () => {
    const rates = computeCrossRates({ USD: 1.0987654321, CLP: 950.123456789 })
    expect(rates.CLP.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(6)
  })

  it('devuelve null si falta el pivote USD (en vez de una tasa inventada)', () => {
    expect(computeCrossRates({ CLP: 950 })).toBeNull()
  })
})

describe('CORS de /api/fixer (C-24)', () => {
  it('no permite financeospro.com, que ya redirige a moyiq.app', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(new URL('./fixer.js', import.meta.url), 'utf8')
    expect(src).not.toMatch(/financeospro/)
    expect(src).toContain("'https://app.moyiq.app'")
  })
})
