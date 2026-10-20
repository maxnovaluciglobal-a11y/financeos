// src/utils/csvExtraRows.js — filas del CSV para lo que no son movimientos
// (DAT-15): presupuestos, deudas, metas, suscripciones y fijos. Mismas columnas
// que los ingresos y gastos; la primera (tipo) dice de qué colección viene.
const money = n => Number(n) || 0

export function extraCsvRows(state, tr) {
  const rows = []
  for (const b of state.budgets || [])
    rows.push([tr('csv.type.budget'), '', b.category, b.category, money(b.limit), '', '', ''])
  for (const d of state.debts || []) {
    const notes = [d.rate ? `${d.rate} %` : '', d.minPayment ? `min ${money(d.minPayment)}` : ''].filter(Boolean).join(' · ')
    rows.push([tr('csv.type.debt'), d.dueDate || '', d.creditor, d.debtType || '', -money(d.balance), '', '', notes])
  }
  for (const g of state.goals || [])
    rows.push([tr('csv.type.goal'), g.targetDate || '', g.name, '', money(g.target), '', '', `${money(g.saved)}`])
  for (const s of state.subscriptions || [])
    rows.push([tr('csv.type.subscription'), s.nextPaymentDate || '', s.name, s.category || '', -money(s.amount), s.paymentMethod || '', s.frequency || '', s.notes || ''])
  for (const r of state.recurring || []) {
    const amounts = r.amounts || []
    const last = amounts[amounts.length - 1]
    const amount = money(last?.amount)
    rows.push([tr('csv.type.fixed'), r.startDate || '', r.description || '', r.category || '', r.kind === 'income' ? amount : -amount,
      r.method || '', r.schedule?.freq || '', r.paused ? tr('csv.paused') : ''])
  }
  return rows
}
