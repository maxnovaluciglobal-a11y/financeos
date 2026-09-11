// Cobertura de src/utils/emergencyGoal.js — fuente única de detección de
// "esta meta ES el fondo de emergencia" por nombre, usada por Coach
// (coachRules.js), Modo Asesor y Goals. Antes de la extracción, 3 copias
// divergentes del mismo regex: la de coachRules.js matcheaba la palabra
// suelta "fund"/"fondo", lo que contaba "Travel fund"/"Car fund"/"Wedding
// fund"/"College fund" como fondo de emergencia. Este archivo fija el
// criterio correcto: solo la raíz "emergenc*", nunca "fund"/"fondo"/"fundo"
// sueltos.
import { describe, it, expect } from 'vitest'
import { isEmergencyGoalName, findEmergencyGoal } from './emergencyGoal.js'

describe('isEmergencyGoalName', () => {
  it.each([
    'Fondo de emergencia',
    'Emergency Fund',
    'Fundo de emergência',
    'Emergencia',
    'Emergency',
  ])('reconoce "%s" como fondo de emergencia', (name) => {
    expect(isEmergencyGoalName(name)).toBe(true)
  })

  it.each([
    'Travel fund',
    'Car fund',
    'Wedding fund',
    'College fund',
    'Fondo de pensión',
    'Fondo mutuo',
    'Viaje a Europa',
  ])('NO confunde "%s" con un fondo de emergencia (falso positivo por "fund"/"fondo" sueltos)', (name) => {
    expect(isEmergencyGoalName(name)).toBe(false)
  })

  it('sin nombre → false, sin explotar', () => {
    expect(isEmergencyGoalName(undefined)).toBe(false)
    expect(isEmergencyGoalName(null)).toBe(false)
    expect(isEmergencyGoalName('')).toBe(false)
  })
})

describe('findEmergencyGoal', () => {
  it('encuentra la meta de emergencia entre otras metas con "fund" en el nombre', () => {
    const goals = [
      { name: 'Travel fund', saved: 5000 },
      { name: 'Fondo de emergencia', saved: 1000 },
      { name: 'Car fund', saved: 2000 },
    ]
    expect(findEmergencyGoal(goals)?.name).toBe('Fondo de emergencia')
  })

  it('sin meta de emergencia → undefined', () => {
    expect(findEmergencyGoal([{ name: 'Travel fund', saved: 5000 }])).toBeUndefined()
  })

  it('goals no-array → undefined, sin explotar', () => {
    expect(findEmergencyGoal(undefined)).toBeUndefined()
    expect(findEmergencyGoal(null)).toBeUndefined()
  })
})
