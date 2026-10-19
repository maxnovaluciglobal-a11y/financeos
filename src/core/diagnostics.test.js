import { describe, it, expect, vi } from 'vitest'
import { buildDiagnostics, copyDiagnostics } from './diagnostics.js'

const now = new Date('2026-10-19T12:00:00Z')

describe('registro de errores para soporte (D-16 / ING-4)', () => {
  it('incluye versión, idioma y los errores sin montos', () => {
    const txt = buildDiagnostics({
      entries: [{ at: 't1', type: 'render', message: 'No se pudo leer 1.250.000 en Comida', source: 'Dashboard' }],
      version: '1.5.0', lang: 'es', userAgent: 'UA', now,
    })
    expect(txt).toContain('MOY IQ 1.5.0')
    expect(txt).toContain('lang: es')
    expect(txt).toContain('errors: 1')
    expect(txt).toContain('t1 | render | No se pudo leer # en Comida | Dashboard')
    expect(txt).not.toContain('1.250.000')
  })
  it('sin errores devuelve solo la cabecera', () => {
    const txt = buildDiagnostics({ entries: [], version: '1.5.0', lang: 'en', userAgent: 'UA', now })
    expect(txt.split('\n')).toHaveLength(5)
    expect(txt).toContain('errors: 0')
  })
  it('copia al portapapeles y no rompe si no hay permiso', async () => {
    const writeText = vi.fn(async () => {})
    expect(await copyDiagnostics('x', { writeText })).toBe(true)
    expect(writeText).toHaveBeenCalledWith('x')
    expect(await copyDiagnostics('x', { writeText: async () => { throw new Error('denied') } })).toBe(false)
    expect(await copyDiagnostics('x', undefined)).toBe(false)
  })
})
