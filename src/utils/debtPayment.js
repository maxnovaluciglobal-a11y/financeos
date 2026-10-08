// src/utils/debtPayment.js — "Registrar pago" de una deuda, como función pura.
//
// La usan la página Deudas y la confirmación de la cuota (regla de fijos con
// source 'debt'): confirmar la cuota del mes crea el gasto Y baja el saldo,
// exactamente igual que el botón "Registrar pago".

// Pago real que se cobraría hoy — incluye el interés del período, con la misma
// fórmula que el simulador de liquidación. Antes "Registrar pago" solo restaba
// el pago del saldo sin sumar el interés primero, así que cada pago real
// dejaba el saldo guardado más bajo de lo que en verdad era.
export function nextPaymentAmount(d) {
  const rate = (Number(d?.rate) || 0) / 100 / 12
  const balanceWithInterest = Number(d?.balance) + Number(d?.balance) * rate
  return Math.min(Number(d?.minPayment) || 0, balanceWithInterest)
}

// Deuda después de pagar `amount` (por defecto, la cuota de nextPaymentAmount).
// En deudas en UF (Chile) baja también el saldo en UF; sin UF del día se usa la
// implícita en la deuda (saldo en pesos / saldo en UF, que se revalúa a diario).
export function applyDebtPayment(debt, amount, { ufValue } = {}) {
  const rate = (Number(debt.rate) || 0) / 100 / 12
  const balanceWithInterest = Number(debt.balance) + Number(debt.balance) * rate
  const monto = Math.max(0, Number(amount ?? nextPaymentAmount(debt)) || 0)
  const balance = Math.max(0, balanceWithInterest - monto)
  const out = { ...debt, balance, paidInstallments: (Number(debt.paidInstallments) || 0) + 1 }
  const ufBalance = Number(debt.ufBalance) || 0
  const uf = Number(ufValue) > 0 ? Number(ufValue) : (ufBalance > 0 ? Number(debt.balance) / ufBalance : 0)
  if (ufBalance > 0 && uf > 0) out.ufBalance = Math.max(0, (ufBalance + ufBalance * rate) - monto / uf)
  return { debt: out, amount: monto }
}
