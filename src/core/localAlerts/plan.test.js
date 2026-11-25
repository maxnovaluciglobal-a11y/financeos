import { describe, it, expect } from 'vitest'
import {
  planLocalAlerts, nextAllowed, alertId, alertPrefs, dueNow, withRecorded, readLedger,
  DELIVER_HOUR, MAX_SCHEDULED, alertText, withFireTimes, MIN_DELAY_MS,
} from './plan.js'

const rule = (over = {}) => ({
  id: 'r1', kind: 'expense', source: 'manual', description: 'Arriendo', category: 'Vivienda',
  amountMode: 'fixed', amounts: [{ from: '2026-01', amount: 450000 }],
  schedule: { freq: 'monthly', day: 15, anchorDate: '2026-01-15' }, startDate: '2026-01-15',
  autoConfirm: false, paused: false, skipped: [], createdAt: '2026-01-01', ...over,
})
// Martes 10 de noviembre de 2026, 10:30 (hora local).
const NOW = new Date(2026, 10, 10, 10, 30).getTime()
const local = (y, m, d, h = DELIVER_HOUR) => new Date(y, m - 1, d, h, 0, 0, 0).getTime()
const keys = (r) => r.alerts.map(a => a.key)

describe('horario tranquilo', () => {
  it('de 21:00 a 7:59 se corre a las 9:00; de día queda igual', () => {
    expect(nextAllowed(new Date(2026, 10, 10, 22, 15).getTime())).toBe(local(2026, 11, 11))
    expect(nextAllowed(new Date(2026, 10, 10, 6, 0).getTime())).toBe(local(2026, 11, 10))
    const day = new Date(2026, 10, 10, 13, 0).getTime()
    expect(nextAllowed(day)).toBe(day)
  })
})

describe('fijo que vence mañana', () => {
  it('se programa a las 9:00 del día anterior, con nombre y monto', () => {
    const r = planLocalAlerts({ recurring: [rule()], now: NOW })
    const a = r.alerts.find(x => x.type === 'fixedDue')
    expect(a.key).toBe('fixed:r1|2026-11-15')
    expect(a.at).toBe(local(2026, 11, 14))
    expect(a.vars).toMatchObject({ name: 'Arriendo', amount: 450000 })
  })

  it('si ya pasaron las 9:00 del día anterior, sale ahora; de noche ya no ("mañana" sería falso)', () => {
    const eve = new Date(2026, 10, 14, 15, 0).getTime()
    expect(planLocalAlerts({ recurring: [rule()], now: eve }).alerts.find(x => x.type === 'fixedDue').at).toBe(eve)
    const night = new Date(2026, 10, 14, 22, 0).getTime()
    expect(planLocalAlerts({ recurring: [rule()], now: night }).alerts.filter(x => x.type === 'fixedDue')).toEqual([])
  })

  it('no avisa lo ya registrado, lo pausado, lo de inversión ni más allá de 14 días', () => {
    const paid = { id: 'e1', amount: 450000, date: '2026-11-15', category: 'Vivienda', recurringId: 'r1', occurrenceDate: '2026-11-15' }
    expect(planLocalAlerts({ recurring: [rule()], expenses: [paid], now: NOW }).alerts).toEqual([])
    expect(planLocalAlerts({ recurring: [rule({ paused: true })], now: NOW }).alerts).toEqual([])
    expect(planLocalAlerts({ recurring: [rule({ inv: true })], now: NOW }).alerts).toEqual([])
    const far = rule({ schedule: { freq: 'monthly', day: 28, anchorDate: '2026-01-28' }, startDate: '2026-01-28' })
    expect(planLocalAlerts({ recurring: [far], now: NOW }).alerts).toEqual([])
  })

  it('cruza de mes: un fijo del 2 de diciembre se avisa el 1', () => {
    const now = new Date(2026, 10, 25, 10, 0).getTime()
    const dec = rule({ schedule: { freq: 'monthly', day: 2, anchorDate: '2026-01-02' }, startDate: '2026-01-02' })
    const a = planLocalAlerts({ recurring: [dec], now }).alerts.find(x => x.type === 'fixedDue')
    expect(a.at).toBe(local(2026, 12, 1))
  })

  it('lo entregado (ledger con hora pasada) no se repite; lo programado a futuro se vuelve a programar', () => {
    const past = planLocalAlerts({ recurring: [rule()], now: NOW, ledger: { 'fixed:r1|2026-11-15': NOW - 1000 } })
    expect(past.alerts).toEqual([])
    const future = planLocalAlerts({ recurring: [rule()], now: NOW, ledger: { 'fixed:r1|2026-11-15': local(2026, 11, 14) } })
    expect(keys(future)).toEqual(['fixed:r1|2026-11-15'])
  })

  it('aparece en la tarjeta del Inicio el día anterior', () => {
    const eve = new Date(2026, 10, 14, 15, 0).getTime()
    expect(planLocalAlerts({ recurring: [rule()], now: eve }).current.map(c => c.type)).toEqual(['fixedDue'])
  })
})

