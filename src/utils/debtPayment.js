// src/utils/debtPayment.js — "Registrar pago" de una deuda, como función pura.
//
// La usan la página Deudas y la confirmación de la cuota (regla de fijos con
// source 'debt'): confirmar la cuota del mes crea el gasto Y baja el saldo,
// exactamente igual que el botón "Registrar pago".
//
// Tasa (auditoría 360, FIN-6, D-13): el campo `rate` es la TAE (tasa anual
// efectiva) y se convierte a mensual con (1 + TAE)^(1/12) − 1, no con TAE/12.
// Interés (FIN-7): se devenga UNA vez por mes calendario (`lastInterestAt`,
// "AAAA-MM"); un segundo abono en el mismo mes no vuelve a cobrar interés, y la
// cuota solo se cuenta si el pago cubre la cuota mínima (o salda la deuda).

export function monthlyRate(d) {
  const tae = (Number(d?.rate) || 0) / 100
  if (tae <= 0) return 0
  return Math.pow(1 + tae, 1 / 12) - 1
}

function localYM(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthsBetween(fromYM, toYM) {
  const [fy, fm] = String(fromYM).split('-').map(Number)
  const [ty, tm] = String(toYM).split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

// Meses de interés pendientes de devengar al pagar en `month`.
function interestMonths(debt, month) {
  const last = debt?.lastInterestAt
  if (!last || !/^\d{4}-\d{2}$/.test(last)) return 1
  return Math.max(0, monthsBetween(last, month))
}

function accrue(amount, r, n) {
  return n > 0 && r > 0 ? amount * Math.pow(1 + r, n) : amount
}

// Pago real que se cobraría hoy (o en `month`): la cuota mínima, acotada al
// saldo con el interés que falte devengar.
export function nextPaymentAmount(d, { month = localYM() } = {}) {
  const balanceWithInterest = accrue(Number(d?.balance) || 0, monthlyRate(d), interestMonths(d, month))
  return Math.min(Number(d?.minPayment) || 0, balanceWithInterest)
}

// Deuda después de pagar `amount` (por defecto, la cuota de nextPaymentAmount).
// En deudas en UF (Chile) baja también el saldo en UF; sin UF del día se usa la
// implícita en la deuda (saldo en pesos / saldo en UF, que se revalúa a diario).
export function applyDebtPayment(debt, amount, { ufValue, month = localYM() } = {}) {
  const r = monthlyRate(debt)
  const n = interestMonths(debt, month)
  const balanceWithInterest = accrue(Number(debt.balance) || 0, r, n)
  const monto = Math.max(0, Number(amount ?? nextPaymentAmount(debt, { month })) || 0)
  const balance = Math.max(0, balanceWithInterest - monto)
  const min = Number(debt.minPayment) || 0
  const countsAsInstallment = monto > 0 && (monto >= min || balance === 0)
  const out = {
    ...debt,
    balance,
    lastInterestAt: n > 0 || !debt.lastInterestAt ? month : debt.lastInterestAt,
    paidInstallments: (Number(debt.paidInstallments) || 0) + (countsAsInstallment ? 1 : 0),
  }
  const ufBalance = Number(debt.ufBalance) || 0
  const uf = Number(ufValue) > 0 ? Number(ufValue) : (ufBalance > 0 ? Number(debt.balance) / ufBalance : 0)
  if (ufBalance > 0 && uf > 0) out.ufBalance = Math.max(0, accrue(ufBalance, r, n) - monto / uf)
  return { debt: out, amount: monto }
}
