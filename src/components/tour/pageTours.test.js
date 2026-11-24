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
  })

  it('Ajustes tiene recorrido de 2 pasos: buscador y filas (R10)', () => {
    expect(hasTour('settings')).toBe(true)
    expect(PAGE_TOURS.settings.map(s => s.id)).toEqual(['set-search', 'set-groups'])
  })

  it('primera visita arranca sola; la segunda no', () => {
    expect(shouldAutoStartTour({ page: 'dashboard', seen: [] })).toBe(true)
    expect(shouldAutoStartTour({ page: 'dashboard', seen: ['dashboard'] })).toBe(false)
    // El resto de las pestañas ya no arranca solo (19-nov-2026): el "?" lo abre.
    expect(shouldAutoStartTour({ page: 'movements', seen: [] })).toBe(false)
  })

  it('nunca arranca solo en el demo ni en páginas sin recorrido', () => {
    expect(shouldAutoStartTour({ page: 'dashboard', seen: [], isDemo: true })).toBe(false)
    expect(shouldAutoStartTour({ page: 'reports', seen: [] })).toBe(false)
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
    const dicts = await Promise.all(['es', 'en', 'pt', 'de'].map(l => import(`../../i18n/${l}.js`).then(m => m[l])))
    for (const d of dicts) for (const s of PAGE_TOURS.dashboard) {
      expect(d[s.title], s.title).toBeTruthy()
      expect(d[s.body], s.body).toBeTruthy()
    }
  })
})

import { requestTourReplay, takeTourReplay } from './PageTour.jsx'
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
