// REC-N5: Movimientos e Ingresos arman sus filas con TxRow (una mejora de la
// fila llega a las dos listas). TxRow acepta nodos en name/meta y usa `label`
// para los aria-label de editar y borrar.
import { describe, it, expect, vi } from 'vitest'
import { createElement as h, Fragment } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

vi.mock('../../i18n/useT.js', async () => {
  const { translate } = await import('../../i18n/translate.js')
  const useT = () => ({ t: (key, vars) => translate('es', key, vars), lang: 'es' })
  return { useT, useTFor: useT }
})
vi.mock('../Money.jsx', () => ({ default: ({ children }) => children, useMoney: () => ({ m: (x) => x }) }))
const { TxRow } = await import('./index.jsx')
const { translate } = await import('../../i18n/translate.js')

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

describe('TxRow (REC-N5)', () => {
  it('con un nodo como nombre, los botones usan `label` en el aria-label', () => {
    const html = renderToStaticMarkup(h(TxRow, {
      dot: 'var(--th)', name: h(Fragment, null, h('svg', { 'aria-hidden': 'true' }), 'Café'), label: 'Café',
      meta: 'Comida · 10-03', amount: '$ 2.500', onEdit() {}, onDelete() {},
    }))
    expect(html).toContain(`aria-label="${translate('es', 'ui.editItem', { name: 'Café' })}"`)
    expect(html).toContain(`aria-label="${translate('es', 'ui.deleteItem', { name: 'Café' })}"`)
    expect(html).toContain('-$ 2.500')
    expect(html).not.toContain('[object Object]')
  })

  it('Movimientos e Ingresos usan TxRow para las filas, sin emoji en el nombre', () => {
    const mov = readFileSync(join(SRC, 'pages/Movements/index.jsx'), 'utf8')
    const inc = readFileSync(join(SRC, 'pages/Income/index.jsx'), 'utf8')
    expect(mov).toMatch(/<TxRow key=\{e\.id\}/)
    expect(inc).toMatch(/<TxRow key=\{r\.id\}/)
    expect(inc).not.toContain('💼')
  })
})
