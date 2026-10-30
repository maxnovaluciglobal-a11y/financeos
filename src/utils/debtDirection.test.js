// "Debo · Me deben" (D2): dirección por defecto, totales por dirección,
// patrimonio, exclusión del IQ Score, Próximos pagos y aplicación de cobros.
import { describe, it, expect } from 'vitest'
import {
  OWE, OWED, debtDirection, isOwed, isOwe, splitDebts, newReceivable, owedTotals,
  applyCollection, groupReceivables, receivableState, upcomingCollections, mergeUpcoming, collectedOf,
  linkedCollectionIncomes,
} from './debtDirection.js'
import { calcNetWorth } from './netWorth.js'
import { personalDebtRatio, personalDebts, pendingDebtMonthly } from './personal.js'
import { calcFinancialScore } from './financialScore.js'
import { reconcileRules } from './recurringSources.js'
import { extraCsvRows } from './csvExtraRows.js'

const card = { id: 'd1', creditor: 'Banco', debtType: 'Tarjeta', initial: 1000, balance: 800, minPayment: 100, rate: 0 }
const ana = { id: 'r1', direction: 'owed', creditor: 'Ana', initial: 300, balance: 300, minPayment: 0, dueDate: '2026-11-10', notes: 'viaje', collections: [] }
const leo = { id: 'r2', direction: 'owed', creditor: 'Leo', initial: 200, balance: 50, minPayment: 0, dueDate: '', collections: [{ id: 'c1', date: '2026-10-01', amount: 150 }] }
const done = { id: 'r3', direction: 'owed', creditor: 'Bea', initial: 90, balance: 0, minPayment: 0, dueDate: '2026-10-05', collectedAt: '2026-10-06' }

describe('dirección', () => {
  it('sin campo (registros y respaldos viejos) es "debo"', () => {
    expect(debtDirection(card)).toBe(OWE)
    expect(debtDirection({})).toBe(OWE)
    expect(debtDirection(null)).toBe(OWE)
    expect(debtDirection({ direction: 'otra' })).toBe(OWE)
    expect(isOwe(card)).toBe(true)
    expect(isOwed(card)).toBe(false)
  })
  it('"owed" es "me deben"', () => {
    expect(debtDirection(ana)).toBe(OWED)
    expect(isOwed(ana)).toBe(true)
  })
  it('splitDebts reparte y tolera null', () => {
    const { owe, owed } = splitDebts([card, ana, null, leo])
    expect(owe.map(d => d.id)).toEqual(['d1'])
    expect(owed.map(d => d.id)).toEqual(['r1', 'r2'])
    expect(splitDebts(undefined)).toEqual({ owe: [], owed: [] })
  })
  it('newReceivable arma un registro sin cuota ni tasa', () => {
    const r = newReceivable({ who: '  Ana ', amount: '120.456', date: '2026-11-01', notes: ' x ' })
    expect(r).toMatchObject({ direction: 'owed', creditor: 'Ana', initial: 120.46, balance: 120.46, minPayment: 0, rate: 0, dueDate: '2026-11-01', notes: 'x', collections: [] })
    expect(newReceivable({ who: 'B', amount: 5 }).dueDate).toBe('')
  })
})

describe('totales de "Me deben"', () => {
  it('por cobrar, cobrado y pendientes; ignora las deudas propias', () => {
    expect(owedTotals([card, ana, leo, done])).toEqual({ pending: 350, collected: 240, open: 2 })
    expect(owedTotals([])).toEqual({ pending: 0, collected: 0, open: 0 })
    expect(collectedOf(leo)).toBe(150)
  })
})

