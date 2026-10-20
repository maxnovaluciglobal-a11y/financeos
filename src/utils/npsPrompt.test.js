import { describe, it, expect } from 'vitest'
import { npsTrigger, closeNps, readNpsState, NPS_KEY } from './npsPrompt.js'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 9, 20, 12)
function memStore() {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }
}

describe('NPS automático (PRD-5)', () => {
  it('no aparece antes del día 14 ni con menos de 10 movimientos', () => {
    expect(npsTrigger({ createdAt: NOW - 13 * DAY, movements: 9, now: NOW, state: null })).toBeNull()
  })
  it('aparece al día 14 desde el alta', () => {
    expect(npsTrigger({ createdAt: new Date(NOW - 14 * DAY).toISOString(), movements: 0, now: NOW, state: null })).toBe('day14')
  })
  it('aparece a los 10 movimientos aunque no hayan pasado 14 días (lo que pase primero)', () => {
    expect(npsTrigger({ createdAt: NOW - DAY, movements: 10, now: NOW, state: null })).toBe('movements10')
  })
  it('sin fecha de alta solo cuenta los movimientos', () => {
    expect(npsTrigger({ createdAt: null, movements: 3, now: NOW, state: null })).toBeNull()
    expect(npsTrigger({ createdAt: undefined, movements: 12, now: NOW, state: null })).toBe('movements10')
  })
  it('una sola vez por cuenta: responder o "Ahora no" lo cierran para siempre', () => {
    const store = memStore()
    expect(npsTrigger({ createdAt: NOW - 20 * DAY, movements: 30, now: NOW, state: readNpsState(store) })).toBe('movements10')
    closeNps('dismissed', 'movements10', NOW, store)
    expect(readNpsState(store)).toEqual({ closedAt: NOW, outcome: 'dismissed', trigger: 'movements10' })
    expect(npsTrigger({ createdAt: NOW - 40 * DAY, movements: 99, now: NOW, state: readNpsState(store) })).toBeNull()
  })
  it('la clave es de la cuenta, no del dispositivo, y no guarda montos', () => {
    expect(NPS_KEY.startsWith('fos_')).toBe(true)
    const store = memStore()
    closeNps('answered', 'day14', NOW, store)
    expect(Object.keys(readNpsState(store)).sort()).toEqual(['closedAt', 'outcome', 'trigger'])
  })
})
