// src/utils/recurringConfirm.js — qué escribir al confirmar ocurrencias.
// Pura: la usan core/db (dentro de una transacción) y el demo (en memoria).
//
// items: [{ rule, date, amount? }]. Idempotente: salta lo que ya tiene un
// registro (mismo id determinista o mismo recurringId + occurrenceDate).
// Reglas de deuda: reusa "Registrar pago" (utils/debtPayment.js) — el gasto
// sale por el monto pagado y la deuda baja su saldo, una sola vez.
import { buildConfirmedRecord, occurrenceRecordId } from './recurring.js'
import { applyDebtPayment } from './debtPayment.js'

export function planConfirmations(items, existingRecords, debtsById, { today, now } = {}) {
  const list = (items || []).filter(it => it && it.rule && it.date)
  const seen = new Set((existingRecords || []).filter(r => r?.recurringId && r?.occurrenceDate).map(r => `${r.recurringId}|${r.occurrenceDate}`))
  const ids = new Set((existingRecords || []).map(r => r?.id))
  const writes = []
  for (const { rule, date, amount } of list) {
    const key = `${rule.id}|${date}`
    if (seen.has(key) || ids.has(occurrenceRecordId(rule.id, date))) continue
    seen.add(key)
    let amt = amount
    let debt = null
    if (rule.source === 'debt' && rule.sourceId && debtsById?.has(rule.sourceId)) {
      const res = applyDebtPayment(debtsById.get(rule.sourceId), amount)
      if (!(res.amount > 0)) continue          // ya saldada: nada que pagar
      debt = res.debt; amt = res.amount
      debtsById.set(debt.id, debt)
    }
    const record = buildConfirmedRecord(rule, date, { amount: amt, today, createdAt: now })
    writes.push({ store: rule.kind === 'income' ? 'incomes' : 'expenses', record, debt })
  }
  return writes
}