describe('applyCollection', () => {
  it('cobro parcial baja el saldo y guarda el historial', () => {
    const { debt, amount } = applyCollection(ana, 100, { date: '2026-10-30', id: 'c9' })
    expect(amount).toBe(100)
    expect(debt.balance).toBe(200)
    expect(debt.collections).toEqual([{ id: 'c9', date: '2026-10-30', amount: 100 }])
    expect(debt.collectedAt).toBeUndefined()
    expect(ana.balance).toBe(300) // no muta el original
  })
  it('sin monto o con uno mayor que el saldo, cobra el total y lo marca cobrado', () => {
    const full = applyCollection(leo, undefined, { date: '2026-10-30', id: 'c2' })
    expect(full.amount).toBe(50)
    expect(full.debt.balance).toBe(0)
    expect(full.debt.collectedAt).toBe('2026-10-30')
    expect(full.debt.collections).toHaveLength(2)
    expect(applyCollection(leo, 999, { date: '2026-10-30' }).amount).toBe(50)
  })
  it('monto inválido, cero o saldo agotado: no cambia nada', () => {
    expect(applyCollection(ana, 0).amount).toBe(0)
    expect(applyCollection(ana, -5).debt).toBe(ana)
    expect(applyCollection(ana, 'abc').amount).toBe(0)
    expect(applyCollection(done, 10).amount).toBe(0)
  })
  it('redondea a centavos', () => {
    const { debt, amount } = applyCollection({ ...ana, balance: 10 }, 3.333, { date: '2026-10-30' })
    expect(amount).toBe(3.33)
    expect(debt.balance).toBe(6.67)
  })
})

describe('grupos y estado', () => {
  it('con fecha (más cercana primero), "Sin fecha" y cobrados', () => {
    const early = { ...ana, id: 'r4', creditor: 'Zoe', dueDate: '2026-11-01' }
    const g = groupReceivables([card, ana, leo, done, early])
    expect(g.dated.map(d => d.id)).toEqual(['r4', 'r1'])
    expect(g.undated.map(d => d.id)).toEqual(['r2'])
    expect(g.done.map(d => d.id)).toEqual(['r3'])
  })
  it('estado en palabras', () => {
    expect(receivableState(ana, '2026-10-30')).toBe('pending')
    expect(receivableState(ana, '2026-11-11')).toBe('late')
    expect(receivableState(leo, '2026-10-30')).toBe('undated')
    expect(receivableState(done, '2026-10-30')).toBe('collected')
  })
})

describe('Próximos pagos: "Cobro"', () => {
  it('solo los que tienen fecha y saldo, dentro de 30 días', () => {
    const far = { ...ana, id: 'r5', dueDate: '2026-12-31' }
    const past = { ...ana, id: 'r6', dueDate: '2026-10-01' }
    const items = upcomingCollections([card, ana, leo, done, far, past], { today: '2026-10-30' })
    expect(items).toEqual([{ id: 'rcv-r1', kind: 'collect', incoming: true, name: 'Ana', amount: 300, date: '2026-11-10' }])
    expect(upcomingCollections([ana], {})).toEqual([])
  })
  it('se mezcla con los pagos por fecha y respeta el límite', () => {
    const pays = [
      { id: 'p1', kind: 'debt', name: 'Banco', amount: 100, date: '2026-11-05' },
      { id: 'p2', kind: 'sub', name: 'Netflix', amount: 9, date: '2026-11-20' },
    ]
    const cols = upcomingCollections([ana], { today: '2026-10-30' })
    const { items, total } = mergeUpcoming(pays, cols, { limit: 2 })
    expect(items.map(i => i.id)).toEqual(['p1', 'rcv-r1'])
    expect(total).toBe(3)
  })
})

describe('patrimonio neto', () => {
  const base = { goals: [{ saved: 500 }], incomes: [], expenses: [], settings: {} }
  it('"Por cobrar" suma a activos; la deuda propia sigue en pasivos', () => {
    const nw = calcNetWorth({ ...base, debts: [card], receivables: [ana, leo, done] })
    expect(nw.receivablesPending).toBe(350)
    expect(nw.pendingDebt).toBe(800)
    expect(nw.totalActivos).toBe(850)
    expect(nw.totalPasivos).toBe(800)
    expect(nw.netWorth).toBe(50)
  })
  it('con la lista mezclada (la store entera) da lo mismo y no duplica', () => {
    const a = calcNetWorth({ ...base, debts: [card, ana, leo] })
    const b = calcNetWorth({ ...base, debts: [card, ana, leo], receivables: [ana, leo] })
    expect(a.netWorth).toBe(50)
    expect(b).toEqual(a)
    expect(a.pendingDebt).toBe(800)
  })
  it('sin "me deben" el cálculo es el de antes', () => {
    const nw = calcNetWorth({ ...base, debts: [card] })
    expect(nw.receivablesPending).toBe(0)
    expect(nw.netWorth).toBe(-300)
  })
  it('solo "me deben" ya alcanza para mostrar el patrimonio', () => {
    expect(calcNetWorth({ goals: [], debts: [], receivables: [ana], settings: {} }).hasData).toBe(true)
  })
})

