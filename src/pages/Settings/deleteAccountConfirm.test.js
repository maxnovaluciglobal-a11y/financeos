import { describe, it, expect } from 'vitest'
import { confirmMatches } from './DeleteAccountSection.jsx'

describe('confirmación del borrado de cuenta (C-22)', () => {
  it('acepta la palabra exacta sin importar mayúsculas ni espacios', () => {
    expect(confirmMatches('ELIMINAR', 'ELIMINAR')).toBe(true)
    expect(confirmMatches('  eliminar ', 'ELIMINAR')).toBe(true)
    expect(confirmMatches('löschen', 'LÖSCHEN')).toBe(true)
  })
  it('rechaza vacío, parcial u otra palabra', () => {
    for (const t of ['', 'ELIMINA', 'ELIMINAR YA', 'DELETE', null, undefined]) expect(confirmMatches(t, 'ELIMINAR')).toBe(false)
  })
})
