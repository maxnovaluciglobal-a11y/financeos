import { describe, it, expect } from 'vitest'
import { EXCHANGE_KEYS, exchangeKey, freshnessKey, freshnessTone, isNYSEOpen, isUsEquity, marketStatus, quoteFreshness } from './investQuoteMeta.js'

const MIN = 60000
const NOW = Date.parse('2026-11-18T15:00:00Z') // miércoles, 10:00 en Nueva York

describe('quoteFreshness (Invest: readings.js)', () => {
  it('al día hasta 2 min, después retraso en minutos', () => {
    expect(quoteFreshness({ marketTime: NOW - 1 * MIN }, NOW)).toEqual({ state: 'live', minutes: 1, time: NOW - MIN })
    expect(quoteFreshness({ marketTime: NOW - 2 * MIN }, NOW).state).toBe('live')
    expect(quoteFreshness({ marketTime: NOW - 15 * MIN }, NOW)).toEqual({ state: 'delayed', minutes: 15, time: NOW - 15 * MIN })
  })
  it('un precio del futuro no da retraso negativo', () => {
    expect(quoteFreshness({ marketTime: NOW + 5 * MIN }, NOW)).toMatchObject({ state: 'live', minutes: 0 })
  })
  it('fuera de la sesión regular: mercado cerrado', () => {
    const q = { marketTime: NOW - 60 * MIN, tradingStart: NOW - 8 * 60 * MIN, tradingEnd: NOW - 30 * MIN }
    expect(quoteFreshness(q, NOW)).toEqual({ state: 'closed', minutes: null, time: q.marketTime })
    expect(quoteFreshness({ marketTime: NOW - 600 * MIN, tradingStart: NOW + 30 * MIN }, NOW).state).toBe('closed')
  })
  it('sin hora de la fuente: retraso no informado, con la hora de la consulta si la hay', () => {
    expect(quoteFreshness({ fetchedAt: NOW - MIN }, NOW)).toEqual({ state: 'unknown', minutes: null, time: NOW - MIN })
    expect(quoteFreshness({}, NOW)).toEqual({ state: 'unknown', minutes: null, time: null })
    expect(quoteFreshness(null, NOW).state).toBe('unknown')
  })
  it('falla: sin conexión, con la última hora conocida', () => {
    expect(quoteFreshness({ marketTime: NOW - 5 * MIN }, NOW, { failed: true })).toEqual({ state: 'offline', minutes: null, time: NOW - 5 * MIN })
    expect(quoteFreshness({ fetchedAt: 7 }, NOW, { failed: true }).time).toBe(7)
  })
})

describe('bolsa del activo (Invest: market.js)', () => {
  it('zona horaria → clave de bolsa', () => {
    expect(exchangeKey('America/New_York')).toBe('nyse')
    expect(exchangeKey('America/Argentina/Buenos_Aires')).toBe('byma')
    expect(exchangeKey('Asia/Tokyo')).toBeNull()
    expect(exchangeKey(null)).toBeNull()
    expect(EXCHANGE_KEYS).toContain('santiago')
  })
  it('Nueva York: 09:30–16:00 del Este, de lunes a viernes', () => {
    expect(isNYSEOpen(NOW)).toBe(true)
    expect(isNYSEOpen(Date.parse('2026-11-18T14:29:00Z'))).toBe(false) // 09:29
    expect(isNYSEOpen(Date.parse('2026-11-18T14:30:00Z'))).toBe(true)
    expect(isNYSEOpen(Date.parse('2026-11-18T21:00:00Z'))).toBe(false) // 16:00
    expect(isNYSEOpen(Date.parse('2026-11-21T15:00:00Z'))).toBe(false) // sábado
  })
  it('acción de EE. UU.: sin sufijo, no cripto y en dólares', () => {
    expect(isUsEquity('AAPL', 'USD')).toBe(true)
    expect(isUsEquity('BRK-B')).toBe(true)
    expect(isUsEquity('SQM-B.SN', 'CLP')).toBe(false)
    expect(isUsEquity('BTC-USD', 'USD')).toBe(false)
    expect(isUsEquity('', 'USD')).toBe(false)
  })
  it('con horario en la cotización: abierta o cerrada según la sesión', () => {
    const q = { timezone: 'America/Santiago', tradingStart: NOW - MIN, tradingEnd: NOW + MIN }
    expect(marketStatus(q, NOW)).toEqual({ exchange: 'santiago', open: true })
    expect(marketStatus({ ...q, tradingEnd: NOW }, NOW)).toEqual({ exchange: 'santiago', open: false })
    expect(marketStatus({ ...q, timezone: 'Asia/Tokyo' }, NOW)).toEqual({ exchange: null, open: true })
    expect(marketStatus({ ...q, timezone: null }, NOW, { usEquity: true })).toEqual({ exchange: 'nyse', open: true })
  })
  it('sin horario: Nueva York de respaldo para EE. UU.; si no, no se sabe', () => {
    expect(marketStatus({}, NOW, { usEquity: true, nyOpen: () => false })).toEqual({ exchange: 'nyse', open: false })
    expect(marketStatus(null, NOW, { usEquity: true, nyOpen: () => true })).toEqual({ exchange: 'nyse', open: true })
    expect(marketStatus({ timezone: 'America/Lima' }, NOW)).toBeNull()
  })
  it('cripto opera todo el día: sin estado', () => {
    expect(marketStatus({ tradingStart: 1, tradingEnd: 2 }, NOW, { crypto: true, usEquity: true })).toBeNull()
  })
})

describe('etiqueta de frescura', () => {
  it('clave por estado; retraso no informado con o sin hora de consulta', () => {
    expect(freshnessKey({ state: 'live', time: 1 })).toBe('asset.fresh.live')
    expect(freshnessKey({ state: 'delayed', minutes: 15, time: 1 })).toBe('asset.fresh.delayed')
    expect(freshnessKey({ state: 'closed', time: 1 })).toBe('asset.fresh.closed')
    expect(freshnessKey({ state: 'unknown', time: 5 })).toBe('asset.fresh.unknownAt')
    expect(freshnessKey({ state: 'unknown', time: null })).toBe('asset.fresh.unknown')
    expect(freshnessKey({ state: 'offline', time: 1 })).toBeNull()
    expect(freshnessKey(null)).toBeNull()
  })
  it('tono: al día en positivo, sin conexión en negativo, el resto neutro', () => {
    expect(freshnessTone({ state: 'live' })).toBe('pos')
    expect(freshnessTone({ state: 'offline' })).toBe('neg')
    expect(freshnessTone({ state: 'delayed' })).toBe('neu')
    expect(freshnessTone(null)).toBe('neu')
  })
})
