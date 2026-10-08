// src/demo/personas/us.js
// Persona del demo en inglés (decisión de Walter, 08-oct-2026): Sofía en COP no
// representa a quien llega a la app en inglés. Datos ficticios y plausibles para
// un hogar de una persona en EE. UU.:
//   Maya Robinson, 31 años, terapeuta respiratoria en un hospital de San Antonio
//   (Texas). Alquila un departamento de 1 dormitorio, cobra cada dos semanas
//   (neto, ya descontado su aporte al 401(k) y el seguro médico), paga un
//   préstamo de auto, una tarjeta de crédito y un préstamo estudiantil federal.
// Montos en USD con centavos, a propósito (es lo que muestra el demo de la
// decisión "montos con centavos según la moneda").
// Las categorías son los VALORES internos de la app (en español); la etiqueta
// que ve el usuario sale de i18n. Las descripciones son del usuario ficticio,
// por eso van en inglés como las escribiría ella.
// Escenarios: "mes bueno" = dos sueldos + bono trimestral + tutorías; "mes
// difícil" = el segundo sueldo llega recortado (días sin goce de sueldo). Los
// gastos son los mismos en los dos; el mes actual trae un arreglo de frenos.
import { d, M0, M1, M2, M3, M4, M5, day, nextMonthDate, nextYearDate } from '../demoDates.js'

export const US_PERSONA_META = { id: 'us', name: 'Maya Robinson', country: 'US', currency: 'USD' }

const PAYCHECK = 1926.40
const paycheck = (id, ym, dd, amount = PAYCHECK, notes = '') =>
  ({ id: d(id), date: day(ym, dd), source: 'Paycheck — Alamo Heights Medical Center', amount, category: 'Salario', recurrence: 'Quincenal', notes })

// ── INGRESOS ──────────────────────────────────────────────────────────────────
const PAST_INCOMES = [
  paycheck('us-i10', M1, 3), paycheck('us-i11', M1, 17),
  paycheck('us-i20', M2, 3), paycheck('us-i21', M2, 17),
  { id: d('us-i22'), date: day(M2, 24), source: 'Online tutoring — chemistry', amount: 240.00, category: 'Freelance', recurrence: 'Único', notes: '' },
  paycheck('us-i30', M3, 3), paycheck('us-i31', M3, 17), paycheck('us-i32', M3, 29, PAYCHECK, 'Third paycheck this month'),
  paycheck('us-i40', M4, 3), paycheck('us-i41', M4, 17),
  paycheck('us-i50', M5, 3), paycheck('us-i51', M5, 17),
  { id: d('us-i52'), date: day(M5, 22), source: 'Quarterly bonus', amount: 650.00, category: 'Bono', recurrence: 'Único', notes: '' },
]

// Mes difícil: el segundo sueldo llega recortado.
const HARD_INCOMES = [
  paycheck('us-i1', M0, 3),
  paycheck('us-i2', M0, 17, 1214.75, 'Short check: 3 unpaid days caring for family'),
  ...PAST_INCOMES,
]

// Mes bueno: sueldo completo + bono trimestral + tutorías.
const GOOD_INCOMES = [
  paycheck('us-ix1', M0, 3),
  paycheck('us-ix2', M0, 17),
  { id: d('us-ix3'), date: day(M0, 12), source: 'Quarterly bonus', amount: 650.00, category: 'Bono', recurrence: 'Único', notes: '' },
  { id: d('us-ix4'), date: day(M0, 20), source: 'Online tutoring — chemistry', amount: 280.00, category: 'Freelance', recurrence: 'Único', notes: '' },
  ...PAST_INCOMES,
]

// ── GASTOS ────────────────────────────────────────────────────────────────────
const exp = (id, ym, dd, description, amount, category, method, type, recurrence = 'Único', notes = '') =>
  ({ id: d(id), date: day(ym, dd), description, amount, category, method, type, recurrence, notes })

