import { describe, it, expect } from 'vitest'
import { decideUptime, initialState, uptimeEmail, describeCheck, type UptimeCheck, type UptimeState } from './uptimeState.ts'

const T0 = Date.parse('2026-10-19T12:00:00Z')
let nextId = 1
function chk(ok: boolean, minutesAgo = 0, extra: Partial<UptimeCheck> = {}): UptimeCheck {
  return { id: nextId++, requested_at: new Date(T0 - minutesAgo * 60000).toISOString(), ok, status_code: ok ? 200 : 503, timed_out: false, marker_found: ok, error_msg: null, ...extra }
}
// Los chequeos se crean del más viejo al más nuevo y se pasan del más nuevo al más viejo.
function seq(...oks: boolean[]): UptimeCheck[] {
  return oks.map((ok, i) => chk(ok, (oks.length - 1 - i) * 5)).reverse()
}
const at = (min: number) => new Date(T0 + min * 60000)

describe('decideUptime', () => {
  it('una sola falla no avisa', () => {
    const d = decideUptime(null, 'app', seq(true, false), at(0))
    expect(d.action).toBeNull()
    expect(d.state.status).toBe('up')
    expect(d.state.consecutive_failures).toBe(1)
  })

  it('dos fallas seguidas: un aviso de caída con la hora de la primera falla', () => {
    const checks = seq(true, false, false)
    const d = decideUptime(null, 'app', checks, at(0))
    expect(d.action).toBe('down')
    expect(d.state.status).toBe('down')
    expect(d.state.down_since).toBe(checks[1].requested_at)
    expect(d.state.last_alert_at).toBe(at(0).toISOString())
  })

  it('una falla, un éxito y otra falla no cuentan como seguidas', () => {
    expect(decideUptime(null, 'app', seq(false, true, false), at(0)).action).toBeNull()
  })

  it('caído y sigue fallando: sin correos hasta 6 h después del último aviso', () => {
    const down: UptimeState = { ...initialState('app'), status: 'down', consecutive_failures: 2, down_since: at(-10).toISOString(), last_alert_at: at(-5).toISOString(), last_check_id: 0 }
    expect(decideUptime(down, 'app', seq(false, false, false), at(0)).action).toBeNull()
    const later = decideUptime(down, 'app', seq(false, false, false), at(6 * 60 - 6))
    expect(later.action).toBeNull()
    const reminder = decideUptime(down, 'app', seq(false, false, false), at(6 * 60 - 5))
    expect(reminder.action).toBe('reminder')
    expect(reminder.state.last_alert_at).toBe(at(6 * 60 - 5).toISOString())
    expect(reminder.state.status).toBe('down')
  })

  it('caído y vuelve: un aviso de recuperación y estado arriba', () => {
    const down: UptimeState = { ...initialState('app'), status: 'down', consecutive_failures: 3, down_since: at(-20).toISOString(), last_alert_at: at(-10).toISOString(), last_check_id: 0 }
    const d = decideUptime(down, 'app', seq(false, false, true), at(0))
    expect(d.action).toBe('recovery')
    expect(d.state.status).toBe('up')
    expect(d.state.down_since).toBeNull()
    expect(d.state.consecutive_failures).toBe(0)
  })

  it('arriba y sin chequeos nuevos: no hace nada (no repite avisos)', () => {
    const checks = seq(false, false)
    const first = decideUptime(null, 'app', checks, at(0))
    expect(first.action).toBe('down')
    const again = decideUptime({ ...first.state, status: 'up' }, 'app', checks, at(1))
    expect(again.action).toBeNull()
    expect(again.changed).toBe(false)
  })

  it('caído: no vuelve a mandar el aviso de caída en cada corrida', () => {
    const first = decideUptime(null, 'app', seq(false, false), at(0))
    const second = decideUptime(first.state, 'app', seq(false, false, false), at(5))
    expect(second.action).toBeNull()
    expect(second.state.status).toBe('down')
  })

  it('sin chequeos: no hace nada', () => {
    const d = decideUptime(null, 'app', [], at(0))
    expect(d.action).toBeNull()
    expect(d.changed).toBe(false)
  })

  it('el estado de recuperación no se repite', () => {
    const down: UptimeState = { ...initialState('app'), status: 'down', consecutive_failures: 2, down_since: at(-20).toISOString(), last_alert_at: at(-10).toISOString(), last_check_id: 0 }
    const checks = seq(false, true)
    const rec = decideUptime(down, 'app', checks, at(0))
    expect(rec.action).toBe('recovery')
    expect(decideUptime(rec.state, 'app', checks, at(5)).action).toBeNull()
  })
})

describe('correos de uptime', () => {
  it('asunto de caída con el sitio, y texto con URL y causa', () => {
    const checks = seq(false, false)
    const d = decideUptime(null, 'app.moyiq.app', checks, at(0))
    const m = uptimeEmail('down', 'app.moyiq.app', 'https://app.moyiq.app/app/', d.state, checks[0], at(0))
    expect(m.subject).toBe('[MOY IQ] caída: app.moyiq.app')
    expect(m.text).toContain('https://app.moyiq.app/app/')
    expect(m.text).toContain('HTTP 503')
    expect(m.text).toContain('docs/monitoreo.md')
  })
  it('asuntos de recordatorio y recuperación', () => {
    const s = { ...initialState('moyiq.app'), status: 'down' as const, down_since: at(-400).toISOString() }
    expect(uptimeEmail('reminder', 'moyiq.app', 'u', s, undefined, at(0)).subject).toBe('[MOY IQ] sigue caído: moyiq.app')
    expect(uptimeEmail('recovery', 'moyiq.app', 'u', s, undefined, at(0)).subject).toBe('[MOY IQ] recuperado: moyiq.app')
  })
  it('describe la causa del chequeo', () => {
    expect(describeCheck(chk(false, 0, { status_code: 200, marker_found: false }))).toContain('contenido esperado')
    expect(describeCheck(chk(false, 0, { status_code: null, timed_out: true, error_msg: 'Timeout was reached' }))).toContain('timeout')
    expect(describeCheck(chk(false, 0, { status_code: null, error_msg: "Couldn't resolve host name" }))).toContain('error de red')
  })
})