describe('presupuesto al 90 %', () => {
  const budgets = [{ id: 'b1', category: 'Restaurantes', limit: 100000 }]
  const spend = (amount) => [{ id: 'x', amount, date: '2026-11-08', category: 'Restaurantes' }]

  it('por debajo del 90 % no avisa; desde el 90 %, una vez, ahora y con el porcentaje', () => {
    expect(planLocalAlerts({ budgets, expenses: spend(89000), now: NOW }).alerts).toEqual([])
    const r = planLocalAlerts({ budgets, expenses: spend(92000), now: NOW })
    expect(r.alerts).toHaveLength(1)
    expect(r.alerts[0]).toMatchObject({ key: 'budget:Restaurantes:2026-11', at: NOW, vars: { pct: 92, spent: 92000, limit: 100000 } })
    const again = planLocalAlerts({ budgets, expenses: spend(95000), now: NOW + 3600e3, ledger: withRecorded({}, r.alerts, NOW) })
    expect(again.alerts).toEqual([])
    expect(again.current).toHaveLength(1)
  })

  it('de noche queda para las 9:00; ignora los gastos de inversión', () => {
    const night = new Date(2026, 10, 10, 23, 0).getTime()
    expect(planLocalAlerts({ budgets, expenses: spend(95000), now: night }).alerts[0].at).toBe(local(2026, 11, 11))
    const inv = [{ ...spend(95000)[0], inv: true }]
    expect(planLocalAlerts({ budgets, expenses: inv, now: NOW }).alerts).toEqual([])
  })

  it('el mes siguiente vuelve a avisar (la clave lleva el mes)', () => {
    const ledger = { 'budget:Restaurantes:2026-10': NOW - 30 * 864e5 }
    expect(planLocalAlerts({ budgets, expenses: spend(95000), now: NOW, ledger }).alerts).toHaveLength(1)
  })
})

describe('te quedan $X', () => {
  const incomes = [{ id: 'i1', amount: 1000000, date: '2026-11-01', category: 'Sueldo' }]

  it('el próximo lunes a las 9:00, con la cifra de "Te queda" y el promedio diario', () => {
    const expenses = [{ id: 'e', amount: 400000, date: '2026-11-05', category: 'Super' }]
    const r = planLocalAlerts({ incomes, expenses, now: NOW })
    const a = r.alerts.find(x => x.type === 'left')
    expect(a.key).toBe('left:week:2026-11-16')
    expect(a.at).toBe(local(2026, 11, 16))
    expect(a.vars.amount).toBe(600000)
    expect(a.vars.days).toBe(15) // del 16 al 30
    expect(a.vars.daily).toBeCloseTo(40000)
  })

  it('un lunes en otro mes no se programa (la cifra sería de otro mes)', () => {
    const late = new Date(2026, 10, 27, 10, 0).getTime() // viernes 27; el lunes es 30 → sí
    expect(planLocalAlerts({ incomes, now: late }).alerts.some(a => a.key === 'left:week:2026-11-30')).toBe(true)
    const last = new Date(2026, 10, 30, 10, 0).getTime() // lunes 30; el próximo es 7-dic
    expect(planLocalAlerts({ incomes, now: last }).alerts.filter(a => a.type === 'left')).toEqual([])
  })

  it('bajo el 20 % de lo disponible avisa una vez ahora', () => {
    const expenses = [{ id: 'e', amount: 850000, date: '2026-11-05', category: 'Super' }]
    const r = planLocalAlerts({ incomes, expenses, now: NOW })
    const low = r.alerts.find(a => a.key === 'left:low:2026-11')
    expect(low).toMatchObject({ at: NOW, vars: { amount: 150000, low: true, days: 21 } })
  })

  it('sin ingreso registrado o con saldo negativo, nada', () => {
    expect(planLocalAlerts({ expenses: [{ id: 'e', amount: 10, date: '2026-11-05' }], now: NOW }).alerts).toEqual([])
    const over = [{ id: 'e', amount: 1200000, date: '2026-11-05', category: 'Super' }]
    expect(planLocalAlerts({ incomes, expenses: over, now: NOW }).alerts.filter(a => a.type === 'left')).toEqual([])
  })
})

describe('día de cobro', () => {
  const salary = rule({ id: 's1', kind: 'income', description: 'Sueldo', category: 'Sueldo', amounts: [{ from: '2026-01', amount: 1200000 }],
    schedule: { freq: 'monthly', day: 20, anchorDate: '2026-01-20' }, startDate: '2026-01-20' })

  it('solo sale de un ingreso fijo: a las 9:00 de ese día', () => {
    const a = planLocalAlerts({ recurring: [salary], now: NOW }).alerts.find(x => x.type === 'payday')
    expect(a).toMatchObject({ key: 'payday:s1|2026-11-20', at: local(2026, 11, 20), vars: { name: 'Sueldo', amount: 1200000 } })
    expect(planLocalAlerts({ now: NOW }).alerts).toEqual([])
  })
})

