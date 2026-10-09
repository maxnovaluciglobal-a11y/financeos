import { describe, it, expect } from 'vitest'
import { es } from '../../i18n/es.js'
import { de } from '../../i18n/de.js'
import { PAGE_TOURS, parseSeen, withSeen, shouldAutoStartTour, readSeen, markSeen, hasTour, TOURS_SEEN_KEY } from './pageTours.js'

const memStorage = () => {
  const m = new Map()
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }
}

describe('pageTours (R08)', () => {
  it('Inicio, Movimientos y Presupuestos tienen recorrido de 3 a 5 pasos', () => {
    for (const p of ['dashboard', 'movements', 'budgets']) {
      expect(hasTour(p)).toBe(true)
      expect(PAGE_TOURS[p].length).toBeGreaterThanOrEqual(3)
      expect(PAGE_TOURS[p].length).toBeLessThanOrEqual(5)
    }
    expect(hasTour('settings')).toBe(false)
  })

  it('primera visita arranca sola; la segunda no', () => {
    expect(shouldAutoStartTour({ page: 'movements', seen: [] })).toBe(true)
    expect(shouldAutoStartTour({ page: 'movements', seen: ['movements'] })).toBe(false)
  })

  it('nunca arranca solo en el demo ni en páginas sin recorrido', () => {
    expect(shouldAutoStartTour({ page: 'dashboard', seen: [], isDemo: true })).toBe(false)
    expect(shouldAutoStartTour({ page: 'goals', seen: [] })).toBe(false)
  })

  it('parseSeen tolera basura y withSeen no duplica', () => {
    expect(parseSeen('no-json')).toEqual([])
    expect(parseSeen('{"a":1}')).toEqual([])
    expect(parseSeen('["dashboard",3]')).toEqual(['dashboard'])
    expect(withSeen(['dashboard'], 'dashboard')).toEqual(['dashboard'])
    expect(withSeen(['dashboard'], 'budgets')).toEqual(['dashboard', 'budgets'])
  })

  it('markSeen persiste por dispositivo', () => {
    const st = memStorage()
    markSeen('budgets', st)
    markSeen('budgets', st)
    expect(JSON.parse(st.getItem(TOURS_SEEN_KEY))).toEqual(['budgets'])
    expect(readSeen(st)).toEqual(['budgets'])
  })

  it('cada paso tiene título y texto en los idiomas', () => {
    for (const steps of Object.values(PAGE_TOURS)) {
      for (const st of steps) for (const d of [es, de]) {
        expect(typeof d[st.title], st.title).toBe('string')
        expect(typeof d[st.body], st.body).toBe('string')
      }
    }
  })
})