// Fijos de cada mes (los montos variables cambian mes a mes).
function monthlyFixed(prefix, ym, v) {
  return [
    exp(`${prefix}-rent`,   ym,  1, 'Rent — 1BR apartment',   1295.00, 'Vivienda',     'Transferencia', 'Necesidad', 'Mensual'),
    exp(`${prefix}-renti`,  ym,  1, "Renter's insurance",       16.50, 'Vivienda',     'Crédito',       'Necesidad', 'Mensual'),
    exp(`${prefix}-elec`,   ym,  6, 'Electric bill',            v.elec, 'Servicios',   'Débito',        'Necesidad', 'Mensual'),
    exp(`${prefix}-water`,  ym,  6, 'Water & trash',            v.water, 'Servicios',  'Débito',        'Necesidad', 'Mensual'),
    exp(`${prefix}-net`,    ym,  9, 'Internet',                 60.00, 'Servicios',    'Débito',        'Necesidad', 'Mensual'),
    exp(`${prefix}-phone`,  ym,  9, 'Phone plan',               45.00, 'Servicios',    'Crédito',       'Necesidad', 'Mensual'),
    exp(`${prefix}-carins`, ym, 14, 'Car insurance',           148.00, 'Transporte',   'Crédito',       'Necesidad', 'Mensual'),
    exp(`${prefix}-gro1`,   ym,  4, 'Groceries — H-E-B',        v.gro1, 'Alimentación', 'Débito',       'Necesidad'),
    exp(`${prefix}-gro2`,   ym, 18, 'Groceries — H-E-B',        v.gro2, 'Alimentación', 'Débito',       'Necesidad'),
    exp(`${prefix}-gas1`,   ym,  8, 'Gas',                      v.gas1, 'Transporte',  'Crédito',       'Necesidad'),
    exp(`${prefix}-gas2`,   ym, 22, 'Gas',                      v.gas2, 'Transporte',  'Crédito',       'Necesidad'),
    exp(`${prefix}-nflx`,   ym, 11, 'Netflix',                  15.49, 'Entretención', 'Crédito',       'Deseo',     'Mensual'),
    exp(`${prefix}-spot`,   ym, 11, 'Spotify',                  11.99, 'Entretención', 'Crédito',       'Deseo',     'Mensual'),
  ]
}

export const US_EXPENSES = [
  ...monthlyFixed('us-e0', M0, { elec: 138.62, water: 52.18, gro1: 112.47, gro2: 94.86, gas1: 41.20, gas2: 38.75 }),
  exp('us-e0-brakes', M0, 10, 'Brake pads and rotors',   486.70, 'Transporte',   'Crédito', 'Necesidad', 'Único', 'Unplanned repair'),
  exp('us-e0-urgent', M0, 13, 'Urgent care co-pay',       50.00, 'Salud',        'Débito',  'Necesidad'),
  exp('us-e0-dinner', M0, 15, 'Dinner with friends',      58.40, 'Alimentación', 'Crédito', 'Deseo'),
  exp('us-e0-concert', M0, 16, 'Concert tickets',         92.00, 'Entretención', 'Crédito', 'Deseo'),
  exp('us-e0-shoes',  M0, 19, 'Work shoes',               74.99, 'Ropa',         'Crédito', 'Necesidad'),

  ...monthlyFixed('us-e1', M1, { elec: 131.08, water: 49.80, gro1: 104.33, gro2: 121.57, gas1: 39.90, gas2: 44.12 }),
  exp('us-e1-target', M1, 20, 'Target — household items', 63.18, 'Otros',        'Débito',  'Necesidad'),
  ...monthlyFixed('us-e2', M2, { elec: 149.95, water: 55.12, gro1: 98.76, gro2: 109.04, gas1: 42.65, gas2: 37.80 }),
  exp('us-e2-dentist', M2, 12, 'Dentist — cleaning co-pay', 40.00, 'Salud',      'Débito',  'Necesidad'),
  ...monthlyFixed('us-e3', M3, { elec: 162.40, water: 51.03, gro1: 117.21, gro2: 92.38, gas1: 45.10, gas2: 40.25 }),
  exp('us-e3-gift',   M3, 21, 'Birthday gift for Mom',    85.00, 'Otros',        'Crédito', 'Deseo'),
  ...monthlyFixed('us-e4', M4, { elec: 118.27, water: 47.66, gro1: 101.92, gro2: 99.47, gas1: 36.40, gas2: 41.75 }),
  exp('us-e4-oil',    M4, 16, 'Oil change',               69.99, 'Transporte',   'Crédito', 'Necesidad'),
  ...monthlyFixed('us-e5', M5, { elec: 104.66, water: 46.90, gro1: 95.18, gro2: 113.64, gas1: 38.05, gas2: 39.60 }),
  exp('us-e5-movie',  M5, 24, 'Movie night',              34.50, 'Entretención', 'Crédito', 'Deseo'),
]

