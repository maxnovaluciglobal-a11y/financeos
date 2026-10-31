import { describe, expect, it } from 'vitest'
import { ACTION_W, EDGE_GUARD_PX, canStart, clampOffset, intent, settlesOpen } from './swipeRow.js'

describe('swipeRow', () => {
  it('no compite con el gesto atrás del borde izquierdo', () => {
    expect(canStart(EDGE_GUARD_PX)).toBe(false)
    expect(canStart(EDGE_GUARD_PX + 1)).toBe(true)
  })
  it('distingue fila de scroll', () => {
    expect(intent(4, 3)).toBe(null)
    expect(intent(-30, 6)).toBe('x')
    expect(intent(-12, 20)).toBe('y')
    expect(intent(14, 12)).toBe('y')
  })
  it('solo abre hacia la izquierda y se resiste al pasarse', () => {
    const w = ACTION_W * 2
    expect(clampOffset(40, w)).toBe(0)
    expect(clampOffset(-100, w)).toBe(-100)
    expect(clampOffset(-w - 40, w)).toBe(-w - 10)
  })
  it('queda abierta por distancia o por velocidad', () => {
    const w = 152
    expect(settlesOpen(-100, 0, w)).toBe(true)
    expect(settlesOpen(-40, 0, w)).toBe(false)
    expect(settlesOpen(-20, -0.8, w)).toBe(true)
    expect(settlesOpen(-140, 0.8, w)).toBe(false)
  })
})
