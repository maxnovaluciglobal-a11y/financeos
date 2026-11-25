import { describe, it, expect } from 'vitest'
import {
  ruleInstallments, occurrenceOrdinal, ruleInstallmentAt, lastInstallmentDate, resolveInstallmentEnd, debtInstallmentAt, debtLastPaidInstallment,
  monthStatusOf, projectCommitments, projectionSummary, cardSummary, cardsTotals, isCreditCard,
} from './ahead.js'
import { monthPlan } from './recurring.js'
import { reconcileRules, debtRuleId } from './recurringSources.js'

const rule = (over = {}) => ({
  id: 'r1', kind: 'expense', source: 'manual', description: 'Notebook en cuotas', category: 'Tecnología',
  amountMode: 'fixed', amounts: [{ from: '2026-09', amount: 100 }],
  schedule: { freq: 'monthly', day: 10, anchorDate: '2026-09-10' }, startDate: '2026-09-01',
  autoConfirm: false, paused: false, skipped: [], ...over,
})

describe('cuotas de un fijo manual', () => {
  it('sin installments no hay etiqueta (compatible con reglas viejas)', () => {
    expect(ruleInstallments(rule())).toBeNull()
    expect(ruleInstallmentAt(rule(), '2026-11-10')).toBeNull()
  })
  it('cuenta las ocurrencias desde el inicio', () => {
    expect(occurrenceOrdinal(rule(), '2026-09-10')).toBe(1)
    expect(occurrenceOrdinal(rule(), '2026-11-10')).toBe(3)
    expect(occurrenceOrdinal(rule(), '2026-11-09')).toBe(2)
  })
  it('"4 de 12" con cuotas pagadas antes del inicio', () => {
    const r = rule({ installments: { total: 12, before: 1 } })
    expect(ruleInstallmentAt(r, '2026-11-10')).toEqual({ n: 4, total: 12 })
    expect(ruleInstallmentAt(r, '2027-07-10')).toEqual({ n: 12, total: 12 })
    expect(ruleInstallmentAt(r, '2027-08-10')).toBeNull()
  })
  it('valores raros se normalizan', () => {
    expect(ruleInstallments(rule({ installments: { total: '6', before: 9 } }))).toEqual({ total: 6, before: 6 })
    expect(ruleInstallments(rule({ installments: { total: -2 } }))).toBeNull()
  })
  it('fecha de la última cuota', () => {
    expect(lastInstallmentDate(rule({ installments: { total: 12, before: 1 } }))).toBe('2027-07-10')
    expect(lastInstallmentDate(rule({ installments: { total: 3, before: 3 } }))).toBeNull()
    expect(lastInstallmentDate(rule())).toBeNull()
  })
})

describe('cuotas de una deuda', () => {
  it('la siguiente es pagadas + 1, sin pasarse del total', () => {
    const d = { totalInstallments: 12, paidInstallments: 3 }
    expect(debtInstallmentAt(d)).toEqual({ n: 4, total: 12 })
    expect(debtInstallmentAt(d, 8)).toEqual({ n: 12, total: 12 })
    expect(debtInstallmentAt(d, 9)).toBeNull()
    expect(debtLastPaidInstallment(d)).toEqual({ n: 3, total: 12 })
  })
  it('sin total no hay etiqueta', () => {
    expect(debtInstallmentAt({ paidInstallments: 3 })).toBeNull()
    expect(debtLastPaidInstallment({ totalInstallments: 5, paidInstallments: 0 })).toBeNull()
  })
})

describe('pagado este mes', () => {
  const today = '2026-11-20'
  it('confirmado, previsto y vencido', () => {
    const r = rule()
    const paid = monthPlan([r], '2026-11', { expenses: [{ id: 'x', recurringId: 'r1', occurrenceDate: '2026-11-10', date: '2026-11-10', amount: 100 }], today })
    expect(monthStatusOf('r1', paid, today)).toBe('paid')
    const due = monthPlan([r], '2026-11', { expenses: [], today })
    expect(monthStatusOf('r1', due, today)).toBe('overdue')
    expect(monthStatusOf('r1', due, '2026-11-05')).toBe('pending')
    expect(monthStatusOf('otra', due, today)).toBeNull()
  })
})

