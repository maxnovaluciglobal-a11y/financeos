// Planificar (F5): textos en 4 idiomas, vista esencial frente a completa,
// regla de riesgo y planes en el demo (en memoria, datos coherentes).
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import es from './strings.es.js'
import en from './strings.en.js'
import pt from './strings.pt.js'
import de from './strings.de.js'
import { es as appEs } from '../../../i18n/withSections.js'
import { en as appEn } from '../../../i18n/withSections.js'
import { interpolate } from '../../../i18n/translate.js'
import { makeFmt } from '../portfolio/format.js'
import { CADENCES, computeSizing, readPlans, sizeInUsd, validatePlans } from '../../../utils/investPlan.js'
import { currencyOf } from '../../../utils/investValuation.js'
import { createDemoInvestStore, demoInvestHoldings, demoInvestPlans, demoInvestQuotes } from '../../../demo/demoInvestBook.js'
import { DEMO_CAPITAL } from '../../../demo/demoInvestHoy.js'
import { RULE_DEFAULTS } from '../../../core/investData.js'
import Calculator, { calcInputs, ruleDecimals } from './Calculator.jsx'
import Aportes, { segKeyTarget } from './Aportes.jsx'
import Plans from './Plans.jsx'
import { RuleCard, PLAN_SUBS, normPlanSub } from './Planificar.jsx'
import Fold from './Fold.jsx'

const L = { es, en, pt, de }
const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort()
const DIR = dirname(fileURLToPath(import.meta.url))
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ')
const tOf = (d) => (k, v) => interpolate(d[k] ?? es[k] ?? k, v)

