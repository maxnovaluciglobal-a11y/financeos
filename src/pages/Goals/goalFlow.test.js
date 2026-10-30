import { describe, it, expect } from 'vitest'
import {
  GOAL_TEMPLATE_IDS, FLOW_STEPS, fixedBuckets, draftFromTemplate, parseAmount, stepError, monthlyNeeded,
  buildGoal, applyContribution, defaultMethod, toFullFormDate, isEmergencyGoal, isGeneralGoal, normalizeName,
  emergencySuggested, MAX_CONTRIBUTIONS,
} from './goalFlow.js'
import { es } from '../../i18n/es.js'
import { en } from '../../i18n/en.js'
import { pt } from '../../i18n/pt.js'
import { de } from '../../i18n/de.js'

const tEs = (k) => es[k] ?? k

describe('R9 Metas: plantillas y alta en 3 pasos (#40, #42)', () => {
  it('8 plantillas, la última es personalizada, y el alta tiene 3 pasos', () => {
    expect(GOAL_TEMPLATE_IDS).toEqual(['trip', 'vehicle', 'home', 'phone', 'computer', 'education', 'business', 'custom'])
    expect(FLOW_STEPS).toBe(3)
  })
  it('cada plantilla tiene etiqueta en los 4 idiomas', () => {
    for (const id of GOAL_TEMPLATE_IDS) for (const d of [es, en, pt, de]) expect(typeof d[`goals.r9.tpl.${id}`], id).toBe('string')
  })
  it('la plantilla prellena el nombre; personalizada lo deja vacío', () => {
    expect(draftFromTemplate('trip', tEs)).toMatchObject({ name: 'Viaje', icon: 'trip', priority: 'Media', target: '' })
    expect(draftFromTemplate('custom', tEs)).toMatchObject({ name: '', icon: 'custom' })
    expect(draftFromTemplate('desconocida', tEs)).toMatchObject({ name: '', icon: 'custom' })
  })
  it('el fondo de emergencia trae 3 meses de gastos y un nombre que reconoce el IQ Score', () => {
    const d = draftFromTemplate('emergency', tEs, { emergencyBase: 1000 })
    expect(d).toMatchObject({ target: '3000', priority: 'Alta', kind: 'emergency' })
    expect(isEmergencyGoal({ name: d.name })).toBe(true)
    expect(draftFromTemplate('emergency', tEs).target).toBe('')
    expect(emergencySuggested(0)).toBeNull()
  })
  it('valida monto y nombre según el paso', () => {
    expect(stepError(0, {})).toBeNull()
    expect(stepError(1, { target: '' })).toBe('goals.r9.err.amount')
    expect(stepError(1, { target: '0' })).toBe('goals.r9.err.amount')
    expect(stepError(1, { target: '500' })).toBeNull()
    expect(stepError(2, { target: '500', name: '  ' })).toBe('goals.r9.err.name')
    expect(stepError(3, { target: '500', name: 'Auto' })).toBeNull()
  })
  it('parseAmount acepta coma o punto y descarta lo inválido', () => {
    expect(parseAmount('1234,5')).toBe(1234.5)
    expect(parseAmount('1234.5')).toBe(1234.5)
    expect(parseAmount('-3')).toBe(0)
    expect(parseAmount('abc')).toBe(0)
    expect(parseAmount(12)).toBe(12)
  })
  it('aporte mensual del resumen: lo que falta repartido hasta la fecha', () => {
    expect(monthlyNeeded({ target: '1200', targetDate: '2026-12', activeMonth: '2026-01' })).toBe(100)
    expect(monthlyNeeded({ target: '1200', targetDate: '', activeMonth: '2026-01' })).toBeNull()
    expect(monthlyNeeded({ target: '1200', targetDate: '2025-12', activeMonth: '2026-01' })).toBeNull()
  })
  it('buildGoal arma la meta de siempre más campos opcionales', () => {
    const g = buildGoal({ name: ' Auto ', target: '5000', targetDate: '2027-06', icon: 'vehicle' }, { now: 42 })
    expect(g).toEqual({ name: 'Auto', target: 5000, saved: 0, targetDate: '2027-06', priority: 'Media', color: '#14213D', createdAt: 42, icon: 'vehicle' })
    expect(buildGoal({ name: 'F', target: '10', kind: 'general' }).kind).toBe('general')
  })
  it('"Más opciones" recibe la fecha en formato del formulario completo', () => {
    expect(toFullFormDate('2027-06')).toBe('2027-06-01')
    expect(toFullFormDate('2027-06-15')).toBe('2027-06-15')
    expect(toFullFormDate('')).toBe('')
  })
})

