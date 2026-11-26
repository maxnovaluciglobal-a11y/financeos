import { describe, it, expect } from 'vitest'
// Los textos de los recorridos viven en la sección diferida src/i18n/help/.
import { es, de } from '../../i18n/withSections.js'
import { PAGE_TOURS, parseSeen, withSeen, shouldOfferTour, readSeen, markSeen, hasTour, TOURS_SEEN_KEY } from './pageTours.js'

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
  })

  it('Ajustes tiene recorrido de 2 pasos: buscador y filas (R10)', () => {
    expect(hasTour('settings')).toBe(true)
    expect(PAGE_TOURS.settings.map(s => s.id)).toEqual(['set-search', 'set-groups'])
  })

  // Ayuda en la app (26-nov-2026): ya no arranca solo; la primera visita pregunta.
  it('primera visita: se ofrece en cada pantalla con recorrido; la segunda no', () => {
    expect(shouldOfferTour({ page: 'dashboard', seen: [] })).toBe(true)
    expect(shouldOfferTour({ page: 'movements', seen: [] })).toBe(true)
    expect(shouldOfferTour({ page: 'dashboard', seen: ['dashboard'] })).toBe(false)
  })

  it('nunca en el demo, con otra hoja abierta ni en páginas sin recorrido', () => {
    expect(shouldOfferTour({ page: 'dashboard', seen: [], isDemo: true })).toBe(false)
    expect(shouldOfferTour({ page: 'dashboard', seen: [], busy: true })).toBe(false)
    expect(shouldOfferTour({ page: 'privacy', seen: [] })).toBe(false)
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

describe('recorrido del Inicio v2 (24-nov-2026)', () => {
  it('muestra los botones redondos y "Pregúntale a moyiq", con textos en los 4 idiomas', async () => {
    const ids = PAGE_TOURS.dashboard.map(s => s.id)
    expect(ids).toEqual(['kpi-free', 'home-quick', 'home-ask', 'first-steps', 'home-edit'])
    const dicts = await import('../../i18n/withSections.js').then(m => [m.es, m.en, m.pt, m.de])
    for (const d of dicts) for (const s of PAGE_TOURS.dashboard) {
      expect(d[s.title], s.title).toBeTruthy()
      expect(d[s.body], s.body).toBeTruthy()
    }
  })
})

import { requestTourReplay, takeTourReplay } from './PageTour.jsx' // reexporta helpCore.js
describe('volver a ver el recorrido sin la barra superior (Inicio v2)', () => {
  it('requestTourReplay deja el pedido y takeTourReplay lo consume una sola vez, solo para esa página', () => {
    const st = memStorage()
    st.removeItem = (k) => st.setItem(k, '')
    requestTourReplay('dashboard', st)
    expect(takeTourReplay('movements', st)).toBe(false)
    expect(takeTourReplay('dashboard', st)).toBe(true)
    expect(takeTourReplay('dashboard', st)).toBe(false)
  })
})
