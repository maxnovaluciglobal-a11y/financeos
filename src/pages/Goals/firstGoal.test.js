import { describe, it, expect } from 'vitest'
import { firstGoalPresets, FIRST_GOAL_IDS } from './firstGoal.js'
import { isEmergencyGoalName } from '../../utils/emergencyGoal.js'
import { es } from '../../i18n/es.js'
import { en } from '../../i18n/en.js'
import { pt } from '../../i18n/pt.js'
import { de } from '../../i18n/de.js'

const tFor = (dict) => (k) => dict[k] ?? k

describe('primera meta guiada', () => {
  it('ofrece las 4 opciones en orden', () => {
    expect(firstGoalPresets().map(p => p.id)).toEqual(FIRST_GOAL_IDS)
  })
  it('el fondo de emergencia propone 3 meses de gastos y prioridad alta', () => {
    const e = firstGoalPresets({ emergencyBase: 1_234_567.4 }).find(p => p.id === 'emergency')
    expect(e).toMatchObject({ priority: 'Alta', target: 3_703_702 })
  })
  it('sin gastos registrados no inventa un monto', () => {
    for (const p of firstGoalPresets({ emergencyBase: 0 })) expect(p.target).toBe(null)
  })
  it.each([['es', es], ['en', en], ['pt', pt], ['de', de]])('%s: el nombre prellenado cuenta como fondo de emergencia', (_, dict) => {
    const e = firstGoalPresets({ t: tFor(dict) }).find(p => p.id === 'emergency')
    expect(isEmergencyGoalName(e.name)).toBe(true)
  })
  it('las demás opciones no se confunden con el fondo de emergencia', () => {
    for (const dict of [es, en, pt, de]) {
      for (const p of firstGoalPresets({ t: tFor(dict) }).filter(p => p.id !== 'emergency')) {
        expect(isEmergencyGoalName(p.name)).toBe(false)
        expect(p.name).not.toMatch(/^goals\.|^gs\./)
      }
    }
  })
})
