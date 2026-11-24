// I-17: la nota de doble conteo en la hoja "Apartar para esta meta" aparece
// solo cuando el portafolio suma al patrimonio (investOverlap).
import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../../components/ui/Sheet.jsx', () => ({ default: ({ children }) => h('div', null, children) }))
const { ContributionSheet, InvestOverlapNote } = await import('./GoalSheets.jsx')

const t = (k) => k
const base = { goal: { id: 1, name: 'Roth IRA', target: 7500, saved: 1750 }, onClose() {}, onConfirm() {}, t, lang: 'en', fmt: String, currency: 'USD', methods: ['Efectivo'] }

describe('nota de Inversiones en Metas (I-17)', () => {
  it('con el portafolio en el patrimonio, la hoja de apartar la muestra', () => {
    const html = renderToStaticMarkup(h(ContributionSheet, { ...base, investOverlap: true }))
    expect(html).toContain('goals.investOverlap')
  })
  it('sin el portafolio en el patrimonio (o módulo apagado), no', () => {
    expect(renderToStaticMarkup(h(ContributionSheet, base))).not.toContain('goals.investOverlap')
    expect(renderToStaticMarkup(h(ContributionSheet, { ...base, investOverlap: false }))).not.toContain('goals.investOverlap')
  })
  it('la nota usa la clave traducida y no es una alerta', () => {
    const html = renderToStaticMarkup(h(InvestOverlapNote, { t }))
    expect(html).toContain('goals.investOverlap')
    expect(html).not.toMatch(/role="alert"/)
  })
})
