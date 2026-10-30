// <ChoiceGroup> (N4): radiogroup del patrón APG para Sistema · Claro · Oscuro.
import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../../i18n/useT.js', () => {
  const useT = () => ({ t: (k) => k, lang: 'es' })
  return { useT, useTFor: useT }
})
const { ChoiceGroup } = await import('./index.jsx')

const options = [
  { value: 'system', label: 'Sistema', preview: 'system' },
  { value: 'light', label: 'Claro', preview: 'light' },
  { value: 'dark', label: 'Oscuro', preview: 'dark' },
]

describe('ChoiceGroup', () => {
  it('expone radiogroup con nombre y un radio marcado', () => {
    const html = renderToStaticMarkup(h(ChoiceGroup, { value: 'light', onChange: () => {}, options, labelledBy: 'lbl' }))
    expect(html).toContain('role="radiogroup"')
    expect(html).toContain('aria-labelledby="lbl"')
    expect(html.match(/role="radio"/g)).toHaveLength(3)
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1)
    // Una sola parada de Tab: la opción elegida.
    expect(html.match(/tabindex="0"/g)).toHaveLength(1)
    expect(html).toMatch(/aria-checked="true" tabindex="0"[^>]*>(?:<span[^>]*><\/span>)?<span>Claro<\/span>/)
  })

  it('sin valor reconocido la primera opción recibe el foco y ninguna queda marcada', () => {
    const html = renderToStaticMarkup(h(ChoiceGroup, { value: 'sepia', onChange: () => {}, options, label: 'Tema' }))
    expect(html).toContain('aria-label="Tema"')
    expect(html).not.toContain('aria-checked="true"')
    expect(html.match(/tabindex="0"/g)).toHaveLength(1)
  })
})
