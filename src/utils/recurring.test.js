import { describe, it, expect } from 'vitest'
import {
  occurrencesInMonth, nextOccurrenceOf, amountAt, withAmountFrom, expectedAmount, monthPlan,
  pendingTotals, buildConfirmedRecord, occurrenceRecordId, dueAutoConfirmations, ruleFromRecord,
  detectRecurring, findPendingMatch, monthlyEquivalent, addDays, diffDays, addMonthsYM, recordMatchesOccurrence,
} from './recurring.js'

const rule = (over = {}) => ({
  id: 'r1', kind: 'expense', source: 'manual', description: 'Arriendo', category: 'Vivienda', method: 'Transferencia',
  amountMode: 'fixed', amounts: [{ from: '2026-01', amount: 500 }],
  schedule: { freq: 'monthly', day: 1, anchorDate: '2026-01-01' },
  startDate: '2026-01-01', autoConfirm: false, paused: false, skipped: [], createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

describe('fechas locales', () => {
  it('addDays y diffDays cruzan meses, años y el cambio de horario', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(diffDays('2026-03-01', '2026-04-01')).toBe(31)
    expect(diffDays('2026-10-20', '2026-11-05')).toBe(16)
  })
  it('addMonthsYM', () => {
    expect(addMonthsYM('2026-12', 1)).toBe('2027-01')
    expect(addMonthsYM('2026-01', -1)).toBe('2025-12')
    expect(addMonthsYM('2026-05', -14)).toBe('2025-03')
  })
})

describe('occurrencesInMonth — calendario', () => {
  it('mensual el 31 cae en el último día de los meses cortos', () => {
    const r = rule({ schedule: { freq: 'monthly', day: 31, anchorDate: '2026-01-31' }, startDate: '2026-01-31' })
    expect(occurrencesInMonth(r, '2026-01')).toEqual(['2026-01-31'])
    expect(occurrencesInMonth(r, '2026-02')).toEqual(['2026-02-28'])
    expect(occurrencesInMonth(r, '2026-04')).toEqual(['2026-04-30'])
  })

  it('febrero de año bisiesto: el 29 y el 30 caen el 29', () => {
    const r29 = rule({ schedule: { freq: 'monthly', day: 30, anchorDate: '2027-01-30' }, startDate: '2027-01-01' })
    expect(occurrencesInMonth(r29, '2028-02')).toEqual(['2028-02-29'])
    expect(occurrencesInMonth(r29, '2027-02')).toEqual(['2027-02-28'])
  })

  it("day 'last' es siempre el último día", () => {
    const r = rule({ schedule: { freq: 'monthly', day: 'last', anchorDate: '2026-01-31' } })
    expect(occurrencesInMonth(r, '2026-02')).toEqual(['2026-02-28'])
    expect(occurrencesInMonth(r, '2028-02')).toEqual(['2028-02-29'])
    expect(occurrencesInMonth(r, '2026-07')).toEqual(['2026-07-31'])
  })

  it('quincenal: el 15 y el último día', () => {
    const r = rule({ schedule: { freq: 'semimonthly', anchorDate: '2026-01-15' } })
    expect(occurrencesInMonth(r, '2026-02')).toEqual(['2026-02-15', '2026-02-28'])
    expect(occurrencesInMonth(r, '2026-03')).toEqual(['2026-03-15', '2026-03-31'])
  })

  it('cada 14 días a través de meses (a veces 3 en un mes)', () => {
    const r = rule({ schedule: { freq: 'biweekly', anchorDate: '2026-01-02' }, startDate: '2026-01-02' })
    expect(occurrencesInMonth(r, '2026-01')).toEqual(['2026-01-02', '2026-01-16', '2026-01-30'])
    expect(occurrencesInMonth(r, '2026-02')).toEqual(['2026-02-13', '2026-02-27'])
    expect(occurrencesInMonth(r, '2026-03')).toEqual(['2026-03-13', '2026-03-27'])
    // A fin de año
    expect(occurrencesInMonth(r, '2027-01')).toEqual(['2027-01-01', '2027-01-15', '2027-01-29'])
  })

  it('semanal', () => {
    const r = rule({ schedule: { freq: 'weekly', anchorDate: '2026-10-05' }, startDate: '2026-10-05' })
    expect(occurrencesInMonth(r, '2026-10')).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'])
    expect(occurrencesInMonth(r, '2026-11')).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30'])
  })

  it('anual: solo en el mes del ancla; 29-feb cae el 28 en años no bisiestos', () => {
    const r = rule({ schedule: { freq: 'yearly', day: 29, anchorDate: '2028-02-29' }, startDate: '2028-02-29' })
    expect(occurrencesInMonth(r, '2028-02')).toEqual(['2028-02-29'])
    expect(occurrencesInMonth(r, '2029-02')).toEqual(['2029-02-28'])
    expect(occurrencesInMonth(r, '2029-03')).toEqual([])
  })

  it('cada 3 meses (trimestral) desde el mes del ancla', () => {
    const r = rule({ schedule: { freq: 'monthly', interval: 3, day: 10, anchorDate: '2026-02-10' }, startDate: '2026-02-01' })
    expect(occurrencesInMonth(r, '2026-02')).toEqual(['2026-02-10'])
    expect(occurrencesInMonth(r, '2026-03')).toEqual([])
    expect(occurrencesInMonth(r, '2026-05')).toEqual(['2026-05-10'])
    expect(monthlyEquivalent(r, '2026-05')).toBeCloseTo(500 / 3)
  })

  it('respeta inicio y fin (inclusive)', () => {
    const r = rule({ schedule: { freq: 'weekly', anchorDate: '2026-10-05' }, startDate: '2026-10-12', endDate: '2026-10-19' })
    expect(occurrencesInMonth(r, '2026-10')).toEqual(['2026-10-12', '2026-10-19'])
    expect(occurrencesInMonth(rule({ startDate: '2026-03-02' }), '2026-03')).toEqual([])
    expect(occurrencesInMonth(rule({ startDate: '2026-03-02' }), '2026-04')).toEqual(['2026-04-01'])
    expect(occurrencesInMonth(rule({ endDate: '2026-05-31' }), '2026-06')).toEqual([])
  })

  it('nextOccurrenceOf busca en los meses siguientes', () => {
    expect(nextOccurrenceOf(rule(), '2026-10-02')).toBe('2026-11-01')
    expect(nextOccurrenceOf(rule(), '2026-10-01')).toBe('2026-10-01')
    expect(nextOccurrenceOf(rule({ endDate: '2026-10-15' }), '2026-10-02')).toBe(null)
  })
})

describe('montos con historial', () => {
  const r = rule({ amounts: [{ from: '2026-01', amount: 500 }, { from: '2026-06', amount: 550 }] })
  it('amountAt toma la entrada vigente del mes', () => {
    expect(amountAt(r, '2026-03')).toBe(500)
    expect(amountAt(r, '2026-06')).toBe(550)
    expect(amountAt(r, '2027-01')).toBe(550)
    expect(amountAt(r, '2025-12')).toBe(500)
  })
  it('"desde ahora" no cambia el pasado', () => {
    const n = withAmountFrom(r, '2026-09', 600)
    expect(amountAt(n, '2026-08')).toBe(550)
    expect(amountAt(n, '2026-09')).toBe(600)
    expect(amountAt(n, '2026-02')).toBe(500)
    // reemplazar el mismo mes no duplica la entrada
    expect(withAmountFrom(n, '2026-09', 610).amounts.filter(a => a.from === '2026-09')).toHaveLength(1)
  })
  it("modo 'last' y 'average' usan los confirmados anteriores", () => {
    const recs = [
      { recurringId: 'r1', occurrenceDate: '2026-01-01', amount: 100 },
      { recurringId: 'r1', occurrenceDate: '2026-02-01', amount: 130 },
      { recurringId: 'r1', occurrenceDate: '2026-03-01', amount: 160 },
      { recurringId: 'r1', occurrenceDate: '2026-04-01', amount: 190 },
      { recurringId: 'otra', occurrenceDate: '2026-04-01', amount: 9999 },
    ]
    expect(expectedAmount(rule({ amountMode: 'last' }), '2026-05-01', recs)).toBe(190)
    expect(expectedAmount(rule({ amountMode: 'average' }), '2026-05-01', recs)).toBe(160)
    expect(expectedAmount(rule({ amountMode: 'last' }), '2026-01-01', recs)).toBe(500) // sin historial previo
    expect(expectedAmount(rule(), '2026-05-01', recs)).toBe(500)
  })
})

describe('monthPlan — estado de cada ocurrencia', () => {
  const today = '2026-10-08'
  it('pendiente sin registro, confirmada con registro vinculado, omitida', () => {
    const r1 = rule()
    const r2 = rule({ id: 'r2', description: 'Netflix', category: 'Entretención', amounts: [{ from: '2026-01', amount: 15 }], schedule: { freq: 'monthly', day: 11, anchorDate: '2026-01-11' } })
    const r3 = rule({ id: 'r3', description: 'Gym', category: 'Deporte', amounts: [{ from: '2026-01', amount: 35 }], schedule: { freq: 'monthly', day: 5 }, skipped: ['2026-10-05'] })
    const expenses = [{ id: 'x', recurringId: 'r1', occurrenceDate: '2026-10-01', date: '2026-10-01', amount: 500, category: 'Vivienda' }]
    const plan = monthPlan([r1, r2, r3], '2026-10', { expenses, today })
    const by = Object.fromEntries(plan.map(o => [o.ruleId, o]))
    expect(by.r1.status).toBe('confirmed')
    expect(by.r2.status).toBe('pending')
    expect(by.r2.due).toBe(false)
    expect(by.r3.status).toBe('skipped')
    expect(pendingTotals(plan)).toEqual({ income: 0, expense: 15, count: 1 })
  })

  it('un gasto cargado a mano que coincide cuenta como confirmado (no se cuenta dos veces)', () => {
    const r2 = rule({ id: 'r2', description: 'Netflix', category: 'Entretención', amounts: [{ from: '2026-01', amount: 15.49 }], schedule: { freq: 'monthly', day: 11 } })
    const manual = { id: 'm1', description: 'NETFLIX.COM', date: '2026-10-12', amount: 15.49, category: 'Entretención' }
    const plan = monthPlan([r2], '2026-10', { expenses: [manual], today })
    expect(plan[0].status).toBe('confirmed')
    expect(plan[0].matched).toBe(true)
    expect(pendingTotals(plan).count).toBe(0)
  })

  it('el mismo registro a mano no cubre dos ocurrencias', () => {
    const a = rule({ id: 'a', description: 'Clases', category: 'Educación', amounts: [{ from: '2026-01', amount: 100 }], schedule: { freq: 'monthly', day: 10 } })
    const b = rule({ id: 'b', description: 'Clases', category: 'Educación', amounts: [{ from: '2026-01', amount: 100 }], schedule: { freq: 'monthly', day: 10 } })
    const plan = monthPlan([a, b], '2026-10', { expenses: [{ id: 'm', description: 'Clases', date: '2026-10-10', amount: 100, category: 'Educación' }] })
    expect(plan.filter(o => o.status === 'confirmed')).toHaveLength(1)
    expect(plan.filter(o => o.status === 'pending')).toHaveLength(1)
  })

  it('no coincide si el monto difiere más de 7,5 % o la fecha más de 3 días (sin misma descripción)', () => {
    const r = rule({ description: 'Arriendo', category: 'Vivienda', amounts: [{ from: '2026-01', amount: 1000 }], schedule: { freq: 'monthly', day: 10 } })
    expect(recordMatchesOccurrence(r, '2026-10-10', 1000, { id: 'a', description: 'otro', category: 'Vivienda', date: '2026-10-13', amount: 1070 })).toBe(true)
    expect(recordMatchesOccurrence(r, '2026-10-10', 1000, { id: 'a', description: 'otro', category: 'Vivienda', date: '2026-10-14', amount: 1000 })).toBe(false)
    expect(recordMatchesOccurrence(r, '2026-10-10', 1000, { id: 'a', description: 'otro', category: 'Vivienda', date: '2026-10-10', amount: 1080 })).toBe(false)
    expect(recordMatchesOccurrence(r, '2026-10-10', 1000, { id: 'a', description: 'Arriendo depto', category: 'Otros', date: '2026-10-25', amount: 1000 })).toBe(true)
  })

  it('pausada: sin pendientes, pero lo confirmado sigue', () => {
    const r = rule({ paused: true })
    expect(monthPlan([r], '2026-10', {})).toEqual([])
    const plan = monthPlan([r], '2026-10', { expenses: [{ id: 'x', recurringId: 'r1', occurrenceDate: '2026-10-01', amount: 500, date: '2026-10-01' }] })
    expect(plan).toHaveLength(1)
    expect(plan[0].status).toBe('confirmed')
  })

  it('pendingTotals excluye reglas de inversión y separa ingresos de gastos', () => {
    const sal = rule({ id: 's', kind: 'income', description: 'Sueldo', category: 'Salario', amounts: [{ from: '2026-01', amount: 2000 }], schedule: { freq: 'monthly', day: 30 } })
    const hip = rule({ id: 'h', inv: true, description: 'Hipoteca depto', category: 'Deudas', amounts: [{ from: '2026-01', amount: 700 }] })
    const plan = monthPlan([sal, hip, rule()], '2026-10', {})
    expect(pendingTotals(plan)).toEqual({ income: 2000, expense: 500, count: 2 })
    expect(pendingTotals(plan, { personalOnly: false }).expense).toBe(1200)
    expect(pendingTotals(plan, { until: '2026-10-15' })).toEqual({ income: 0, expense: 500, count: 1 })
  })
})

describe('confirmar — idempotente', () => {
  it('el id del registro es determinista y lleva el vínculo', () => {
    const r = rule()
    const a = buildConfirmedRecord(r, '2026-10-01', { today: '2026-10-08', createdAt: 'x' })
    const b = buildConfirmedRecord(r, '2026-10-01', { today: '2026-10-09', createdAt: 'y' })
    expect(a.id).toBe(occurrenceRecordId('r1', '2026-10-01'))
    expect(a.id).toBe(b.id)
    expect(a).toMatchObject({ recurringId: 'r1', occurrenceDate: '2026-10-01', amount: 500, description: 'Arriendo', category: 'Vivienda', method: 'Transferencia', recurrence: 'Mensual' })
  })
  it('monto "solo este mes" y confirmación anticipada (fecha = hoy)', () => {
    const rec = buildConfirmedRecord(rule({ schedule: { freq: 'monthly', day: 30 } }), '2026-10-30', { amount: 480, today: '2026-10-25' })
    expect(rec.amount).toBe(480)
    expect(rec.date).toBe('2026-10-25')
    expect(rec.occurrenceDate).toBe('2026-10-30')
  })
  it('ingreso usa source', () => {
    const rec = buildConfirmedRecord(rule({ kind: 'income', description: 'Sueldo', category: 'Salario' }), '2026-10-01', {})
    expect(rec.source).toBe('Sueldo')
    expect(rec.description).toBeUndefined()
  })
  it('confirmar dos veces no cambia el plan (sigue una sola confirmada)', () => {
    const r = rule()
    const rec = buildConfirmedRecord(r, '2026-10-01', {})
    const plan = monthPlan([r], '2026-10', { expenses: [rec, { ...rec }] })
    expect(plan).toHaveLength(1)
    expect(plan[0].status).toBe('confirmed')
  })
})

describe('auto-confirmación', () => {
  it('solo reglas con autoConfirm, solo hasta hoy, sin repetir las ya registradas', () => {
    const sal = rule({ id: 'sal', kind: 'income', description: 'Sueldo', category: 'Salario', autoConfirm: true, amounts: [{ from: '2026-08', amount: 2000 }],
      schedule: { freq: 'semimonthly', anchorDate: '2026-08-15' }, startDate: '2026-08-01' })
    const incomes = [buildConfirmedRecord(sal, '2026-08-15', {})]
    const due = dueAutoConfirmations([sal, rule()], { incomes, today: '2026-10-08' })
    expect(due.map(o => o.date)).toEqual(['2026-08-31', '2026-09-15', '2026-09-30'])
  })
})

describe('regla desde un movimiento + detección', () => {
  it('"Se repite cada mes" crea la regla con ese registro como primera ocurrencia', () => {
    const r = ruleFromRecord({ description: 'Gimnasio', amount: 35, date: '2026-10-31', category: 'Deporte', method: 'Débito' }, { kind: 'expense', id: 'n1', createdAt: 'x' })
    expect(r.schedule).toEqual({ freq: 'monthly', day: 'last', anchorDate: '2026-10-31' })
    expect(r.startDate).toBe('2026-10-31')
    expect(occurrencesInMonth(r, '2026-11')).toEqual(['2026-11-30'])
    const rec = buildConfirmedRecord(r, '2026-10-31', { amount: 35 })
    expect(monthPlan([r], '2026-10', { expenses: [rec] })[0].status).toBe('confirmed')
  })

  it('sugiere fijo con 2 de 3 meses parecidos (±15 % monto, ±5 días)', () => {
    const recs = [
      { id: 'a', description: 'Colegio', date: '2026-07-05', amount: 100 },
      { id: 'b', description: 'colegio ', date: '2026-08-07', amount: 110 },
    ]
    const cur = { id: 'c', description: 'Colegio', date: '2026-09-04', amount: 105 }
    expect(detectRecurring(cur, recs, [])).toEqual({ freq: 'monthly', months: 2 })
    expect(detectRecurring(cur, recs.slice(0, 1), [])).toBe(null)
    expect(detectRecurring({ ...cur, amount: 140 }, recs, [])).toBe(null)
    expect(detectRecurring({ ...cur, date: '2026-09-20' }, recs, [])).toBe(null)
    expect(detectRecurring(cur, recs, [rule({ description: 'Colegio' })])).toBe(null)
  })

  it('vincula un gasto a mano con la única ocurrencia pendiente que coincide', () => {
    const r = rule({ description: 'Arriendo', amounts: [{ from: '2026-01', amount: 500 }] })
    const plan = monthPlan([r], '2026-10', {})
    expect(findPendingMatch({ description: 'Arriendo octubre', date: '2026-10-02', amount: 500, category: 'Vivienda' }, plan, 'expense')?.ruleId).toBe('r1')
    expect(findPendingMatch({ description: 'Super', date: '2026-10-02', amount: 80, category: 'Alimentación' }, plan, 'expense')).toBe(null)
  })
})
