// Las plantillas guardan claves i18n para todo lo que muestran y valores en
// español para las categorías (que se guardan en los datos del usuario). Cada
// clave y cada etiqueta de categoría tiene que existir en los 4 idiomas, si no
// el usuario en/pt/de ve una isla en español (o la clave cruda).
import { describe, it, expect } from 'vitest'
import TEMPLATES from './templates.js'
import { es } from '../i18n/es.js'
import { en } from '../i18n/en.js'
import { pt } from '../i18n/pt.js'
import { de } from '../i18n/de.js'

const DICTS = { es, en, pt, de }
const textKeys = (t) => [
  t.tagline, t.description, ...t.bestFor, ...t.suggestedBudgets.map(b => b.note),
  ...t.suggestedGoals.flatMap(g => [g.name, g.note]), ...t.alerts, ...t.keyMetrics, t.advisorTip,
  `tpl.${t.id}.name`,
]

describe('plantillas: textos por clave i18n', () => {
  it.each(TEMPLATES.map(t => [t.id, t]))('%s: toda clave existe en es/en/pt/de', (_, t) => {
    for (const key of textKeys(t)) {
      expect(key, key).toMatch(/^tpl\./)
      for (const [lang, d] of Object.entries(DICTS)) expect(d[key], `${lang}:${key}`).toBeTruthy()
    }
  })

  it.each(TEMPLATES.map(t => [t.id, t]))('%s: cada categoría tiene etiqueta cat.* en los 4 idiomas', (_, t) => {
    const cats = [...t.categoriesIncome, ...t.categoriesExpense, ...t.suggestedBudgets.map(b => b.category)]
    for (const c of cats) for (const [lang, d] of Object.entries(DICTS)) expect(d[`cat.${c}`], `${lang}:cat.${c}`).toBeTruthy()
  })

  it('las prioridades de las metas sugeridas tienen etiqueta prio.*', () => {
    for (const t of TEMPLATES) for (const g of t.suggestedGoals) for (const d of Object.values(DICTS)) expect(d[`prio.${g.priority}`]).toBeTruthy()
  })
})
