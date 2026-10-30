// src/demo/personas/ve.js
// Persona del demo para Venezuela (EST-5, 21-oct-2026): Sofía en COP no
// representa a quien llega desde Venezuela. Datos ficticios y plausibles:
//   Gabriela Rondón, 30 años, asistente administrativa en una distribuidora de
//   alimentos en Caracas. Vive en un anexo alquilado en El Paraíso. Cobra la
//   quincena en bolívares (indexada al dólar) más el bono de alimentación; los
//   fines de semana lleva la contabilidad de dos bodegas, que le pagan en
//   dólares por Zelle, y su hermano en Santiago de Chile le manda una remesa.
// Moneda principal VES (Bs.), con la tasa del BCV guardada en Ajustes para que
// el Inicio muestre el equivalente en US$. Todo lo que ella cobra o paga en
// dólares se registra en bolívares a la tasa BCV del mes, y la nota dice el
// monto en US$ y la tasa (con el paralelo al lado, como lo anota la gente).
// Las tasas son referenciales y suben mes a mes; el mes de hace dos meses
// coincide con el respaldo de utils/tasaVE.js (BCV 771,07 · paralelo 865,62).
// Categorías = valores internos de la app; descripciones en español neutro,
// como las escribiría ella (sin voseo).
// Escenarios: "mes bueno" = quincenas + bono + las dos bodegas + un trabajo
// extra + la remesa; "mes difícil" = una bodega no pagó, la remesa no llegó y
// se dañó la nevera.
import { d, M0, M1, M2, M3, M4, M5, day, nextMonthDate, nextYearDate } from '../demoDates.js'

export const VE_PERSONA_META = { id: 've', name: 'Gabriela Rondón', country: 'VE', currency: 'VES' }

// Bs. por 1 US$, por mes (M0 = mes actual).
export const VE_RATES = {
  [M0]: { bcv: 885.40, paralelo: 1009.30 },
  [M1]: { bcv: 832.15, paralelo: 951.20 },
  [M2]: { bcv: 771.07, paralelo: 865.62 },
  [M3]: { bcv: 734.60, paralelo: 829.85 },
  [M4]: { bcv: 702.35, paralelo: 790.10 },
  [M5]: { bcv: 668.90, paralelo: 748.45 },
}

