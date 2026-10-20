// PRD-4: sin Pro, ProGate muestra la tarjeta y debajo una vista previa
// desenfocada e inerte de la herramienta; en el demo, una franja "Función Pro".
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

let plan = { isPro: false }
vi.mock('../../hooks/usePlan.js', () => ({ usePlan: () => plan }))
vi.mock('../../hooks/useAccount.js', () => ({ useAccount: () => null }))
vi.mock('../../i18n/useT.js', async () => {
  const { translate } = await import('../../i18n/translate.js')
  const useT = () => ({ t: (key, vars) => translate('es', key, vars), lang: 'es' })
  return { useT, useTFor: useT }
})
const { default: ProGate } = await import('./ProGate.jsx')
const { translate } = await import('../../i18n/translate.js')

const tool = createElement('div', { id: 'tool' }, 'RESULTADO 123')
const render = (props = {}) => renderToStaticMarkup(createElement(ProGate, { featureKey: 'nav.advisorMode', ...props }, tool))

describe('ProGate (PRD-4)', () => {
  beforeEach(() => { plan = { isPro: false }; globalThis.window = { location: { search: '' } } })

  it('sin Pro: tarjeta con la explicación y la herramienta como vista previa inerte y desenfocada', () => {
    const html = render()
    expect(html).toContain(translate('es', 'pro.gate.previewNote', { days: 14 }))
    expect(html).toMatch(/<div inert="" data-pro-preview=""[^>]*filter:blur\(4px\)[^>]*><div id="tool">RESULTADO 123<\/div><\/div>/)
    expect(html.indexOf('pro.gate') === -1).toBe(true)
  })

  it('preview={false}: solo la tarjeta', () => {
    const html = render({ preview: false })
    expect(html).not.toContain('RESULTADO 123')
    expect(html).not.toContain(translate('es', 'pro.gate.previewNote', { days: 14 }))
  })

  it('con Pro: la herramienta tal cual; en el demo, con la franja de Pro', () => {
    plan = { isPro: true }
    expect(render()).toBe('<div id="tool">RESULTADO 123</div>')
    globalThis.window = { location: { search: '?demo=true' } }
    const demo = render()
    expect(demo).toContain(translate('es', 'pro.demo.strip', { days: 14 }))
    expect(demo).toContain('RESULTADO 123')
  })
})
