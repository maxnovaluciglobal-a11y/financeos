import { describe, it, expect } from 'vitest'
import { reconcileRules, subRuleId, debtRuleId } from './recurringSources.js'
import { amountAt, occurrencesInMonth } from './recurring.js'

const today = '2026-10-08'
const now = '2026-10-08T12:00:00.000Z'
const subs = [
  { id: 's1', name: 'Netflix', category: 'Streaming', amount: 15.49, frequency: 'monthly', nextPaymentDate: '2026-10-11', status: 'active' },
  { id: 's2', name: 'Dominio web', category: 'Software', amount: 12, frequency: 'annual', nextPaymentDate: '2027-03-02', status: 'active' },
  { id: 's3', name: 'Revista', category: 'Otros', amount: 5, frequency: 'monthly', nextPaymentDate: '', status: 'inactive' },
  { id: 's4', name: 'Seguro auto', category: 'Seguros', amount: 300, frequency: 'quarterly', nextPaymentDate: '2026-11-20', status: 'active' },
]
const debts = [
  { id: 'd1', creditor: 'Tarjeta', balance: 2000, minPayment: 80, dueDate: '2026-11-25', rate: 24 },
  { id: 'd2', creditor: 'Hipoteca depto', balance: 90000, minPayment: 700, dueDate: '2026-10-05', project: 'Depto Ñuñoa' },
  { id: 'd3', creditor: 'Saldada', balance: 0, minPayment: 50, dueDate: '2026-10-05' },
  { id: 'd4', creditor: 'Sin cuota', balance: 500, minPayment: 0 },
]

describe('reconcileRules — unificación de Suscripciones y Deudas', () => {
  const first = reconcileRules([], subs, debts, { today, now })

  it('crea una regla por suscripción (inactiva = pausada) y por deuda con cuota pendiente', () => {
    expect(first.map(r => r.id).sort()).toEqual([debtRuleId('d1'), debtRuleId('d2'), subRuleId('s1'), subRuleId('s2'), subRuleId('s3'), subRuleId('s4')].sort())
    const nf = first.find(r => r.id === 'rs-s1')
    expect(nf).toMatchObject({ kind: 'expense', source: 'subscription', sourceId: 's1', description: 'Netflix', category: 'Entretención', paused: false, startDate: '2026-10-01' })
    expect(occurrencesInMonth(nf, '2026-10')).toEqual(['2026-10-11'])
    expect(first.find(r => r.id === 'rs-s3').paused).toBe(true)
  })

  it('anual con próxima fecha en otro mes arranca en esa fecha; trimestral cada 3 meses', () => {
    const dom = first.find(r => r.id === 'rs-s2')
    expect(dom.schedule.freq).toBe('yearly')
    expect(dom.startDate).toBe('2027-03-02')
    expect(occurrencesInMonth(dom, '2026-10')).toEqual([])
    expect(occurrencesInMonth(dom, '2027-03')).toEqual(['2027-03-02'])
    const seg = first.find(r => r.id === 'rs-s4')
    expect(occurrencesInMonth(seg, '2026-11')).toEqual(['2026-11-20'])
    expect(occurrencesInMonth(seg, '2026-12')).toEqual([])
    expect(occurrencesInMonth(seg, '2027-02')).toEqual(['2027-02-20'])
  })

  it('deuda: cuota mensual en su día; la de una propiedad queda marcada como inversión', () => {
    const tj = first.find(r => r.id === 'rd-d1')
    expect(tj).toMatchObject({ source: 'debt', sourceId: 'd1', category: 'Deudas', startDate: '2026-11-25' })
    expect(amountAt(tj, '2026-11')).toBe(80)
    const hip = first.find(r => r.id === 'rd-d2')
    expect(hip).toMatchObject({ inv: true, project: 'Depto Ñuñoa', startDate: '2026-10-01' })
    expect(occurrencesInMonth(hip, '2026-10')).toEqual(['2026-10-05'])
  })

  it('volver a correr no cambia nada (idempotente, sin duplicados)', () => {
    expect(reconcileRules(first, subs, debts, { today, now })).toEqual([])
    expect(reconcileRules(first, subs, debts, { today: '2026-10-20', now: 'otro' })).toEqual([])
  })

  it('no modifica los registros originales', () => {
    const snapshot = JSON.stringify({ subs, debts })
    reconcileRules([], subs, debts, { today, now })
    expect(JSON.stringify({ subs, debts })).toBe(snapshot)
  })

  it('subir el precio cambia el monto "desde ahora" sin tocar el pasado', () => {
    const later = reconcileRules(first, subs.map(s => s.id === 's1' ? { ...s, amount: 17.99 } : s), debts, { today: '2026-12-03', now })
    expect(later).toHaveLength(1)
    expect(amountAt(later[0], '2026-11')).toBe(15.49)
    expect(amountAt(later[0], '2026-12')).toBe(17.99)
  })

  it('"desde ahora" sobre la regla gana hasta que la suscripción misma cambie', async () => {
    const { withAmountFrom } = await import('./recurring.js')
    const edited = withAmountFrom(first.find(r => r.id === 'rs-s1'), '2026-10', 16.99)
    const rules = first.map(r => r.id === 'rs-s1' ? edited : r)
    expect(reconcileRules(rules, subs, debts, { today, now })).toEqual([])          // no se pisa
    const changed = reconcileRules(rules, subs.map(s => s.id === 's1' ? { ...s, amount: 18.99 } : s), debts, { today: '2026-11-02', now })
    expect(amountAt(changed[0], '2026-10')).toBe(16.99)
    expect(amountAt(changed[0], '2026-11')).toBe(18.99)
    expect(changed[0].sourceAmount).toBe(18.99)
    // lo mismo con la cuota de una deuda
    const tj = withAmountFrom(first.find(r => r.id === 'rd-d1'), '2026-11', 95)
    expect(reconcileRules(first.map(r => r.id === 'rd-d1' ? tj : r), subs, debts, { today, now })).toEqual([])
  })

  it('cancelar pausa; borrar termina; deshacer el borrado la reabre', () => {
    const paused = reconcileRules(first, subs.map(s => s.id === 's1' ? { ...s, status: 'inactive' } : s), debts, { today, now })
    expect(paused[0]).toMatchObject({ id: 'rs-s1', paused: true })

    const removed = reconcileRules(first, subs.filter(s => s.id !== 's1'), debts, { today, now })
    expect(removed[0]).toMatchObject({ id: 'rs-s1', endDate: '2026-10-07', endedBySource: true })
    const rules2 = first.map(r => r.id === 'rs-s1' ? removed[0] : r)
    expect(reconcileRules(rules2, subs.filter(s => s.id !== 's1'), debts, { today, now })).toEqual([])
    const back = reconcileRules(rules2, subs, debts, { today, now })
    expect(back[0].endDate).toBeUndefined()
  })

  it('deuda saldada termina su regla hoy', () => {
    const settled = reconcileRules(first, subs, debts.map(d => d.id === 'd1' ? { ...d, balance: 0 } : d), { today, now })
    expect(settled[0]).toMatchObject({ id: 'rd-d1', endDate: today })
  })

  it('las reglas manuales no se tocan', () => {
    const manual = { id: 'm1', source: 'manual', kind: 'income', description: 'Sueldo' }
    expect(reconcileRules([...first, manual], subs, debts, { today, now })).toEqual([])
    expect(reconcileRules([manual], [], [], { today, now })).toEqual([])
  })
})
