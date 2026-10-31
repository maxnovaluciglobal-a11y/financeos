import { describe, it, expect } from 'vitest'
import { moduleOn, newAccountModules, setModule, modulesOff, promptableModulesOff } from './modules.js'

describe('módulos que se activan (poda P3)', () => {
  it('una cuenta existente (sin `modules`) conserva Propiedades y Modo asesor', () => {
    expect(moduleOn({}, 'properties')).toBe(true)
    expect(moduleOn({ country: 'CL' }, 'advisor')).toBe(true)
    expect(moduleOn(undefined, 'advisor')).toBe(true)
    expect(modulesOff({})).toEqual(['investments'])
    expect(promptableModulesOff({})).toEqual([])
  })

  it('Inversiones está apagado por defecto en toda cuenta, vieja o nueva', () => {
    expect(moduleOn(undefined, 'investments')).toBe(false)
    expect(moduleOn({}, 'investments')).toBe(false)
    // Cuenta que ya tenía `modules` de antes de este módulo: la clave no existe.
    expect(moduleOn({ modules: { properties: true, advisor: true } }, 'investments')).toBe(false)
    expect(moduleOn({ modules: newAccountModules({ hasProperties: true }) }, 'investments')).toBe(false)
    expect(moduleOn({ modules: { investments: true } }, 'investments')).toBe(true)
  })

  it('un módulo ausente de `modules` no cambia lo que hacían Propiedades y Modo asesor', () => {
    expect(moduleOn({ modules: { investments: true } }, 'properties')).toBe(true)
    expect(moduleOn({ modules: { investments: true } }, 'advisor')).toBe(true)
  })

  it('una cuenta nueva: Modo asesor apagado y Propiedades según la respuesta', () => {
    expect(newAccountModules()).toEqual({ properties: false, advisor: false, investments: false })
    expect(newAccountModules({ hasProperties: true })).toEqual({ properties: true, advisor: false, investments: false })
    const s = { modules: newAccountModules() }
    expect(moduleOn(s, 'properties')).toBe(false)
    expect(modulesOff(s)).toEqual(['properties', 'advisor', 'investments'])
    expect(promptableModulesOff(s)).toEqual(['properties', 'advisor'])
  })

  it('tocar un módulo en una cuenta vieja no apaga los demás', () => {
    expect(setModule({}, 'advisor', false)).toEqual({ modules: { properties: true, advisor: false, investments: false } })
    expect(setModule({ modules: { properties: false, advisor: false } }, 'properties', true))
      .toEqual({ modules: { properties: true, advisor: false, investments: false } })
    expect(setModule({}, 'investments', true)).toEqual({ modules: { properties: true, advisor: true, investments: true } })
  })
})
