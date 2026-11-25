import { describe, it, expect } from 'vitest'
import { firstStepsProgress, firstStepsVisible, FIRST_STEP_IDS, accountSince, readFirstStepsState, nextFirstStepsState, FIRST_STEPS_DAYS } from './firstSteps.js'

const M = '2026-11'

describe('firstStepsProgress (R06, 5 pasos)', () => {
  it('cuenta nueva: 0 de 5, el primero pendiente es el ingreso', () => {
    const p = firstStepsProgress({ activeMonth: M, pushOffered: true })
    expect(p.steps.map(s => s.id)).toEqual(FIRST_STEP_IDS)
    expect(p.done).toBe(0)
    expect(p.total).toBe(5)
    expect(p.nextId).toBe('income')
    expect(p.complete).toBe(false)
  })

  it('el ingreso cuenta si es del mes que se mira o si hay un fijo de ingreso', () => {
    const byId = (p) => Object.fromEntries(p.steps.map(s => [s.id, s.done]))
    expect(byId(firstStepsProgress({ activeMonth: M, incomes: [{ date: `${M}-01`, amount: 1 }] })).income).toBe(true)
    expect(byId(firstStepsProgress({ activeMonth: M, incomes: [{ date: '2026-09-01', amount: 1 }] })).income).toBe(false)
    expect(byId(firstStepsProgress({ activeMonth: M, recurring: [{ kind: 'income' }] })).income).toBe(true)
  })

  it('gasto, fijos y presupuesto salen de los datos reales', () => {
    const p = firstStepsProgress({
      activeMonth: M,
      expenses: [{ amount: 5 }],
      recurring: [{ kind: 'expense' }],
      budgets: [{ category: 'Alimentación', limit: 100 }],
    })
    expect(p.done).toBe(3)
    expect(p.nextId).toBe('income')
  })

  it('un apartado no es un gasto; un fijo en pausa no cuenta', () => {
    const p = firstStepsProgress({ activeMonth: M, expenses: [{ kind: 'setAside', amount: 5 }], recurring: [{ kind: 'expense', paused: true }] })
    expect(p.done).toBe(0)
  })

  it('con avisos disponibles el 5.º paso es activarlos; si no, el respaldo', () => {
    expect(firstStepsProgress({ pushOffered: true }).steps[4].id).toBe('alerts')
    expect(firstStepsProgress({ pushOffered: true, pushOn: true }).steps[4].done).toBe(true)
    expect(firstStepsProgress({ pushOffered: false }).steps[4].id).toBe('backup')
    expect(firstStepsProgress({ lastBackupAt: '2026-10-01' }).steps[4].done).toBe(true)
    expect(firstStepsProgress({ syncOn: true }).steps[4].done).toBe(true)
  })

  it('completa: 5 de 5 y sin próximo paso', () => {
    const p = firstStepsProgress({
      activeMonth: M, incomes: [{ date: `${M}-02` }], expenses: [{}], recurring: [{ kind: 'expense' }],
      budgets: [{}], pushOffered: true, pushOn: true,
    })
    expect(p.complete).toBe(true)
    expect(p.nextId).toBe(null)
  })
})

describe('firstStepsVisible', () => {
  const pending = firstStepsProgress({})
  it('no se muestra en el demo, ocultada a mano ni completa', () => {
    expect(firstStepsVisible(pending)).toBe(true)
    expect(firstStepsVisible(pending, { isDemo: true })).toBe(false)
    expect(firstStepsVisible(pending, { hidden: true })).toBe(false)
    expect(firstStepsVisible({ ...pending, complete: true })).toBe(false)
  })
})