describe('proyección de los próximos meses', () => {
  const today = '2026-11-20'
  const debts = [{ id: 'd1', creditor: 'Banco', debtType: 'Crédito', balance: 250, minPayment: 100, dueDate: '2026-11-25', rate: 0, totalInstallments: 12, paidInstallments: 9 }]
  const subs = [{ id: 's1', name: 'Música', category: 'Música', amount: 10, frequency: 'monthly', nextPaymentDate: '2026-11-04', status: 'active' }]
  const derived = reconcileRules([], subs, debts, { today, now: 'x' })
  const rules = [rule({ installments: { total: 4, before: 1 } }), ...derived]

  it('12 meses por defecto, con el mes en curso primero', () => {
    const out = projectCommitments({ rules, debts, today })
    expect(out).toHaveLength(12)
    expect(out[0].ym).toBe('2026-11')
    expect(out[11].ym).toBe('2027-10')
  })
  it('el fijo en cuotas termina en su última cuota', () => {
    const out = projectCommitments({ rules, debts, today })
    const notebook = out.flatMap(m => m.items.filter(i => i.ruleId === 'r1'))
    // inicio sep: sep = cuota 2, oct = 3, nov = 4 → ya no hay en diciembre.
    expect(notebook.map(i => i.installment)).toEqual([{ n: 4, total: 4 }])
    expect(notebook[0].status).toBe('overdue')
  })
  it('la deuda se proyecta hasta saldarse, con su número de cuota', () => {
    const out = projectCommitments({ rules, debts, today })
    const debt = out.flatMap(m => m.items.filter(i => i.ruleId === debtRuleId('d1')))
    expect(debt.map(i => i.amount)).toEqual([100, 100, 50])
    expect(debt.map(i => i.installment?.n)).toEqual([10, 11, 12])
  })
  it('una deuda con interés aplica la tasa mensual y no supera el saldo', () => {
    const d2 = [{ ...debts[0], totalInstallments: 0, paidInstallments: 0, rate: 12.68 }]
    const r2 = reconcileRules([], [], d2, { today, now: 'x' })
    const out = projectCommitments({ rules: r2, debts: d2, today })
    const amounts = out.flatMap(m => m.items.map(i => i.amount))
    expect(amounts.slice(0, 2)).toEqual([100, 100])
    expect(amounts[2]).toBeGreaterThan(50)
    expect(amounts[2]).toBeLessThan(60)
    expect(amounts).toHaveLength(3)
  })
  it('suscripciones cada mes; la pausada no se proyecta', () => {
    const out = projectCommitments({ rules, debts, today })
    expect(out.every(m => m.items.some(i => i.source === 'subscription'))).toBe(true)
    const paused = projectCommitments({ rules: rules.map(r => (r.source === 'subscription' ? { ...r, paused: true } : r)), debts, today })
    expect(paused.slice(1).some(m => m.items.some(i => i.source === 'subscription'))).toBe(false)
  })
  it('lo ya pagado este mes cuenta como pagado', () => {
    const expenses = [{ id: 'e1', recurringId: 'rs-s1', occurrenceDate: '2026-11-04', date: '2026-11-04', amount: 10, description: 'Música' }]
    const [m0] = projectCommitments({ rules, debts, expenses, today })
    expect(m0.paid).toBe(10)
    expect(m0.total).toBe(m0.paid + m0.pending)
    expect(m0.bySource.subscription).toBe(10)
  })
  it('excluye reglas de inversión e ingresos', () => {
    const extra = [rule({ id: 'inv', inv: true }), rule({ id: 'inc', kind: 'income' })]
    const out = projectCommitments({ rules: extra, today })
    expect(out.some(m => m.items.length)).toBe(false)
  })
  it('resumen: total, promedio, pico y cuotas que terminan', () => {
    const out = projectCommitments({ rules, debts, today })
    const sum = projectionSummary(out)
    expect(sum.total).toBe(Math.round(out.reduce((s, m) => s + m.total, 0) * 100) / 100)
    expect(sum.peak.ym).toBe('2026-11')
    expect(sum.ending.map(e => e.ruleId).sort()).toEqual([debtRuleId('d1'), 'r1'].sort())
  })
})

describe('tarjeta de crédito', () => {
  const today = '2026-11-20'
  const card = { id: 'c1', creditor: 'Visa', debtType: 'Tarjeta', balance: 300, creditLimit: 1000, statementAmount: 250, minPayment: 50, dueDate: '2026-11-15' }
  const [r] = reconcileRules([], [], [card], { today: '2026-11-01', now: 'x' })
  it('cupo usado, disponible y facturado', () => {
    const s = cardSummary(card, { today, plan: [], ruleId: r.id })
    expect(s).toMatchObject({ limit: 1000, used: 300, available: 700, usedPct: 0.3, statement: 250, overLimit: false })
  })
  it('vencida si la cuota del mes pasó sin pagarse; pagada si está confirmada', () => {
    const plan = monthPlan([r], '2026-11', { expenses: [], today })
    expect(cardSummary(card, { today, plan, ruleId: r.id }).status).toBe('overdue')
    expect(cardSummary(card, { today: '2026-11-10', plan: monthPlan([r], '2026-11', { today: '2026-11-10' }), ruleId: r.id })).toMatchObject({ status: 'due', daysToDue: 5 })
    const paidPlan = monthPlan([r], '2026-11', { expenses: [{ id: 'p', recurringId: r.id, occurrenceDate: '2026-11-15', date: '2026-11-15', amount: 50 }], today })
    expect(cardSummary(card, { today, plan: paidPlan, ruleId: r.id }).status).toBe('paid')
  })
  it('sin cupo no inventa disponible; sobre el cupo se marca', () => {
    expect(cardSummary({ ...card, creditLimit: 0 }, { today }).available).toBeNull()
    expect(cardSummary({ ...card, balance: 1200 }, { today }).overLimit).toBe(true)
    expect(cardSummary({ ...card, statementAmount: '' }, { today }).statement).toBeNull()
  })
  it('saldada no está vencida', () => {
    expect(cardSummary({ ...card, balance: 0 }, { today }).status).toBe('none')
  })
  it('totales y tipo', () => {
    const a = cardSummary(card, { today, plan: monthPlan([r], '2026-11', { today }), ruleId: r.id })
    const b = cardSummary({ ...card, id: 'c2', creditLimit: 0, statementAmount: 100 }, { today: '2026-11-01' })
    expect(cardsTotals([a, b])).toEqual({ statement: 350, used: 600, limit: 1000, available: 700, overdue: 1 })
    expect(isCreditCard(card)).toBe(true)
    expect(isCreditCard({ debtType: 'Auto' })).toBe(false)
  })
})

