// src/demo/demoData.js
// Datos ficticios para el modo demo de moyiq.
// Personas (08-oct-2026): se elige por el idioma del navegador (pickDemoPersonaId):
//   es / pt → Sofía García (Colombia, COP) — este archivo
//   en      → Maya Robinson (EE. UU., USD) — personas/us.js
//   de      → Aylin Demir (Alemania, EUR) — personas/de.js
//   es-VE   → Gabriela Rondón (Venezuela, VES con tasa BCV) — personas/ve.js
//   ?demo=true&persona=<id> elige la persona a mano (enlaces de la landing).
// Perfil Sofía: Diseñadora freelance, 28 años, Colombia
// 6 meses de datos. Mes actual con flujo negativo (realista para freelancer).
// IMPORTANTE: estos datos nunca se escriben en IndexedDB

import { detectLanguage } from '../i18n/translate.js'
import { US_PERSONA } from './personas/us.js'
import { DE_PERSONA } from './personas/de.js'
import { VE_PERSONA } from './personas/ve.js'

import { d, M0, M1, M2, M3, M4, M5, day, nextMonthDate, nextYearDate } from './demoDates.js'
import { demoRecurringRules } from './demoRecurring.js'
import { seedDemoReview } from '../utils/review.js'
import { suggestMatch } from '../utils/categoryRules.js'

// ── SETTINGS ──────────────────────────────────────────────────────────────────
export const DEMO_SETTINGS = {
  currency: 'COP',
  country: 'CO',
  theme: 'light',
  // Idioma inicial = el del navegador (es/en/pt/de, default es), el mismo que
  // usa DemoGate. Moneda/país los pisa la persona elegida (buildDemoState).
  language: detectLanguage(),
  savingGoalPct: 20,
  onboardingDone: true,
  activeMonth: M0,
  isDemo: true,
  // El demo muestra todo, también Inversiones (apagado por defecto en una cuenta real).
  modules: { properties: true, advisor: true, investments: true },
}

// ── INGRESOS ──────────────────────────────────────────────────────────────────
// Mes actual: flujo negativo — cobró menos de lo normal (cliente retrasó pago)
export const DEMO_INCOMES = [
  // Mes actual — mes difícil: solo cobró un proyecto parcial
  { id: d('i1'),  date: day(M0,  5), source: 'Proyecto diseño — cliente Bogotá',   amount: 1_800_000, category: 'Freelance', recurrence: 'Único',   notes: 'Pago parcial, falta 50%' },
  { id: d('i2'),  date: day(M0, 12), source: 'Clases de diseño online',            amount:   480_000, category: 'Freelance', recurrence: 'Mensual', notes: '' },
  // Mes anterior — mes bueno
  { id: d('i4'),  date: day(M1,  3), source: 'Proyecto branding — startup',        amount: 3_200_000, category: 'Freelance', recurrence: 'Único',   notes: '' },
  { id: d('i5'),  date: day(M1, 10), source: 'Clases de diseño online',            amount:   480_000, category: 'Freelance', recurrence: 'Mensual', notes: '' },
  { id: d('i6'),  date: day(M1, 20), source: 'Venta de plantillas en línea',           amount:   320_000, category: 'Otro',      recurrence: 'Único',   notes: '' },
  // Hace 2 meses
  { id: d('i7'),  date: day(M2,  2), source: 'Proyecto web — cliente Medellín',    amount: 2_800_000, category: 'Freelance', recurrence: 'Único',   notes: '' },
  { id: d('i8'),  date: day(M2, 10), source: 'Clases de diseño online',            amount:   480_000, category: 'Freelance', recurrence: 'Mensual', notes: '' },
  { id: d('i9'),  date: day(M2, 25), source: 'Consultoría UX — empresa',           amount:   900_000, category: 'Freelance', recurrence: 'Único',   notes: '' },
  // Hace 3 meses
  { id: d('i10'), date: day(M3,  1), source: 'Proyecto diseño — cliente Cali',     amount: 2_500_000, category: 'Freelance', recurrence: 'Único',   notes: '' },
  { id: d('i11'), date: day(M3, 10), source: 'Clases de diseño online',            amount:   480_000, category: 'Freelance', recurrence: 'Mensual', notes: '' },
  // Hace 4 meses
  { id: d('i12'), date: day(M4,  4), source: 'Proyecto identidad visual',          amount: 3_500_000, category: 'Freelance', recurrence: 'Único',   notes: '' },
  { id: d('i13'), date: day(M4, 10), source: 'Clases de diseño online',            amount:   480_000, category: 'Freelance', recurrence: 'Mensual', notes: '' },
  { id: d('i14'), date: day(M4, 22), source: 'Venta activos digitales',            amount:   150_000, category: 'Otro',      recurrence: 'Único',   notes: '' },
  // Hace 5 meses
  { id: d('i15'), date: day(M5,  3), source: 'Proyecto redes sociales — marca',    amount: 1_900_000, category: 'Freelance', recurrence: 'Único',   notes: '' },
  { id: d('i16'), date: day(M5, 10), source: 'Clases de diseño online',            amount:   480_000, category: 'Freelance', recurrence: 'Mensual', notes: '' },
]

