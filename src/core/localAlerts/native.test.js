// Avisos locales en la app de tienda: lo "inmediato" no se pierde al
// reprogramar enseguida, y solo se tocan las notificaciones de moyiq.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const plugin = { getPending: vi.fn(), cancel: vi.fn(), schedule: vi.fn(), createChannel: vi.fn() }
vi.mock('@capacitor/core', () => ({ registerPlugin: () => plugin }))
vi.mock('./primer.js', () => ({ localAlertsSupported: () => true }))
const logged = []
vi.mock('../../utils/errorLog.js', () => ({ logRejection: (src) => (err) => logged.push([src, String(err?.message || err)]) }))

const { scheduleLocal, KEEP_SOON_MS } = await import('./native.js')
const { withFireTimes, withRecorded, planLocalAlerts, MIN_DELAY_MS } = await import('./plan.js')

const NOW = new Date(2026, 10, 10, 10, 30).getTime()
const pend = (id, at, extra) => ({ id, schedule: { at: new Date(at).toISOString() }, extra })

beforeEach(() => {
  for (const f of Object.values(plugin)) f.mockReset()
  plugin.cancel.mockResolvedValue()
  plugin.schedule.mockResolvedValue()
  logged.length = 0
})

describe('scheduleLocal', () => {
  it('devuelve la hora real de entrega (al menos ahora + 2 s) para el ledger', async () => {
    plugin.getPending.mockResolvedValue({ notifications: [] })
    const r = await scheduleLocal([{ id: 1, at: NOW - 5000, title: 'a', body: 'b', key: 'k1' }], { now: NOW })
    expect(r.ok).toBe(true)
    expect(r.scheduled[0].at).toBe(NOW + MIN_DELAY_MS)
    expect(plugin.schedule.mock.calls[0][0].notifications[0].schedule.at.getTime()).toBe(NOW + MIN_DELAY_MS)
  })

  it('no cancela lo que está por salir en segundos ni lo vuelve a programar', async () => {
    plugin.getPending.mockResolvedValue({ notifications: [
      pend(1, NOW + 1500, { src: 'moyiq-local', key: 'k1' }),
      pend(2, NOW + 3600_000, { src: 'moyiq-local', key: 'k2' }),
      pend(3, NOW + 3600_000, { src: 'otra-app' }),
      pend(4, NOW + 3600_000),
    ] })
    const items = [{ id: 1, at: NOW + 1500, key: 'k1' }, { id: 2, at: NOW + 3600_000, key: 'k2' }]
    const r = await scheduleLocal(items, { now: NOW })
    // Solo se cancela la de moyiq que no sale ya; las ajenas o sin marca no se tocan.
    expect(plugin.cancel).toHaveBeenCalledWith({ notifications: [{ id: 2 }] })
    expect(r.scheduled.map(x => x.id)).toEqual([2])
    expect(KEEP_SOON_MS).toBeGreaterThan(MIN_DELAY_MS)
  })

  it('reprogramar en los 2 s siguientes no pierde el aviso inmediato', async () => {
    const budgets = [{ category: 'Comida', limit: 100 }]
    const expenses = [{ id: 'e', date: '2026-11-05', category: 'Comida', amount: 95 }]
    const first = planLocalAlerts({ budgets, expenses, now: NOW, ledger: {} })
    expect(first.alerts.map(a => a.key)).toContain('budget:Comida:2026-11')
    plugin.getPending.mockResolvedValue({ notifications: [] })
    const r1 = await scheduleLocal(withFireTimes(first.alerts, NOW), { now: NOW })
    const ledger = withRecorded({}, r1.scheduled, NOW)
    // 1 s después (todavía no salió): sigue pendiente para el plan y no se cancela.
    const later = NOW + 1000
    const again = planLocalAlerts({ budgets, expenses, now: later, ledger })
    expect(again.alerts.map(a => a.key)).toContain('budget:Comida:2026-11')
    const id = first.alerts.find(a => a.type === 'budget').id
    plugin.getPending.mockResolvedValue({ notifications: [pend(id, NOW + MIN_DELAY_MS, { src: 'moyiq-local' })] })
    plugin.cancel.mockClear()
    await scheduleLocal(withFireTimes(again.alerts, later), { now: later })
    expect(plugin.cancel).not.toHaveBeenCalled()
  })

  it('si schedule() falla: { ok: false } y queda registrado', async () => {
    plugin.getPending.mockResolvedValue({ notifications: [] })
    plugin.schedule.mockRejectedValue(new Error('boom'))
    const r = await scheduleLocal([{ id: 1, at: NOW + 60_000, key: 'k' }], { now: NOW })
    expect(r).toMatchObject({ ok: false, error: 'failed', scheduled: [] })
    expect(logged).toEqual([['localAlerts:schedule', 'boom']])
  })
})
