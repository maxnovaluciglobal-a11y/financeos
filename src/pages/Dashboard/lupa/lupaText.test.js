import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { valueText, inspectLines, paceLine, weekdayName, shortDate } from './lupaText.js'
import { interpolate } from '../../../i18n/translate.js'
import { es } from '../../../i18n/es.js'
import { de } from '../../../i18n/de.js'
import { dailyAvailable } from '../../../utils/dailyAvailable.js'

const NOW = new Date(2026, 10, 18, 12)
const series = dailyAvailable({
  incomes: [{ date: '2026-11-15', amount: 1150 }],
  expenses: [{ date: '2026-11-10', amount: 54.3 }, { date: '2026-11-18', amount: 20 }],
  activeMonth: '2026-11', now: NOW, reference: 1150,
})
const tOf = (dict) => (k, v) => interpolate(dict[k] ?? k, v)
const fmt = (n) => `US$${n.toFixed(2)}`

describe('valueText (aria-valuetext del slider)', () => {
  it('hoy: "Hoy, <fecha>: te queda"', () => {
    expect(valueText({ series, day: 18, activeMonth: '2026-11', t: tOf(es), fmt, locale: 'es-CL' }))
      .toBe('Hoy, miércoles, 18 de noviembre: te queda US$1075.70')
  })
  it('un día pasado dice cuánto quedaba y cuánto se gastó', () => {
    expect(valueText({ series, day: 10, activeMonth: '2026-11', t: tOf(es), fmt, locale: 'es-CL' }))
      .toBe('martes, 10 de noviembre: te quedaban US$-54.30; ese día gastaste US$54.30')
  })
  it('el día de cobro suma lo que entró', () => {
    expect(valueText({ series, day: 15, activeMonth: '2026-11', t: tOf(es), fmt, locale: 'es-CL' })).toContain('entraron US$1150.00')
  })
  it('alemán sin "du"', () => {
    const v = valueText({ series, day: 10, activeMonth: '2026-11', t: tOf(de), fmt, locale: 'de-DE' })
    expect(v).toBe('Dienstag, 10. November: US$-54.30 übrig; an diesem Tag ausgegeben: US$54.30')
    expect(v).not.toMatch(/\bdu\b|\bdir\b|\bdein/i)
  })
})

describe('inspectLines / paceLine', () => {
  it('rótulo con el día de la semana y la línea de lo que pasó', () => {
    const l = inspectLines({ series, day: 10, activeMonth: '2026-11', t: tOf(es), fmt, locale: 'es-CL' })
    expect(l.label).toBe('El martes 10 te quedaban')
    expect(l.sub).toBe('ese día gastaste US$54.30')
    expect(inspectLines({ series, day: 3, activeMonth: '2026-11', t: tOf(es), fmt, locale: 'es-CL' }).sub).toBe('ese día no hubo movimientos')
  })
  it('ritmo: delante, detrás o parejo (±2 % de la referencia)', () => {
    const t = tOf(es)
    expect(paceLine(100, { t, fmt, reference: 1000 }).kind).toBe('ahead')
    expect(paceLine(-100, { t, fmt, reference: 1000 }).text).toBe('US$100.00 por detrás del ritmo ideal')
    expect(paceLine(15, { t, fmt, reference: 1000 }).kind).toBe('even')
    expect(paceLine(null, { t, fmt, reference: 1000 })).toBeNull()
  })
  it('fechas en el idioma de la interfaz', () => {
    expect(weekdayName('2026-11', 10, 'en-US')).toBe('Tuesday')
    expect(weekdayName('2026-11', 10, 'pt-BR')).toBe('terça-feira')
    expect(shortDate('2026-11', 30, 'de-DE')).toBe('30. Nov')
  })
})

// PLAN Entrega 2, Fase 3, punto 6: 0 fontSize numérico en los archivos nuevos.
describe('lupa: sin fontSize numérico', () => {
  it('ningún archivo de lupa/ usa fontSize con número', () => {
    const dir = dirname(fileURLToPath(import.meta.url))
    const bad = readdirSync(dir).filter(n => /\.jsx?$/.test(n) && !n.endsWith('.test.js'))
      .filter(n => /fontSize\s*:\s*['"]?\d/.test(readFileSync(join(dir, n), 'utf8')))
    expect(bad).toEqual([])
  })
})
