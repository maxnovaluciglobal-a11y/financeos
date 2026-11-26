// "Tus reglas hoy" (Resumen): estados en los bordes (cumple / cerca / lejos),
// RSI que falta o bloquea, activos sin lectura, la cuenta N de M igual a los
// estados de planCapital, avisos sin repetir, guardia de palabras y estructura
// accesible de la tarjeta.
import { describe, it, expect, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { classifyAsset, summarizeRules, marketFacts, NEAR_RULE } from './rules.js'
import { planCapital, LADDER_KEYS } from '../oportunidades/capital.js'
import { readSignal, SMAS } from '../oportunidades/signals.js'
import { vixZone } from '../../../utils/investMarket.js'
import {
  newRuleHits, parsePrefs, setAll, toggleAsset, wantsAlert, systemChannel, isQuiet, ledgerKey, localDay,
  pruneLedger, savePrefs, saveLedger, loadPrefs, PREFS_KEY, LEDGER_KEY, memoryStore, __resetMemory, tickerId,
} from './ruleAlerts.js'
import { readRule, readRsiRule, writeRsiRule, readLadder, writeLadder } from './rulePrefs.js'
import TusReglasHoy, { factText, noticeText, vixZoneOf } from './TusReglasHoy.jsx'
import { pushState as rulesPushState, alertId as rulesAlertId, QUIET_START as RQS, QUIET_END as RQE } from './ruleAlerts.js'
import { pushState as followPushState } from '../follow/shared.js'
import { alertId, QUIET_START, QUIET_END } from '../../../core/localAlerts/plan.js'
import es from './strings.es.js'
import en from './strings.en.js'
import pt from './strings.pt.js'
import de from './strings.de.js'
import { interpolate } from '../../../i18n/translate.js'
import '../i18n/investStrings.js' // registra invest.mkt.vix.* (la zona del VIX, la misma de Mercado)

const t = (k, v) => interpolate(es[k] ?? k, v)

// Lectura con la forma de readSignal, con medias y RSI a mano (bordes exactos).
function rd(price, values, rsi = 37) {
  const smas = SMAS.map((n, i) => {
    const value = values[i] ?? null
    if (value == null) return { n, tramo: i + 1, value: null, dist: null, hit: false, near: false }
    const dist = price / value - 1
    return { n, tramo: i + 1, value, dist, hit: price <= value, near: Math.abs(dist) <= 0.01 }
  })
  const hits = smas.filter(x => x.hit)
  return { price, closes: 250, crypto: false, smas, level: hits.length, deepest: hits.length ? hits[hits.length - 1].n : null, tramos: hits.map(x => x.tramo), missing: [], rsi, rsiZone: null, high: price, drawdown: 0 }
}
const ON = { ladder: 'half200', rsiRule: true }
const OFF = { ladder: 'half200', rsiRule: false }
const flat = (n, v = 100) => Array.from({ length: n }, () => v)
const withLast = (n, base, last) => [...flat(n - 1, base), last]
const rowsOf = (closes, endDay = 26) => closes.map((close, i) => {
  const d = new Date(Date.UTC(2026, 10, endDay) - (closes.length - 1 - i) * 86400000)
  return { date: d.toISOString().slice(0, 10), ts: Math.floor(d.getTime() / 1000), close }
})

describe('classifyAsset: cumple / cerca / lejos', () => {
  it('precio en o bajo una media con RSI 30–45: cumple, con la media más larga y el RSI', () => {
    const r = classifyAsset('AAPL', rd(95, [90, 100, 100, 110], 37), ON)
    expect(r.state).toBe('meets')
    expect(r.fact).toEqual({ kind: 'meets', n: 200, rsi: 37 })
    expect(r.met).toBe(3)
    expect(r.counted).toBe(4)
    expect(factText(r, t)).toBe('media de 200 días, RSI 37')
  })
  it('precio exactamente igual a la media: cumple (≤, como signals.js)', () => {
    expect(classifyAsset('X', rd(100, [100, 110, 120, 130]), ON).state).toBe('meets')
  })
  it('justo 2 % sobre la media más cercana: cerca; un poco más: lejos', () => {
    expect(NEAR_RULE).toBe(0.02)
    const atEdge = classifyAsset('X', rd(102, [100, 98, 95, 90]), ON)
    expect(atEdge.state).toBe('near')
    expect(atEdge.fact.n).toBe(20)
    const over = classifyAsset('X', rd(102.01, [100, 98, 95, 90]), ON)
    expect(over.state).toBe('far')
    expect(factText(over, t)).toMatch(/^2,0\s?% sobre su media de 20 días$/)
  })
  it('la media más cercana decide, aunque no sea la de 20 días', () => {
    const r = classifyAsset('X', rd(130, [110, 120, 129, 140]), ON)
    expect(r.state).toBe('meets') // 130 ≤ 140: la de 200 se cumple
    const r2 = classifyAsset('X', rd(150, [110, 120, 148, 140]), ON) // todas bajo el precio: la más cercana es la de 100
    expect(r2.state).toBe('near')
    expect(r2.fact.n).toBe(100)
    expect(factText(r2, t)).toMatch(/^a 1,4\s?% de su media de 100 días$/)
  })
  it('precio bajo la media pero RSI fuera de 30–45: cerca, con el RSI como dato; no cuenta', () => {
    const r = classifyAsset('X', rd(95, [100, 100, 100, 100], 62), ON)
    expect(r.state).toBe('near')
    expect(r.fact).toEqual({ kind: 'rsi', n: 200, rsi: 62 })
    expect(r.met).toBe(0)
    expect(factText(r, t)).toBe('en o bajo su media de 200 días; RSI 62, fuera de 30–45')
  })
  it('sin dato de RSI con la regla encendida: cerca y "sin dato de RSI"', () => {
    const r = classifyAsset('X', rd(95, [100, 100, 100, 100], null), ON)
    expect(r.state).toBe('near')
    expect(r.met).toBe(0)
    expect(factText(r, t)).toBe('en o bajo su media de 200 días; sin dato de RSI')
  })
  it('regla de RSI apagada: el RSI no se mira', () => {
    const r = classifyAsset('X', rd(95, [100, 100, 100, 100], 80), OFF)
    expect(r.state).toBe('meets')
    expect(r.fact.rsi).toBeNull()
    expect(factText(r, t)).toBe('en o bajo su media de 200 días')
  })
  it('una media sin cierres suficientes no cuenta en M', () => {
    const r = classifyAsset('X', rd(95, [100, 100, 100, null]), ON)
    expect(r.counted).toBe(3)
    expect(r.met).toBe(3)
    expect(r.fact.n).toBe(100)
  })
  it('sin lectura (null) o cargando (undefined): fuera de la cuenta', () => {
    expect(classifyAsset('X', null, ON)).toMatchObject({ state: 'none', met: 0, counted: 0 })
    expect(classifyAsset('X', undefined, ON)).toMatchObject({ state: 'loading', met: 0, counted: 0 })
    expect(factText(classifyAsset('X', null, ON), t)).toBe(es['rul.fact.none'])
  })
})

describe('summarizeRules: N de M igual a los tramos de planCapital', () => {
  const histories = {
    A: withLast(250, 100, 90),   // bajo todas sus medias
    B: withLast(250, 100, 101),  // 1 % sobre todas: cerca
    C: withLast(250, 100, 130),  // lejos
    D: flat(120, 100),           // sin media de 200 (120 cierres)
  }
  for (const ladder of LADDER_KEYS) {
    for (const rsiRule of [true, false]) {
      it(`escalera ${ladder}, RSI ${rsiRule ? 'encendido' : 'apagado'}`, () => {
        const items = Object.entries(histories).map(([tk, c]) => ({ t: tk, rows: rowsOf(c) }))
        const sum = summarizeRules(items, { ladder, rsiRule })
        const readings = Object.fromEntries(Object.entries(histories).map(([tk, c]) => [tk, readSignal(c)]))
        const plan = planCapital({ amount: 1000, alloc: [{ t: 'A', p: 40 }, { t: 'B', p: 30 }, { t: 'C', p: 20 }, { t: 'D', p: 10 }], readings, ladder, rsiRule })
        const all = plan.rows.flatMap(r => r.tramos || [])
        expect(sum.met).toBe(all.filter(x => x.state === 'today').length)
        expect(sum.total).toBe(all.filter(x => x.state !== 'none').length)
        expect(sum.read).toBe(4)
      })
    }
  }
  it('activos sin historia o cargando no entran; la fecha es el último cierre', () => {
    const sum = summarizeRules([
      { t: 'A', rows: rowsOf(flat(250, 100), 24) },
      { t: 'B', rows: rowsOf(withLast(250, 100, 130), 25) },
      { t: 'N', rows: null },
      { t: 'S', rows: rowsOf(flat(10)) },
      { t: 'L', rows: undefined },
      { t: 'A', rows: rowsOf(flat(250)) }, // repetido: se ignora
    ], OFF)
    expect(sum.rows.map(r => [r.t, r.state])).toEqual([['A', 'meets'], ['B', 'far'], ['N', 'none'], ['S', 'none'], ['L', 'loading']])
    expect(sum.met).toBe(4)
    expect(sum.total).toBe(8)
    expect(sum.none).toBe(2)
    expect(sum.loading).toBe(1)
    expect(sum.date).toBe('2026-11-25')
  })
  it('el orden es el del portafolio, nunca por estado', () => {
    const sum = summarizeRules([
      { t: 'FAR', rows: rowsOf(withLast(250, 100, 130)) },
      { t: 'MEET', rows: rowsOf(withLast(250, 100, 90)) },
    ], OFF)
    expect(sum.rows.map(r => r.t)).toEqual(['FAR', 'MEET'])
  })
})

describe('marketFacts: solo hechos', () => {
  it('SPY sobre, bajo o entre sus medias de 50 y 200; VIX con la zona de Mercado', () => {
    expect(marketFacts(rowsOf(withLast(250, 100, 120)), 26.6, vixZone)).toEqual({ spy: { pos: 'above' }, vix: { v: 26.6, zone: 'elevated' } })
    expect(marketFacts(rowsOf(withLast(250, 100, 80)), 12, vixZone)).toEqual({ spy: { pos: 'below' }, vix: { v: 12, zone: 'low' } })
    // 200 cierres a 100 y luego 50 a 120: la de 50 queda en 120, la de 200 en 115.
    const between = [...flat(200, 100), ...flat(49, 120), 118]
    expect(marketFacts(rowsOf(between), null, vixZone).spy).toEqual({ pos: 'between' })
    expect(marketFacts(rowsOf(withLast(120, 100, 120)), null, vixZone).spy).toEqual({ pos: 'above50' })
    expect(marketFacts(null, null, vixZone)).toEqual({ spy: null, vix: null })
  })
})

describe('copias locales (para no crecer el JS inicial) iguales a las originales', () => {
  it('horario tranquilo y hash de core/localAlerts/plan.js', () => {
    expect([RQS, RQE]).toEqual([QUIET_START, QUIET_END])
    for (const k of ['rule:AAPL', 'x', '', 'rule:BTC-USD']) expect(rulesAlertId(k)).toBe(alertId(k))
  })
  it('pushState de follow/shared.js', () => {
    for (const demo of [true, false]) for (const supported of [true, false]) for (const hasKey of [true, false]) for (const on of [true, false]) for (const permission of ['granted', 'denied', 'default']) {
      const a = { demo, supported, hasKey, on, permission }
      expect(rulesPushState(a)).toBe(followPushState(a))
    }
  })
  it('zona del VIX: la misma de Mercado (investMarket.vixZone)', () => {
    for (const v of [null, 0, 10, 14.99, 15, 24.99, 25, 34.99, 35, 80]) expect(vixZoneOf(v)).toBe(vixZone(v))
  })
})

describe('rulePrefs: la regla de Tus tramos', () => {
  it('sin almacenamiento: los valores por defecto (mitad en la de 200, RSI encendido)', () => {
    expect(readRule()).toEqual({ ladder: 'half200', rsiRule: true })
    writeLadder('even'); writeRsiRule(false) // sin localStorage en node: no lanza
    expect(readLadder()).toBe('half200')
    expect(readRsiRule()).toBe(true)
  })
})

describe('avisos de regla: una vez por activo + media + día', () => {
  beforeEach(() => __resetMemory())
  const NOON = new Date(2026, 10, 26, 12, 0, 0).getTime()
  const meets = (tk, ns, rsi = 37) => ({ t: tk, label: tk, state: 'meets', fact: { kind: 'meets', n: ns[ns.length - 1], rsi }, tramos: ns.map(n => ({ n, state: 'today' })) })

  it('el mismo día no se repite; una media nueva sí; al día siguiente vuelve', () => {
    const prefs = setAll(parsePrefs(null), true)
    const a = newRuleHits([meets('AAPL', [100])], prefs, {}, NOON)
    expect(a.notices).toEqual([{ t: 'AAPL', label: 'AAPL', n: 100, rsi: 37 }])
    const b = newRuleHits([meets('AAPL', [100])], prefs, a.ledger, NOON + 3600e3)
    expect(b.notices).toEqual([])
    const c = newRuleHits([meets('AAPL', [100, 200])], prefs, b.ledger, NOON + 7200e3)
    expect(c.notices.map(n => n.n)).toEqual([200])
    const d = newRuleHits([meets('AAPL', [100, 200])], prefs, c.ledger, NOON + 24 * 3600e3)
    expect(d.notices.map(n => n.n)).toEqual([200])
    expect(Object.keys(d.ledger)).toContain(ledgerKey('AAPL', 100, localDay(NOON + 24 * 3600e3)))
  })
  it('solo los activos elegidos; "cerca" y "lejos" nunca avisan', () => {
    let prefs = toggleAsset(parsePrefs(null), 'MSFT', true)
    expect(wantsAlert(prefs, 'MSFT')).toBe(true)
    expect(wantsAlert(prefs, 'AAPL')).toBe(false)
    const rows = [meets('AAPL', [50]), meets('MSFT', [20]), { t: 'VOO', state: 'near', tramos: [{ n: 20, state: 'wait' }] }]
    expect(newRuleHits(rows, prefs, {}, NOON).notices.map(n => n.t)).toEqual(['MSFT'])
    prefs = toggleAsset(prefs, 'MSFT', false)
    expect(newRuleHits(rows, prefs, {}, NOON).notices).toEqual([])
  })
  it('sin tickers en claro en el dispositivo; el registro viejo se poda', () => {
    const prefs = setAll(toggleAsset(parsePrefs(null), 'AAPL', true), false)
    savePrefs(memoryStore, prefs)
    const { ledger } = newRuleHits([meets('AAPL', [100])], prefs, {}, NOON)
    saveLedger(memoryStore, ledger)
    expect(memoryStore.getItem(PREFS_KEY)).not.toMatch(/AAPL/)
    expect(memoryStore.getItem(LEDGER_KEY)).not.toMatch(/AAPL/)
    expect(loadPrefs(memoryStore).ids).toEqual([tickerId('AAPL')])
    expect(pruneLedger({ old: NOON - 8 * 24 * 3600e3, now: NOON }, NOON)).toEqual({ now: NOON })
    expect(parsePrefs('{roto')).toEqual({ all: false, ids: [] })
  })
  it('notificación del sistema: solo con avisos activos, fuera de 21:00–8:00, nunca en la app nativa', () => {
    expect(isQuiet(new Date(2026, 10, 26, 21, 0).getTime())).toBe(true)
    expect(isQuiet(new Date(2026, 10, 26, 7, 59).getTime())).toBe(true)
    expect(isQuiet(new Date(2026, 10, 26, 8, 0).getTime())).toBe(false)
    expect(systemChannel({ pushState: 'on', now: NOON })).toEqual({ ok: true, why: null })
    expect(systemChannel({ pushState: 'on', now: new Date(2026, 10, 26, 22, 0).getTime() }).why).toBe('quiet')
    expect(systemChannel({ pushState: 'noLicense', now: NOON }).why).toBe('noLicense')
    expect(systemChannel({ pushState: 'off', now: NOON }).why).toBe('off')
    expect(systemChannel({ pushState: 'demo', now: NOON }).why).toBe('demo')
    expect(systemChannel({ pushState: 'on', native: true, now: NOON }).why).toBe('native')
  })
  it('el texto del aviso dice la media y la regla, sin calificar', () => {
    expect(noticeText({ label: 'AAPL', n: 100 }, true, t)).toBe('AAPL llegó a su media de 100 días y cumple tu regla de RSI.')
    expect(noticeText({ label: 'AAPL', n: 100 }, false, t)).toBe('AAPL llegó a su media de 100 días y cumple tu regla.')
  })
})

// ── Guardia de palabras ──────────────────────────────────────────────
// En "Tus reglas hoy", en los 4 idiomas, nada que califique el momento o
// empuje a operar. Y en TODO Inversiones, nada que lo califique (las palabras
// de operar sí existen en otras pantallas: "vender" en el formulario de una
// venta, "comprar" en la calculadora).
const BANNED = {
  es: /\b(favorables?|desfavorables?|señal|señales|oportunidad(es)?|comprar|compra|compre|vender|vende|venda|ideal(es)?|te conviene|le conviene)\b/i,
  en: /\b(favou?rable|unfavou?rable|signals?|opportunit(y|ies)|buy(ing)?|sell(ing)?|ideal|you should|worth it|good time)\b/i,
  pt: /\b(favorá?veis|favorável|desfavorável|sina(l|is)|oportunidades?|comprar|vender|ideal|te convém|lhe convém|vale a pena)\b/i,
  de: /(\bgünstig|\bungünstig|\bSignal|\bChance|\bGelegenheit|\bkaufen\b|\bverkaufen\b|\bKauf\b|\bVerkauf\b|\bideal\b|\blohnt)/i,
}
const EVALUATIVE = {
  es: /\b(favorables?|desfavorables?|ideal(es)?|te conviene)\b/i,
  en: /\b(favou?rable|unfavou?rable|ideal|you should)\b/i,
  pt: /\b(favorável|favoráveis|desfavorável|ideal|te convém|lhe convém)\b/i,
  de: /(\bgünstig|\bungünstig|\bideal\b)/i,
}
const DICTS = { es, en, pt, de }

describe('guardia de palabras', () => {
  it('"Tus reglas hoy": ninguna palabra prohibida en es/en/pt/de', () => {
    for (const [lang, d] of Object.entries(DICTS)) {
      const bad = Object.entries(d).filter(([, v]) => BANNED[lang].test(String(v))).map(([k]) => k)
      expect(bad, lang).toEqual([])
    }
  })
  it('el aviso educativo está en los 4 idiomas', () => {
    expect(es['rul.edu']).toMatch(/no es una recomendación de inversión/)
    expect(en['rul.edu']).toMatch(/not an investment recommendation/)
    expect(pt['rul.edu']).toMatch(/não é uma recomendação de investimento/)
    expect(de['rul.edu']).toMatch(/keine Anlageempfehlung/)
  })
  it('mismas claves y variables en los 4 idiomas; sin voseo; alemán de Sie', () => {
    const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join()
    for (const d of [en, pt, de]) {
      expect(Object.keys(d).sort()).toEqual(Object.keys(es).sort())
      for (const k of Object.keys(es)) expect(vars(d[k]), k).toBe(vars(es[k]))
    }
    const VOSEO = /\b(tenés|podés|querés|sabés|acá|vos|hacé|mirá|elegí|agregá|usá|probá|revisá|tocá|activá|cambiá)\b/i
    expect(Object.entries(es).filter(([, v]) => VOSEO.test(v) || /[¡!]/.test(v))).toEqual([])
    expect(Object.entries(de).filter(([, v]) => /\b(du|dich|dir|dein\w*)\b/i.test(v))).toEqual([])
  })
  it('en TODO Inversiones, nada califica el momento ("favorable", "ideal", "te conviene"…)', async () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const files = []
    const walk = (dir) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (/^(strings|text)\.(es|en|pt|de)\.js$/.test(f)) files.push(p) } }
    walk(root)
    expect(files.length).toBeGreaterThan(20)
    const bad = []
    for (const f of files) {
      const lang = f.match(/\.(es|en|pt|de)\.js$/)[1]
      const mod = await import(pathToFileURL(f).href)
      const d = mod.default || mod[lang]
      for (const [k, v] of Object.entries(d)) if (EVALUATIVE[lang].test(String(v))) bad.push(`${f.slice(root.length)} ${k}`)
    }
    expect(bad).toEqual([])
  })
})

