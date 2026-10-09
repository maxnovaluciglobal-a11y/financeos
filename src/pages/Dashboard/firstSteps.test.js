import { describe, it, expect } from 'vitest'
import { firstStepsProgress } from './firstSteps.js'

describe('firstStepsProgress (R06)', () => {
  it('sin datos: 0 de 3 y el primer paso es registrar un movimiento', () => {
    const p = firstStepsProgress({})
    expect(p.done).toBe(0)
    expect(p.total).toBe(3)
    expect(p.complete).toBe(false)
    expect(p.nextId).toBe('movement')
  })

  it('un gasto o un ingreso cuenta como primer movimiento', () => {
    expect(firstStepsProgress({ expenses: [{ amount: 1 }] }).done).toBe(1)
    expect(firstStepsProgress({ incomes: [{ amount: 1 }] }).done).toBe(1)
    expect(firstStepsProgress({ expenses: [{ amount: 1 }] }).nextId).toBe('budget')
  })

  it('presupuesto y respaldo suman; el sync activo cuenta como respaldo', () => {
    const base = { expenses: [{}], budgets: [{ category: 'Vivienda', limit: 10 }] }
    expect(firstStepsProgress(base).done).toBe(2)
    expect(firstStepsProgress({ ...base, lastBackupAt: '2026-10-01T00:00:00Z' }).complete).toBe(true)
    expect(firstStepsProgress({ ...base, syncOn: true }).complete).toBe(true)
  })

  it('los pasos no dependen del orden: respaldo sin movimientos es 1 de 3', () => {
    const p = firstStepsProgress({ lastBackupAt: '2026-10-01' })
    expect(p.done).toBe(1)
    expect(p.nextId).toBe('movement')
    expect(p.steps.map(s => s.done)).toEqual([false, false, true])
  })

  it('volver a 0 presupuestos vuelve a dejar el paso pendiente (sale de los datos)', () => {
    expect(firstStepsProgress({ expenses: [{}], budgets: [], lastBackupAt: 'x' }).nextId).toBe('budget')
  })
})
