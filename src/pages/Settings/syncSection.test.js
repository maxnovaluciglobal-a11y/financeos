import { describe, it, expect } from 'vitest'
import { passphraseProblem } from './SyncSection.jsx'

describe('formulario de la frase de paso (C-21)', () => {
  it('pide 10+ caracteres y que la confirmación coincida al crearla', () => {
    expect(passphraseProblem('corta', 'corta', true)).toBe('syncPass.errShort')
    expect(passphraseProblem('una frase larga', 'otra frase larga', true)).toBe('syncPass.errMismatch')
    expect(passphraseProblem('una frase larga', 'una frase larga', true)).toBeNull()
    expect(passphraseProblem('una frase larga', '', false)).toBeNull()
  })
})
