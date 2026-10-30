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

  const at = new Date(2026, 9, 1, 12).getTime()
  const veRate = { rate: 880, at, source: 'bcv' }

  it('US$ | € solo con onRefCurrency y si la cuenta no es en euros', () => {
    const ve = text(renderToStaticMarkup(createElement(ConverterSheet, {
      open: true, onClose() {}, settings: { country: 'VE', currency: 'VES' }, sym: 'Bs.', refRate: veRate, onRefCurrency() {},
    })))
    expect(ve).toMatch(/USD\s+EUR/)
    const noCb = text(renderToStaticMarkup(createElement(ConverterSheet, {
      open: true, onClose() {}, settings: { country: 'VE', currency: 'VES' }, sym: 'Bs.', refRate: veRate,
    })))
    expect(noCb).not.toMatch(/USD\s+EUR/)
    const de = text(renderToStaticMarkup(createElement(ConverterSheet, {
      open: true, onClose() {}, settings: { country: 'DE', currency: 'EUR', showDualCurrency: true }, sym: '€',
      refRate: { rate: 0.92, at, source: 'fixer' }, onRefCurrency() {},
    })))
    expect(de).not.toMatch(/USD\s+EUR/)
  })

  it('con la lente en euros: "Equivale en EUR" y la fuente dice el cruce con Fixer', () => {
    const prev = globalThis.localStorage
    globalThis.localStorage = { getItem: (k) => (k === 'fnos_tasa_fixer_v1'
      ? JSON.stringify({ source: 'fixer', ts: new Date(2026, 9, 2, 12).getTime(), rates: { USD: 1, EUR: 0.8 } }) : null) }
    try {
      setMoneyLocale('VES', 'es')
      const tx = text(renderToStaticMarkup(createElement(ConverterSheet, {
        open: true, onClose() {}, settings: { country: 'VE', currency: 'VES', refCurrency: 'EUR' }, sym: 'Bs.', refRate: veRate, onRefCurrency() {},
      })))
      expect(tx).toContain('Equivale en EUR')
      expect(tx).toContain('Tasa BCV × EUR/USD Fixer')
      expect(tx).toMatch(/1 € = Bs\.1\.100,00/)
      expect(tx).toMatch(/1 oct/) // la fecha más vieja de las dos
    } finally { globalThis.localStorage = prev }
  })

  it('euro elegido sin Fixer en el dispositivo: sigue en US$ y lo explica', () => {
    const tx = text(renderToStaticMarkup(createElement(ConverterSheet, {
      open: true, onClose() {}, settings: { country: 'VE', currency: 'VES', refCurrency: 'EUR' }, sym: 'Bs.', refRate: veRate, onRefCurrency() {},
    })))
    expect(tx).toContain('Equivale en USD')
    expect(tx).toContain('Falta la cotización EUR/USD')
  })

  it('historial (B2b): cerrado por defecto detrás de "Ver historial"; sin datos, no aparece', () => {
    const html = renderToStaticMarkup(createElement(ConverterSheet, {
      open: true, onClose() {}, sym: 'Bs.', refRate: veRate,
      settings: { country: 'VE', currency: 'VES', monthlyRefRates: { '2026-08': 700, '2026-09': 832.15, '2026-10': 885.4 } },
    }))
    expect(text(html)).toContain('Ver historial')
    expect(html).toMatch(/aria-expanded="false"/)
    expect(html).not.toMatch(/<svg[^>]*viewBox="0 0 300 64"/)
    const none = text(renderToStaticMarkup(createElement(ConverterSheet, {
      open: true, onClose() {}, settings: { country: 'VE', currency: 'VES' }, sym: 'Bs.', refRate: veRate,
    })))
    expect(none).not.toContain('Ver historial')
    const cl = text(renderToStaticMarkup(createElement(ConverterSheet, {
      open: true, onClose() {}, settings: { country: 'CL', currency: 'CLP', showDualCurrency: true, monthlyRefRates: { '2026-09': 1, '2026-10': 2 } }, sym: '$', refRate: { rate: 950, at, source: 'fixer' },
    })))
    expect(cl).not.toContain('Ver historial')
  })
})

describe('fmtRef: la moneda de la lente', () => {
  it('US$ por defecto; el euro detrás fuera del inglés; setLensCurrency cambia el valor por defecto', async () => {
    const { fmtRef, setLensCurrency } = await import('../pages/Dashboard/RefCurrency.jsx')
    setMoneyLocale('VES', 'es')
    expect(fmtRef(1234.5, 'es')).toBe('US$1.234,50')
    expect(fmtRef(1234.5, 'es', 'EUR')).toBe('1.234,50\u00a0€')
    setLensCurrency('EUR')
    try {
      expect(fmtRef(10, 'es')).toBe('10,00\u00a0€')
      expect(fmtRef(10, 'es', 'USD')).toBe('US$10,00')
    } finally { setLensCurrency('USD') }
    setLensCurrency('XYZ')
    expect(fmtRef(10, 'es')).toBe('US$10,00')
  })
})
