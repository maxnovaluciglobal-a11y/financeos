// B2: el conversor rápido es GRATIS (decisión D-A, 30-oct-2026). La demo
// siempre es Pro, así que el corte gratis/Pro se verifica acá: la hoja no pasa
// por ProGate ni lee el plan, y el Inicio la abre desde la fila de tasa (no
// navega al panel PRO). Se renderiza sin DOM con renderToStaticMarkup.
import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.mock('../i18n/useT.js', async () => {
  const { translate } = await import('../i18n/translate.js')
  const useT = () => ({ t: (key, vars) => translate('es', key, vars), lang: 'es' })
  return { useT, useTFor: useT }
})

const { default: ConverterSheet } = await import('./ConverterSheet.jsx')
const { setMoneyLocale } = await import('../utils/index.js')

const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ')

describe('ConverterSheet (B2, gratis)', () => {
  it('no usa ProGate ni el plan', () => {
    const code = src('./ConverterSheet.jsx').replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/ProGate|usePlan|getLicensePlan|isPro/)
  })

  it('el Inicio la abre desde la fila de tasa y deja el panel PRO como enlace', () => {
    const dash = src('../pages/Dashboard/index.jsx')
    expect(dash).toMatch(/onTool: \(\) => setConvOpen\(true\)/)
    expect(dash).toMatch(/<ConverterSheet[\s\S]*onOpenPanel=/)
    expect(dash).not.toMatch(/onTool: \(\) => setPage\?\.\(rateTool\)/)
  })

  it('con tasa: dos campos, intercambio, copiar y compartir, la tasa con fuente y fecha', () => {
    setMoneyLocale('VES', 'es')
    const html = renderToStaticMarkup(createElement(ConverterSheet, {
      open: true, onClose() {}, settings: { country: 'VE', currency: 'VES' }, sym: 'Bs.',
      refRate: { rate: 885.4, at: new Date(2026, 9, 1, 12).getTime(), source: 'bcv' },
      onEditRate() {}, onOpenPanel() {}, panelId: 'multimoneda',
    }))
    const tx = text(html)
    expect(tx).toContain('Monto en VES')
    expect(tx).toContain('Equivale en USD')
    expect(tx).toContain('Intercambiar')
    expect(tx).toContain('Copiar')
    expect(tx).toContain('Compartir')
    expect(tx).toContain('Tasa BCV')
    expect(tx).toMatch(/1 oct/)
    expect(tx).toContain('Panel multimoneda (Pro)')
    // Un solo primario Latón.
    expect((html.match(/fos-btn-primary/g) || []).length).toBe(1)
  })

  it('sin tasa: lo dice y ofrece agregarla; una tasa sin fecha dice "sin fecha"', () => {
    const none = text(renderToStaticMarkup(createElement(ConverterSheet, {
      open: true, onClose() {}, settings: { country: 'CL', currency: 'CLP' }, sym: '$', refRate: null, onEditRate() {},
    })))
    expect(none).toContain('hace falta una tasa')
    expect(none).toContain('Agregar una tasa')
    expect(none).not.toContain('(Pro)')
    const legacy = text(renderToStaticMarkup(createElement(ConverterSheet, {
      open: true, onClose() {}, settings: { country: 'CL', currency: 'CLP', showDualCurrency: true }, sym: '$',
      refRate: { rate: 950, at: null, source: 'legacy' }, onEditRate() {},
    })))
    expect(legacy).toContain('Tasa guardada')
    expect(legacy).toContain('sin fecha')
  })
})
