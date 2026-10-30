import { describe, it, expect } from 'vitest'
import { groupDonutSlices } from './CategoryDonut.jsx'

const s = (pairs) => pairs.map(([name, value]) => ({ name, value }))

describe('groupDonutSlices (ola A5, H9)', () => {
  it('sin exceso de categorías no agrupa y la "Otros" real queda como categoría', () => {
    const out = groupDonutSlices(s([['Vivienda', 50], ['Otros', 10]]), 6)
    expect(out).toHaveLength(2)
    expect(out.find(d => d.name === 'Otros').group).toBeUndefined()
  })
  it('con exceso, una sola entrada "Otros" que incluye la real', () => {
    const out = groupDonutSlices(s([['A', 100], ['Otros', 60], ['B', 50], ['C', 40], ['D', 30], ['E', 20], ['F', 10]]), 6)
    const otros = out.filter(d => d.name === 'Otros')
    expect(otros).toHaveLength(1)
    expect(otros[0]).toMatchObject({ group: true, value: 70 })
    expect(out).toHaveLength(6)
  })
})
