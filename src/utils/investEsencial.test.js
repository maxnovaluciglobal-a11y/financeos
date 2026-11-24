import { describe, it, expect } from 'vitest'
import { beatChecks, companyBrief, firstSentence, putAndGain, riskWords, sizeBand, yearChange } from './investEsencial.js'

const totals = (over = {}) => ({ value: 12000, cost: 10000, total: 2000, fxEffect: 0, fxKnown: 0, fxUnknown: 0, excluded: 0, ...over })
const ledger = (over = {}) => ({ complete: true, contributed: 11500, gain: 1200, value: 12700, deposits: 11500, implicit: 0, dividends: 0, ...over })

describe('Pusiste / El mercado sumó', () => {
  it('sin operaciones: lo invertido en las posiciones y su resultado', () => {
    const r = putAndGain({ totals: totals() })
    expect(r).toMatchObject({ basis: 'invested', put: 10000, gain: 2000, value: 12000, parts: null })
    expect(r.pct).toBeCloseTo(0.2)
  })
  it('con el libro completo manda lo aportado', () => {
    const r = putAndGain({ ledger: ledger(), totals: totals() })
    expect(r).toMatchObject({ basis: 'contributed', put: 11500, gain: 1200, value: 12700 })
  })
  it('libro incompleto (falta un tipo de cambio) o vacío: vuelve a lo invertido', () => {
    expect(putAndGain({ ledger: ledger({ complete: false, gain: null }), totals: totals() }).basis).toBe('invested')
    expect(putAndGain({ ledger: ledger({ contributed: 0, deposits: 0 }), totals: totals() }).basis).toBe('invested')
  })
  it('desglose Precio + Dividendos + Dólar que suma el total', () => {
    const r = putAndGain({ ledger: ledger({ dividends: 150 }), totals: totals({ fxEffect: -80, fxKnown: 2 }) })
    expect(r.parts).toEqual({ price: 1200 - 150 + 80, dividends: 150, fx: -80 })
    expect(r.parts.price + r.parts.dividends + r.parts.fx).toBeCloseTo(r.gain)
  })
  it('el dólar no se separa si alguna posición en otra moneda no tiene el tipo de cambio de la compra', () => {
    const r = putAndGain({ ledger: ledger({ dividends: 0 }), totals: totals({ fxEffect: -80, fxKnown: 1, fxUnknown: 1 }) })
    expect(r.parts).toBeNull()
    const d = putAndGain({ ledger: ledger({ dividends: 40 }), totals: totals({ fxEffect: -80, fxKnown: 1, fxUnknown: 1 }) })
    expect(d.parts).toEqual({ price: 1160, dividends: 40, fx: null })
  })
  it('sin nada invertido no hay cifra (no se inventa)', () => {
    expect(putAndGain({})).toBeNull()
    expect(putAndGain({ totals: totals({ cost: 0, value: 0, total: 0 }) })).toBeNull()
  })
  it('avisa si quedaron montos fuera por tipo de cambio', () => {
    expect(putAndGain({ totals: totals({ excluded: 1 }) }).partial).toBe(true)
  })
})

describe('¿Le ganaste a la inflación y al dólar?', () => {
  const sum = (gain, put = 1000) => ({ gain, put, pct: gain / put })
  it('al dólar: solo para quien no usa US$, y le ganó si el mercado sumó', () => {
    expect(beatChecks(sum(100), { currency: 'USD' })).toBeNull()
    expect(beatChecks(sum(100), { currency: 'CLP' })).toEqual([{ key: 'usd', beat: true, even: false, pct: 0.1 }])
    expect(beatChecks(sum(-50), { currency: 'ARS' })[0]).toMatchObject({ beat: false, even: false })
    expect(beatChecks(sum(0), { currency: 'MXN' })[0]).toMatchObject({ even: true })
  })
  it('inflación solo con un dato real del período; sin dato, no aparece', () => {
    expect(beatChecks(sum(100), { currency: 'USD', inflation: null })).toBeNull()
    const r = beatChecks(sum(100), { currency: 'USD', inflation: { pct: 0.03 } })
    expect(r).toEqual([{ key: 'inflation', beat: true, even: false, pct: 0.1, ref: 0.03 }])
    expect(beatChecks(sum(10), { currency: 'USD', inflation: { pct: 0.05 } })[0].beat).toBe(false)
  })
  it('sin resumen o sin porcentaje, nada', () => {
    expect(beatChecks(null, { currency: 'CLP' })).toBeNull()
    expect(beatChecks({ gain: 1, put: 0, pct: null }, { currency: 'CLP' })).toBeNull()
  })
})