// ── PRESUPUESTOS ──────────────────────────────────────────────────────────────
// Transporte excedido por el arreglo, Alimentación y Entretención apenas
// pasados → el Coach tiene algo que decir en los dos escenarios.
export const US_BUDGETS = [
  { id: d('us-b1'), category: 'Vivienda',     limit: 1320 },
  { id: d('us-b2'), category: 'Alimentación', limit:  250 },
  { id: d('us-b3'), category: 'Transporte',   limit:  300 },
  { id: d('us-b4'), category: 'Entretención', limit:  100 },
  { id: d('us-b5'), category: 'Salud',        limit:   75 },
  { id: d('us-b6'), category: 'Servicios',    limit:  310 },
  { id: d('us-b7'), category: 'Ropa',         limit:   80 },
]

// ── DEUDAS ────────────────────────────────────────────────────────────────────
// La tarjeta tiene la tasa más alta → el simulador Avalanche la prioriza.
export const US_DEBTS = [
  { id: d('us-d1'), type: 'Auto',        creditor: 'Auto loan — 2021 Honda Civic', initial: 23_900.00, balance: 14_862.30, minPayment: 389.00, dueDate: nextMonthDate(12), rate: 7.4,   notes: '60 months' },
  { id: d('us-d2'), type: 'Tarjeta',     creditor: 'Credit card (Visa)',           initial:  3_200.00, balance:  2_614.55, minPayment:  78.00, dueDate: nextMonthDate(25), rate: 24.24, notes: 'APR 24.24%' },
  { id: d('us-d3'), type: 'Estudiantil', creditor: 'Federal student loan',         initial: 21_500.00, balance:  9_845.10, minPayment: 172.00, dueDate: nextMonthDate(1),  rate: 5.5,   notes: 'Standard repayment plan' },
]

// ── METAS ─────────────────────────────────────────────────────────────────────
// "Emergency fund" lo reconoce isEmergencyGoalName (IQ Score / Coach). El
// 401(k) ya sale del sueldo; el ahorro para retiro que ella maneja es la IRA
// (límite 2026: US$7,500, ver taxCalcUS.js) — la herramienta del país (US →
// Ahorro fiscal) muestra 401(k)/IRA/HSA.
export const US_GOALS = [
  { id: d('us-g1'), name: 'Emergency fund (3 months)',  target: 9000.00, saved: 2350.00, targetDate: nextYearDate(12, 31), priority: 'Alta',  color: '#B8863B', notes: '' },
  { id: d('us-g2'), name: 'Roth IRA — this year',       target: 7500.00, saved: 1750.00, targetDate: nextYearDate(4, 15),  priority: 'Media', color: '#14213D', notes: 'Annual limit' },
  { id: d('us-g3'), name: 'Trip home for the holidays', target: 1800.00, saved:  420.00, targetDate: nextYearDate(12, 15), priority: 'Media', color: '#5B7A99', notes: 'Flights + gifts' },
]

// ── SUSCRIPCIONES ─────────────────────────────────────────────────────────────
const sub = (id, name, category, amount, dd, paymentMethod, notes = '') =>
  ({ id, name, category, amount, currency: 'USD', frequency: 'monthly', nextPaymentDate: day(M0, dd), paymentMethod, status: 'active', notes, createdAt: '2026-01-01', updatedAt: '2026-01-01' })

export const US_SUBSCRIPTIONS = [
  sub('us-sub1', 'Netflix',          'Streaming',      15.49, 11, 'Visa'),
  sub('us-sub2', 'Spotify',          'Música',         11.99, 11, 'Visa'),
  sub('us-sub3', 'Amazon Prime',     'Delivery',       14.99,  7, 'Visa'),
  sub('us-sub4', 'iCloud+ 200 GB',   'Almacenamiento',  2.99, 23, 'Apple Pay'),
  sub('us-sub5', 'Gym membership',   'Gimnasio',       34.99,  5, 'Debit card'),
]

export const US_PERSONA = {
  ...US_PERSONA_META,
  incomesHard: HARD_INCOMES,
  incomesGood: GOOD_INCOMES,
  expenses: US_EXPENSES,
  budgets: US_BUDGETS,
  debts: US_DEBTS,
  goals: US_GOALS,
  subscriptions: US_SUBSCRIPTIONS,
}
