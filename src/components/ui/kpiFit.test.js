import { describe, it, expect } from 'vitest'
import { kpiFit } from './index.jsx'

describe('kpiFit (montos largos en una línea)', () => {
  it('no toca montos cortos ni valores no textuales', () => {
    expect(kpiFit('$1,950.65')).toBeUndefined()
    expect(kpiFit(3)).toBeUndefined()
    expect(kpiFit(null)).toBeUndefined()
  })
  it('achica la fuente según el largo, sin partir la cifra', () => {
    expect(kpiFit('Bs.250.000,00')).toEqual({ fontSize: 18, whiteSpace: 'nowrap' })
    expect(kpiFit('Bs.16.700.000,00')).toEqual({ fontSize: 15, whiteSpace: 'nowrap' })
    expect(kpiFit('Bs.167.000.000,00')).toEqual({ fontSize: 13, whiteSpace: 'nowrap' })
  })
})