describe('preferencias y límites', () => {
  it('cada tipo se apaga solo; sin dato, encendido', () => {
    expect(alertPrefs({})).toEqual({ fixedDue: true, budget: true, left: true, payday: true, amounts: true })
    expect(alertPrefs({ localAlerts: { budget: false }, hideAmounts: true })).toMatchObject({ budget: false, amounts: false, fixedDue: true })
    expect(planLocalAlerts({ recurring: [rule()], settings: { localAlerts: { fixedDue: false } }, now: NOW }).alerts).toEqual([])
  })

  it('nunca más de MAX_SCHEDULED y ordenado por hora', () => {
    const many = Array.from({ length: 40 }, (_, i) => rule({ id: `r${i}`, schedule: { freq: 'weekly', anchorDate: '2026-11-11' }, startDate: '2026-11-11' }))
    const r = planLocalAlerts({ recurring: many, now: NOW })
    expect(r.alerts.length).toBe(MAX_SCHEDULED)
    expect(r.alerts.map(a => a.at)).toEqual([...r.alerts.map(a => a.at)].sort((a, b) => a - b))
  })

  it('ids estables, positivos y de 32 bits', () => {
    const id = alertId('fixed:r1|2026-11-15')
    expect(id).toBe(alertId('fixed:r1|2026-11-15'))
    expect(id).toBeGreaterThan(0)
    expect(id).toBeLessThan(2 ** 31)
    expect(alertId('budget:A:2026-11')).not.toBe(alertId('budget:B:2026-11'))
  })

  it('dueNow, withRecorded y readLedger', () => {
    expect(dueNow([{ at: NOW }, { at: NOW + 3600e3 }], NOW)).toHaveLength(1)
    const old = { 'x': NOW - 60 * 864e5, 'y': NOW - 864e5 }
    expect(Object.keys(withRecorded(old, [{ key: 'z', at: NOW }], NOW)).sort()).toEqual(['y', 'z'])
    expect(readLedger('nope')).toEqual({})
    expect(readLedger('[1]')).toEqual({})
    expect(readLedger('{"a":1}')).toEqual({ a: 1 })
  })
})

describe('textos', () => {
  const t = (k, v) => `${k}${v ? ' ' + JSON.stringify(v) : ''}`
  const money = (n) => `$${Math.round(n)}`
  it('con montos y sin montos (pantalla bloqueada)', () => {
    const a = { type: 'budget', vars: { cat: 'Restaurantes', pct: 92, spent: 92000, limit: 100000 } }
    expect(alertText(a, { t, money }).body).toContain('$92000')
    expect(alertText(a, { t, money, amounts: false }).body).toBe('la.budget.bodyHidden')
    const left = { type: 'left', vars: { amount: 1, days: 3, daily: 1, low: false } }
    expect(alertText(left, { t, money, amounts: false }).title).toBe('la.left.titleHidden')
    expect(alertText({ type: 'nope' }, { t, money })).toBeNull()
  })
  it('con montos ocultos el título del presupuesto no dice categoría ni porcentaje', () => {
    const a = { type: 'budget', vars: { cat: 'Salud', pct: 93, spent: 93, limit: 100 } }
    expect(alertText(a, { t, money, amounts: false }).title).toBe('la.budget.titleHidden')
    expect(alertText(a, { t, money }).title).toContain('Salud')
  })
  it('"1 día", no "1 días", en los cuatro idiomas', async () => {
    const left = (days, low) => ({ type: 'left', vars: { amount: 50, days, daily: 50, low } })
    expect(alertText(left(1, false), { t, money }).body).toMatch(/^la\.left\.body\.one/)
    expect(alertText(left(1, true), { t, money }).body).toMatch(/^la\.left\.bodyLow\.one/)
    expect(alertText(left(1, false), { t, money, amounts: false }).body).toMatch(/^la\.left\.bodyHidden\.one/)
    expect(alertText(left(2, false), { t, money }).body).toMatch(/^la\.left\.body /)
    for (const lang of ['es', 'en', 'pt', 'de']) {
      const d = (await import(`../../extras/strings.${lang}.js`)).default
      for (const k of ['la.left.body.one', 'la.left.bodyLow.one', 'la.left.bodyHidden.one']) {
        expect(d[k], `${lang} ${k}`).toBeTruthy()
        expect(d[k], `${lang} ${k}`).not.toMatch(/\b1 (días|days|dias|Tage)\b/)
      }
    }
  })
  it('withFireTimes: lo inmediato se registra con su hora real de entrega', () => {
    const now = 1_000_000
    expect(withFireTimes([{ at: now - 10 }, { at: now + 60_000 }], now).map(a => a.at)).toEqual([now + MIN_DELAY_MS, now + 60_000])
  })
})
