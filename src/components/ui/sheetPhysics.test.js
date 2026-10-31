import { describe, expect, it } from 'vitest'
import { detentOffsets, rubberBand, settle, springMs, velocityOf, SPRING_MS, SPRING_MIN_MS } from './sheetPhysics.js'

describe('sheetPhysics', () => {
  it('una hoja corta tiene una altura; una alta, dos', () => {
    expect(detentOffsets(300, 844)).toEqual([0])
    expect(detentOffsets(760, 844)).toEqual([0, 760 - Math.round(844 * 0.56)])
  })
  it('la velocidad sale de las últimas muestras', () => {
    expect(velocityOf([{ t: 0, y: 0 }])).toBe(0)
    expect(velocityOf([{ t: 0, y: 0 }, { t: 500, y: 0 }, { t: 550, y: 50 }])).toBe(1)
  })
  it('soltar despacio vuelve a la altura más cercana', () => {
    expect(settle({ offset: 60, velocity: 0, offsets: [0, 300], height: 760 })).toBe(0)
    expect(settle({ offset: 260, velocity: 0, offsets: [0, 300], height: 760 })).toBe(300)
  })
  it('un gesto rápido baja a la media o cierra, según desde dónde', () => {
    expect(settle({ offset: 40, velocity: 1.2, offsets: [0, 300], height: 760 })).toBe(300)
    expect(settle({ offset: 300, velocity: 1.8, offsets: [0, 300], height: 760 })).toBe('close')
    expect(settle({ offset: 90, velocity: 1.2, offsets: [0], height: 320 })).toBe('close')
  })
  it('sin gesto rápido, una hoja corta necesita pasar la mitad para cerrar', () => {
    expect(settle({ offset: 120, velocity: 0, offsets: [0], height: 320 })).toBe(0)
    expect(settle({ offset: 200, velocity: 0, offsets: [0], height: 320 })).toBe('close')
  })
  it('por encima del tope la hoja se resiste', () => {
    expect(rubberBand(50)).toBe(50)
    expect(rubberBand(-100)).toBeCloseTo(-18)
  })
  it('el resorte se acorta con la velocidad, sin pasar sus topes', () => {
    expect(springMs(400, 0)).toBe(SPRING_MS)
    expect(springMs(100, 3)).toBe(SPRING_MIN_MS)
    expect(springMs(300, 2)).toBe(240)
  })
})
