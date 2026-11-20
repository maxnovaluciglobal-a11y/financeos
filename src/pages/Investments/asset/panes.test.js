// Indicadores: una falla de carga de la historia no se confunde con falta de
// datos (revisión F3): avisa del error y ofrece Reintentar.
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { IndicatorsPane } from './Panes.jsx'
import es from './strings.es.js'
import { interpolate } from '../../../i18n/translate.js'

const html = (props) => renderToStaticMarkup(createElement(IndicatorsPane, { ticker: 'AAPL', ccy: 'USD', score: null, ...props }))
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

describe('IndicatorsPane', () => {
  it('error de carga: aviso de error y botón Reintentar', () => {
    const out = html({ phase: 'error', onRetry: () => {} })
    expect(out).toContain(esc(interpolate(es['asset.ind.error'], { t: 'AAPL' })))
    expect(out).toContain(`>${es['asset.retry']}</button>`)
    expect(out).not.toContain(esc(interpolate(es['asset.ind.none'], { t: 'AAPL' })))
  })
  it('sin historia suficiente (carga correcta): el aviso de falta de datos, sin Reintentar', () => {
    const out = html({ phase: 'ready' })
    expect(out).toContain(esc(interpolate(es['asset.ind.none'], { t: 'AAPL' })))
    expect(out).not.toContain('<button')
  })
  it('cargando: estado de carga', () => {
    expect(html({ phase: 'loading' })).toContain(es['asset.ind.loading'])
  })
})