describe('R9 Metas: bolsas fijas (#41)', () => {
  it('sin metas, las dos bolsas aparecen vacías', () => {
    const [em, gen] = fixedBuckets([], { emergencyBase: 500 })
    expect(em).toEqual({ id: 'emergency', goal: null, suggested: 1500 })
    expect(gen).toEqual({ id: 'general', goal: null, suggested: null })
  })
  it('reconoce el fondo de emergencia por nombre (misma detección del IQ Score) en los 4 idiomas', () => {
    for (const name of ['Fondo de emergencia', 'Emergency fund', 'Fundo de emergência', 'Notgroschen', 'colchón de emergencia']) {
      const g = { id: 'x', name }
      expect(fixedBuckets([g])[0].goal, name).toBe(g)
    }
    expect(fixedBuckets([{ id: 'v', name: 'Viaje' }])[0].goal).toBeNull()
  })
  it('reconoce ahorros generales por kind o por nombre, sin confundirlo con emergencia', () => {
    for (const name of ['Ahorros generales', 'General savings', 'Poupança geral', 'Allgemeine Ersparnisse']) {
      expect(isGeneralGoal({ name }), name).toBe(true)
    }
    expect(isGeneralGoal({ name: 'Mi colchón', kind: 'general' })).toBe(true)
    expect(isGeneralGoal({ name: 'Fondo de emergencia', kind: 'general' })).toBe(false)
    expect(isEmergencyGoal({ name: 'Mi colchón', kind: 'emergency' })).toBe(true)
  })
  it('el nombre de "Ahorros generales" de cada idioma se reconoce', () => {
    for (const d of [es, en, pt, de]) expect(isGeneralGoal({ name: d['goals.r9.generalName'] }), d['goals.r9.generalName']).toBe(true)
  })
  it('normalizeName ignora tildes, mayúsculas y espacios', () => {
    expect(normalizeName('  Poupança   Geral ')).toBe('poupanca geral')
  })
})

describe('R9 Metas: aporte desde la hoja (#43)', () => {
  const goal = { id: 'g', name: 'Viaje', target: 1000, saved: 900 }
  it('suma, no pasa del objetivo y guarda el medio de pago de origen', () => {
    const r = applyContribution(goal, '300', { method: 'Débito', date: '2026-10-30' })
    expect(r.goal.saved).toBe(1000)
    expect(r.added).toBe(100)
    expect(r.done).toBe(true)
    expect(r.remaining).toBe(0)
    expect(r.goal.contributions).toEqual([{ amount: 100, date: '2026-10-30', method: 'Débito' }])
    expect(goal.contributions).toBeUndefined() // no muta
  })
  it('monto inválido o meta completa no registran nada', () => {
    expect(applyContribution(goal, '0')).toBeNull()
    expect(applyContribution({ ...goal, saved: 1000 }, '10')).toBeNull()
    expect(applyContribution(null, '10')).toBeNull()
  })
  it('conserva el historial y lo limita', () => {
    const many = Array.from({ length: MAX_CONTRIBUTIONS }, () => ({ amount: 1, date: 'd' }))
    const r = applyContribution({ ...goal, saved: 0, contributions: many }, 5, { date: 'z' })
    expect(r.goal.contributions).toHaveLength(MAX_CONTRIBUTIONS)
    expect(r.goal.contributions.at(-1)).toEqual({ amount: 5, date: 'z' })
    expect(r.remaining).toBe(995)
  })
  it('medio por defecto: último aporte de la meta, luego el del alta rápida', () => {
    const methods = ['Débito', 'Crédito', 'Efectivo']
    expect(defaultMethod({ contributions: [{ method: 'Efectivo' }] }, methods, 'Crédito')).toBe('Efectivo')
    expect(defaultMethod({}, methods, 'Crédito')).toBe('Crédito')
    expect(defaultMethod({}, methods, 'Cheque')).toBe('Débito')
  })
})

describe('R9 Metas: textos nuevos (goals.r9.*, tour.goals.*)', () => {
  const prefixes = ['goals.r9.', 'tour.goals.']
  const pick = (d) => Object.keys(d).filter(k => prefixes.some(p => k.startsWith(p))).sort()
  it('paridad de claves y variables en los 4 idiomas', () => {
    const base = pick(es)
    expect(base.length).toBeGreaterThan(30)
    const vars = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',')
    for (const d of [en, pt, de]) {
      expect(pick(d)).toEqual(base)
      for (const k of base) expect(vars(d[k]), k).toBe(vars(es[k]))
    }
  })
  it('voz seca: sin exclamaciones ni voseo; el alemán no tutea', () => {
    for (const d of [es, en, pt, de]) for (const k of pick(d)) expect(d[k], k).not.toMatch(/[¡!]/)
    for (const k of pick(es)) expect(es[k], k).not.toMatch(/\b(podés|tenés|querés|vos|tocá|elegí|agregá|creá|mirá)\b/i)
    for (const k of pick(de)) expect(de[k], k).not.toMatch(/\b(du|dein|deine|dich|dir)\b/i)
  })
})
