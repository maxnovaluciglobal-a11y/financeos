// src/utils/taxCalcUS.js
// Roth vs Traditional decision helper + HSA optimizer — USA.
// Cifras 2026 confirmadas oficialmente: IRS Notice 2025-67 (retiro),
// Rev. Proc. 2025-32 (tramos/standard deduction), Rev. Proc. 2025-19 (HSA).
// NO constituye asesoría financiera ni fiscal.

export const LIMITES_2026 = {
  contribucion401k: 24500,
  catchUp401k50: 8000,
  catchUp401kSuper6063: 11250,
  contribucionIRA: 7500,
  catchUpIRA50: 1100, // primer ajuste inflacionario bajo SECURE 2.0 — verificar cada año
  hsaSelfOnly: 4400,
  hsaFamily: 8750,
  hsaCatchUp55: 1000, // fijo por ley, no indexado
}

// Tramos federales 2026 — Rev. Proc. 2025-32
const TRAMOS_SINGLE = [
  { hasta: 12400, tasa: 0.10 },
  { hasta: 50400, tasa: 0.12 },
  { hasta: 105700, tasa: 0.22 },
  { hasta: 201775, tasa: 0.24 },
  { hasta: 256225, tasa: 0.32 },
  { hasta: 640600, tasa: 0.35 },
  { hasta: Infinity, tasa: 0.37 },
]

const TRAMOS_MFJ = [
  { hasta: 24800, tasa: 0.10 },
  { hasta: 100800, tasa: 0.12 },
  { hasta: 211400, tasa: 0.22 },
  { hasta: 403550, tasa: 0.24 },
  { hasta: 512450, tasa: 0.32 },
  { hasta: 768700, tasa: 0.35 },
  { hasta: Infinity, tasa: 0.37 },
]

export const STANDARD_DEDUCTION_2026 = { single: 16100, mfj: 32200 }

// Los tramos de arriba están definidos sobre TAXABLE INCOME, no sobre ingreso
// bruto. Pasarles el bruto sobreestima la tasa marginal (un single con $52.000
// brutos cae en 12%, no en 22%). Usar esto antes de llamar a tasaMarginal().
export function taxableIncome(grossIncome, filingStatus = 'single') {
  const gross = Number(grossIncome) || 0
  const sd = filingStatus === 'mfj' ? STANDARD_DEDUCTION_2026.mfj : STANDARD_DEDUCTION_2026.single
  return Math.max(0, gross - sd)
}

export function tasaMarginal(taxableIncomeValue, filingStatus = 'single') {
  const tabla = filingStatus === 'mfj' ? TRAMOS_MFJ : TRAMOS_SINGLE
  const income = Number(taxableIncomeValue) || 0
  const tramo = tabla.find(t => income <= t.hasta) || tabla[tabla.length - 1]
  return tramo.tasa
}

// Atajo seguro: recibe ingreso BRUTO y aplica la standard deduction.
export function tasaMarginalDesdeBruto(grossIncome, filingStatus = 'single') {
  return tasaMarginal(taxableIncome(grossIncome, filingStatus), filingStatus)
}

// Topes con catch-up por edad (edad al cierre del año fiscal).
export function limite401k(edad) {
  const e = Number(edad) || 0
  let catchUp = 0
  if (e >= 60 && e <= 63) catchUp = LIMITES_2026.catchUp401kSuper6063
  else if (e >= 50) catchUp = LIMITES_2026.catchUp401k50
  return { base: LIMITES_2026.contribucion401k, catchUp, total: LIMITES_2026.contribucion401k + catchUp }
}

export function limiteIRA(edad) {
  const catchUp = (Number(edad) || 0) >= 50 ? LIMITES_2026.catchUpIRA50 : 0
  return { base: LIMITES_2026.contribucionIRA, catchUp, total: LIMITES_2026.contribucionIRA + catchUp }
}

