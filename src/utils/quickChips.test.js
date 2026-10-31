import { describe, it, expect } from 'vitest'
import { orderQuickChips, hasProfileTemplate, rankByRecency } from './quickChips.js'

const effective = ['Alimentación', 'Vivienda', 'Transporte', 'Salud', 'Educación', 'Ropa', 'Tecnología', 'Marketing propio']
const freelancer = ['Vivienda', 'Alimentación', 'Transporte', 'Tecnología', 'Marketing propio', 'Educación / Cursos', 'Salud']
const canonical = ['Alimentación', 'Vivienda', 'Transporte', 'Salud', 'Educación', 'Ropa', 'Entretención', 'Servicios', 'Tecnología', 'Deporte', 'Viajes', 'Otros']

describe('orderQuickChips', () => {
  it('sin plantilla: historial y luego efectivas (sin cambios)', () => {
    expect(orderQuickChips({ ranked: ['Salud'], effective })).toEqual(['Salud', 'Alimentación', 'Vivienda', 'Transporte', 'Educación', 'Ropa'])
  })

  it('con plantilla freelancer y sin historial: básicas y propias con cupo (Alimentación sigue visible)', () => {
    expect(orderQuickChips({ ranked: [], effective, canonical, templateCats: freelancer, templateActive: true }))
      .toEqual(['Vivienda', 'Alimentación', 'Transporte', 'Tecnología', 'Marketing propio', 'Educación / Cursos'])
  })

  it('primer gasto con la plantilla de onboarding "trabajo por mi cuenta": mitad básicas, mitad propias, sin "Otro"', () => {
    const union = ['Vivienda', 'Alimentación', 'Transporte', 'Salud', 'Entretención', 'Servicios', 'Ropa', 'Otro',
      'Tecnología', 'Marketing propio', 'Educación / Cursos', 'Provisión impuestos']
    expect(orderQuickChips({ ranked: [], effective, canonical, templateCats: union, templateActive: true }))
      .toEqual(['Vivienda', 'Alimentación', 'Transporte', 'Marketing propio', 'Educación / Cursos', 'Provisión impuestos'])
  })

  it('con historial canónico: 3 usadas de la plantilla, las propias y la más usada ajena al final', () => {
    const out = orderQuickChips({
      ranked: ['Servicios', 'Alimentación', 'Vivienda', 'Transporte', 'Salud', 'Entretención'],
      effective, canonical, templateCats: [...freelancer, 'Servicios'], templateActive: true,
    })
    expect(out).toEqual(['Servicios', 'Alimentación', 'Vivienda', 'Marketing propio', 'Educación / Cursos', 'Entretención'])
  })

  it('plantilla corta: completa con historial y efectivas', () => {
    expect(orderQuickChips({ ranked: [], effective, templateCats: ['A', 'B'], templateActive: true, max: 4 })).toEqual(['A', 'B', 'Alimentación', 'Vivienda'])
  })
})

describe('hasProfileTemplate', () => {
  it('la personal no cuenta como plantilla de perfil', () => {
    expect(hasProfileTemplate({ activeTemplateId: 'personal' })).toBe(false)
    expect(hasProfileTemplate({ activeTemplateId: 'freelancer' })).toBe(true)
    expect(hasProfileTemplate({})).toBe(false)
  })
})

describe('rankByRecency', () => {
  it('pone primero la categoría usada más recientemente', () => {
    expect(rankByRecency([
      { category: 'Comida', date: '2026-10-01' },
      { category: 'Comida', date: '2026-10-02' },
      { category: 'Transporte', date: '2026-10-30' },
    ])).toEqual(['Transporte', 'Comida'])
  })
  it('en la misma fecha gana la última registrada', () => {
    expect(rankByRecency([
      { category: 'A', date: '2026-10-30' },
      { category: 'B', date: '2026-10-30' },
    ])).toEqual(['B', 'A'])
  })
  it('nunca sugiere primero el cajón genérico', () => {
    expect(rankByRecency([
      { category: 'Comida', date: '2026-10-01' },
      { category: 'Otros', date: '2026-10-30' },
    ])).toEqual(['Comida', 'Otros'])
  })
  it('ignora registros sin categoría y respeta el límite', () => {
    expect(rankByRecency([{ date: '2026-10-30' }, null, { category: 'A', date: '2026-10-01' }, { category: 'B', date: '2026-10-02' }], 1)).toEqual(['B'])
  })
})
