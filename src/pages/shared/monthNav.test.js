import { monthsBetween, describe, it, expect } from 'vitest'
import { shiftMonth, monthRange, stepState, closeKeyToDismiss } from './monthNav.js'

describe('shiftMonth (B3a)', () => {
  it('avanza y retrocede cruzando años', () => {
    expect(shiftMonth('2026-10', 1)).toBe('2026-11')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-03', -15)).toBe('2024-12')
    expect(shiftMonth('2026-03', 0)).toBe('2026-03')
  })
  it('entrada inválida → la misma', () => {
    expect(shiftMonth('oct', 1)).toBe('oct')
    expect(shiftMonth(undefined, 1)).toBeUndefined()
  })
})

describe('monthRange / stepState', () => {
  it('del mes más viejo con datos al más nuevo, incluyendo el actual y el activo', () => {
    expect(monthRange(['2026-08-15', '2026-10-02', 'basura', null], '2026-10', '2026-10')).toEqual({ min: '2026-08', max: '2026-10' })
    expect(monthRange(['2026-12-01'], '2026-10', '2026-10')).toEqual({ min: '2026-10', max: '2026-12' })
    expect(monthRange([], '2026-10', '2026-07')).toEqual({ min: '2026-07', max: '2026-10' })
    expect(monthRange(null, null, null)).toEqual({ min: null, max: null })
  })
  it('sin datos viejos no se puede ir atrás; en el último mes no se puede ir adelante', () => {
    const r = monthRange(['2026-09-30'], '2026-10', '2026-10')
    expect(stepState('2026-10', r)).toEqual({ prev: '2026-09', next: '2026-11', canPrev: true, canNext: false })
    expect(stepState('2026-09', r)).toMatchObject({ canPrev: false, canNext: true })
    expect(stepState('2026-10', { min: null, max: null })).toMatchObject({ canPrev: false, canNext: false })
  })
})

describe('closeKeyToDismiss (la hoja de cierre no aparece sola)', () => {
  it('un mes pasado elegido a propósito marca su cierre como visto', () => {
    expect(closeKeyToDismiss('2026-09', '2026-10')).toBe('fos_close_2026-09')
    expect(closeKeyToDismiss('2025-12', '2026-01')).toBe('fos_close_2025-12')
  })
  it('el mes en curso o uno futuro no marcan nada', () => {
    expect(closeKeyToDismiss('2026-10', '2026-10')).toBeNull()
    expect(closeKeyToDismiss('2026-11', '2026-10')).toBeNull()
    expect(closeKeyToDismiss('x', '2026-10')).toBeNull()
  })
})

describe('monthsBetween', () => {
  it('lista del más nuevo al más viejo, cruzando el año', () => {
    expect(monthsBetween({ min: '2025-11', max: '2026-02' })).toEqual(['2026-02', '2026-01', '2025-12', '2025-11'])
  })
  it('sin rango, lista vacía', () => {
    expect(monthsBetween({ min: null, max: null })).toEqual([])
  })
})
