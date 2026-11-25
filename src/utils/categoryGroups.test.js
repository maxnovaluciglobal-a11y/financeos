import { describe, it, expect } from 'vitest'
import { proposeGroups, applyGroup, merchantKey, historyIndex, topChoice } from './categoryGroups.js'

const exp = (id, description, category = 'Importado', extra = {}) => ({ id, description, category, date: '2026-11-20', amount: 10, ...extra })

describe('merchantKey', () => {
  it('primera palabra significativa del detalle', () => {
    expect(merchantKey({ description: 'COMPRA RAPPI*COL 123' })).toBe('rappi')
    expect(merchantKey({ description: '1234' })).toBe('')
  })
})

describe('topChoice', () => {
  it('la más usada, con al menos 2 y sin empate', () => {
    expect(topChoice({ Comida: 3, Otros: 1 })).toBe('Comida')
    expect(topChoice({ Comida: 1 })).toBeNull()
    expect(topChoice({ Comida: 2, Otros: 2 })).toBeNull()
  })
})

describe('proposeGroups', () => {
  const reviewed = [exp('h1', 'Rappi cena', 'Comida'), exp('h2', 'RAPPI almuerzo', 'Comida'), exp('h3', 'Rappi', 'Otros')]
  const open3 = [exp('o1', 'RAPPI*1'), exp('o2', 'Rappi pedido', 'Otros', { needsReview: true }), exp('o3', 'rappi')]

  it('lo que la persona ya eligió: "estos 3 parecen de Comida"', () => {
    const [g] = proposeGroups({ expenses: [...reviewed, ...open3] })
    expect(g).toMatchObject({ kind: 'expense', key: 'rappi', category: 'Comida', reason: 'history' })
    expect(g.items.map(x => x.rec.id)).toEqual(['o1', 'o2', 'o3'])
  })

  it('una regla manda sobre el historial', () => {
    const [g] = proposeGroups({ expenses: [...reviewed, ...open3] }, { rules: [{ match: 'rappi', category: 'Delivery', kind: 'expense' }] })
    expect(g).toMatchObject({ category: 'Delivery', reason: 'rule' })
  })

  it('lo aprendido en el alta rápida si no hay historial', () => {
    const [g] = proposeGroups({ expenses: open3 }, { merchantRules: { 'rappi pedido': 'Comida' } })
    expect(g).toMatchObject({ category: 'Comida', reason: 'learned' })
  })

  it('sin pista de categoría, igual agrupa el mismo comercio y pregunta', () => {
    const [g] = proposeGroups({ expenses: open3 })
    expect(g).toMatchObject({ category: null, reason: 'merchant' })
    expect(g.items).toHaveLength(3)
  })

  it('un solo movimiento no forma grupo; revisados, inversión y apartados no entran', () => {
    const data = { expenses: [exp('a', 'Cine'), exp('b', 'Cine', 'Entretención'), exp('c', 'Cine', 'Importado', { inv: true }), exp('d', 'Cine', 'Importado', { kind: 'setAside' })] }
    expect(proposeGroups(data)).toEqual([])
  })

  it('categoría fuera de las permitidas no se propone', () => {
    const [g] = proposeGroups({ expenses: [...reviewed, ...open3] }, { allowedFor: () => ['Otros'] })
    expect(g.category).toBeNull()
  })

  it('ingresos y gastos van en grupos distintos; orden determinista por tamaño', () => {
    const data = {
      expenses: [...open3, exp('x1', 'Netflix'), exp('x2', 'NETFLIX.COM')],
      incomes: [{ id: 'i1', source: 'Rappi reembolso', category: '', date: '2026-11-01' }, { id: 'i2', description: 'Rappi', source: 'csv', category: 'Importado', date: '2026-11-02' }],
    }
    const out = proposeGroups(data)
    expect(out.map(g => `${g.kind}:${g.key}:${g.items.length}`)).toEqual(['expense:rappi:3', 'expense:netflix:2', 'income:rappi:2'])
    expect(proposeGroups(data)).toEqual(out)
  })

  it('historyIndex ignora lo abierto', () => {
    const idx = historyIndex({ expenses: [...reviewed, ...open3] })
    expect(idx.get('expense|rappi')).toEqual({ Comida: 2, Otros: 1 })
  })
})

describe('applyGroup', () => {
  it('categoriza, quita el flag y guarda los originales para deshacer', () => {
    const group = { items: [{ kind: 'expense', rec: exp('o1', 'Rappi', 'Importado', { needsReview: true, categorySuggested: true }) }] }
    const { next, prev } = applyGroup(group, 'Comida')
    expect(next[0].rec).toMatchObject({ id: 'o1', category: 'Comida' })
    expect(next[0].rec.needsReview).toBeUndefined()
    expect(next[0].rec.categorySuggested).toBeUndefined()
    expect(prev[0].rec.needsReview).toBe(true)
  })
})
