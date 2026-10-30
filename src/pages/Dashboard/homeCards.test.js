import { describe, it, expect } from 'vitest'
import { HOME_CARDS, homeCardOn, toggleHomeCard } from './homeCards.js'

describe('Editar Inicio (poda P3)', () => {
  it('las tres tarjetas opcionales vienen apagadas', () => {
    for (const id of HOME_CARDS) expect(homeCardOn({}, id)).toBe(false)
  })
  it('encender una no toca las otras', () => {
    const patch = toggleHomeCard({}, 'networth')
    expect(patch).toEqual({ homeCards: { donut: false, networth: true, projection: false } })
    expect(toggleHomeCard(patch, 'networth').homeCards.networth).toBe(false)
  })
})
