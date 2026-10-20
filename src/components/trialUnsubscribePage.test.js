// La página de baja (?unsub=trial) se monta fuera de AppProvider: un hook que
// dependa del contexto la rompía en producción (20-oct-2026). Se renderiza sin
// provider y tiene que salir el botón.
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import TrialUnsubscribe from './TrialUnsubscribe.jsx'

describe('TrialUnsubscribe sin AppProvider (C-35)', () => {
  it('renderiza sin contexto', () => {
    const html = renderToStaticMarkup(createElement(TrialUnsubscribe, { id: '0b6f1c2e-3d4a-4b5c-8d9e-0f1a2b3c4d5e' }))
    expect(html).toContain('<button')
    expect(html).toContain('unsub-title')
  })
})
