import { describe, it, expect } from 'vitest'
import { pickDemoPersonaId, buildDemoState, DEMO_PERSONAS, demoPersona } from './demoData.js'
import { M0 } from './demoDates.js'
import config from '../config.js'
import { monthPlan, pendingTotals } from '../utils/recurring.js'
import { isEmergencyGoalName } from '../utils/emergencyGoal.js'
import { currencyDecimals, CATS_EXPENSE, CATS_INCOME } from '../utils/index.js'

const sum = (rows, k = 'amount') => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0)
const inMonth = (rows) => rows.filter(r => r.date?.startsWith(M0))
// "Te queda este mes" del Inicio (decisión de Walter, 08-oct-2026): solo lo
// real (ingresos − gastos); lo previsto va aparte en "Previsto pendiente".
const leftThisMonth = (state) => sum(inMonth(state.incomes)) - sum(inMonth(state.expenses))
const pendingExpense = (state) => pendingTotals(monthPlan(state.recurring, M0, state)).expense

describe('selección de persona del demo por idioma', () => {
  it('en → EE. UU. en USD, de → Alemania en EUR, es/pt → Sofía en COP', () => {
    expect(pickDemoPersonaId('en')).toBe('us')
    expect(pickDemoPersonaId('de')).toBe('de')
    expect(pickDemoPersonaId('es')).toBe('sofia')
    expect(pickDemoPersonaId('pt')).toBe('sofia')
    expect(pickDemoPersonaId(undefined)).toBe('sofia')
  })
  it('EST-5: es-VE → Venezuela; ?persona=<id> manda sobre el idioma; un id desconocido se ignora', () => {
    expect(pickDemoPersonaId('es', { locales: ['es-VE', 'es'] })).toBe('ve')
    expect(pickDemoPersonaId('es', { locales: ['es_ve'] })).toBe('ve')
    expect(pickDemoPersonaId('es', { locales: ['es-CO'] })).toBe('sofia')
    expect(pickDemoPersonaId('en', { locales: ['en-US', 'es-VE'] })).toBe('us')
    expect(pickDemoPersonaId('es', { search: '?demo=true&persona=ve' })).toBe('ve')
    expect(pickDemoPersonaId('en', { search: '?demo=true&persona=VE' })).toBe('ve')
    expect(pickDemoPersonaId('es', { search: '?demo=true&persona=us' })).toBe('us')
    expect(pickDemoPersonaId('de', { search: '?demo=true&persona=toString' })).toBe('de')
    expect(pickDemoPersonaId('es', { search: '?demo=true&persona=xx', locales: ['es-VE'] })).toBe('ve')
  })
  it('buildDemoState aplica moneda y país de la persona y conserva el idioma', () => {
    const us = buildDemoState('us', 'en')
    expect(us.settings).toMatchObject({ currency: 'USD', country: 'US', language: 'en', isDemo: true })
    expect(buildDemoState('de', 'de').settings).toMatchObject({ currency: 'EUR', country: 'DE', language: 'de' })
    expect(buildDemoState('sofia', 'es').settings).toMatchObject({ currency: 'COP', country: 'CO', language: 'es' })
    expect(buildDemoState('nope', 'es').personaId).toBe('sofia')
    expect(buildDemoState('ve', 'es').settings).toMatchObject({ currency: 'VES', country: 'VE', language: 'es', usdRateSource: 'bcv' })
  })
  it('el banner tiene nombre y país para cada persona', () => {
    expect(demoPersona('us')).toMatchObject({ name: 'Maya Robinson', country: 'US' })
    expect(demoPersona('de')).toMatchObject({ name: 'Aylin Demir', country: 'DE' })
    expect(demoPersona('sofia')).toMatchObject({ name: 'Sofía García', country: 'CO' })
    expect(demoPersona('ve')).toMatchObject({ name: 'Gabriela Rondón', country: 'VE' })
  })
})

