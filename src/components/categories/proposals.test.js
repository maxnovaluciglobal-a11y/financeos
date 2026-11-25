// "moyiq propone": los grupos se calculan una vez por combinación de datos y
// "Ahora no" lo ven todas las instancias (incluido el contador del chip).
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

let app = {}
vi.mock('../../context/AppContext.jsx', () => ({ useApp: () => app }))
vi.mock('../../i18n/useT.js', () => ({ useT: () => ({ t: (k) => k, lang: 'es' }) }))
const store = new Map()
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }

const { proposalsFor, useProposals, dismissProposal, dismissId, DISMISS_KEY } = await import('./Proposals.jsx')

const exp = (id, description, category = 'Importado', extra = {}) => ({ id, description, category, date: '2026-11-20', amount: 10, ...extra })
const expenses = [exp('h1', 'Rappi cena', 'Comida'), exp('h2', 'RAPPI almuerzo', 'Comida'), exp('o1', 'RAPPI*1'), exp('o2', 'Rappi pedido'), exp('o3', 'rappi')]

describe('propuestas compartidas', () => {
  it('mismos datos = mismo resultado, sin recalcular', () => {
    const incomes = []
    const settings = {}
    const a = proposalsFor(incomes, expenses, settings)
    expect(a).toHaveLength(1)
    expect(proposalsFor(incomes, expenses, settings)).toBe(a)
    expect(proposalsFor(incomes, [...expenses], settings)).not.toBe(a)
  })

  it('"Ahora no" se guarda y lo ven todas las instancias', () => {
    app = { incomes: [], expenses, settings: {} }
    const Count = () => createElement('span', null, String(useProposals().groups.length))
    expect(renderToStaticMarkup(createElement(Count))).toBe('<span>1</span>')
    const [g] = proposalsFor(app.incomes, app.expenses, app.settings)
    dismissProposal(g)
    expect(JSON.parse(store.get(DISMISS_KEY))).toEqual([dismissId(g)])
    expect(renderToStaticMarkup(createElement(Count))).toBe('<span>0</span>')
  })
})
