import { describe, it, expect } from 'vitest'
import { monthAdvance } from './monthAdvance.js'

describe('el mes activo avanza solo', () => {
  it('si estaba en el mes en curso, pasa al nuevo', () => {
    expect(monthAdvance({ activeMonth: '2026-10', lastSeenMonth: '2026-10' }, '2026-11'))
      .toEqual({ activeMonth: '2026-11', lastSeenMonth: '2026-11' })
  })
  it('también si pasaron varios meses sin abrir la app', () => {
    expect(monthAdvance({ activeMonth: '2026-07', lastSeenMonth: '2026-07' }, '2026-11').activeMonth).toBe('2026-11')
  })
  it('si estaba revisando un mes anterior, se queda', () => {
    expect(monthAdvance({ activeMonth: '2026-08', lastSeenMonth: '2026-10' }, '2026-11'))
      .toEqual({ activeMonth: '2026-08', lastSeenMonth: '2026-11' })
  })
  it('mismo mes: no hace nada', () => {
    expect(monthAdvance({ activeMonth: '2026-11', lastSeenMonth: '2026-11' }, '2026-11')).toBe(null)
  })
  it('primera vez tras la actualización (sin lastSeenMonth)', () => {
    expect(monthAdvance({ activeMonth: '2026-10' }, '2026-11').activeMonth).toBe('2026-11')
    expect(monthAdvance({ activeMonth: '2026-08' }, '2026-11').activeMonth).toBe('2026-08')
    expect(monthAdvance({ activeMonth: '2026-11' }, '2026-11')).toEqual({ activeMonth: '2026-11', lastSeenMonth: '2026-11' })
    expect(monthAdvance({ activeMonth: '2026-12' }, '2027-01').activeMonth).toBe('2027-01')
  })
  it('sin mes activo, el actual', () => {
    expect(monthAdvance({}, '2026-11').activeMonth).toBe('2026-11')
  })
})
