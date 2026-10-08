// src/demo/personas/de.js
// Persona del demo en alemán: Aylin Demir, 34 años, contadora en una empresa
// mediana de Colonia. Alquila (Warmmiete), cobra un sueldo neto mensual,
// tiene un crédito en cuotas por el auto y una compra de cocina en 0 %.
// Montos en EUR con centavos. Categorías = valores internos de la app; las
// descripciones van en alemán, como las escribiría ella.
// Escenarios: "mes bueno" = sueldo + devolución de impuestos + clases
// particulares; "mes difícil" = solo el sueldo. En el mes actual llegan la
// liquidación anual de gastos comunes (Nebenkostennachzahlung) y un arreglo
// del auto para la ITV (TÜV) — en el mes difícil el saldo queda negativo.
import { d, M0, M1, M2, M3, M4, M5, day, nextMonthDate, nextYearDate } from '../demoDates.js'

export const DE_PERSONA_META = { id: 'de', name: 'Aylin Demir', country: 'DE', currency: 'EUR' }

const SALARY = 2684.30
const salary = (id, ym) =>
  ({ id: d(id), date: day(ym, 1), source: 'Gehalt — Rheinwerk Logistik GmbH', amount: SALARY, category: 'Salario', recurrence: 'Mensual', notes: '' })

const PAST_INCOMES = [
  salary('de-i10', M1),
  salary('de-i20', M2),
  { id: d('de-i21'), date: day(M2, 19), source: 'Nachhilfe Mathematik', amount: 160.00, category: 'Freelance', recurrence: 'Único', notes: '' },
  salary('de-i30', M3),
  { id: d('de-i31'), date: day(M3, 28), source: 'Urlaubsgeld', amount: 950.00, category: 'Bono', recurrence: 'Único', notes: '' },
  salary('de-i40', M4),
  salary('de-i50', M5),
]

const HARD_INCOMES = [salary('de-i1', M0), ...PAST_INCOMES]
const GOOD_INCOMES = [
  salary('de-ix1', M0),
  { id: d('de-ix2'), date: day(M0, 9),  source: 'Steuererstattung Finanzamt', amount: 612.00, category: 'Otro',      recurrence: 'Único', notes: 'Einkommensteuer Vorjahr' },
  { id: d('de-ix3'), date: day(M0, 20), source: 'Nachhilfe Mathematik',       amount: 180.00, category: 'Freelance', recurrence: 'Único', notes: '' },
  ...PAST_INCOMES,
]

const exp = (id, ym, dd, description, amount, category, method, type, recurrence = 'Único', notes = '') =>
  ({ id: d(id), date: day(ym, dd), description, amount, category, method, type, recurrence, notes })

function monthlyFixed(prefix, ym, v) {
  return [
    exp(`${prefix}-miete`,  ym,  1, 'Warmmiete',                 980.00, 'Vivienda',     'Transferencia', 'Necesidad', 'Mensual'),
    exp(`${prefix}-strom`,  ym,  3, 'Strom (Abschlag)',           74.00, 'Servicios',    'Débito',        'Necesidad', 'Mensual'),
    exp(`${prefix}-inet`,   ym,  5, 'Internet',                   39.99, 'Servicios',    'Débito',        'Necesidad', 'Mensual'),
    exp(`${prefix}-handy`,  ym,  5, 'Handyvertrag',               17.99, 'Servicios',    'Débito',        'Necesidad', 'Mensual'),
    exp(`${prefix}-rfb`,    ym, 15, 'Rundfunkbeitrag',            18.36, 'Servicios',    'Débito',        'Necesidad', 'Mensual'),
    exp(`${prefix}-dt`,     ym,  1, 'Deutschlandticket',          63.00, 'Transporte',   'Débito',        'Necesidad', 'Mensual'),
    exp(`${prefix}-hpv`,    ym,  1, 'Haftpflichtversicherung',     6.25, 'Otros',        'Débito',        'Necesidad', 'Mensual'),
    exp(`${prefix}-rewe`,   ym,  4, 'Einkauf REWE',               v.rewe, 'Alimentación', 'Débito',       'Necesidad'),
    exp(`${prefix}-lidl`,   ym, 17, 'Wocheneinkauf Lidl',         v.lidl, 'Alimentación', 'Débito',       'Necesidad'),
    exp(`${prefix}-gym`,    ym,  2, 'Fitnessstudio',              29.90, 'Salud',        'Débito',        'Deseo',     'Mensual'),
    exp(`${prefix}-nflx`,   ym,  8, 'Netflix',                    13.99, 'Entretención', 'Crédito',       'Deseo',     'Mensual'),
    exp(`${prefix}-spot`,   ym,  8, 'Spotify',                    11.99, 'Entretención', 'Crédito',       'Deseo',     'Mensual'),
  ]
}