// Un año de cierres diarios hábiles hasta `end`, con un paso diario fijo.
function series({ start = '2025-11-20', end = '2026-11-20', from = 100, step = 0.001, wiggle = 0 } = {}) {
  const out = []
  let d = new Date(`${start}T00:00:00Z`), p = from, i = 0
  const last = new Date(`${end}T00:00:00Z`)
  while (d <= last) {
    const wd = d.getUTCDay()
    if (wd !== 0 && wd !== 6) {
      p = p * (1 + step + (wiggle ? (i % 2 ? wiggle : -wiggle) : 0))
      out.push({ date: d.toISOString().slice(0, 10), close: p })
      i++
    }
    d = new Date(d.getTime() + 86400000)
  }
  return out
}
const NOW = Date.parse('2026-11-20T15:00:00Z')

describe('Esta empresa en 30 segundos', () => {
  it('tamaño por valor en bolsa', () => {
    expect(sizeBand(3e12)).toBe('mega')
    expect(sizeBand(50e9)).toBe('large')
    expect(sizeBand(5e9)).toBe('mid')
    expect(sizeBand(1e9)).toBe('small')
    expect(sizeBand(100e6)).toBe('micro')
    expect(sizeBand(null)).toBeNull()
    expect(sizeBand(0)).toBeNull()
  })
  it('en el año: del último cierre del año pasado al precio de hoy', () => {
    const rows = [{ date: '2025-12-30', close: 90 }, { date: '2025-12-31', close: 100 }, { date: '2026-01-02', close: 101 }, { date: '2026-11-19', close: 120 }]
    expect(yearChange(rows, { now: NOW }).pct).toBeCloseTo(0.2)
    expect(yearChange(rows, { now: NOW, price: 110 }).pct).toBeCloseTo(0.1)
    expect(yearChange(rows, { now: NOW })).toMatchObject({ from: '2025-12-31', year: 2026 })
  })
  it('sin un cierre del año pasado no se adivina el punto de partida', () => {
    expect(yearChange([{ date: '2026-03-02', close: 10 }, { date: '2026-11-19', close: 12 }], { now: NOW })).toBeNull()
    expect(yearChange([{ date: '2025-12-31', close: 10 }], { now: NOW })).toBeNull()
    expect(yearChange(null, { now: NOW })).toBeNull()
  })
  it('riesgo en palabras según cuánto se movió el precio en el año', () => {
    expect(riskWords(series({ wiggle: 0.002 })).band).toBe('low')
    expect(riskWords(series({ wiggle: 0.015 })).band).toBe('medium')
    expect(riskWords(series({ wiggle: 0.03 })).band).toBe('high')
    expect(riskWords(series({ wiggle: 0.06 })).band).toBe('veryHigh')
    expect(riskWords(series().slice(0, 40))).toBeNull()
  })
  it('primera oración de la descripción, con tope', () => {
    expect(firstSentence('Apple Inc. designs phones. It also sells services.')).toBe('Apple Inc. designs phones.')
    expect(firstSentence('')).toBeNull()
    expect(firstSentence('x'.repeat(400)).length).toBeLessThanOrEqual(220)
  })
  it('arma el resumen solo con lo que trae la API', () => {
    const fund = { source: 'fmp', description: 'Apple Inc. designs, manufactures and markets smartphones. More text.', sector: 'Technology', industry: 'Consumer Electronics', marketCap: 3.5e12, dividendYield: 0.0045 }
    const b = companyBrief({ fund, rows: series({ wiggle: 0.01 }), type: 'Stock', now: NOW })
    expect(b.what).toBe('Apple Inc. designs, manufactures and markets smartphones.')
    expect(b.sector).toEqual(['Technology', 'Consumer Electronics'])
    expect(b.size).toMatchObject({ band: 'mega', cap: { unit: 'T' } })
    expect(b.dividend).toEqual({ kind: 'pays', yield: 0.0045 })
    expect(b.year.pct).toBeGreaterThan(0)
    expect(b.risk.band).toBeTruthy()
    expect(b.empty).toBe(false)
  })
  it('sin fundamentales no dice nada de dividendos ni de qué hace; cripto no paga', () => {
    const b = companyBrief({ fund: null, rows: null, type: 'Stock', now: NOW })
    expect(b.dividend).toBeNull()
    expect(b.what).toBeNull()
    expect(b.empty).toBe(true)
    expect(companyBrief({ fund: {}, type: 'Stock', now: NOW }).dividend).toBeNull()
    expect(companyBrief({ type: 'Crypto', now: NOW }).dividend).toEqual({ kind: 'crypto' })
    // M10 (QA): sin el dato de dividendos (un ETF en la fuente) no dice "no paga";
    // solo un 0 explícito.
    expect(companyBrief({ fund: { sector: 'Energy' }, type: 'Stock', now: NOW }).dividend).toBeNull()
    const none = companyBrief({ fund: { sector: 'Energy', dividendYield: 0 }, type: 'Stock', now: NOW })
    expect(none.dividend).toEqual({ kind: 'none' })
  })
  it('el tamaño puede salir de la cotización si los fundamentales no lo traen', () => {
    expect(companyBrief({ quote: { marketCap: 20e9 }, type: 'Stock', now: NOW }).size.band).toBe('large')
  })
})
