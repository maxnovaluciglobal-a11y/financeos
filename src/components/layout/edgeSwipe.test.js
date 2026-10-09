import { describe, it, expect } from 'vitest'
import { isEdgeSwipeBack } from './edgeSwipe.js'

describe('isEdgeSwipeBack (R14, iOS instalada)', () => {
  const s = (x, y = 300, at = 0) => ({ x, y, at })
  it('desde el borde, horizontal y rápido: atrás', () => {
    expect(isEdgeSwipeBack(s(8), s(120, 310, 250))).toBe(true)
  })
  it('lejos del borde no cuenta (es un swipe de contenido)', () => {
    expect(isEdgeSwipeBack(s(60), s(200, 300, 200))).toBe(false)
  })
  it('corto, vertical o lento no cuenta', () => {
    expect(isEdgeSwipeBack(s(8), s(50, 300, 100))).toBe(false)
    expect(isEdgeSwipeBack(s(8), s(110, 420, 200))).toBe(false)
    expect(isEdgeSwipeBack(s(8), s(150, 300, 1200))).toBe(false)
  })
})