const round2 = (n) => Math.round(n * 100) / 100
// Monto en US$ → bolívares a la tasa BCV del mes.
export const bs = (usd, ym) => round2(usd * VE_RATES[ym].bcv)
// "1.009,30" — como se escribe en Venezuela.
const fmtRate = (n) => {
  const [int, dec] = n.toFixed(2).split('.')
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`
}
const usdNote = (usd, ym, how) =>
  `US$ ${usd} ${how} · BCV ${fmtRate(VE_RATES[ym].bcv)} · paralelo ${fmtRate(VE_RATES[ym].paralelo)}`
const lastDay = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate() }

// ── INGRESOS ──────────────────────────────────────────────────────────────────
const QUINCENA_USD = 80
const quincena = (id, ym, dd) =>
  ({ id: d(id), date: day(ym, dd), source: 'Quincena — Distribuidora El Ávila', amount: bs(QUINCENA_USD, ym), category: 'Salario', recurrence: 'Quincenal', notes: 'Sueldo en Bs indexado al dólar' })
const cesta = (id, ym) =>
  ({ id: d(id), date: day(ym, 5), source: 'Bono de alimentación (cestaticket)', amount: bs(40, ym), category: 'Bono', recurrence: 'Mensual', notes: '' })
const bodega = (id, ym, dd, name, usd) =>
  ({ id: d(id), date: day(ym, dd), source: `Contabilidad ${name}`, amount: bs(usd, ym), category: 'Freelance', recurrence: 'Mensual', notes: usdNote(usd, ym, 'por Zelle') })
const remesa = (id, ym, dd, usd = 100) =>
  ({ id: d(id), date: day(ym, dd), source: 'Remesa de Luis (Santiago de Chile)', amount: bs(usd, ym), category: 'Otro', recurrence: 'Mensual', notes: usdNote(usd, ym, 'recibidos') })

function salaryMonth(prefix, ym) {
  return [quincena(`${prefix}-q1`, ym, 15), quincena(`${prefix}-q2`, ym, lastDay(ym)), cesta(`${prefix}-cesta`, ym)]
}

const PAST_INCOMES = [
  ...salaryMonth('ve-i1', M1), bodega('ve-i1-b1', M1, 6, 'Bodega La Esquina', 100), bodega('ve-i1-b2', M1, 9, 'Abasto Don Manuel', 80), remesa('ve-i1-r', M1, 20),
  ...salaryMonth('ve-i2', M2), bodega('ve-i2-b1', M2, 6, 'Bodega La Esquina', 100), bodega('ve-i2-b2', M2, 12, 'Abasto Don Manuel', 80), remesa('ve-i2-r', M2, 18),
  ...salaryMonth('ve-i3', M3), bodega('ve-i3-b1', M3, 5, 'Bodega La Esquina', 100), bodega('ve-i3-b2', M3, 10, 'Abasto Don Manuel', 80), remesa('ve-i3-r', M3, 22, 80),
  ...salaryMonth('ve-i4', M4), bodega('ve-i4-b1', M4, 7, 'Bodega La Esquina', 100), remesa('ve-i4-r', M4, 19),
  { id: d('ve-i4-x'), date: day(M4, 24), source: 'Declaración de ISLR de un cliente', amount: bs(45, M4), category: 'Freelance', recurrence: 'Único', notes: usdNote(45, M4, 'en efectivo') },
  ...salaryMonth('ve-i5', M5), bodega('ve-i5-b1', M5, 6, 'Bodega La Esquina', 100), bodega('ve-i5-b2', M5, 11, 'Abasto Don Manuel', 80), remesa('ve-i5-r', M5, 21),
]

// Mes difícil: el abasto no pagó, la remesa no llegó y la bodega pagó una parte.
const HARD_INCOMES = [
  ...salaryMonth('ve-i0', M0),
  { ...bodega('ve-i0-b1', M0, 6, 'Bodega La Esquina', 60), notes: `${usdNote(60, M0, 'por Zelle')} · pagó una parte` },
  ...PAST_INCOMES,
]

// Mes bueno: las dos bodegas, un trabajo extra y la remesa.
const GOOD_INCOMES = [
  ...salaryMonth('ve-ix0', M0),
  bodega('ve-ix0-b1', M0, 6, 'Bodega La Esquina', 100),
  bodega('ve-ix0-b2', M0, 9, 'Abasto Don Manuel', 80),
  { id: d('ve-ix0-x'), date: day(M0, 14), source: 'Cierre contable de una ferretería', amount: bs(70, M0), category: 'Freelance', recurrence: 'Único', notes: usdNote(70, M0, 'por Binance (USDT)') },
  remesa('ve-ix0-r', M0, 18),
  ...PAST_INCOMES,
]

// ── GASTOS ────────────────────────────────────────────────────────────────────
const exp = (id, ym, dd, description, usd, category, method, type, recurrence = 'Único', notes = '') =>
  ({ id: d(id), date: day(ym, dd), description, amount: bs(usd, ym), category, method, type, recurrence, notes })

// Fijos de cada mes; v = montos variables en US$ de ese mes.
function monthlyFixed(prefix, ym, v) {
  return [
    exp(`${prefix}-alq`,    ym,  1, 'Alquiler anexo — El Paraíso',       200, 'Vivienda',     'Efectivo',      'Necesidad', 'Mensual', usdNote(200, ym, 'en efectivo')),
    exp(`${prefix}-cantv`,  ym,  8, 'CANTV — internet ABA y teléfono',     9, 'Servicios',    'Transferencia', 'Necesidad', 'Mensual', 'Pago Móvil'),
    exp(`${prefix}-dig`,    ym, 10, 'Plan Digitel',                         8, 'Servicios',    'Transferencia', 'Necesidad', 'Mensual', 'Pago Móvil'),
    exp(`${prefix}-mov`,    ym, 10, 'Recarga Movilnet — línea de mamá',     3, 'Servicios',    'Transferencia', 'Necesidad', 'Mensual', 'Pago Móvil'),
    exp(`${prefix}-luz`,    ym, 12, 'Corpoelec — luz',                   v.luz, 'Servicios',   'Transferencia', 'Necesidad', 'Mensual', 'Pago Móvil'),
    exp(`${prefix}-merc1`,  ym,  3, 'Mercado — Central Madeirense',     v.m1, 'Alimentación', 'Débito',        'Necesidad'),
    exp(`${prefix}-feria`,  ym, 11, 'Verduras — feria de Coche',        v.feria, 'Alimentación', 'Efectivo',   'Necesidad', 'Único', 'Pagado en US$ efectivo'),
    exp(`${prefix}-merc2`,  ym, 17, 'Mercado — Gama',                   v.m2, 'Alimentación', 'Transferencia', 'Necesidad', 'Único', 'Pago Móvil'),
    exp(`${prefix}-pas`,    ym,  2, 'Pasajes — Metro y camionetica',      18, 'Transporte',   'Efectivo',      'Necesidad', 'Mensual'),
    exp(`${prefix}-mama`,   ym, 25, 'Ayuda a mamá en Barquisimeto',        20, 'Otros',        'Transferencia', 'Necesidad', 'Mensual', 'Pago Móvil'),
    exp(`${prefix}-nflx`,   ym,  7, 'Netflix',                           5.99, 'Entretención', 'Crédito',       'Deseo',     'Mensual', 'Cobrado en US$'),
    exp(`${prefix}-spot`,   ym,  7, 'Spotify',                           3.99, 'Entretención', 'Crédito',       'Deseo',     'Mensual', 'Cobrado en US$'),
  ]
}

export const VE_EXPENSES = [
  ...monthlyFixed('ve-e0', M0, { luz: 4.20, m1: 58, feria: 24, m2: 31 }),
  exp('ve-e0-nevera', M0, 13, 'Reparación de la nevera (compresor)', 70, 'Vivienda',     'Efectivo',      'Necesidad', 'Único', 'Imprevisto'),
  exp('ve-e0-farma',  M0, 16, 'Farmatodo — medicinas',               14, 'Salud',        'Transferencia', 'Necesidad', 'Único', 'Pago Móvil'),
  exp('ve-e0-ridery', M0, 19, 'Ridery — regreso de noche',             7, 'Transporte',   'Billetera digital', 'Necesidad'),
  exp('ve-e0-cine',   M0, 20, 'Cine en el Sambil',                     9, 'Entretención', 'Débito',        'Deseo'),

  ...monthlyFixed('ve-e1', M1, { luz: 3.90, m1: 55, feria: 22, m2: 28 }),
  exp('ve-e1-gas',    M1, 14, 'Bombona de gas',                        6, 'Servicios',    'Efectivo',      'Necesidad'),
  exp('ve-e1-arepa',  M1, 21, 'Arepera con amigas',                   12, 'Alimentación', 'Transferencia', 'Deseo',     'Único', 'Pago Móvil'),
  ...monthlyFixed('ve-e2', M2, { luz: 4.40, m1: 61, feria: 25, m2: 26 }),
  exp('ve-e2-cel',    M2, 9, 'Celular Samsung A15 — inicial Cashea', 64, 'Tecnología',   'Transferencia', 'Necesidad', 'Único', 'Inicial del 40 %; el resto en cuotas sin intereses'),
  exp('ve-e2-farma',  M2, 23, 'Farmatodo — medicinas',               11, 'Salud',        'Transferencia', 'Necesidad', 'Único', 'Pago Móvil'),
  ...monthlyFixed('ve-e3', M3, { luz: 4.10, m1: 57, feria: 23, m2: 30 }),
  exp('ve-e3-gas',    M3, 15, 'Bombona de gas',                        6, 'Servicios',    'Efectivo',      'Necesidad'),
  exp('ve-e3-ropa',   M3, 20, 'Zapatos para el trabajo',              25, 'Ropa',         'Débito',        'Necesidad'),
  ...monthlyFixed('ve-e4', M4, { luz: 3.80, m1: 52, feria: 21, m2: 29 }),
  exp('ve-e4-cons',   M4, 13, 'Consulta médica y exámenes',          35, 'Salud',        'Efectivo',      'Necesidad', 'Único', 'Pagado en US$ efectivo'),
  ...monthlyFixed('ve-e5', M5, { luz: 3.70, m1: 54, feria: 20, m2: 27 }),
  exp('ve-e5-gas',    M5, 16, 'Bombona de gas',                        6, 'Servicios',    'Efectivo',      'Necesidad'),
  exp('ve-e5-playa',  M5, 24, 'Paseo a la playa (La Guaira)',         18, 'Entretención', 'Efectivo',      'Deseo'),
]

// ── PRESUPUESTOS ──────────────────────────────────────────────────────────────
// En Bs a la tasa de este mes. Vivienda se pasa por la nevera y Alimentación
// queda apenas pasada → el Coach tiene algo que decir en los dos escenarios.
export const VE_BUDGETS = [
  { id: d('ve-b1'), category: 'Vivienda',     limit: bs(210, M0) },
  { id: d('ve-b2'), category: 'Alimentación', limit: bs(105, M0) },
  { id: d('ve-b3'), category: 'Transporte',   limit: bs(30, M0) },
  { id: d('ve-b4'), category: 'Entretención', limit: bs(20, M0) },
  { id: d('ve-b5'), category: 'Salud',        limit: bs(15, M0) },
  { id: d('ve-b6'), category: 'Servicios',    limit: bs(30, M0) },
  { id: d('ve-b7'), category: 'Otros',        limit: bs(25, M0) },
]

// ── DEUDAS ────────────────────────────────────────────────────────────────────
// La tarjeta tiene la tasa más alta → el simulador Avalanche la prioriza.
export const VE_DEBTS = [
  { id: d('ve-d1'), type: 'Crédito', debtType: 'Crédito', creditor: 'Cashea — celular Samsung A15', initial: bs(96, M0), balance: bs(64, M0), minPayment: bs(32, M0), dueDate: nextMonthDate(9), rate: 0, notes: '6 cuotas quincenales sin intereses' },
  { id: d('ve-d2'), type: 'Tarjeta', debtType: 'Tarjeta', creditor: 'Tarjeta de crédito Banesco', initial: bs(150, M0), balance: bs(118, M0), minPayment: bs(15, M0), dueDate: nextMonthDate(20), rate: 58.0, notes: 'Tasa anual referencial' },
]

// ── METAS ─────────────────────────────────────────────────────────────────────
// "Fondo de emergencia" lo reconoce isEmergencyGoalName (IQ Score / Coach).
export const VE_GOALS = [
  { id: d('ve-g1'), name: 'Fondo de emergencia (3 meses)', target: bs(1200, M0), saved: bs(310, M0), targetDate: nextYearDate(12, 31), priority: 'Alta',  color: '#B8863B', notes: 'Ahorrado en US$: 310 de 1.200' },
  { id: d('ve-g2'), name: 'Moto para trabajar',            target: bs(1800, M0), saved: bs(420, M0), targetDate: nextYearDate(9, 1),   priority: 'Media', color: '#14213D', notes: 'Meta en US$: 1.800' },
  { id: d('ve-g3'), name: 'Viaje a Mérida en diciembre',   target: bs(350, M0),  saved: bs(90, M0),  targetDate: nextYearDate(12, 15), priority: 'Media', color: '#5B7A99', notes: 'Pasajes y posada' },
]

// ── SUSCRIPCIONES ─────────────────────────────────────────────────────────────
const sub = (id, name, category, usd, dd, paymentMethod, notes = 'Cobrado en US$') =>
  ({ id, name, category, amount: bs(usd, M0), currency: 'VES', frequency: 'monthly', nextPaymentDate: day(M0, dd), paymentMethod, status: 'active', notes, createdAt: '2026-01-01', updatedAt: '2026-01-01' })

export const VE_SUBSCRIPTIONS = [
  sub('ve-sub1', 'Netflix',           'Streaming',      5.99,  7, 'Tarjeta internacional'),
  sub('ve-sub2', 'Spotify',           'Música',         3.99,  7, 'Tarjeta internacional'),
  sub('ve-sub3', 'Google One 100 GB', 'Almacenamiento', 1.99, 22, 'Tarjeta internacional'),
]

// Ajustes propios de la persona: la tasa BCV del mes guardada como tasa de
// referencia, para que el Inicio muestre "Te queda" también en US$.
// B1: la fecha es la de ESA tasa (la del mes, día 1 a mediodía), no la de
// carga del demo: guardar Date.now() decía "hoy" para una cifra de otro día.
// Si la consulta en vivo trae una más reciente, el Inicio la ofrece con "Usar".
// El mes en curso se fecha HOY a la 1:00 (hora de publicación del BCV): en el
// demo es "la tasa de hoy" de la persona y no debe verse como vieja (antes salía
// "hace 28 días" en naranja en la primera pantalla del demo).
export const VE_RATE_AT = (ym = M0, now = new Date()) => {
  if (ym === M0) return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 1).getTime()
  const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1, 12).getTime()
}
// B5: foto mensual de la tasa (BCV) para la variación del mes en US$.
export const veMonthlyRefRates = () => Object.fromEntries(Object.entries(VE_RATES).map(([ym, r]) => [ym, r.bcv]))
export const veSettings = () => ({ usdRate: VE_RATES[M0].bcv, usdRateAt: VE_RATE_AT(M0), usdRateSource: 'bcv', monthlyRefRates: veMonthlyRefRates() })

export const VE_PERSONA = {
  ...VE_PERSONA_META,
  incomesHard: HARD_INCOMES,
  incomesGood: GOOD_INCOMES,
  expenses: VE_EXPENSES,
  budgets: VE_BUDGETS,
  debts: VE_DEBTS,
  goals: VE_GOALS,
  subscriptions: VE_SUBSCRIPTIONS,
  settings: veSettings,
}