describe.each(Object.keys(DEMO_PERSONAS))('persona %s', (id) => {
  const p = DEMO_PERSONAS[id]
  const good = buildDemoState(id, 'es', 'exitoso')
  const hard = buildDemoState(id, 'es', 'dificil')

  it('mes bueno con saldo real positivo; en el difícil no alcanza para los fijos que faltan', () => {
    expect(leftThisMonth(good)).toBeGreaterThan(0)
    expect(leftThisMonth(hard) - pendingExpense(hard)).toBeLessThan(0)
  })
  it('muestra fijos: sueldo o ingreso fijo, arriendo, suscripciones y cuotas, con algo previsto', () => {
    const kinds = new Set(good.recurring.map(r => r.source))
    expect([...kinds].sort()).toEqual(['debt', 'manual', 'subscription'])
    expect(good.recurring.some(r => r.kind === 'income')).toBe(true)
    expect(good.recurring.some(r => r.category === 'Vivienda')).toBe(true)
    const plan = monthPlan(good.recurring, M0, good)
    expect(plan.some(o => o.status === 'pending')).toBe(true)
    expect(plan.some(o => o.status === 'confirmed')).toBe(true)
    for (const r of good.recurring) expect([...CATS_EXPENSE, 'Deudas', ...CATS_INCOME]).toContain(r.category)
  })
  it('categorías = valores internos de la app (las etiquetas se traducen aparte)', () => {
    for (const r of p.expenses) expect(config.categoriesExpense).toContain(r.category)
    for (const r of [...p.incomesGood, ...p.incomesHard]) expect(config.categoriesIncome).toContain(r.category)
    for (const b of p.budgets) expect(config.categoriesExpense).toContain(b.category)
    for (const r of p.expenses) expect(config.recurrences).toContain(r.recurrence)
  })
  it('ids únicos y montos válidos para los decimales de la moneda', () => {
    const all = [...p.incomesGood, ...p.incomesHard.filter(r => !p.incomesGood.includes(r)), ...p.expenses, ...p.budgets, ...p.debts, ...p.goals, ...p.subscriptions]
    const ids = all.map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    const f = 10 ** currencyDecimals(p.currency)
    for (const r of [...p.expenses, ...p.incomesGood, ...p.subscriptions]) {
      expect(r.amount).toBeGreaterThan(0)
      expect(Math.abs(Math.round(r.amount * f) - r.amount * f)).toBeLessThan(1e-6)
    }
  })
  it('tiene un fondo de emergencia que reconoce el IQ Score', () => {
    expect(p.goals.some(g => isEmergencyGoalName(g.name))).toBe(true)
  })
  it('seis meses de historia', () => {
    const months = new Set(p.expenses.map(r => r.date.slice(0, 7)))
    expect(months.size).toBe(6)
  })
})

describe('persona de EE. UU.', () => {
  const p = DEMO_PERSONAS.us
  it('montos con centavos y sueldo quincenal', () => {
    expect(p.expenses.some(r => !Number.isInteger(r.amount))).toBe(true)
    expect(p.incomesGood.filter(r => r.date.startsWith(M0) && r.category === 'Salario').length).toBe(2)
    expect(p.incomesGood.every(r => r.category !== 'Salario' || r.recurrence === 'Quincenal')).toBe(true)
  })
  it('alquiler, préstamo de auto, tarjeta de crédito y suscripciones en USD', () => {
    expect(p.expenses.some(r => /rent/i.test(r.description))).toBe(true)
    expect(p.debts.map(d => d.type)).toEqual(expect.arrayContaining(['Auto', 'Tarjeta']))
    expect(p.subscriptions.every(s => s.currency === 'USD')).toBe(true)
  })
})

describe('persona de Venezuela (EST-5)', () => {
  const p = DEMO_PERSONAS.ve
  const st = buildDemoState('ve', 'es', 'exitoso')
  const texts = [...p.incomesGood, ...p.incomesHard].map(r => `${r.source} ${r.notes}`)
    .concat(p.expenses.map(r => `${r.description} ${r.notes}`), p.debts.map(x => `${x.creditor} ${x.notes}`), p.goals.map(g => `${g.name} ${g.notes}`))
  it('VES con la tasa BCV guardada: el Inicio muestra el equivalente en US$', () => {
    expect(st.settings.usdRate).toBeGreaterThan(0)
    expect(st.settings.usdRateAt).toBeGreaterThan(0)
    expect(p.subscriptions.every(s => s.currency === 'VES')).toBe(true)
  })
  it('B1: la tasa guardada lleva la fecha de esa tasa (la del mes), no la de carga del demo', () => {
    const at = new Date(st.settings.usdRateAt)
    expect(st.settings.usdRateSource).toBe('bcv')
    expect(`${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`).toBe(M0)
    expect(at.getDate()).toBe(1)
  })
  it('ingresos en Bs y en US$, con BCV y paralelo a la vista', () => {
    const m0 = p.incomesGood.filter(r => r.date.startsWith(M0))
    expect(m0.filter(r => r.category === 'Salario').length).toBe(2)
    expect(m0.some(r => /US\$/.test(r.notes) && /BCV/.test(r.notes) && /paralelo/.test(r.notes))).toBe(true)
    expect(texts.some(t => /remesa/i.test(t))).toBe(true)
  })
  it('gastos típicos: Cashea, Pago Móvil, CANTV, Movilnet y Digitel, mercado y transporte', () => {
    for (const re of [/Cashea/, /Pago Móvil/, /CANTV/, /Movilnet/, /Digitel/, /Mercado/, /Pasajes/]) {
      expect(texts.some(t => re.test(t)), String(re)).toBe(true)
    }
  })
  it('tono neutro: sin voseo', () => {
    for (const t of texts) expect(t).not.toMatch(/\b(vos|tenés|podés|querés|sabés|sos|hacé|mirá|fijate)\b/i)
  })
})
