import { describe, it, expect } from 'vitest'
import { fuenteLabel, leadScore, todayQueue, ACTIVITY_TYPES } from './crmLogic.js'

const now = new Date('2026-10-19T12:00:00Z').getTime()

describe('panel CRM (C-46 / COM-8)', () => {
  it('una cuenta sin lead previo se muestra como "cuenta"', () => {
    expect(fuenteLabel({ fuente: null, cuenta_creada_en: '2026-10-01' })).toBe('cuenta')
    expect(fuenteLabel({ fuente: 'starter', cuenta_creada_en: '2026-10-01' })).toBe('starter')
    expect(fuenteLabel({ fuente: null })).toBe('—')
  })
  it('puntaje: cuenta, login reciente, opt-in y Pro', () => {
    expect(leadScore({}, now)).toBe(0)
    expect(leadScore({ plan: 'gratis' }, now)).toBe(30)
    expect(leadScore({ plan: 'gratis', ultimo_login: '2026-10-15T00:00:00Z', optin_confirmado: true }, now)).toBe(65)
    expect(leadScore({ plan: 'gratis', ultimo_login: '2026-09-01T00:00:00Z' }, now)).toBe(30)
    expect(leadScore({ plan: 'pro', ultimo_login: '2026-10-18T00:00:00Z', optin_confirmado: true }, now)).toBe(100)
  })
  it('vista Hoy: vencidas y de hoy, la más atrasada primero', () => {
    const rows = [
      { id: 1, proxima_accion: 'a', proxima_accion_fecha: '2026-10-19' },
      { id: 2, proxima_accion: 'b', proxima_accion_fecha: '2026-10-12' },
      { id: 3, proxima_accion: 'c', proxima_accion_fecha: '2026-10-25' },
      { id: 4, proxima_accion: null, proxima_accion_fecha: '2026-10-01' },
      { id: 5 },
    ]
    expect(todayQueue(rows, '2026-10-19').map(r => r.id)).toEqual([2, 1])
  })
  it('los tipos de actividad coinciden con el CHECK de la base', () => {
    expect(ACTIVITY_TYPES).toEqual(['nota', 'correo', 'llamada', 'mensaje', 'reunion'])
  })
})
