import { describe, it, expect } from 'vitest'
import { readChecklist, startChecklist, markPageVisited, dismissChecklist, isChecklistVisible, PRO_STEPS } from './proChecklist.js'

function memStore() {
  const m = new Map()
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }
}
const DAY = 24 * 60 * 60 * 1000

describe('checklist de Pro (PRD-4)', () => {
  it('los pasos son los de los correos de la prueba: importar, Modo Asesor, reporte', () => {
    expect(PRO_STEPS.map(s => s.page)).toEqual(['import', 'advisor', 'reports'])
  })

  it('arranca una sola vez y se ve durante 14 días', () => {
    const st = memStore()
    const s0 = startChecklist(1000, st)
    expect(startChecklist(5000, st).since).toBe(1000)
    expect(isChecklistVisible(s0, 1000 + 13 * DAY)).toBe(true)
    expect(isChecklistVisible(s0, 1000 + 15 * DAY)).toBe(false)
  })

  it('cada pantalla marca su paso; con los tres hechos desaparece', () => {
    const st = memStore()
    startChecklist(1, st)
    markPageVisited('dashboard', st)
    expect(readChecklist(st).done).toEqual({})
    markPageVisited('import', st)
    markPageVisited('advisor', st)
    expect(isChecklistVisible(readChecklist(st), DAY)).toBe(true)
    markPageVisited('reports', st)
    expect(isChecklistVisible(readChecklist(st), DAY)).toBe(false)
  })

  it('no marca nada antes de ser Pro; ocultar es definitivo; datos rotos no rompen', () => {
    const st = memStore()
    expect(markPageVisited('import', st)).toBe(null)
    startChecklist(1, st)
    dismissChecklist(st)
    expect(isChecklistVisible(readChecklist(st), DAY)).toBe(false)
    const bad = memStore(); bad.setItem('fos_pro_checklist', '{no json')
    expect(readChecklist(bad)).toBe(null)
    expect(isChecklistVisible(null)).toBe(false)
  })
})
