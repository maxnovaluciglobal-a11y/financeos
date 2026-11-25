// "Por revisar" en el Inicio: render sin DOM (renderToStaticMarkup) con el
// contexto reemplazado, y "Confirmar los N" en una sola transacción.
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../../../i18n/useT.js', async () => {
  const { translate } = await import('../../../i18n/translate.js')
  const useT = () => ({ t: (key, vars) => translate('es', key, vars), lang: 'es' })
  return { useT, useTFor: useT }
})
let app = {}
vi.mock('../../../context/AppContext.jsx', async () => {
  const { createContext } = await import('react')
  return { useApp: () => app, AppContext: createContext(null) }
})

const { default: ReviewInbox } = await import('./ReviewInbox.jsx')
const { putMovements } = await import('./reviewBatch.js')

const render = (over = {}) => {
  app = { settings: {}, incomes: [], expenses: [], ...over }
  return renderToStaticMarkup(createElement(ReviewInbox, { sym: '$' }))
}
const exp = (id, extra = {}) => ({ id, amount: 1200, date: '2026-11-20', category: 'Comida', description: `Gasto ${id}`, needsReview: true, origin: 'applepay', ...extra })

describe('ReviewInbox', () => {
  it('sin pendientes no muestra nada (ni región en vivo propia: el aviso es el toast)', () => {
    const html = render({ expenses: [{ id: 'a', amount: 5, date: '2026-11-01', category: 'Comida' }] })
    expect(html).toBe('')
  })

  it('muestra hasta 3 filas y el conteo como texto para lector de pantalla', () => {
    const html = render({ expenses: ['a', 'b', 'c', 'd'].map(id => exp(id)) })
    expect(html).toContain('Por revisar')
    expect(html).toContain('<span class="sr-only">4 movimientos por revisar</span>')
    expect(html).not.toMatch(/<span[^>]*aria-label="4 movimientos/)
    expect((html.match(/aria-describedby=/g) || []).length).toBe(3)
    expect(html).not.toContain('aria-live')
  })

  it('el botón de la fila describe origen y monto (aria-describedby apunta a ids que existen)', () => {
    const html = render({ expenses: [exp('a')] })
    const [, ids] = html.match(/aria-describedby="([^"]+)"/)
    for (const id of ids.split(' ')) expect(html).toContain(`id="${id}"`)
    expect(html).toContain('Apple Pay')
  })
})

describe('ReviewInbox con propuestas agrupadas', () => {
  it('"moyiq propone, tú confirmas" se ve dentro de Por revisar, sin región en vivo propia', async () => {
    const { translate } = await import('../../../i18n/translate.js')
    const uber = (id) => exp(id, { category: '', description: `Uber viaje ${id}`, origin: 'import' })
    const html = render({ expenses: [uber('u1'), uber('u2'), uber('u3')] })
    expect(html).toContain(translate('es', 'propose.title'))
    expect(html).toContain('Por revisar')
    expect(html).not.toContain('aria-live')
  })
})

describe('putMovements ("Confirmar los N")', () => {
  it('escribe todo en una sola transacción', async () => {
    const puts = []
    let txCount = 0
    const db = {
      transaction(stores, mode) {
        txCount++
        expect(mode).toBe('readwrite')
        expect([...stores].sort()).toEqual(['expenses', 'incomes'])
        return { objectStore: (name) => ({ put: async (r) => { puts.push([name, r.id]) } }), done: Promise.resolve() }
      },
    }
    await putMovements([
      { store: 'expenses', record: { id: 'e1' } },
      { store: 'incomes', record: { id: 'i1' } },
      { store: 'expenses', record: { id: 'e2' } },
    ], db)
    expect(txCount).toBe(1)
    expect(puts).toEqual([['expenses', 'e1'], ['incomes', 'i1'], ['expenses', 'e2']])
  })
})