describe('IQ Score: "me deben" no es carga de deuda', () => {
  it('personalDebts y el ratio excluyen "owed"', () => {
    const big = { ...ana, balance: 99999, minPayment: 5000 }
    expect(personalDebts([card, big]).map(d => d.id)).toEqual(['d1'])
    expect(personalDebtRatio([card, big], 1000)).toEqual({ totalDebt: 800, monthlyPayments: 100, ratio: 0.1 })
    expect(pendingDebtMonthly([card, big], [])).toBe(100)
  })
  it('el factor debtLoad da los 20 puntos si solo hay "me deben"', () => {
    const r = calcFinancialScore({ savingRate: 0, expenses: [], incomes: [], debts: [{ ...ana, minPayment: 500 }], goals: [], activeMonth: '2026-09', now: 1_700_000_000_000 }, k => k)
    expect(r.breakdown.find(b => b.key === 'debtLoad').pts).toBe(20)
  })
})

describe('fijos y CSV', () => {
  it('un "me deben" nunca genera una regla de cuota', () => {
    const ups = reconcileRules([], [], [card, { ...ana, minPayment: 50 }], { today: '2026-10-30', now: '2026-10-30T00:00:00Z' })
    expect(ups.map(r => r.id)).toEqual(['rd-d1'])
  })
  it('el CSV exporta "me deben" como fila propia con monto positivo', () => {
    const rows = extraCsvRows({ debts: [card, ana] }, k => k)
    expect(rows[0]).toEqual(['csv.type.debt', '', 'Banco', 'Tarjeta', -800, '', '', 'min 100'])
    expect(rows[1]).toEqual(['csv.type.receivable', '2026-11-10', 'Ana', '', 300, '', '', 'viaje'])
  })
})

describe('ingresos vinculados a los cobros de un "me deben"', () => {
  const incomes = [
    { id: 'i1', amount: 150, date: '2026-10-01', receivableId: 'r2', collectionId: 'c1' },
    { id: 'i2', amount: 20, date: '2026-10-02', receivableId: 'r2' }, // anterior al collectionId
    { id: 'i3', amount: 150, date: '2026-10-01', source: 'Cobro a Leo' }, // sin vínculo: mismo monto y fecha
    { id: 'i4', amount: 300, date: '2026-10-03', receivableId: 'r1', collectionId: 'c9' },
    null,
  ]
  it('al borrar el registro devuelve solo los ingresos con su receivableId', () => {
    expect(linkedCollectionIncomes(leo, incomes).map(r => r.id)).toEqual(['i1', 'i2'])
    expect(linkedCollectionIncomes(ana, incomes).map(r => r.id)).toEqual(['i4'])
  })
  it('nunca adivina por monto, fecha o descripción', () => {
    expect(linkedCollectionIncomes(done, incomes)).toEqual([])
    expect(linkedCollectionIncomes(leo, incomes).some(r => r.id === 'i3')).toBe(false)
  })
  it('por cobro puntual exige el collectionId (los ingresos viejos no se atribuyen)', () => {
    expect(linkedCollectionIncomes(leo, incomes, { collectionId: 'c1' }).map(r => r.id)).toEqual(['i1'])
    expect(linkedCollectionIncomes(leo, incomes, { collectionId: 'c2' })).toEqual([])
  })
  it('acepta entradas vacías', () => {
    expect(linkedCollectionIncomes(null, incomes)).toEqual([])
    expect(linkedCollectionIncomes(leo, null)).toEqual([])
    expect(linkedCollectionIncomes({ id: 'r2' }, [{ receivableId: 'r2' }])).toEqual([])
  })
})