// ── Estructura de la tarjeta ─────────────────────────────────────────
describe('TusReglasHoy: estructura y accesibilidad', () => {
  const base = { rule: ON, pushState: 'off', native: false, store: memoryStore, onSee: () => {} }
  const render = (props) => renderToStaticMarkup(createElement(TusReglasHoy, { ...base, ...props }))

  it('cuenta, lista con un ítem por activo y estados con palabra (no solo color)', () => {
    const html = render({
      items: [
        { t: 'AAPL', rows: rowsOf(withLast(250, 100, 90)) },
        { t: 'VOO', rows: rowsOf(withLast(250, 100, 130)) },
      ],
      spyRows: rowsOf(withLast(250, 100, 120)),
      vix: 26.6,
    })
    expect(html).toMatch(/<section[^>]*aria-labelledby="hoy-rules-title"/)
    expect(html).toContain('<h2 id="hoy-rules-title"')
    expect(html).toContain('Cierre del')
    // flat → RSI de una serie plana con una caída: fuera de 30–45 o sin dato.
    expect(html).toMatch(/Se cumple[n]? \d+ de 8 tramos/)
    const ul = html.match(/<ul[^>]*aria-label="Tus activos frente a tu regla"[^>]*>([\s\S]*?)<\/ul>/)
    expect(ul).not.toBeNull()
    expect((ul[1].match(/<li/g) || []).length).toBe(2)
    // Cada estado: ícono decorativo + palabra visible.
    for (const m of html.matchAll(/<span class="[^"]*" data-state="(\w+)">([\s\S]*?)<\/span><\/span>/g)) {
      expect(m[2]).toMatch(/aria-hidden="true"/)
      expect(m[2]).toMatch(/<span>[^<]+$/)
    }
    expect(html).toContain('data-state="far"')
    expect(html).toContain('>Lejos<')
    // La fila es un botón con nombre completo: activo, estado y dato.
    expect(html).toMatch(/aria-label="VOO: Lejos, 28,1\s?% sobre su media de 20 días\. Abrir Tus tramos"/)
    expect(html).toContain('el S&amp;P 500 (SPY) está sobre sus medias de 50 y 200 días')
    expect(html).toContain('VIX en 26,6, elevada')
    expect(html).toContain('Datos, no recomendaciones.')
    expect(html).toContain('no es una recomendación de inversión')
    expect(html).toContain(es['rul.al.all'])
    expect(html).toContain(es['rul.al.ch.off'])
  })
  it('estados vacíos y de carga', () => {
    expect(render({ items: [] })).toContain(es['rul.empty.noPositions'])
    expect(render({ items: [{ t: 'A', rows: undefined }] })).toContain(es['rul.loading'])
    const failed = render({ items: [{ t: 'A', rows: null }], onRetry: () => {} })
    expect(failed).toContain(es['rul.empty.failed'])
    expect(failed).toContain(es['rul.retry'])
    expect(render({ items: [{ t: 'A', rows: rowsOf(flat(10)) }] })).toContain(es['rul.empty.noReadings'])
    const partial = render({ items: [{ t: 'A', rows: rowsOf(flat(250)) }, { t: 'B', rows: null }] })
    expect(partial).toContain('1 activo sin lectura de medias')
    expect(partial).toContain('Se cumplen')
  })
  it('abre en una línea (cuenta + "Ver tus tramos") y el detalle se despliega sin perder nada', () => {
    const html = render({ items: [{ t: 'AAPL', rows: rowsOf(withLast(250, 100, 90)) }], spyRows: rowsOf(withLast(250, 100, 120)), vix: 18 })
    // La cuenta y "Ver tus tramos" quedan a la vista, antes del detalle.
    const detailAt = html.indexOf('hidden=""')
    expect(detailAt).toBeGreaterThan(0)
    expect(html.search(/Se cumple[n]? \d+ de \d+ tramos/)).toBeLessThan(detailAt)
    expect(html.indexOf('>Ver tus tramos<')).toBeLessThan(detailAt)
    // El botón dice si está desplegado y qué controla.
    const btn = html.match(/<button[^>]*aria-expanded="false"[^>]*aria-controls="([^"]+)"[^>]*>Ver el detalle/)
    expect(btn).not.toBeNull()
    expect(html).toMatch(new RegExp(`id="${btn[1].replace(/[:]/g, '\\$&')}"[^>]*hidden=""`))
    // Lista, avisos de tu regla y aviso educativo siguen en el detalle (plegado).
    const detail = html.slice(detailAt)
    expect(detail).toContain('aria-label="Tus activos frente a tu regla"')
    expect(detail).toContain(es['rul.al.title'])
    expect(detail).toContain('no es una recomendación de inversión')
    // Desplegado de entrada (defaultOpen), sin hidden y con "Ocultar el detalle".
    const open = render({ items: [{ t: 'AAPL', rows: rowsOf(withLast(250, 100, 90)) }], defaultOpen: true })
    expect(open).toMatch(/aria-expanded="true"[^>]*>Ocultar el detalle/)
    expect(open).not.toContain('hidden=""')
  })
  it('el acceso "Repartir" (split) va dentro del detalle', () => {
    const html = render({ items: [{ t: 'AAPL', rows: rowsOf(flat(250)) }], split: createElement('button', { type: 'button' }, 'Repartir tus US$9.000 sin invertir') })
    expect(html.indexOf('Repartir tus US$9.000 sin invertir')).toBeGreaterThan(html.indexOf('hidden=""'))
  })
  it('sin licencia: dice por qué el aviso queda solo en la app', () => {
    const html = render({ items: [{ t: 'A', rows: rowsOf(flat(250)) }], pushState: 'noLicense' })
    expect(html).toContain(es['rul.al.ch.noLicense'])
    expect(html).toContain(es['rul.al.closed'])
  })
})
