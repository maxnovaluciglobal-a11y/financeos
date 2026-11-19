import { describe, it, expect } from 'vitest'
import { answersComplete, buildProfile, investAccessState, profileComplete, PROFILE_VERSION } from './investProfile.js'

const ok = { experience: 'some', horizon: 'long', risk: 'medium' }
const user = (meta) => ({ id: 'u1', user_metadata: meta })

describe('perfil de inversionista', () => {
  it('pide las tres respuestas válidas', () => {
    expect(answersComplete(ok)).toBe(true)
    expect(answersComplete({ ...ok, risk: 'extreme' })).toBe(false)
    expect(answersComplete({ experience: 'some', horizon: 'long' })).toBe(false)
  })
  it('buildProfile guarda versión y fecha de aceptación', () => {
    const p = buildProfile(ok, new Date('2026-11-19T12:00:00Z'))
    expect(p).toEqual({ v: PROFILE_VERSION, ackAt: '2026-11-19T12:00:00.000Z', ...ok })
    expect(profileComplete(p)).toBe(true)
    expect(() => buildProfile({ experience: 'some' })).toThrow('profile_incomplete')
  })
  it('un perfil sin aviso aceptado o de otra versión no habilita', () => {
    expect(profileComplete({ v: PROFILE_VERSION, ...ok })).toBe(false)
    expect(profileComplete({ v: 0, ackAt: '2026-11-19T12:00:00Z', ...ok })).toBe(false)
    expect(profileComplete(null)).toBe(false)
  })
})

describe('acceso a Inversiones', () => {
  it('el demo siempre entra', () => {
    expect(investAccessState({ demo: true })).toBe('granted')
  })
  it('sin sesión no hay acceso', () => {
    expect(investAccessState({ sessionLoaded: false })).toBe('loading')
    expect(investAccessState({ user: null })).toBe('no-account')
  })
  it('con sesión, solo con el perfil completo', () => {
    expect(investAccessState({ user: user({}) })).toBe('needs-profile')
    expect(investAccessState({ user: user({ invest_profile: { v: PROFILE_VERSION, ...ok } }) })).toBe('needs-profile')
    expect(investAccessState({ user: user({ invest_profile: buildProfile(ok) }) })).toBe('granted')
  })
})
