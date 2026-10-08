// src/demo/demoRecurring.js — movimientos fijos de las personas del demo.
// Solo en memoria (el demo nunca escribe en IndexedDB). Muestran el sistema
// completo: sueldo/ingreso fijo, arriendo y servicios, suscripciones y cuotas
// de deudas (estas dos salen de reconcileRules, igual que en la app real).
// Todas arrancan el día 1 del mes actual: los meses anteriores quedan como
// historia real, sin pendientes. Lo ya registrado en el mes actual (arriendo
// del día 1, Netflix…) aparece confirmado por coincidencia; lo que falta
// (cuotas, gimnasio, el segundo sueldo) queda previsto.
import { M0 } from './demoDates.js'
import { reconcileRules } from '../utils/recurringSources.js'
import { localDateStr } from '../utils/index.js'

const START = `${M0}-01`
const CREATED = '2026-01-01T00:00:00.000Z'

const manual = (id, kind, description, category, amount, day, extra = {}) => ({
  id: `demo-rec-${id}`, kind, source: 'manual', description, category,
  method: kind === 'expense' ? (extra.method || 'Débito') : undefined,
  amountMode: extra.amountMode || 'fixed',
  amounts: [{ from: M0, amount }],
  schedule: extra.schedule || { freq: 'monthly', day, anchorDate: `${M0}-${String(day).padStart(2, '0')}` },
  startDate: START, autoConfirm: !!extra.autoConfirm, paused: false, skipped: [], createdAt: CREATED,
})

const MANUAL = {
  sofia: [
    manual('so-clases', 'income', 'Clases de diseño online', 'Freelance', 480_000, 10),
    manual('so-arriendo', 'expense', 'Arriendo apartamento Bogotá', 'Vivienda', 950_000, 1, { method: 'Transferencia' }),
    manual('so-servicios', 'expense', 'Servicios públicos', 'Servicios', 145_000, 2, { method: 'PSE', amountMode: 'average' }),
    manual('so-transmi', 'expense', 'TransMilenio recarga', 'Transporte', 52_000, 5),
    manual('so-internet', 'expense', 'Internet hogar', 'Servicios', 79_000, 14),
  ],
  us: [
    manual('us-pay', 'income', 'Paycheck — Alamo Heights Medical Center', 'Salario', 1926.40, 3,
      { autoConfirm: true, schedule: { freq: 'biweekly', anchorDate: `${M0}-03` } }),
    manual('us-rent', 'expense', 'Rent — 1BR apartment', 'Vivienda', 1295.00, 1, { method: 'Transferencia' }),
    manual('us-renti', 'expense', "Renter's insurance", 'Vivienda', 16.50, 1, { method: 'Crédito' }),
    manual('us-elec', 'expense', 'Electric bill', 'Servicios', 138.62, 6, { amountMode: 'average' }),
    manual('us-net', 'expense', 'Internet', 'Servicios', 60.00, 9),
    manual('us-phone', 'expense', 'Phone plan', 'Servicios', 45.00, 9, { method: 'Crédito' }),
    manual('us-carins', 'expense', 'Car insurance', 'Transporte', 148.00, 14, { method: 'Crédito' }),
  ],
  de: [
    manual('de-gehalt', 'income', 'Gehalt — Rheinwerk Logistik GmbH', 'Salario', 2684.30, 1, { autoConfirm: true }),
    manual('de-miete', 'expense', 'Warmmiete', 'Vivienda', 980.00, 1, { method: 'Transferencia' }),
    manual('de-strom', 'expense', 'Strom (Abschlag)', 'Servicios', 74.00, 3),
    manual('de-inet', 'expense', 'Internet', 'Servicios', 39.99, 5),
    manual('de-handy', 'expense', 'Handyvertrag', 'Servicios', 17.99, 5),
    manual('de-rfb', 'expense', 'Rundfunkbeitrag', 'Servicios', 18.36, 15),
    manual('de-dt', 'expense', 'Deutschlandticket', 'Transporte', 63.00, 1),
  ],
}

// Reglas del demo para una persona: las manuales + las que derivan de sus
// suscripciones y deudas. En el demo las cuotas arrancan este mes aunque la
// fecha de vencimiento cargada sea del mes que viene, para que se vean.
export function demoRecurringRules(persona) {
  const today = localDateStr()
  const derived = reconcileRules([], persona.subscriptions, persona.debts, { today, now: CREATED })
    .map(r => ({ ...r, startDate: START, amounts: r.amounts.map(a => ({ ...a, from: M0 })) }))
  return [...(MANUAL[persona.id] || []), ...derived]
}
