// Plantilla de arranque por persona, no por país (feedback de Walter, 09-oct-2026).
import { describe, it, expect } from 'vitest'
import TEMPLATES, { templateIdForProfile, profileTemplateSettings } from './templates.js'
import * as countries from './countries.js'
import { getCategoriesExpense, CATS_EXPENSE } from '../utils/index.js'
import { orderQuickChips } from '../utils/quickChips.js'

describe('plantilla de perfil del onboarding', () => {
  it('por defecto (o "No") es la personal, sea cual sea el país', () => {
    expect(templateIdForProfile()).toBe('personal')
    expect(templateIdForProfile({ selfEmployed: false })).toBe('personal')
    expect(profileTemplateSettings().activeTemplateId).toBe('personal')
    // el mapa país → plantilla ya no existe
    expect(countries.templateForCountry).toBeUndefined()
  })

  it('solo "Sí, trabajo por mi cuenta" aplica freelancer', () => {
    expect(templateIdForProfile({ selfEmployed: true })).toBe('freelancer')
    const s = profileTemplateSettings({ selfEmployed: true })
    expect(s.activeTemplateId).toBe('freelancer')
    expect(s.templateSuggestedBudgets).toBe(TEMPLATES.find(t => t.id === 'freelancer').suggestedBudgets)
  })

  it('con "Sí" las categorías personales siguen (unión, personales primero) y se suman las de freelancer', () => {
    const personal = TEMPLATES.find(t => t.id === 'personal')
    const free = TEMPLATES.find(t => t.id === 'freelancer')
    const s = profileTemplateSettings({ selfEmployed: true })
    expect(s.categoriesExpense.slice(0, personal.categoriesExpense.length)).toEqual(personal.categoriesExpense)
    for (const c of free.categoriesExpense) expect(s.categoriesExpense).toContain(c)
    for (const c of free.categoriesIncome) expect(s.categoriesIncome).toContain(c)
    expect(new Set(s.categoriesExpense).size).toBe(s.categoriesExpense.length)
    expect(s.categoriesExpense).toContain('Alimentación')
  })

  it('con "No" no aparece ninguna categoría de freelancer', () => {
    const s = profileTemplateSettings({ selfEmployed: false })
    for (const c of ['Marketing propio', 'Educación / Cursos', 'Provisión impuestos']) {
      expect(s.categoriesExpense).not.toContain(c)
      expect(getCategoriesExpense(s)).not.toContain(c)
    }
  })

  it('primer gasto de quien trabaja por su cuenta: Alimentación entre los chips', () => {
    const s = profileTemplateSettings({ selfEmployed: true })
    const chips = orderQuickChips({ ranked: [], effective: getCategoriesExpense(s), templateCats: s.categoriesExpense, canonical: CATS_EXPENSE, templateActive: true })
    expect(chips).toContain('Alimentación')
    expect(chips).toContain('Marketing propio')
  })
})