describe('solo para cuentas nuevas (revisión del 24-nov)', () => {
  const NOW = Date.UTC(2026, 10, 25, 12)
  const DAY = 24 * 3600 * 1000
  const pending = firstStepsProgress({})
  const iso = (ms) => new Date(ms).toISOString()

  it('accountSince: el registro más viejo; un movimiento sin createdAt cuenta su fecha', () => {
    expect(accountSince({}, NOW)).toBe(NOW)
    expect(accountSince({ expenses: [{ createdAt: iso(NOW - 3 * DAY) }] }, NOW)).toBe(NOW - 3 * DAY)
    expect(accountSince({ incomes: [{ date: '2026-01-15' }] }, NOW)).toBe(Date.parse('2026-01-15'))
    expect(accountSince({ lastBackupAt: iso(NOW - 90 * DAY) }, NOW)).toBe(NOW - 90 * DAY)
    // Presupuestos de plantilla sin createdAt no hacen vieja a una cuenta nueva.
    expect(accountSince({ budgets: [{ category: 'Comida' }], recurring: [{ kind: 'expense' }] }, NOW)).toBe(NOW)
    expect(accountSince({ budgets: [{ createdAt: iso(NOW - 60 * DAY) }] }, NOW)).toBe(NOW - 60 * DAY)
  })

  it('una cuenta nueva que importa una cartola vieja sigue viendo Primeros pasos', () => {
    // Filas importadas: fecha del movimiento de hace meses, pero importadas hoy.
    const imported = [{ date: '2025-03-10', importedAt: iso(NOW - DAY) }, { date: '2025-04-02', importedAt: iso(NOW - DAY), createdAt: iso(NOW - DAY) }]
    expect(accountSince({ expenses: imported }, NOW)).toBe(NOW - DAY)
    const state = nextFirstStepsState(null, { expenses: imported }, pending, NOW)
    expect(firstStepsVisible(pending, { state, now: NOW })).toBe(true)
  })

  it('una cuenta que ya existía (datos de hace más de 30 días) no ve la tarjeta', () => {
    const data = { expenses: [{ createdAt: iso(NOW - 200 * DAY) }] }
    const state = nextFirstStepsState(null, data, pending, NOW)
    expect(firstStepsVisible(pending, { state, now: NOW })).toBe(false)
  })

  it(`una cuenta nueva la ve durante ${FIRST_STEPS_DAYS} días y después no`, () => {
    const state = nextFirstStepsState(null, {}, pending, NOW)
    expect(firstStepsVisible(pending, { state, now: NOW })).toBe(true)
    expect(firstStepsVisible(pending, { state, now: NOW + (FIRST_STEPS_DAYS - 1) * DAY })).toBe(true)
    expect(firstStepsVisible(pending, { state, now: NOW + FIRST_STEPS_DAYS * DAY })).toBe(false)
  })

  it('completada una vez no vuelve aunque un paso quede pendiente (otro mes, avisos)', () => {
    const complete = { ...pending, complete: true }
    const s1 = nextFirstStepsState({ since: NOW, done: false }, {}, complete, NOW)
    expect(s1.done).toBe(true)
    const s2 = nextFirstStepsState(s1, {}, pending, NOW + DAY)
    expect(s2.done).toBe(true)
    expect(firstStepsVisible(pending, { state: s2, now: NOW + DAY })).toBe(false)
  })

  it('since solo baja: datos viejos que llegan después (sync, respaldo) la apagan', () => {
    const s1 = nextFirstStepsState(null, {}, pending, NOW)
    const s2 = nextFirstStepsState(s1, { incomes: [{ createdAt: iso(NOW - 400 * DAY) }] }, pending, NOW + 1000)
    expect(s2.since).toBe(NOW - 400 * DAY)
    expect(firstStepsVisible(pending, { state: s2, now: NOW + 1000 })).toBe(false)
    expect(nextFirstStepsState(s2, {}, pending, NOW + 2000).since).toBe(NOW - 400 * DAY)
  })

  it('readFirstStepsState tolera vacío y basura', () => {
    expect(readFirstStepsState(null)).toEqual({ since: 0, done: false })
    expect(readFirstStepsState('{roto')).toEqual({ since: 0, done: false })
    expect(readFirstStepsState(JSON.stringify({ since: NOW, done: true }))).toEqual({ since: NOW, done: true })
  })
})
