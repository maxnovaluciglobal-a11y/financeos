import { describe, it, expect } from 'vitest'
import { wordmarkVariant, PLATE_MIN_IQ_PX } from './Logo.jsx'

describe('placa IQ con tamaño mínimo (BRD-15)', () => {
  it('debajo de 10 px de "IQ" usa la variante compacta sin placa', () => {
    expect(PLATE_MIN_IQ_PX).toBe(10)
    expect(wordmarkVariant(22 * 0.62)).toBe('compact') // AuthGate / LicenseGate
    expect(wordmarkVariant(19 * 0.62)).toBe('compact') // nav
    expect(wordmarkVariant(14)).toBe('compact')        // onboarding
  })
  it('con espacio suficiente conserva la placa', () => {
    expect(wordmarkVariant(36 * 0.62)).toBe('plate')   // DemoGate
    expect(wordmarkVariant(18)).toBe('plate')
  })
})
