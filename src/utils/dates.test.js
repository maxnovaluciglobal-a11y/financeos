// Fecha "de hoy" en hora LOCAL (B1). Antes se usaba toISOString(), que da la
// fecha en UTC: en LatAm, después de ~21 h, un gasto quedaba con fecha de mañana.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { localDateStr, localMonthStr, today, currentMonth, setDateLocale, dateLocale, monthShortName, monthYearLabel } from './index.js'

afterEach(() => { vi.useRealTimers() })

describe('localDateStr / localMonthStr', () => {
  it('usa los getters locales, no UTC', () => {
    // 23:30 hora local del 31-ene: en UTC-3 ya sería 1-feb.
    const d = new Date(2026, 0, 31, 23, 30, 0)
    expect(localDateStr(d)).toBe('2026-01-31')
    expect(localMonthStr(d)).toBe('2026-01')
  })

  it('rellena mes y día con cero a la izquierda', () => {
    const d = new Date(2026, 2, 5, 9, 0, 0)
    expect(localDateStr(d)).toBe('2026-03-05')
    expect(localMonthStr(d)).toBe('2026-03')
  })

  it('coincide con la fecha local aunque toISOString ya esté en el día siguiente', () => {
    const d = new Date(2026, 9, 7, 23, 59, 0)
    const offsetMin = d.getTimezoneOffset()
    expect(localDateStr(d)).toBe('2026-10-07')
    // Solo en zonas al oeste de UTC el bug original se manifiesta a esta hora.
    if (offsetMin > 0) expect(d.toISOString().slice(0, 10)).toBe('2026-10-08')
  })
})

describe('today / currentMonth', () => {
  it('devuelven la fecha y el mes locales del reloj actual', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 11, 31, 22, 15, 0))
    expect(today()).toBe('2026-12-31')
    expect(currentMonth()).toBe('2026-12')
  })
})

describe('setDateLocale', () => {
  afterEach(() => setDateLocale('es'))

  it.each([['es', 'es-CL'], ['en', 'en-US'], ['pt', 'pt-BR'], ['de', 'de-DE']])(
    'idioma %s -> locale de fechas %s', (lang, locale) => {
      setDateLocale(lang)
      expect(dateLocale()).toBe(locale)
    })

  it('un idioma desconocido cae al locale español', () => {
    setDateLocale('fr')
    expect(dateLocale()).toBe('es-CL')
  })
})

describe('monthShortName / monthYearLabel (nombres de mes por idioma)', () => {
  it.each([['es-CL', 'Ene'], ['en-US', 'Jan'], ['pt-BR', 'Jan'], ['de-DE', 'Jan']])('%s enero -> %s', (loc, out) => {
    expect(monthShortName(0, loc)).toBe(out)
  })
  it('sin punto final y con mayúscula inicial', () => {
    for (const loc of ['es-CL', 'en-US', 'pt-BR', 'de-DE']) {
      for (let i = 0; i < 12; i++) {
        const s = monthShortName(i, loc)
        expect(s).not.toMatch(/\.$/)
        expect(s[0]).toBe(s[0].toUpperCase())
      }
    }
  })
  it('monthYearLabel arma "Mes AAAA"', () => {
    expect(monthYearLabel('2026-03', 'en-US')).toBe('Mar 2026')
    expect(monthYearLabel('2026-12', 'es-CL')).toBe('Dic 2026')
    expect(monthYearLabel('', 'en-US')).toBe('')
  })
})