// ── GASTOS ────────────────────────────────────────────────────────────────────
// Mes actual: gastos normales pero ingresos bajos → balance negativo
export const DEMO_EXPENSES = [
  // Mes actual — Necesidades
  { id: d('e1'),  date: day(M0,  1), description: 'Alquiler apartamento Bogotá',   amount:  950_000, category: 'Vivienda',        method: 'Transferencia', type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  { id: d('e2'),  date: day(M0,  2), description: 'Servicios públicos',            amount:  145_000, category: 'Servicios',       method: 'Transferencia', type: 'Necesidad', recurrence: 'Mensual', notes: 'Luz + agua + gas' },
  { id: d('e3'),  date: day(M0,  3), description: 'Mercado semana 1',              amount:  185_000, category: 'Alimentación',    method: 'Débito',        type: 'Necesidad', recurrence: 'Único',   notes: '' },
  { id: d('e4'),  date: day(M0,  5), description: 'Recarga de transporte público',         amount:   52_000, category: 'Transporte',      method: 'Débito',        type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  { id: d('e5'),  date: day(M0,  7), description: 'Farmacia — vitaminas',         amount:   43_000, category: 'Salud',           method: 'Débito',        type: 'Necesidad', recurrence: 'Único',   notes: '' },
  { id: d('e6'),  date: day(M0, 11), description: 'Mercado semana 2',              amount:  168_000, category: 'Alimentación',    method: 'Débito',        type: 'Necesidad', recurrence: 'Único',   notes: '' },
  { id: d('e7'),  date: day(M0, 14), description: 'Internet hogar',               amount:   79_000, category: 'Servicios',       method: 'Débito',        type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  // Mes actual — Deseos
  { id: d('e8'),  date: day(M0,  4), description: 'Streaming de video',                      amount:   47_900, category: 'Entretención', method: 'Crédito',       type: 'Deseo',     recurrence: 'Mensual', notes: '' },
  { id: d('e9'),  date: day(M0,  4), description: 'Música en streaming',                      amount:   16_900, category: 'Entretención', method: 'Crédito',       type: 'Deseo',     recurrence: 'Mensual', notes: '' },
  { id: d('e10'), date: day(M0,  8), description: 'Suite de diseño',         amount:   62_000, category: 'Educación',       method: 'Crédito',       type: 'Deseo',     recurrence: 'Mensual', notes: 'Herramienta de trabajo' },
  { id: d('e11'), date: day(M0, 10), description: 'Almuerzo cliente — Zona Rosa',  amount:   82_000, category: 'Alimentación',    method: 'Crédito',       type: 'Deseo',     recurrence: 'Único',   notes: 'Reunión de negocio' },
  { id: d('e12'), date: day(M0, 13), description: 'Ropa — descuento 40%',         amount:  210_000, category: 'Ropa',            method: 'Crédito',       type: 'Deseo',     recurrence: 'Único',   notes: 'Outlet del centro comercial' },
  { id: d('e13'), date: day(M0, 15), description: 'Salida con amigas',            amount:  120_000, category: 'Entretención', method: 'Débito',        type: 'Deseo',     recurrence: 'Único',   notes: '' },
  // Mes anterior
  { id: d('e14'), date: day(M1,  1), description: 'Alquiler apartamento',         amount:  950_000, category: 'Vivienda',        method: 'Transferencia', type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  { id: d('e15'), date: day(M1,  2), description: 'Servicios públicos',           amount:  138_000, category: 'Servicios',       method: 'Transferencia', type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  { id: d('e16'), date: day(M1,  4), description: 'Streaming de video',                      amount:   47_900, category: 'Entretención', method: 'Crédito',       type: 'Deseo',     recurrence: 'Mensual', notes: '' },
  { id: d('e17'), date: day(M1,  4), description: 'Música en streaming',                      amount:   16_900, category: 'Entretención', method: 'Crédito',       type: 'Deseo',     recurrence: 'Mensual', notes: '' },
  { id: d('e18'), date: day(M1,  5), description: 'Mercado + domicilios',         amount:  420_000, category: 'Alimentación',    method: 'Débito',        type: 'Necesidad', recurrence: 'Único',   notes: '' },
  { id: d('e19'), date: day(M1,  7), description: 'Internet hogar',               amount:   79_000, category: 'Servicios',       method: 'Débito',        type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  { id: d('e20'), date: day(M1, 10), description: 'Suite de diseño',         amount:   62_000, category: 'Educación',       method: 'Crédito',       type: 'Deseo',     recurrence: 'Mensual', notes: '' },
  { id: d('e21'), date: day(M1, 12), description: 'Recarga de transporte público',         amount:   52_000, category: 'Transporte',      method: 'Débito',        type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  { id: d('e22'), date: day(M1, 18), description: 'Concierto + cena',             amount:  185_000, category: 'Entretención', method: 'Débito',        type: 'Deseo',     recurrence: 'Único',   notes: '' },
  { id: d('e23'), date: day(M1, 25), description: 'Ropa trabajo',                 amount:  145_000, category: 'Ropa',            method: 'Crédito',       type: 'Deseo',     recurrence: 'Único',   notes: '' },
  // Hace 2 meses
  { id: d('e24'), date: day(M2,  1), description: 'Alquiler apartamento',         amount:  950_000, category: 'Vivienda',        method: 'Transferencia', type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  { id: d('e25'), date: day(M2,  2), description: 'Servicios públicos',           amount:  142_000, category: 'Servicios',       method: 'Transferencia', type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  { id: d('e26'), date: day(M2,  4), description: 'Streaming de video',                      amount:   47_900, category: 'Entretención', method: 'Crédito',       type: 'Deseo',     recurrence: 'Mensual', notes: '' },
  { id: d('e27'), date: day(M2,  4), description: 'Música en streaming',                      amount:   16_900, category: 'Entretención', method: 'Crédito',       type: 'Deseo',     recurrence: 'Mensual', notes: '' },
  { id: d('e28'), date: day(M2,  6), description: 'Mercado del mes',              amount:  395_000, category: 'Alimentación',    method: 'Débito',        type: 'Necesidad', recurrence: 'Único',   notes: '' },
  { id: d('e29'), date: day(M2,  7), description: 'Internet hogar',               amount:   79_000, category: 'Servicios',       method: 'Débito',        type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  { id: d('e30'), date: day(M2, 10), description: 'Suite de diseño',         amount:   62_000, category: 'Educación',       method: 'Crédito',       type: 'Deseo',     recurrence: 'Mensual', notes: '' },
  { id: d('e31'), date: day(M2, 15), description: 'Recarga de transporte público',         amount:   52_000, category: 'Transporte',      method: 'Débito',        type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  { id: d('e32'), date: day(M2, 22), description: 'Médico particular',            amount:   95_000, category: 'Salud',           method: 'Débito',        type: 'Necesidad', recurrence: 'Único',   notes: 'Consulta dermatología' },
  // Hace 3 meses
  { id: d('e33'), date: day(M3,  1), description: 'Alquiler apartamento',         amount:  950_000, category: 'Vivienda',        method: 'Transferencia', type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  { id: d('e34'), date: day(M3,  2), description: 'Servicios públicos',           amount:  135_000, category: 'Servicios',       method: 'Transferencia', type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  { id: d('e35'), date: day(M3,  4), description: 'Streaming de video',                      amount:   47_900, category: 'Entretención', method: 'Crédito',       type: 'Deseo',     recurrence: 'Mensual', notes: '' },
  { id: d('e36'), date: day(M3,  4), description: 'Música en streaming',                      amount:   16_900, category: 'Entretención', method: 'Crédito',       type: 'Deseo',     recurrence: 'Mensual', notes: '' },
  { id: d('e37'), date: day(M3,  5), description: 'Mercado del mes',              amount:  368_000, category: 'Alimentación',    method: 'Débito',        type: 'Necesidad', recurrence: 'Único',   notes: '' },
  { id: d('e38'), date: day(M3,  7), description: 'Internet hogar',               amount:   79_000, category: 'Servicios',       method: 'Débito',        type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  { id: d('e39'), date: day(M3, 10), description: 'Suite de diseño',         amount:   62_000, category: 'Educación',       method: 'Crédito',       type: 'Deseo',     recurrence: 'Mensual', notes: '' },
  { id: d('e40'), date: day(M3, 14), description: 'Recarga de transporte público',         amount:   52_000, category: 'Transporte',      method: 'Débito',        type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  { id: d('e41'), date: day(M3, 20), description: 'Ropa temporada',               amount:  230_000, category: 'Ropa',            method: 'Crédito',       type: 'Deseo',     recurrence: 'Único',   notes: '' },
  // Hace 4 meses
  { id: d('e42'), date: day(M4,  1), description: 'Alquiler apartamento',         amount:  950_000, category: 'Vivienda',        method: 'Transferencia', type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  { id: d('e43'), date: day(M4,  2), description: 'Servicios públicos',           amount:  130_000, category: 'Servicios',       method: 'Transferencia', type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  { id: d('e44'), date: day(M4,  4), description: 'Streaming de video',                      amount:   47_900, category: 'Entretención', method: 'Crédito',       type: 'Deseo',     recurrence: 'Mensual', notes: '' },
  { id: d('e45'), date: day(M4,  4), description: 'Música en streaming',                      amount:   16_900, category: 'Entretención', method: 'Crédito',       type: 'Deseo',     recurrence: 'Mensual', notes: '' },
  { id: d('e46'), date: day(M4,  5), description: 'Mercado del mes',              amount:  355_000, category: 'Alimentación',    method: 'Débito',        type: 'Necesidad', recurrence: 'Único',   notes: '' },
  { id: d('e47'), date: day(M4,  7), description: 'Internet hogar',               amount:   79_000, category: 'Servicios',       method: 'Débito',        type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  { id: d('e48'), date: day(M4, 10), description: 'Suite de diseño',         amount:   62_000, category: 'Educación',       method: 'Crédito',       type: 'Deseo',     recurrence: 'Mensual', notes: '' },
  { id: d('e49'), date: day(M4, 14), description: 'Recarga de transporte público',         amount:   52_000, category: 'Transporte',      method: 'Débito',        type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  // Hace 5 meses
  { id: d('e50'), date: day(M5,  1), description: 'Alquiler apartamento',         amount:  950_000, category: 'Vivienda',        method: 'Transferencia', type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  { id: d('e51'), date: day(M5,  2), description: 'Servicios públicos',           amount:  128_000, category: 'Servicios',       method: 'Transferencia', type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  { id: d('e52'), date: day(M5,  4), description: 'Streaming de video',                      amount:   47_900, category: 'Entretención', method: 'Crédito',       type: 'Deseo',     recurrence: 'Mensual', notes: '' },
  { id: d('e53'), date: day(M5,  4), description: 'Música en streaming',                      amount:   16_900, category: 'Entretención', method: 'Crédito',       type: 'Deseo',     recurrence: 'Mensual', notes: '' },
  { id: d('e54'), date: day(M5,  5), description: 'Mercado del mes',              amount:  342_000, category: 'Alimentación',    method: 'Débito',        type: 'Necesidad', recurrence: 'Único',   notes: '' },
  { id: d('e55'), date: day(M5,  7), description: 'Internet hogar',               amount:   79_000, category: 'Servicios',       method: 'Débito',        type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  { id: d('e56'), date: day(M5, 10), description: 'Suite de diseño',         amount:   62_000, category: 'Educación',       method: 'Crédito',       type: 'Deseo',     recurrence: 'Mensual', notes: '' },
  { id: d('e57'), date: day(M5, 14), description: 'Recarga de transporte público',         amount:   52_000, category: 'Transporte',      method: 'Débito',        type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  { id: d('e58'), date: day(M5, 20), description: 'Vacuna + cita médica',         amount:   85_000, category: 'Salud',           method: 'Débito',        type: 'Necesidad', recurrence: 'Único',   notes: '' },
]

// ── PRESUPUESTOS ──────────────────────────────────────────────────────────────
// Alimentación excedido (123%), Entretención excedido (163%) → activa Coach
export const DEMO_BUDGETS = [
  { id: d('b1'), category: 'Vivienda',        limit:  950_000 },
  { id: d('b2'), category: 'Alimentación',    limit:  400_000 },  // gasto real: $482k → 120%
  { id: d('b3'), category: 'Transporte',      limit:  120_000 },
  { id: d('b4'), category: 'Entretención', limit:  120_000 },  // gasto real: $187k → 156%
  { id: d('b5'), category: 'Salud',           limit:   80_000 },
  { id: d('b6'), category: 'Servicios',       limit:  280_000 },
  { id: d('b7'), category: 'Educación',       limit:  100_000 },
]

// ── DEUDAS ────────────────────────────────────────────────────────────────────
// Dos deudas con tasas altas → simulador Avalanche muestra ahorro real
export const DEMO_DEBTS = [
  { id: d('d1'), debtType: 'Tarjeta', creditor: 'Tarjeta de crédito',   initial: 4_200_000,  balance: 3_800_000,  minPayment: 190_000, dueDate: nextMonthDate(15), rate: 24.0, notes: 'Tasa efectiva anual 24%', creditLimit: 6_000_000, statementAmount: 1_450_000 },
  { id: d('d2'), debtType: 'Crédito', creditor: 'Crédito de consumo',    initial: 8_500_000,  balance: 7_200_000,  minPayment: 320_000, dueDate: nextMonthDate(5),  rate: 18.5, notes: 'Préstamo a 36 meses', totalInstallments: 36, paidInstallments: 9 },
]

// ── METAS ─────────────────────────────────────────────────────────────────────
export const DEMO_GOALS = [
  { id: d('g1'), name: 'Fondo de emergencia (3 meses)', target: 5_000_000, saved: 1_200_000, targetDate: nextYearDate(12, 31), priority: 'Alta',  color: '#B07414', notes: '~24% del objetivo' },
  { id: d('g2'), name: 'Viaje a México en diciembre',   target: 3_500_000, saved:   450_000, targetDate: nextYearDate(12, 15), priority: 'Media', color: '#3C2282', notes: 'Vuelos + 7 noches' },
  { id: d('g3'), name: 'Equipo de diseño (computador)',        target: 8_200_000, saved: 2_100_000, targetDate: nextYearDate(6, 1),  priority: 'Alta',  color: '#0E8C8C', notes: 'Computador portátil para diseñar' },
]

// ── SUSCRIPCIONES ──────────────────────────────────────────────────────────────
// En COP — costo anual visible genera el "momento wow"
export const DEMO_SUBSCRIPTIONS = [
  { id: 'sub1', name: 'Streaming de video',            category: 'Streaming',     amount:  47_900, currency: 'COP', frequency: 'monthly', nextPaymentDate: day(M0,  4), paymentMethod: 'Tarjeta de crédito', status: 'active', notes: '', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'sub2', name: 'Música en streaming',            category: 'Música',        amount:  16_900, currency: 'COP', frequency: 'monthly', nextPaymentDate: day(M0,  4), paymentMethod: 'Tarjeta de crédito', status: 'active', notes: '', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'sub3', name: 'Suite de diseño', category: 'Productividad', amount: 62_000, currency: 'COP', frequency: 'monthly', nextPaymentDate: day(M0, 10), paymentMethod: 'Tarjeta de crédito', status: 'active', notes: 'Herramienta principal', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'sub4', name: 'Video sin anuncios',    category: 'Streaming',     amount:  19_900, currency: 'COP', frequency: 'monthly', nextPaymentDate: day(M0, 20), paymentMethod: 'Billetera digital', status: 'active', notes: '', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'sub5', name: 'Herramienta de diseño',          category: 'Productividad', amount:  58_000, currency: 'COP', frequency: 'monthly', nextPaymentDate: day(M0, 15), paymentMethod: 'Tarjeta de crédito', status: 'active', notes: 'Plan profesional', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
  { id: 'sub6', name: 'Nube 200 GB',   category: 'Almacenamiento', amount:  9_900, currency: 'COP', frequency: 'monthly', nextPaymentDate: day(M0, 18), paymentMethod: 'Billetera digital', status: 'active', notes: '', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
]

// ── INGRESOS MES EXITOSO (escenario alternativo para toggle) ─────────────────
export const DEMO_INCOMES_EXITOSO = [
  { id: d('ix1'), date: day(M0,  2), source: 'Proyecto branding — startup LATAM',  amount: 3_800_000, category: 'Freelance', recurrence: 'Único',   notes: 'Cliente nuevo — pago completo' },
  { id: d('ix2'), date: day(M0, 10), source: 'Clases de diseño online',             amount:   480_000, category: 'Freelance', recurrence: 'Mensual', notes: '' },
  { id: d('ix3'), date: day(M0, 18), source: 'Venta de plantillas en línea',            amount:   420_000, category: 'Otro',      recurrence: 'Único',   notes: 'Lanzamiento nuevo pack' },
  // meses anteriores — igual que DEMO_INCOMES
  ...DEMO_INCOMES.filter(r => !r.date.startsWith(M0)),
]

// ── ESTADO COMPLETO ───────────────────────────────────────────────────────────
export const DEMO_STATE = {
  incomes:       DEMO_INCOMES,
  expenses:      DEMO_EXPENSES,
  budgets:       DEMO_BUDGETS,
  debts:         DEMO_DEBTS,
  goals:         DEMO_GOALS,
  subscriptions: DEMO_SUBSCRIPTIONS,
  settings:      DEMO_SETTINGS,
}

// ── PERSONAS ──────────────────────────────────────────────────────────────────
export const SOFIA_PERSONA = {
  id: 'sofia', name: 'Sofía García', country: 'CO', currency: 'COP',
  incomesHard: DEMO_INCOMES,
  incomesGood: DEMO_INCOMES_EXITOSO,
  expenses: DEMO_EXPENSES,
  budgets: DEMO_BUDGETS,
  debts: DEMO_DEBTS,
  goals: DEMO_GOALS,
  subscriptions: DEMO_SUBSCRIPTIONS,
}

export const DEMO_PERSONAS = { sofia: SOFIA_PERSONA, us: US_PERSONA, de: DE_PERSONA, ve: VE_PERSONA }

// Persona con que arranca el demo.
// 1. `?persona=<id>` en la URL (us, de, ve, sofia) manda: así la landing
//    enlaza la persona del país (p. ej. el hero de Venezuela →
//    https://demo.moyiq.app/app/?demo=true&persona=ve).
// 2. Si no, el idioma: en → EE. UU., de → Alemania. En español, un navegador
//    con región Venezuela (es-VE) va a Gabriela; el resto, a Sofía. Portugués
//    sigue con Sofía: no hay persona brasileña/portuguesa todavía.
export function pickDemoPersonaId(language, { search = '', locales = [] } = {}) {
  let forced = null
  try { forced = new URLSearchParams(search || '').get('persona') } catch { forced = null }
  forced = String(forced || '').trim().toLowerCase()
  if (Object.hasOwn(DEMO_PERSONAS, forced)) return forced
  if (language === 'en') return 'us'
  if (language === 'de') return 'de'
  const list = Array.isArray(locales) ? locales : [locales]
  if (language === 'es' && list.some(l => /^es[-_]ve$/i.test(String(l || '')))) return 've'
  return 'sofia'
}

// Estado completo del demo para una persona. `scenario`: 'exitoso' (mes bueno,
// el inicial) o 'dificil'.
// Movimientos con fecha posterior a hoy no deben aparecer como ya ocurridos
// (el 19-nov se veía "Quincena · lun 30 nov" arriba de "Hoy" y sumaba al mes).
// Lo que todavía no pasó vive en `recurring` (Próximos pagos).
export function onlyUntilToday(rows, today = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  const iso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  return rows.filter(r => !r.date || String(r.date).slice(0, 10) <= iso)
}

// Reglas de categoría del demo (24-nov-2026): las 2 palabras de comercio que
// más se repiten en los gastos de la persona con una sola categoría, para que
// Ajustes › Categorías y reglas no aparezca vacío. Marcadas `source: 'demo'`.
export function demoCategoryRules(expenses) {
  const by = new Map()
  for (const e of Array.isArray(expenses) ? expenses : []) {
    const key = suggestMatch(e?.description)
    if (!key || !e.category) continue
    const g = by.get(key) || { key, cats: new Set(), n: 0 }
    g.cats.add(e.category); g.n++
    by.set(key, g)
  }
  return [...by.values()].filter(g => g.cats.size === 1 && g.n >= 2)
    .sort((a, b) => b.n - a.n || (a.key < b.key ? -1 : 1)).slice(0, 2)
    .map(g => ({ id: `cr-demo-${g.key}`, match: g.key, category: [...g.cats][0], kind: 'expense', createdAt: '2026-01-01T00:00:00.000Z', source: 'demo' }))
}

export function buildDemoState(personaId, language = detectLanguage(), scenario = 'dificil') {
  const p = DEMO_PERSONAS[personaId] || SOFIA_PERSONA
  return {
    personaId: p.id,
    incomes:       onlyUntilToday(scenario === 'exitoso' ? p.incomesGood : p.incomesHard),
    // "Por revisar": 3 gastos del mes marcados, sin cambiar montos.
    expenses:      seedDemoReview(onlyUntilToday(p.expenses), M0),
    budgets:       p.budgets,
    debts:         p.debts,
    goals:         p.goals,
    subscriptions: p.subscriptions,
    recurring:     demoRecurringRules(p),
    settings:      { ...DEMO_SETTINGS, currency: p.currency, country: p.country, language, categoryRules: demoCategoryRules(p.expenses), ...(p.settings ? p.settings() : {}) },
  }
}

// Ingresos de un escenario hasta hoy (lo usa el selector de escenario del demo).
export function scenarioIncomes(personaId, scenario, today = new Date()) {
  const p = DEMO_PERSONAS[personaId] || SOFIA_PERSONA
  return onlyUntilToday(scenario === 'exitoso' ? p.incomesGood : p.incomesHard, today)
}

export const demoPersona = (personaId) => DEMO_PERSONAS[personaId] || SOFIA_PERSONA
