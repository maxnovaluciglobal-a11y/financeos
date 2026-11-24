// Oportunidades (Inversiones v2): lectura de medias en los bordes, reparto
// exacto al centavo, datos que faltan, cripto y menos de 200 días de historia.
import { describe, it, expect, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { readSignal, signalKey, rsiRuleOk, summarize, joinList, SMAS, MIN_CLOSES } from './signals.js'
import { planCapital, driftMath, uninvested, LADDER_KEYS, DEFAULT_LADDER, DEFAULT_RSI_RULE } from './capital.js'
import { queueOpp, takeOppQueue } from './queue.js'
import { allocByDrift } from '../../../utils/investPlan.js'
import es from './strings.es.js'
import { interpolate } from '../../../i18n/translate.js'
import OppTeaser from './OppTeaser.jsx'

const t = (k, v) => interpolate(es[k] ?? k, v)
const flat = (n, v = 100) => Array.from({ length: n }, () => v)
// n cierres a `base` y el último a `last`: todas las medias quedan cerca de base.
const withLast = (n, base, last) => [...flat(n - 1, base), last]
const cents = (x) => Math.round(x * 100)

describe('readSignal: bordes de la escalera', () => {
  it('menos de 20 cierres: sin lectura', () => {
    expect(readSignal(flat(MIN_CLOSES - 1))).toBeNull()
    expect(readSignal(null)).toBeNull()
    expect(readSignal([0, -1, NaN, 'x'])).toBeNull()
  })
  it('precio exactamente igual a la media: el tramo se cumple (≤)', () => {
    const r = readSignal(flat(250, 100))
    expect(r.smas.every(m => m.value === 100 && m.hit && m.dist === 0)).toBe(true)
    expect(r.level).toBe(4)
    expect(r.deepest).toBe(200)
    expect(r.tramos).toEqual([1, 2, 3, 4])
  })
  it('un centavo sobre todas las medias: ningún tramo, pero "en la media" (±1 %)', () => {
    const r = readSignal(withLast(250, 100, 100.5))
    expect(r.level).toBe(0)
    expect(signalKey(r)).toEqual({ key: 'near', n: 20 })
    const far = readSignal(withLast(250, 100, 120))
    expect(signalKey(far)).toEqual({ key: 'above' })
  })
  it('bajo la de 50 pero sobre la de 20: tramo 2 (y los que correspondan), en su orden', () => {
    // 200 cierres en 100, 30 en 90, 20 en 80 y hoy 85: SMA20 = 80,25 (precio
    // sobre), SMA50 ≈ 85,1 (bajo), SMA100 y 200 más altas (bajo).
    const c = [...flat(200, 100), ...flat(30, 90), ...flat(19, 80), 85]
    const r = readSignal(c)
    expect(r.smas[0].hit).toBe(false)
    expect(r.smas[1].hit).toBe(true)
    expect(r.tramos).toEqual([2, 3, 4])
    expect(signalKey(r)).toMatchObject({ key: 'below', n: 200 })
  })
  it('menos de 200 días: la media de 200 queda sin dato y no cuenta', () => {
    const r = readSignal(withLast(140, 100, 90))
    expect(r.smas[3].value).toBeNull()
    expect(r.missing).toEqual([200])
    expect(r.tramos).toEqual([1, 2, 3])
    const r2 = readSignal(withLast(30, 100, 90))
    expect(r2.missing).toEqual([50, 100, 200])
    expect(r2.level).toBe(1)
  })
  it('cripto: misma cuenta por cierres; solo marca crypto para el texto', () => {
    const c = withLast(366, 100, 95)
    const a = readSignal(c, { crypto: true }), b = readSignal(c)
    expect(a.crypto).toBe(true)
    expect(a.tramos).toEqual(b.tramos)
  })
  it('caída desde el máximo de 1 año y RSI', () => {
    const c = [...flat(100, 50), 200, ...flat(150, 150)]
    const r = readSignal(c)
    expect(r.high).toBe(200)
    expect(r.drawdown).toBeCloseTo(-0.25, 10)
    expect(readSignal(flat(30)).rsi).toBe(100) // sin bajadas
  })
  it('signalKey sin lectura', () => {
    expect(signalKey(null)).toEqual({ key: 'none' })
  })
})

describe('rsiRuleOk (condición opcional 30–45)', () => {
  it('bordes inclusivos y sin RSI', () => {
    expect(rsiRuleOk({ rsi: 30 })).toBe(true)
    expect(rsiRuleOk({ rsi: 45 })).toBe(true)
    expect(rsiRuleOk({ rsi: 29.99 })).toBe(false)
    expect(rsiRuleOk({ rsi: 45.01 })).toBe(false)
    expect(rsiRuleOk({ rsi: null })).toBe(false)
    expect(rsiRuleOk(null)).toBe(false)
  })
})

describe('planCapital: reparto exacto', () => {
  const hitAll = readSignal(flat(250, 100))
  const above = readSignal(withLast(250, 100, 130))
  const short = readSignal(withLast(140, 100, 90))
  it('hoy + espera + sin lectura = el monto, al centavo, con montos que no se dividen exacto', () => {
    for (const amount of [1000, 333.33, 0.01, 0.07, 1234567.89, 100.01]) {
      for (const ladder of LADDER_KEYS) {
        const alloc = [{ t: 'A', p: 33.3 }, { t: 'B', p: 33.3 }, { t: 'C', p: 33.4 }]
        const r = planCapital({ amount, alloc, readings: { A: hitAll, B: above, C: short }, ladder })
        expect(r.ok).toBe(true)
        expect(cents(r.today) + cents(r.wait) + cents(r.noData)).toBe(cents(amount))
        expect(r.rows.reduce((a, x) => a + cents(x.amount), 0)).toBe(cents(amount))
        for (const row of r.rows) {
          const tr = row.tramos.filter(x => x.amount != null).reduce((a, x) => a + cents(x.amount), 0)
          expect(tr).toBe(cents(row.amount))
        }
      }
    }
  })
  it('pesos de la escalera y estado de cada tramo', () => {
    const r = planCapital({ amount: 1000, alloc: [{ t: 'A', p: 100 }], readings: { A: hitAll }, ladder: 'half200', rsiRule: false })
    expect(r.rows[0].tramos.map(x => x.amount)).toEqual([100, 150, 250, 500])
    expect(r.today).toBe(1000)
    const w = planCapital({ amount: 1000, alloc: [{ t: 'A', p: 100 }], readings: { A: above }, ladder: 'even' })
    expect(w.rows[0].tramos.every(x => x.state === 'wait')).toBe(true)
    expect(w.wait).toBe(1000)
  })
  it('por defecto, el modelo original de Walter: 10/15/25/50 (decisión del 24-nov-2026); las otras dos siguen', () => {
    expect(DEFAULT_LADDER).toBe('half200')
    expect(LADDER_KEYS).toEqual(expect.arrayContaining(['even', 'long', 'half200']))
    const r = planCapital({ amount: 1000, alloc: [{ t: 'A', p: 100 }], readings: { A: hitAll }, rsiRule: false })
    expect(r.rows[0].tramos.map(x => x.amount)).toEqual([100, 150, 250, 500])
    const bad = planCapital({ amount: 1000, alloc: [{ t: 'A', p: 100 }], readings: { A: hitAll }, ladder: 'nope', rsiRule: false })
    expect(bad.rows[0].tramos.map(x => x.amount)).toEqual([100, 150, 250, 500])
  })
  it('sin la media de 200: su parte va a los otros tramos del activo', () => {
    const r = planCapital({ amount: 900, alloc: [{ t: 'A', p: 100 }], readings: { A: short }, ladder: 'even' })
    expect(r.reassigned).toBe(true)
    expect(r.rows[0].tramos.map(x => x.amount)).toEqual([300, 300, 300, null])
    expect(r.rows[0].tramos[3].state).toBe('none')
  })
  it('sin historia: el monto queda entero como "sin lectura"', () => {
    const r = planCapital({ amount: 500, alloc: [{ t: 'A', p: 60 }, { t: 'Z', p: 40 }], readings: { A: hitAll, Z: null }, rsiRule: false })
    expect(r.noData).toBe(200)
    expect(r.rows[1].tramos).toBeNull()
    expect(r.today).toBe(300)
  })
  it('RSI 30–45 encendido por defecto (decisión de Walter, 24-nov-2026)', () => {
    expect(DEFAULT_RSI_RULE).toBe(true)
    const r = planCapital({ amount: 100, alloc: [{ t: 'A', p: 100 }], readings: { A: { ...hitAll, rsi: 60 } } })
    expect(r.today).toBe(0)
  })
  it('bordes de RSI: 30 y 45 cuentan; 29,9 y 45,1 no; sin RSI no cuenta y se marca', () => {
    const at = (rsi) => planCapital({ amount: 100, alloc: [{ t: 'A', p: 100 }], readings: { A: { ...hitAll, rsi } } })
    expect(at(30).today).toBe(100)
    expect(at(45).today).toBe(100)
    expect(at(29.9).today).toBe(0)
    expect(at(45.1).today).toBe(0)
    const none = at(null)
    expect(none.today).toBe(0)
    expect(none.wait).toBe(100)
    expect(none.rows[0].tramos.every(x => x.rsiMissing && x.state === 'wait')).toBe(true)
    expect(at(60).rows[0].tramos.every(x => x.rsiBlocked && !x.rsiMissing)).toBe(true)
    // Apagada, el RSI no se mira.
    expect(planCapital({ amount: 100, alloc: [{ t: 'A', p: 100 }], readings: { A: { ...hitAll, rsi: null } }, rsiRule: false }).today).toBe(100)
    expect(es['opp.res.st.rsiNone']).toMatch(/sin dato de RSI/)
  })
  it('regla de RSI: precio bajo la media pero RSI fuera de 30–45 → espera', () => {
    const rd = { ...hitAll, rsi: 60 }
    const r = planCapital({ amount: 100, alloc: [{ t: 'A', p: 100 }], readings: { A: rd }, rsiRule: true })
    expect(r.today).toBe(0)
    expect(r.wait).toBe(100)
    expect(r.rows[0].tramos.every(x => x.rsiBlocked)).toBe(true)
    const ok = planCapital({ amount: 100, alloc: [{ t: 'A', p: 100 }], readings: { A: { ...hitAll, rsi: 40 } }, rsiRule: true })
    expect(ok.today).toBe(100)
  })
  it('errores: sin monto, sin reparto, % que no suman 100', () => {
    expect(planCapital({ amount: 0, alloc: [{ t: 'A', p: 100 }] })).toMatchObject({ ok: false, error: 'amount_required' })
    expect(planCapital({ amount: 10, alloc: [] })).toMatchObject({ ok: false, error: 'alloc_empty' })
    expect(planCapital({ amount: 10, alloc: [{ t: 'A', p: 90 }] })).toMatchObject({ ok: false, error: 'sum' })
  })
})

describe('driftMath coincide con allocByDrift', () => {
  it('modo desvío: solo lo que está más de 0,5 puntos bajo su objetivo', () => {
    const base = [{ t: 'A', valueUsd: 600 }, { t: 'B', valueUsd: 300 }, { t: 'C', valueUsd: 100 }]
    const targets = { A: 50, B: 30, C: 20 }
    const m = driftMath(base, targets)
    expect(m.mode).toBe('gap')
    expect(m.rows.filter(r => r.counts).map(r => r.t)).toEqual(['C'])
    expect(allocByDrift(base, targets)).toEqual([{ t: 'C', p: 100 }])
  })
  it('modo objetivo: nada está debajo', () => {
    const base = [{ t: 'A', valueUsd: 500 }, { t: 'B', valueUsd: 500 }]
    expect(driftMath(base, { A: 50, B: 50 }).mode).toBe('target')
  })
})

describe('uninvested', () => {
  it('capital − costo, nunca negativo; sin capital, null', () => {
    expect(uninvested(20000, 12345.678)).toBe(7654.32)
    expect(uninvested(1000, 5000)).toBe(0)
    expect(uninvested(null, 10)).toBeNull()
    expect(uninvested(0, 0)).toBeNull()
  })
})

describe('queue y textos', () => {
  beforeEach(() => { takeOppQueue() })
  it('se lee una sola vez', () => {
    queueOpp({ usd: 1234.567, focus: 'split' })
    expect(takeOppQueue()).toEqual({ sub: 'oportunidades', usd: 1234.57, focus: 'split' })
    expect(takeOppQueue()).toBeNull()
    queueOpp({ usd: -4, focus: 'x' })
    expect(takeOppQueue()).toEqual({ sub: 'oportunidades', usd: null, focus: null })
  })
  it('joinList', () => {
    expect(joinList([2], t)).toBe('2')
    expect(joinList([1, 2], t)).toBe('1 y 2')
    expect(joinList([1, 2, 3], t)).toBe('1, 2 y 3')
  })
  it('summarize cuenta solo lo leído', () => {
    const s = summarize([{ t: 'A', reading: readSignal(flat(250)) }, { t: 'B', reading: null }, { t: 'C', reading: readSignal(withLast(250, 100, 130)) }])
    expect(s).toMatchObject({ read: 2, hit: 1 })
    expect(s.rows[0]).toMatchObject({ t: 'A', deepest: 200 })
  })
  it('cada texto que dice el reparto lleva el aviso educativo y nunca "compra"', () => {
    expect(es['opp.edu']).toMatch(/no es una recomendación de inversión/)
    const bad = Object.entries(es).filter(([, v]) => /\b(compra|compre|vende|venda|te recomendamos|recomendado)\b/i.test(v))
    expect(bad).toEqual([])
  })
  it('SMAS', () => { expect(SMAS).toEqual([20, 50, 100, 200]) })
})

describe('OppTeaser', () => {
  const rows = (closes) => closes.map((close, i) => ({ ts: i, close }))
  it('cuenta las posiciones en o bajo alguna media y lleva el aviso', () => {
    const html = renderToStaticMarkup(createElement(OppTeaser, {
      items: [
        { t: 'VOO', rows: rows(flat(250)) },
        { t: 'AAPL', rows: rows(withLast(250, 100, 130)) },
        { t: 'BTC', crypto: true, rows: null },
      ],
      free: 0, money: (v) => `$${v}`, onSee: () => {}, onSplit: () => {},
    }))
    expect(html).toContain('Hoy 1 de tus 2 posiciones está en o bajo')
    expect(html).toContain('VOO · media de 200')
    expect(html).toContain(es['opp.edu'])
    expect(html).toContain(es['opp.teaser.splitAny'])
  })
  it('cargando mientras no llega ninguna historia', () => {
    const html = renderToStaticMarkup(createElement(OppTeaser, { items: [{ t: 'VOO', rows: undefined }], free: 50, money: (v) => `$${v}`, onSee() {}, onSplit() {} }))
    expect(html).toContain(es['opp.teaser.loading'])
    expect(html).toContain('Repartir tus $50 sin invertir')
  })
})
