// Rótulo del exceso/margen del ritmo sobre la ChartLupa.
import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { paceGap } from './lupaText.js'
import { interpolate } from '../../../i18n/translate.js'
import es from '../../../i18n/ahead/strings.es.js'
import en from '../../../i18n/ahead/strings.en.js'
import de from '../../../i18n/ahead/strings.de.js'
import { dailyAvailable, paceToday } from '../../../utils/dailyAvailable.js'
import ChartLupa from './ChartLupa.jsx'

const tOf = (dict) => (k, v) => interpolate(dict[k] ?? k, v)
const fmt = (n) => `$${Math.round(n).toLocaleString('es-CL')}`

describe('paceGap', () => {
  it('por encima y por debajo, con el monto en positivo', () => {
    expect(paceGap({ gap: -639144, even: false }, { t: tOf(es), fmt })).toEqual({ kind: 'over', text: '$639.144 por encima' })
    expect(paceGap({ gap: 1200, even: false }, { t: tOf(es), fmt })).toEqual({ kind: 'under', text: '$1.200 por debajo' })
    expect(paceGap({ gap: -5, even: false }, { t: tOf(en), fmt }).text).toBe('$5 over')
    expect(paceGap({ gap: 5, even: false }, { t: tOf(de), fmt }).text).toBe('$5 darunter')
  })
  it('sin rótulo si va parejo, sin ritmo o sin datos', () => {
    expect(paceGap({ gap: 3, even: true }, { t: tOf(es), fmt })).toBeNull()
    expect(paceGap({ gap: -3, cause: 'fixed' }, { t: tOf(es), fmt })).toBeNull()
    expect(paceGap(null, { t: tOf(es), fmt })).toBeNull()
  })
  it('la ChartLupa dibuja el tramo y el rótulo (oculto para lectores) solo en el mes en curso', () => {
    const series = dailyAvailable({
      incomes: [{ date: '2026-11-01', amount: 1000 }], expenses: [{ date: '2026-11-03', amount: 700 }],
      activeMonth: '2026-11', now: new Date(2026, 10, 10, 12), income: 1000,
    })
    const gap = paceGap(paceToday(series), { t: tOf(es), fmt })
    expect(gap.kind).toBe('over')
    const html = renderToStaticMarkup(h(ChartLupa, { series, label: 'x', valueTextOf: () => '', gap }))
    expect(html).toContain(gap.text)
    expect(html).toMatch(/aria-hidden="true"[^>]*data-side=/)
    const past = dailyAvailable({ incomes: [{ date: '2026-10-01', amount: 1000 }], expenses: [], activeMonth: '2026-10', now: new Date(2026, 10, 10), income: 1000 })
    expect(renderToStaticMarkup(h(ChartLupa, { series: past, label: 'x', valueTextOf: () => '', gap }))).not.toContain(gap.text)
  })
})