describe('textos de Planificar', () => {
  for (const lang of ['en', 'pt', 'de']) {
    it(`${lang}: mismas claves y variables que el español`, () => {
      expect(Object.keys(L[lang]).sort()).toEqual(Object.keys(es).sort())
      expect(Object.keys(es).filter(k => vars(es[k]).join() !== vars(L[lang][k]).join())).toEqual([])
    })
  }
  it('portugués propio: ninguna frase igual al español (salvo palabras iguales)', () => {
    const same = new Set([
      'plan.sub.calc', 'plan.rule.cancel', 'plan.calc.titleFull', 'plan.calc.tickerPh', 'plan.calc.capital', 'plan.calc.full.stop',
      'plan.calc.full.col.result', 'plan.calc.r.r1', 'plan.calc.r.r2', 'plan.calc.r.r3', 'plan.calc.res.units',
      'plan.ap.cad.monthly', 'plan.ap.cad.weekly', 'plan.ap.res.col.pct', 'plan.pl.trade.stopEst', 'plan.pl.kind.trade',
      'plan.calc.stop', 'plan.ap.deposit', 'plan.pl.open',
    ])
    expect(Object.keys(es).filter(k => !same.has(k) && pt[k] === es[k])).toEqual([])
  })
  it('español neutro, sin exclamaciones ni emoji; el alemán no tutea', () => {
    const vos = /\b(tenés|podés|querés|sabés|elegí|tocá|mirá|buscá|agregá|escribí|probá|hacé|usá|guardá|revisá|cambiá|borrá|vos)\b/i
    expect(Object.entries(es).filter(([, v]) => vos.test(v)).map(([k]) => k)).toEqual([])
    for (const d of Object.values(L)) {
      expect(Object.entries(d).filter(([, v]) => /[¡!]|\p{Extended_Pictographic}/u.test(v)).map(([k]) => k)).toEqual([])
    }
    expect(Object.entries(de).filter(([, v]) => /\b(du|dein|deine|deinen|dich|dir)\b/i.test(v)).map(([k]) => k)).toEqual([])
  })
  it('sin consejos de compra o venta ni "monto sugerido"', () => {
    const banned = /deber[ií]as|te sugerimos|te recomendamos|monto sugerido|compra ahora|vende ya|should buy|you should|we recommend|sollten Sie kaufen|você deveria/i
    for (const d of Object.values(L)) expect(Object.entries(d).filter(([, v]) => banned.test(v)).map(([k]) => k)).toEqual([])
  })
  it('avisos educativos donde hay datos de mercado y proyecciones', () => {
    expect(es['plan.calc.foot']).toMatch(/no una instrucción ni una recomendación de inversión/)
    expect(es['plan.proj.warn']).toMatch(/^No es una garantía/)
    expect(es['plan.dataNote']).toMatch(/posible retraso/)
    expect(es['plan.calc.title']).toBe('¿Cuánto puedo perder si sale mal?')
  })
  it('familias dinámicas completas', () => {
    const need = [
      ...PLAN_SUBS.map(k => `plan.sub.${k}`),
      ...CADENCES.map(c => `plan.ap.cad.${c}`),
      ...['no-entry', 'no-capital', 'no-risk', 'stop-not-below-price', 'drop', 'no-fx'].map(k => `plan.calc.err.${k}`),
      ...['stop', 'r1', 'r2', 'r3'].map(k => `plan.calc.r.${k}`),
      ...['ticker_required', 'ticker_invalid', 'pct_range', 'too_many'].map(k => `plan.ap.alloc.err.${k}`),
      ...['noTargets', 'zeroTargets', 'targetsOk'].map(k => `plan.ap.alloc.${k}`),
      ...['years_range', 'rate_range', 'monthly_invalid', 'initial_invalid'].map(k => `plan.proj.err.${k}`),
      ...['risk_range', 'limit_range', 'save'].map(k => `plan.rule.err.${k}`),
      ...['required', 'invalid', 'save'].map(k => `plan.cap.err.${k}`),
      ...['plans_full', 'plans_too_big', 'save', 'load'].map(k => `plan.pl.err.${k}`),
      ...['amount_required', 'amount_invalid'].map(k => `plan.ap.err.${k}`),
    ]
    expect(need.filter(k => !(k in es))).toEqual([])
  })
  it('cada t(\'…\') literal de Planificar existe (en su diccionario o en el de la app)', () => {
    const code = readdirSync(DIR).filter(f => f.endsWith('.jsx')).map(f => readFileSync(join(DIR, f), 'utf8')).join('\n')
    const used = [...new Set([...code.matchAll(/\bt\(\s*'([^'$`]+)'/g)].map(m => m[1]))]
    expect(used.length).toBeGreaterThan(60)
    expect(used.filter(k => !(k in es) && !(k in appEs))).toEqual([])
  })
  it('los textos no viven en el diccionario principal (chunk diferido)', () => {
    expect(Object.keys(appEs).filter(k => k.startsWith('plan.'))).toEqual([])
    expect(Object.keys(appEn).filter(k => k.startsWith('plan.'))).toEqual([])
  })
  it('lo guardado en el dispositivo: nada de planes, tickers ni regla', () => {
    const code = readdirSync(DIR).filter(f => /\.jsx?$/.test(f) && !f.endsWith('.test.js')).map(f => readFileSync(join(DIR, f), 'utf8').replace(/^\s*\/\/.*$/gm, '')).join('\n')
    const writes = [...code.matchAll(/localStorage\.setItem\(([^,]+),/g)].map(m => m[1].trim())
    // Solo la sub-pestaña de Portafolio a la que se salta (rememberPortTab recibe la clave).
    expect(writes).toEqual(['k'])
    expect(code).not.toMatch(/sessionStorage|indexedDB/)
  })
})

describe('regla de riesgo y demo', () => {
  it('regla por defecto prudente: 1 % por operación y 25 % por posición', () => {
    expect(RULE_DEFAULTS).toEqual({ risk: 1, limit: 25 })
    expect(ruleDecimals(1)).toBe(0)
    expect(ruleDecimals(1.5)).toBe(1)
    expect(ruleDecimals(0.25)).toBe(2)
  })
  it('el demo guarda la regla y los planes en memoria, con validación', async () => {
    const st = createDemoInvestStore({ now: () => Date.UTC(2026, 10, 20) })
    expect((await st.getProfile()).data).toEqual({ capital: DEMO_CAPITAL, rule: RULE_DEFAULTS })
    expect((await st.setRiskRule({ risk: 50, limit: 25 })).fields).toEqual({ risk: 'risk_range' })
    expect((await st.setRiskRule({ risk: '1,5', limit: 30 })).data).toEqual({ risk: 1.5, limit: 30 })
    expect((await st.getProfile()).data.rule).toEqual({ risk: 1.5, limit: 30 })
    const plans = (await st.getPlans()).data
    expect(plans.map(p => p.k)).toEqual(['trade', 'aporte'])
    expect((await st.savePlans([])).data).toEqual([])
    expect((await st.savePlans([{ id: 'nope' }])).error).toBe('plan_invalid')
    st.clear()
    expect((await st.getPlans()).data).toHaveLength(2)
  })
  it('los planes de ejemplo cuadran con el portafolio de ejemplo', () => {
    const plans = demoInvestPlans(Date.UTC(2026, 10, 20))
    expect(validatePlans(plans).ok).toBe(true)
    expect(readPlans({ user_metadata: { invest_plans: { v: 1, list: plans } } })).toHaveLength(2)
    const trade = plans.find(p => p.k === 'trade')
    const voo = demoInvestHoldings().find(x => x.t === 'VOO')
    expect(trade.entry).toBe(demoInvestQuotes().VOO.price)
    expect(trade.stop).toBe(voo.stop)
    expect(computeSizing({ capital: trade.cap, riskPct: trade.risk, entry: trade.entry, stop: trade.stop }).units).toBe(trade.units)
    const held = new Set(demoInvestHoldings().map(x => x.t))
    const ap = plans.find(p => p.k === 'aporte')
    expect(ap.alloc.every(a => held.has(a.t))).toBe(true)
    expect(ap.alloc.reduce((a, b) => a + b.p, 0)).toBe(100)
  })
})

describe('vista esencial y completa', () => {
  const fmt = makeFmt({ disp: { ccy: 'USD', rate: 1 }, currency: 'USD', language: 'es' })
  const pb = {
    holdings: demoInvestHoldings(), market: { quotes: demoInvestQuotes() }, rates: { rates: {} },
    positions: { rows: [], totals: { cost: 11000, value: 12500 } }, ledger: { usesCash: true, cash: 380 },
  }
  const rule = { risk: 1, limit: 25 }
  const render = (C, props) => text(renderToStaticMarkup(h(C, { pb, fmt, t: tOf(es), demo: true, ...props })))

  it('calculadora esencial: la pregunta en palabras, sin stop ni R', () => {
    const out = render(Calculator, { view: 'esencial', rule, capital: 20000, onSavePlan: () => {}, onAddToPortfolio: () => {} })
    expect(out).toContain('¿Cuánto puedo perder si sale mal?')
    expect(out).toContain('Cuánto aceptas que baje (%)')
    expect(out).not.toMatch(/Stop \(|múltiplos de R/)
    expect(out).toContain('Desde tu portafolio')
    expect(out).toContain('VOO')
  })
  it('calculadora completa: stop, capital y regla para probar', () => {
    const out = render(Calculator, { view: 'completa', rule, capital: 20000, onSavePlan: () => {}, onAddToPortfolio: () => {} })
    expect(out).toContain('Calculadora de posición')
    expect(out).toContain('Stop (USD)')
    expect(out).toContain('Tu regla: % del capital')
    expect(out).not.toContain('Cuánto aceptas que baje')
  })
  it('entradas de la calculadora según la vista', () => {
    const f = { ticker: 'VOO', entry: '550', stop: '500', drop: '', capital: '', risk: '' }
    expect(calcInputs(f, { full: true, capital: 20000, rule })).toMatchObject({ entry: 550, stop: 500, capital: 20000, riskPct: 1, limit: 0.25 })
    // Esencial sin caída escrita: stop vacío (se estima −8 % y se marca).
    expect(calcInputs(f, { full: false, capital: 20000, rule })).toMatchObject({ stop: '', dropTyped: false })
    const e = calcInputs({ ...f, drop: '10' }, { full: false, capital: 20000, rule })
    expect(e.stop).toBeCloseTo(495)
    expect(e.dropTyped).toBe(true)
    expect(calcInputs({ ...f, drop: '120' }, { full: false, capital: 20000, rule }).dropBad).toBe(true)
    // En la completa se puede probar otro capital y otra regla sin guardarlos.
    expect(calcInputs({ ...f, capital: '10.000', risk: '2' }, { full: true, capital: 20000, rule })).toMatchObject({ capital: 10000, riskPct: 2 })
  })
  it('aportes: el capital disponible en las dos vistas; la escalera ya no está aquí, solo el enlace a Tus tramos (decisión del 24-nov-2026)', () => {
    const base = { capital: 20000, targets: null, onSavePlan: () => {}, onDeposit: () => {}, onTab: () => {}, onGoOpp: () => {} }
    for (const view of ['esencial', 'completa']) {
      const html = render(Aportes, { ...base, view })
      expect(html).toContain('Tu aporte mensual')
      expect(html).toContain('¿Cuánto podrías tener?')
      expect(html).toContain('Usar tu capital sin invertir')
      expect(html).not.toContain('Escalera sobre medias móviles')
      expect(html).not.toContain('Calcular los tramos')
      expect(html).toContain('Repartir por tramos según tus medias')
    }
    expect(Object.keys(es).filter(k => k.startsWith('plan.lad.'))).toEqual([])
  })
  it('aportes: lo que trae Repartir de Resumen se usa como monto (también en el ejemplo)', () => {
    const base = { capital: 20000, targets: null, onSavePlan: () => {}, onDeposit: () => {}, onTab: () => {} }
    const html = render(Aportes, { ...base, view: 'esencial', arriveUsd: 750 })
    expect(html).toContain('Usar el aporte de este mes (US$750,00)')
  })
  it('regla: en palabras en la esencial; con el límite por posición en la completa', () => {
    const p = { t: tOf(es), fmt, rule: { risk: 1.5, limit: 25 }, capital: 20000, demo: true, onSaveRule: async () => ({ ok: true }), onSaveCapital: async () => ({ ok: true }) }
    const ess = text(renderToStaticMarkup(h(RuleCard, { ...p, view: 'esencial' })))
    expect(ess).toMatch(/aceptas perder como máximo el 1,5/)
    expect(ess).not.toContain('Límite por posición')
    const full = text(renderToStaticMarkup(h(RuleCard, { ...p, view: 'completa' })))
    expect(full).toContain('Límite por posición')
    const none = text(renderToStaticMarkup(h(RuleCard, { ...p, capital: null, view: 'esencial' })))
    expect(none).toContain('Capital de referencia (US$)')
  })
  it('planes guardados: vacío, de ejemplo y con el riesgo de hoy', () => {
    const base = { fmt, t: tOf(es), rates: {}, onOpen: () => {}, onRename: async () => true, onDelete: () => {}, onGoCalc: () => {} }
    const empty = text(renderToStaticMarkup(h(Plans, { ...base, demo: false, plans: { phase: 'ready', list: [] } })))
    expect(empty).toContain('Todavía no tienes planes guardados')
    expect(empty).toContain('Hasta 20 planes')
    const list = text(renderToStaticMarkup(h(Plans, { ...base, demo: true, plans: { phase: 'ready', list: demoInvestPlans(Date.UTC(2026, 10, 20)) } })))
    expect(list).toContain('Compra de VOO')
    expect(list).toContain('4 unidades')
    expect(list).toContain('Aporte de')
    expect(list).toContain('Entre 3 símbolos')
    expect(list).toContain('Planes de ejemplo')
  })
  it('en inglés también se pinta (sin claves sueltas)', () => {
    const out = text(renderToStaticMarkup(h(Calculator, { pb, fmt, t: tOf(en), demo: true, view: 'esencial', rule, capital: 20000, onSavePlan: () => {}, onAddToPortfolio: () => {} })))
    expect(out).toContain('How much could I lose if it goes wrong?')
    expect(out).not.toMatch(/plan\.[a-z]+\./)
  })
})

describe('revisión 23-nov', () => {
  const rule = { risk: 1, limit: 25 }
  const fmt = makeFmt({ disp: { ccy: 'USD', rate: 1 }, currency: 'USD', language: 'es' })
  const pb = {
    holdings: demoInvestHoldings(), market: { quotes: demoInvestQuotes() }, rates: { rates: {} },
    positions: { rows: [], totals: { cost: 11000, value: 12500 } }, ledger: { usesCash: true, cash: 380 },
  }
  it('la regla escrita a mano tiene los topes de la cuenta (0,1 % a 10 %)', () => {
    const f = { ticker: 'VOO', entry: '550', stop: '500', drop: '', capital: '', risk: '25' }
    expect(calcInputs(f, { full: true, capital: 20000, rule }).riskBad).toBe(true)
    expect(calcInputs({ ...f, risk: '0,05' }, { full: true, capital: 20000, rule }).riskBad).toBe(true)
    expect(calcInputs({ ...f, risk: '2' }, { full: true, capital: 20000, rule }).riskBad).toBe(false)
    expect(calcInputs({ ...f, risk: '' }, { full: true, capital: 20000, rule }).riskBad).toBe(false)
    // En la esencial la regla es la de la cuenta: nunca fuera de rango.
    expect(calcInputs(f, { full: false, capital: 20000, rule }).riskBad).toBe(false)
    for (const l of [es, en, pt, de]) expect(l['plan.calc.err.risk-range']).toMatch(/\{min\}.*\{max\}/)
  })
  it('las opciones de Aportes siguen el patrón de radios (flechas, Inicio y Fin)', () => {
    const v = ['monthly', 'biweekly', 'weekly']
    expect(segKeyTarget('ArrowRight', 'monthly', v)).toBe('biweekly')
    expect(segKeyTarget('ArrowDown', 'weekly', v)).toBe('monthly')
    expect(segKeyTarget('ArrowLeft', 'monthly', v)).toBe('weekly')
    expect(segKeyTarget('ArrowUp', 'biweekly', v)).toBe('monthly')
    expect(segKeyTarget('Home', 'weekly', v)).toBe('monthly')
    expect(segKeyTarget('End', 'monthly', v)).toBe('weekly')
    expect(segKeyTarget('Tab', 'monthly', v)).toBeNull()
    const html = renderToStaticMarkup(h(Aportes, { pb, fmt, t: tOf(es), demo: true, view: 'esencial', capital: 20000, targets: null, onSavePlan: () => {}, onDeposit: () => {}, onTab: () => {} }))
    const radios = [...html.matchAll(/role="radio"[^>]*tabindex="(-?\d)"/g)].map(m => m[1])
    expect(radios.filter(x => x === '0')).toHaveLength(1)
  })
  it('el demo aplica cambios puntuales a sus planes', async () => {
    const st = createDemoInvestStore({ now: () => Date.UTC(2026, 10, 20) })
    const [a] = (await st.getPlans()).data
    expect((await st.updatePlans({ op: 'remove', id: a.id })).data).toHaveLength(1)
    expect((await st.updatePlans({ op: 'restore', plan: a, index: 0 })).data).toHaveLength(2)
    expect((await st.updatePlans({ op: 'upsert', plan: { ...a, name: 'Mi VOO' } })).data.find(p => p.id === a.id).name).toBe('Mi VOO')
  })
  it('un plan sin moneda conocida no muestra el precio como US$', () => {
    const plan = { id: 'pzz12345', k: 'trade', ts: Date.UTC(2026, 10, 20), name: '', t: 'ABC.ZZ', ccy: null, entry: 12.5, stop: 11, units: 10, cap: 20000, risk: 1 }
    const out = text(renderToStaticMarkup(h(Plans, { fmt, t: tOf(es), rates: {}, demo: false, plans: { phase: 'ready', list: [plan] }, onOpen: () => {}, onRename: async () => true, onDelete: () => {}, onGoCalc: () => {} })))
    expect(out).toContain('sin tipo de cambio')
    expect(out).not.toMatch(/US\$\s?12/)
  })
})

describe('revisión 23-nov (ronda 2)', () => {
  const rule = { risk: 1, limit: 25 }
  it('un plan abierto en la vista esencial usa su capital y su regla: mismas unidades que en la completa', () => {
    // Plan guardado en la completa: capital 50.000, regla 2 %, entrada 100, stop 90.
    const seedForm = { ticker: 'VOO', entry: '100', stop: '90', drop: '10', capital: '50000', risk: '2' }
    const full = calcInputs(seedForm, { full: true, capital: 10000, rule })
    const ess = calcInputs(seedForm, { full: false, capital: 10000, rule })
    expect(ess).toMatchObject({ capital: 50000, riskPct: 2, planOverride: true })
    const size = (i) => sizeInUsd({ entry: i.entry, stop: i.stop, fx: 1, capital: i.capital, riskPct: i.riskPct, limit: i.limit, ticker: 'VOO' })
    expect(size(ess).units).toBe(size(full).units)
    expect(size(ess).units).toBe(100)
    // Sin plan abierto, la esencial usa los de la cuenta y no muestra la nota.
    expect(calcInputs({ ...seedForm, capital: '', risk: '' }, { full: false, capital: 10000, rule })).toMatchObject({ capital: 10000, riskPct: 1, planOverride: false })
    for (const l of [es, en, pt, de]) expect(vars(l['plan.calc.planRule'])).toEqual(['cap', 'pct'])
  })
  it('moneda desconocida: no se calcula ni se guarda como USD', () => {
    expect(currencyOf('NPN.JO', null)).toBeNull()
    const src = readFileSync(join(DIR, 'Calculator.jsx'), 'utf8')
    expect(src).not.toMatch(/currencyOf\([^)]*\)\s*\|\|\s*'USD'/)
    expect(src).toMatch(/if \(!ccy\) return \{ error: 'no-ccy' \}/)
    for (const l of [es, en, pt, de]) {
      expect(vars(l['plan.calc.err.no-ccy'])).toEqual(['t'])
      expect(l['plan.calc.ccyUnknown']).toBeTruthy()
    }
  })
})

describe('Planificar en dos partes (26-nov-2026)', () => {
  const fmt = makeFmt({ disp: { ccy: 'USD', rate: 1 }, currency: 'USD', language: 'es' })
  const pb = {
    holdings: demoInvestHoldings(), market: { quotes: demoInvestQuotes() }, rates: { rates: {} },
    positions: { rows: [], totals: { cost: 11000, value: 12500 } }, ledger: { usesCash: true, cash: 380 },
  }
  it('solo Tus tramos y Aportes; las partes viejas caen en la nueva con su sección abierta', () => {
    expect(PLAN_SUBS).toEqual(['oportunidades', 'aportes'])
    expect(normPlanSub('calc')).toEqual({ sub: 'oportunidades', calc: true, plans: false })
    expect(normPlanSub('planes')).toEqual({ sub: 'aportes', calc: false, plans: true })
    expect(normPlanSub('aportes')).toEqual({ sub: 'aportes', calc: false, plans: false })
    expect(normPlanSub(undefined).sub).toBe('oportunidades')
    expect(normPlanSub('cualquiera').sub).toBe('oportunidades')
    for (const l of [es, en, pt, de]) {
      expect(l['plan.sub.calc']).toBeUndefined()
      expect(l['plan.sub.planes']).toBeUndefined()
    }
  })
  it('aportes: una sola "Cómo lo repartes", sin la regla de riesgo, y "¿Cuánto podrías tener?" plegada', () => {
    const html = renderToStaticMarkup(h(Aportes, { pb, fmt, t: tOf(es), demo: true, view: 'esencial', capital: 20000, targets: null, onSavePlan: () => {}, onDeposit: () => {}, onTab: () => {}, onGoOpp: () => {} }))
    expect((text(html).match(/Cómo lo repartes/g) || []).length).toBe(1)
    expect(html).not.toContain('Tu regla de riesgo')
    expect(html).toMatch(/aria-expanded="false" aria-controls="plan-proj-body"/)
    expect(html).toMatch(/id="plan-proj-body"[^>]*hidden/)
    expect(text(html)).toContain('¿Cuánto podrías tener?')
  })
  it('sección plegable: botón con aria-expanded, el contenido montado y oculto, y el conteo', () => {
    const closed = renderToStaticMarkup(h(Fold, { id: 'x', title: 'Planes guardados', count: 2, open: false, onToggle: () => {} }, h('p', null, 'adentro')))
    expect(closed).toMatch(/<h2 id="x-h"[^>]*><button[^>]*aria-expanded="false" aria-controls="x-body"/)
    expect(text(closed)).toContain('Planes guardados (2)')
    expect(closed).toMatch(/id="x-body"[^>]*hidden=""[^>]*><p>adentro<\/p>/)
    const open = renderToStaticMarkup(h(Fold, { id: 'x', title: 'T', open: true, onToggle: () => {} }, 'c'))
    expect(open).toContain('aria-expanded="true"')
    expect(open).not.toMatch(/id="x-body"[^>]*hidden/)
  })
  it('planes dentro de Aportes: sin título propio ni segundo aviso de ejemplo; Abrir, Cambiar nombre y Borrar siguen', () => {
    const base = { fmt, t: tOf(es), rates: {}, onOpen: () => {}, onRename: async () => true, onDelete: () => {}, onGoCalc: () => {} }
    const html = renderToStaticMarkup(h(Plans, { ...base, demo: true, embedded: true, plans: { phase: 'ready', list: demoInvestPlans(Date.UTC(2026, 10, 20)) } }))
    expect(html).not.toContain('<h2')
    expect(html).not.toContain('Planes de ejemplo')
    for (const w of ['Abrir', 'Cambiar nombre', 'Borrar']) expect(text(html)).toContain(w)
  })
  it('la calculadora dentro de Tus tramos: sin título propio (lo lleva la sección)', () => {
    const html = renderToStaticMarkup(h(Calculator, { pb, fmt, t: tOf(es), demo: true, view: 'esencial', rule: { risk: 1, limit: 25 }, capital: 20000, onSavePlan: () => {}, onAddToPortfolio: () => {}, embedded: true }))
    expect(html).not.toContain('<h2')
    expect(html).not.toContain('<section')
    expect(text(html)).toContain('Cuánto aceptas que baje (%)')
  })
})
