import { describe, it, expect } from 'vitest'
import { moduleOn, newAccountModules, setModule, modulesOff } from './modules.js'

describe('módulos que se activan (poda P3)', () => {
  it('una cuenta existente (sin `modules`) tiene todo encendido', () => {
    expect(moduleOn({}, 'properties')).toBe(true)
    expect(moduleOn({ country: 'CL' }, 'advisor')).toBe(true)
    expect(moduleOn(undefined, 'advisor')).toBe(true)
    expect(modulesOff({})).toEqual([])
  })

  it('una cuenta nueva: Modo asesor apagado y Propiedades según la respuesta', () => {
    expect(newAccountModules()).toEqual({ properties: false, advisor: false })
    expect(newAccountModules({ hasProperties: true })).toEqual({ properties: true, advisor: false })
    const s = { modules: newAccountModules() }
    expect(moduleOn(s, 'properties')).toBe(false)
    expect(modulesOff(s)).toEqual(['properties', 'advisor'])
  })

  it('tocar un módulo en una cuenta vieja no apaga los demás', () => {
    expect(setModule({}, 'advisor', false)).toEqual({ modules: { properties: true, advisor: false } })
    expect(setModule({ modules: { properties: false, advisor: false } }, 'properties', true))
      .toEqual({ modules: { properties: true, advisor: false } })
  })
})