describe('copias locales de fechas', () => {
  it('la id de la regla de una suscripción coincide con recurringSources', async () => {
    const { subRuleId } = await import('./recurringSources.js')
    expect(subRuleId('abc')).toBe('rs-abc')
  })
})

describe('revisión previa al lanzamiento', () => {
  const inst = (over = {}) => rule({ installments: { total: 12, before: 0 }, ...over })

  it('fin automático: de 12 a 18 cuotas se recalcula (no se pierden la 13 a la 18)', () => {
    const prev = inst()
    const auto = resolveInstallmentEnd(null, prev, '')
    expect(auto).toEqual({ endDate: '2027-08-10', autoEnd: true })
    const saved = { ...prev, endDate: auto.endDate, installments: { ...prev.installments, autoEnd: true } }
    const next = { ...saved, installments: { total: 18, before: 0 } }
    // El campo "Termina" quedó con la fecha automática anterior, sin tocar.
    expect(resolveInstallmentEnd(saved, next, saved.endDate)).toEqual({ endDate: '2028-02-10', autoEnd: true })
  })
  it('fin automático en reglas viejas (sin la marca): igual se recalcula', () => {
    const saved = { ...inst(), endDate: '2027-08-10' }
    const next = { ...saved, installments: { total: 18, before: 0 } }
    expect(resolveInstallmentEnd(saved, next, '2027-08-10').endDate).toBe('2028-02-10')
  })
  it('una fecha escrita a mano se respeta; quitar las cuotas borra la automática', () => {
    const saved = { ...inst(), endDate: '2027-08-10', installments: { total: 12, before: 0, autoEnd: true } }
    expect(resolveInstallmentEnd(saved, { ...saved, installments: { total: 18 } }, '2027-03-10')).toEqual({ endDate: '2027-03-10', autoEnd: false })
    const plain = { ...saved }; delete plain.installments
    expect(resolveInstallmentEnd(saved, plain, '2027-08-10')).toEqual({ endDate: null, autoEnd: false })
  })
  it('cambiar el inicio mueve el fin automático', () => {
    const saved = { ...inst(), endDate: '2027-08-10', installments: { total: 12, before: 0, autoEnd: true } }
    const moved = { ...saved, startDate: '2026-10-01', schedule: { ...saved.schedule, anchorDate: '2026-10-10' } }
    expect(resolveInstallmentEnd(saved, moved, '2027-08-10').endDate).toBe('2027-09-10')
  })
  it('una ocurrencia omitida no cuenta como cuota', () => {
    const r = rule({ installments: { total: 3, before: 0 }, skipped: ['2026-10-10'] })
    expect(occurrenceOrdinal(r, '2026-11-10')).toBe(2)
    expect(ruleInstallmentAt(r, '2026-11-10')).toEqual({ n: 2, total: 3 })
    expect(lastInstallmentDate(r)).toBe('2026-12-10')
  })
  it('deuda semanal: el interés se suma una vez por mes, no por cada pago', () => {
    const r = 1.1 ** 12 - 1 // 10 % mensual
    const debts = [{ id: 'd9', creditor: 'X', debtType: 'Crédito', balance: 250, minPayment: 100, rate: r * 100 }]
    const rules = [{ id: 'rd', kind: 'expense', source: 'debt', sourceId: 'd9', description: 'X', category: 'Deudas', amountMode: 'fixed',
      amounts: [{ from: '2026-11', amount: 100 }], schedule: { freq: 'weekly', anchorDate: '2026-11-02' }, startDate: '2026-11-02', paused: false, skipped: [] }]
    const out = projectCommitments({ rules, debts, today: '2026-11-01', months: 3 })
    // 250 × 1,10 = 275 en noviembre: 100 + 100 + 75, y nada más.
    expect(out.flatMap(m => m.items.map(i => i.amount))).toEqual([100, 100, 75])
  })
})
