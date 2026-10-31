import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { generateGoalSuggestions, GOAL_NAMES_OTHER_LANGS, GOAL_TEMPLATES } from './goalSuggestions.js'
import { en } from '../i18n/en.js'
import { pt } from '../i18n/pt.js'

const alreadyExists = (name) => {
  const out = generateGoalSuggestions({ ingresoNeto: 1000, existingGoals: [{ name }] })
  return out.filter(s => s.alreadyExists).map(s => s.id)
}

describe('metas sugeridas: nombres en otros idiomas (V4)', () => {
  it('la copia corta de nombres es idéntica a los diccionarios', () => {
    for (const t of GOAL_TEMPLATES) {
      expect(GOAL_NAMES_OTHER_LANGS.en[t.name]).toBe(en[t.name])
      expect(GOAL_NAMES_OTHER_LANGS.pt[t.name]).toBe(pt[t.name])
    }
  })
  it('detecta una meta ya creada en español, inglés o portugués', () => {
    expect(alreadyExists('Fondo de emergencia')).toContain('emergency_fund')
    expect(alreadyExists('Emergency fund')).toContain('emergency_fund')
    expect(alreadyExists('Fundo de emergência')).toContain('emergency_fund')
    expect(alreadyExists('Férias anuais')).toContain('vacations')
  })
  it('una meta sin relación no marca nada', () => {
    expect(alreadyExists('Moto nueva')).toEqual([])
  })
  it('no vuelve a importar diccionarios enteros (arrastran 115 kB a la página Metas)', () => {
    const src = readFileSync(new URL('./goalSuggestions.js', import.meta.url), 'utf8')
    expect(src).not.toMatch(/from '\.\.\/i18n\/(en|pt|de)\.js'/)
  })
})
