import { describe, it, expect } from 'vitest'
import { secretEquals } from './secretEquals.ts'

describe('secretEquals', () => {
  it('acepta solo el mismo secreto', () => {
    expect(secretEquals('abc123', 'abc123')).toBe(true)
    expect(secretEquals('abc124', 'abc123')).toBe(false)
    expect(secretEquals('abc12', 'abc123')).toBe(false)
    expect(secretEquals('abc1234', 'abc123')).toBe(false)
    expect(secretEquals('', 'abc123')).toBe(false)
  })
  it('sin secreto configurado o sin cabecera, rechaza', () => {
    expect(secretEquals('x', undefined)).toBe(false)
    expect(secretEquals('', '')).toBe(false)
    expect(secretEquals(null, 'abc')).toBe(false)
    expect(secretEquals(undefined, 'abc')).toBe(false)
  })
  it('compara bytes, no unidades UTF-16', () => {
    expect(secretEquals('ñandú', 'ñandú')).toBe(true)
    expect(secretEquals('nandu', 'ñandú')).toBe(false)
  })
})