export const DE_EXPENSES = [
  ...monthlyFixed('de-e0', M0, { rewe: 87.43, lidl: 64.12 }),
  exp('de-e0-nk',    M0, 12, 'Nebenkostennachzahlung',     418.60, 'Vivienda',     'Transferencia', 'Necesidad', 'Único', 'Abrechnung Vorjahr'),
  exp('de-e0-tuev',  M0, 14, 'Autoreparatur vor dem TÜV',  640.00, 'Transporte',   'Débito',        'Necesidad', 'Único', 'Bremsen + Auspuff'),
  exp('de-e0-zahn',  M0, 10, 'Professionelle Zahnreinigung', 95.00, 'Salud',       'Débito',        'Necesidad'),
  exp('de-e0-essen', M0, 16, 'Abendessen mit Freunden',     46.50, 'Alimentación', 'Crédito',       'Deseo'),
  exp('de-e0-jacke', M0, 18, 'Winterjacke',                 89.95, 'Ropa',         'Crédito',       'Deseo'),

  ...monthlyFixed('de-e1', M1, { rewe: 92.18, lidl: 58.47 }),
  exp('de-e1-kino',  M1, 21, 'Kino',                        24.00, 'Entretención', 'Débito',        'Deseo'),
  ...monthlyFixed('de-e2', M2, { rewe: 79.65, lidl: 71.30 }),
  exp('de-e2-geschenk', M2, 23, 'Geburtstagsgeschenk',       45.00, 'Otros',       'Débito',        'Deseo'),
  ...monthlyFixed('de-e3', M3, { rewe: 101.24, lidl: 66.89 }),
  exp('de-e3-flug',  M3, 6, 'Flug Lissabon',               186.40, 'Entretención', 'Crédito',       'Deseo'),
  ...monthlyFixed('de-e4', M4, { rewe: 84.07, lidl: 62.55 }),
  exp('de-e4-apo',   M4, 13, 'Apotheke',                    18.70, 'Salud',        'Débito',        'Necesidad'),
  ...monthlyFixed('de-e5', M5, { rewe: 88.92, lidl: 59.33 }),
  exp('de-e5-schuhe', M5, 20, 'Laufschuhe',                 79.99, 'Ropa',         'Crédito',       'Deseo'),
]

export const DE_BUDGETS = [
  { id: d('de-b1'), category: 'Vivienda',     limit: 1000 },
  { id: d('de-b2'), category: 'Alimentación', limit:  220 },
  { id: d('de-b3'), category: 'Transporte',   limit:  120 },
  { id: d('de-b4'), category: 'Entretención', limit:   60 },
  { id: d('de-b5'), category: 'Salud',        limit:   60 },
  { id: d('de-b6'), category: 'Servicios',    limit:  160 },
  { id: d('de-b7'), category: 'Ropa',         limit:   60 },
]

export const DE_DEBTS = [
  { id: d('de-d1'), type: 'Auto',    creditor: 'Ratenkredit Auto',        initial: 12_000.00, balance: 6_480.00, minPayment: 215.00, dueDate: nextMonthDate(1),  rate: 5.9, notes: '60 Monate' },
  { id: d('de-d2'), type: 'Crédito', creditor: 'Ratenkauf Küche (0 %)',    initial:  1_800.00, balance:   900.00, minPayment:  75.00, dueDate: nextMonthDate(15), rate: 0,   notes: '24 Raten' },
]

// "Notgroschen" lo reconoce isEmergencyGoalName (IQ Score / Coach).
export const DE_GOALS = [
  { id: d('de-g1'), name: 'Notgroschen (3 Monatsausgaben)', target: 7500.00, saved: 3150.00, targetDate: nextYearDate(12, 31), priority: 'Alta',  color: '#B8863B', notes: '' },
  { id: d('de-g2'), name: 'Urlaub in Portugal',            target: 2000.00, saved:  640.00, targetDate: nextYearDate(7, 1),   priority: 'Media', color: '#14213D', notes: '' },
  { id: d('de-g3'), name: 'ETF-Sparplan — erstes Jahr',    target: 1800.00, saved:  900.00, targetDate: nextYearDate(12, 31), priority: 'Media', color: '#5B7A99', notes: '150 € pro Monat' },
]

const sub = (id, name, category, amount, dd, paymentMethod, notes = '') =>
  ({ id, name, category, amount, currency: 'EUR', frequency: 'monthly', nextPaymentDate: day(M0, dd), paymentMethod, status: 'active', notes, createdAt: '2026-01-01', updatedAt: '2026-01-01' })

export const DE_SUBSCRIPTIONS = [
  sub('de-sub1', 'Netflix',          'Streaming',      13.99,  8, 'Kreditkarte'),
  sub('de-sub2', 'Spotify',          'Música',         11.99,  8, 'Kreditkarte'),
  sub('de-sub3', 'Fitnessstudio',    'Gimnasio',       29.90,  2, 'Lastschrift'),
  sub('de-sub4', 'Amazon Prime',     'Delivery',        8.99, 21, 'Kreditkarte'),
  sub('de-sub5', 'iCloud+ 200 GB',   'Almacenamiento',  2.99, 26, 'Apple Pay'),
]

export const DE_PERSONA = {
  ...DE_PERSONA_META,
  incomesHard: HARD_INCOMES,
  incomesGood: GOOD_INCOMES,
  expenses: DE_EXPENSES,
  budgets: DE_BUDGETS,
  debts: DE_DEBTS,
  goals: DE_GOALS,
  subscriptions: DE_SUBSCRIPTIONS,
}
