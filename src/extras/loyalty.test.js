import { describe, it, expect } from 'vitest'
import { loyaltyList, programValue, loyaltyTotal, includeInNetWorth, validateProgram, upsertProgram, removeProgram, withDemoLoyalty } from './loyalty.js'
import { DEMO_SETTINGS } from '../demo/demoData.js'

describe('Puntos y millas', () => {
  it('una cuenta vieja (sin lista) no tiene programas ni los suma', () => {
    expect(loyaltyList({})).toEqual([])
    expect(loyaltyList({ loyalty: 'x' })).toEqual([])
    expect(includeInNetWorth({})).toBe(false)
  })

  it('limpia lo roto y calcula el valor estimado solo con valor por punto', () => {
    const list = loyaltyList({ loyalty: [
      { id: 'a', program: ' Millas ', points: '12000.4', valuePerPoint: 5 },
      { id: 'b', program: 'Puntos', points: 800 },
      { id: 'c', program: '', points: 10 },
      null,
    ] })
    expect(list).toEqual([
      { id: 'a', program: 'Millas', points: 12000, valuePerPoint: 5 },
      { id: 'b', program: 'Puntos', points: 800, valuePerPoint: null },
    ])
    expect(programValue(list[0])).toBe(60000)
    expect(programValue(list[1])).toBeNull()
    expect(loyaltyTotal(list)).toBe(60000)
  })

  it('valida el formulario y hace alta, edición y baja', () => {
    expect(validateProgram({ program: '', points: '1' }).error).toBe('loyalty.form.needName')
    expect(validateProgram({ program: 'X', points: '' }).error).toBe('loyalty.form.needPoints')
    expect(validateProgram({ program: 'X', points: '-3' }).error).toBe('loyalty.form.needPoints')
    const ok = validateProgram({ program: 'Millas', points: '15.000', valuePerPoint: '4,5' })
    expect(ok.item).toEqual({ program: 'Millas', points: 15000, valuePerPoint: 4.5 })
    let list = upsertProgram([], ok.item)
    expect(list).toHaveLength(1)
    const id = list[0].id
    list = upsertProgram(list, { ...ok.item, points: 1 }, id)
    expect(list).toEqual([{ ...ok.item, points: 1, id }])
    expect(removeProgram(list, id)).toEqual([])
  })

  it('el demo trae programas y no los suma al patrimonio', () => {
    const demo = withDemoLoyalty({ ...DEMO_SETTINGS, currency: 'USD' }, (k) => `t:${k}`)
    expect(loyaltyList(demo).map(p => p.program)).toEqual(['t:loyalty.demo.miles', 't:loyalty.demo.card'])
    // En dólares una milla vale centavos, no 30.
    expect(loyaltyTotal(loyaltyList(demo))).toBeLessThan(1000)
    expect(includeInNetWorth(demo)).toBe(false)
    // Una cuenta real nunca recibe los de ejemplo; en el demo, lo cargado manda.
    expect(withDemoLoyalty({ loyalty: undefined })).toEqual({ loyalty: undefined })
    expect(loyaltyList(withDemoLoyalty({ ...DEMO_SETTINGS, loyalty: [] }))).toEqual([])
  })
})
