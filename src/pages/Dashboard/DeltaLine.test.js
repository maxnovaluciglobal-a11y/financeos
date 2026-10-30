import { describe, it, expect } from 'vitest'
import { deltaAmountText } from './DeltaLine.jsx'

describe('deltaAmountText (ola A1)', () => {
  it('signo + para subir y U+2212 para bajar', () => {
    expect(deltaAmountText(53141, 'Bs.')).toMatch(/^\+Bs\./)
    expect(deltaAmountText(-150, '$')).toMatch(/^−\$/)
  })
  it('cero sin signo', () => {
    expect(deltaAmountText(0, '$')).toMatch(/^\$/)
  })
})