export function limiteHSA(coverage, edad) {
  const base = coverage === 'family' ? LIMITES_2026.hsaFamily : LIMITES_2026.hsaSelfOnly
  const catchUp = (Number(edad) || 0) >= 55 ? LIMITES_2026.hsaCatchUp55 : 0
  return { base, catchUp, total: base + catchUp }
}

// Valor futuro de una SERIE de aportes anuales (anualidad ordinaria).
export function valorFuturoSerie(aporte, tasaAnual, anios) {
  const a = Number(aporte) || 0
  const r = Number(tasaAnual) || 0
  const n = Number(anios) || 0
  if (r === 0) return a * n
  return a * ((Math.pow(1 + r, n) - 1) / r)
}

// Compara aportar $X a Traditional (deducible hoy, se tributa al retirar) vs
// $X a Roth (se tributa hoy, libre de impuesto al retirar) — MISMO APORTE
// NOMINAL en ambas cuentas, que es el caso real de quien topea el límite legal.
//
// Con el mismo nominal, la cuenta Roth siempre termina con más saldo neto: por
// eso la comparación honesta suma el otro lado del Traditional — la deducción
// de hoy ($X × tasaHoy) es plata que te queda en el bolsillo. Se asume que se
// invierte al mismo retorno (simplificación: ignora el impuesto de esa cuenta
// taxable). Con ese modelo, Traditional gana exactamente cuando tu tasa de hoy
// es mayor que la que esperas pagar retirado.
export function compararRothTraditional({ aporte, tasaHoy, tasaRetiro, anios, retornoAnual }) {
  const a = Number(aporte) || 0
  const tHoy = Number(tasaHoy) || 0
  const tRet = Number(tasaRetiro) || 0
  const n = Number(anios) || 0
  const r = (Number(retornoAnual) || 0) / 100

  const crecimiento = Math.pow(1 + r, n)

  // Traditional: entra el monto completo pre-tax, crece, tributas al salir.
  const traditionalBruto = a * crecimiento
  const traditionalNeto = traditionalBruto * (1 - tRet)
  // La deducción de hoy, invertida al mismo retorno.
  const ahorroFiscalHoy = a * tHoy
  const ahorroInvertido = ahorroFiscalHoy * crecimiento
  const traditionalTotal = traditionalNeto + ahorroInvertido

  // Roth: mismo aporte nominal, ya tributado. Sale libre de impuesto.
  const rothFinal = a * crecimiento

  const diferencia = traditionalTotal - rothFinal
  const convieneTraditional = diferencia > 0

  return {
    traditionalNeto: Math.round(traditionalNeto),
    ahorroFiscalHoy: Math.round(ahorroFiscalHoy),
    ahorroInvertido: Math.round(ahorroInvertido),
    traditionalTotal: Math.round(traditionalTotal),
    rothFinal: Math.round(rothFinal),
    diferencia: Math.round(Math.abs(diferencia)),
    convieneTraditional,
  }
}

// HSA — triple ventaja: deducible al aportar, crece libre de impuesto, sale
// libre de impuesto si es gasto médico calificado. Modela una SERIE de aportes
// anuales (uno por año durante `anios`), no un aporte único.
export function calcHSA({ coverage, aporteAnual, tasaMarginalHoy, anios, retornoAnual, edad }) {
  const { base, catchUp, total: limite } = limiteHSA(coverage, edad)
  const aporte = Math.min(Number(aporteAnual) || 0, limite)
  const t = Number(tasaMarginalHoy) || 0
  const n = Number(anios) || 0
  const r = (Number(retornoAnual) || 0) / 100

  const ahorroFiscalHoy = Math.round(aporte * t)
  const valorFuturo = Math.round(valorFuturoSerie(aporte, r, n))
  const totalAportado = Math.round(aporte * n)
  const faltaParaTope = Math.max(0, limite - aporte)

  return { limite, limiteBase: base, catchUp, aporte, ahorroFiscalHoy, valorFuturo, totalAportado, faltaParaTope }
}
