// Planificar (F5): las fórmulas de Invest (test/sizing.test.js) más lo nuevo
// (moneda, aportes, escaleras, proyección y planes guardados con topes).
import { describe, it, expect } from 'vitest'
import {
  amount, computeSizing, rMultiples, concentrationAlternative, sizeInUsd, stopFromDrop, isFractional,
  perContribution, addAlloc, equalAlloc, allocByDrift, splitCents, splitAmount, allocReady,
  ladderReading, ladderSplit, LADDERS, LEGACY_LADDERS, MIN_CLOSES,
  projectContributions, validateProjection,
  normalizePlan, readPlans, validatePlans, upsertPlan, removePlan, restorePlan, tradePlanFrom, planRisk,
  plansBytes, newPlanId, MAX_PLANS, MAX_PLANS_BYTES, PLANS_KEY,
} from './investPlan.js'

describe('computeSizing (igual que Invest)', () => {
  it('caso M12: capital 10.000, 2 %, entrada 234,12, stop 222 → 16 unidades, −194 al stop', () => {
    const r = computeSizing({ capital: 10000, riskPct: 2, entry: 234.12, stop: 222 })
    expect(r.units).toBe(16)
    expect(r.riskBudget).toBeCloseTo(200)
    expect(r.lossAtStop).toBeCloseTo(193.92)
    expect(r.exposure).toBeCloseTo(3745.92)
    expect(r.stopIsEstimate).toBe(false)
  })
  it('nunca arriesga más que la regla (redondea hacia abajo)', () => {
    const r = computeSizing({ capital: 10000, riskPct: 2, entry: 100, stop: 93 })
    expect(r.units).toBe(28)
    expect(r.lossAtStop).toBeLessThanOrEqual(200)
  })
  it('cripto: 4 decimales hacia abajo', () => {
    expect(computeSizing({ capital: 10000, riskPct: 1, entry: 60000, stop: 57000, fractional: true }).units).toBe(0.0333)
  })
  it('sin stop usa −8 % y lo marca como estimación', () => {
    const r = computeSizing({ capital: 10000, riskPct: 2, entry: 100 })
    expect(r.stop).toBeCloseTo(92)
    expect(r.stopIsEstimate).toBe(true)
    expect(r.units).toBe(25)
    expect(r.dropPct).toBeCloseTo(0.08)
  })
  it('sin la regla explícita usa 1 % (valor por defecto prudente)', () => {
    expect(computeSizing({ capital: 10000, entry: 100 }).riskBudget).toBeCloseTo(100)
  })
  it('no alcanza para una unidad entera', () => {
    const r = computeSizing({ capital: 1000, riskPct: 1, entry: 500, stop: 480 })
    expect(r.units).toBe(0)
    expect(r.lossAtStop).toBe(0)
  })
  it('aviso de concentración con alternativa entera', () => {
    const r = computeSizing({ capital: 10000, riskPct: 2, entry: 234.12, stop: 222 })
    expect(r.concentration.maxUnits).toBe(10)
    expect(Math.round(r.concentration.weightAtMax * 100)).toBe(23)
    expect(concentrationAlternative(100, 1, 10000)).toBeNull()
  })
  it('errores de entrada', () => {
    expect(computeSizing({ capital: 0, riskPct: 2, entry: 100 }).error).toBe('no-capital')
    expect(computeSizing({ capital: 1000, riskPct: 2, entry: 0 }).error).toBe('no-entry')
    expect(computeSizing({ capital: 1000, riskPct: 2, entry: 100, stop: 100 }).error).toBe('stop-not-below-price')
    expect(computeSizing({ capital: 1000, riskPct: 0, entry: 100 }).error).toBe('no-risk')
  })
  it('rMultiples: Stop, +1R, +2R, +3R', () => {
    const t = rMultiples(234.12, 222, 16)
    expect(t.map(x => x.key)).toEqual(['stop', 'r1', 'r2', 'r3'])
    expect(t[0].pnl).toBeCloseTo(-193.92)
    expect(t[1].price).toBeCloseTo(246.24)
    expect(t[3].pnl).toBeCloseTo(581.76)
  })
})

describe('calculadora con la moneda del activo (pbCalc)', () => {
  it('USD: igual que computeSizing', () => {
    const r = sizeInUsd({ entry: 234.12, stop: 222, fx: 1, capital: 10000, riskPct: 2, ticker: 'AAPL' })
    expect(r.units).toBe(16)
    expect(r.stopLocal).toBe(222)
  })
  it('otra moneda: precios en la moneda del activo, pérdida en USD', () => {
    // 1 USD = 950 CLP. Entrada 9.500 CLP (10 USD), stop 8.550 (9 USD): R = 1 USD.
    const r = sizeInUsd({ entry: 9500, stop: 8550, fx: 950, capital: 10000, riskPct: 1, ticker: 'SQM-B.SN' })
    expect(r.units).toBe(100)
    expect(r.lossAtStop).toBeCloseTo(100)
    expect(r.rTable[1].priceLocal).toBeCloseTo(10450)
  })
  it('sin tipo de cambio no calcula (nunca 1:1)', () => {
    expect(sizeInUsd({ entry: 9500, fx: null, capital: 10000, riskPct: 1 }).error).toBe('no-fx')
  })
  it('stop estimado en moneda local = entrada × 0,92', () => {
    const r = sizeInUsd({ entry: 1000, stop: '', fx: 20, capital: 10000, riskPct: 1, ticker: 'X.MX' })
    expect(r.stopIsEstimate).toBe(true)
    expect(r.stopLocal).toBeCloseTo(920)
  })
  it('cripto admite fracciones; "si baja un X %" da el stop', () => {
    expect(isFractional('BTC-USD')).toBe(true)
    expect(isFractional('VOO')).toBe(false)
    expect(stopFromDrop(100, 10)).toBeCloseTo(90)
    expect(stopFromDrop(100, 0)).toBeNull()
    expect(stopFromDrop(100, 100)).toBeNull()
  })
})

describe('aportes', () => {
  it('cadencia: solo informativa', () => {
    expect(perContribution(1000, 'monthly')).toBe(1000)
    expect(perContribution(1300, 'biweekly')).toBeCloseTo(600)
    expect(perContribution(1300, 'weekly')).toBeCloseTo(300)
    expect(perContribution(0, 'weekly')).toBeNull()
  })
  it('agregar al reparto: valida símbolo, porcentaje y tope', () => {
    expect(addAlloc([], '', 10).error).toBe('ticker_required')
    expect(addAlloc([], 'no válido', 10).error).toBe('ticker_invalid')
    expect(addAlloc([], 'VOO', 0).error).toBe('pct_range')
    expect(addAlloc([], 'voo', '12,5').alloc).toEqual([{ t: 'VOO', p: 12.5 }])
    expect(addAlloc([{ t: 'VOO', p: 10 }], 'VOO', 20).alloc).toEqual([{ t: 'VOO', p: 20 }])
  })
  it('pesos parejos suman 100 y nunca son negativos (Invest: −1 con más de 100)', () => {
    expect(equalAlloc(['A', 'B', 'C']).map(a => a.p).sort()).toEqual([33, 33, 34])
    const many = equalAlloc(Array.from({ length: 150 }, (_, i) => `T${i}`))
    expect(many.length).toBe(20)
    expect(many.every(a => a.p > 0)).toBe(true)
    expect(many.reduce((a, b) => a + b.p, 0)).toBe(100)
  })
  it('reparto por desvío: solo lo que está bajo su objetivo, en proporción', () => {
    const base = [{ t: 'VOO', valueUsd: 6000 }, { t: 'AAPL', valueUsd: 3000 }, { t: 'MSFT', valueUsd: 1000 }]
    const r = allocByDrift(base, { VOO: 50, AAPL: 30, MSFT: 20 })
    // VOO está 10 puntos sobre su objetivo; MSFT 10 bajo; AAPL igual → todo a MSFT.
    expect(r).toEqual([{ t: 'MSFT', p: 100 }])
    const r2 = allocByDrift(base, { VOO: 40, AAPL: 35, MSFT: 25 })
    expect(r2).toEqual([{ t: 'MSFT', p: 75 }, { t: 'AAPL', p: 25 }])
  })
  it('reparto por desvío: alineado → según el objetivo; sin pesos → vacío', () => {
    const base = [{ t: 'A', valueUsd: 500 }, { t: 'B', valueUsd: 500 }]
    expect(allocByDrift(base, { A: 50, B: 50 })).toEqual([{ t: 'A', p: 50 }, { t: 'B', p: 50 }])
    expect(allocByDrift(base, { A: 0, B: 0 })).toEqual([])
    expect(allocByDrift([], {})).toEqual([])
  })
  it('el reparto suma exactamente el total (centavos)', () => {
    const parts = splitCents(100, [1, 1, 1])
    expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10)
    expect(parts).toEqual([33.34, 33.33, 33.33])
  })
  it('no reparte si los porcentajes no suman 100 (Invest repartía igual)', () => {
    const r = splitAmount(1000, [{ t: 'A', p: 60 }, { t: 'B', p: 30 }])
    expect(r.ok).toBe(false)
    expect(r.error).toBe('sum')
    expect(r.sum).toBe(90)
    expect(allocReady([{ t: 'A', p: 99.6 }])).toBe(true)
    expect(splitAmount(0, [{ t: 'A', p: 100 }]).error).toBe('amount_required')
    const ok = splitAmount(400, [{ t: 'VOO', p: 60 }, { t: 'AAPL', p: 25 }, { t: 'MSFT', p: 15 }])
    expect(ok.rows.map(x => x.amount)).toEqual([240, 100, 60])
  })
})

describe('escalera sobre medias', () => {
  const rising = (n) => Array.from({ length: n }, (_, i) => 100 + i)
  it('lectura: precio, medias y RSI; menos de 25 cierres → null', () => {
    expect(ladderReading(rising(MIN_CLOSES - 1))).toBeNull()
    const rd = ladderReading(rising(250))
    expect(rd.price).toBe(349)
    expect(rd.smas[0]).toBeCloseTo(339.5) // media de los últimos 20
    expect(rd.smas.every(v => v != null)).toBe(true)
    expect(rd.rsi).toBe(100)
  })
  it('escaleras de Invest con sus nombres viejos', () => {
    expect(LADDERS.even).toEqual([0.25, 0.25, 0.25, 0.25])
    expect(LADDERS.long).toEqual([0.15, 0.2, 0.25, 0.4])
    expect(LADDERS.half200).toEqual([0.1, 0.15, 0.25, 0.5])
    expect(LEGACY_LADDERS).toEqual({ short: 'even', mid: 'long', long: 'half200' })
  })
  it('tramos y marca (·) cuando el precio está en o bajo la media', () => {
    const falling = Array.from({ length: 250 }, (_, i) => 400 - i)
    const r = ladderSplit(1000, [{ t: 'A', p: 100 }], { A: ladderReading(falling) }, 'even')
    expect(r.ok).toBe(true)
    const row = r.rows[0]
    expect(row.tramos.map(x => x.amount)).toEqual([250, 250, 250, 250])
    expect(row.tramos.every(x => x.below)).toBe(true)
    expect(row.reassigned).toBe(false)
  })
  it('un tramo sin media no pierde su dinero: se reasigna (Invest lo perdía)', () => {
    const r = ladderSplit(1000, [{ t: 'A', p: 100 }], { A: ladderReading(rising(120)) }, 'half200')
    const row = r.rows[0]
    expect(row.tramos[3].amount).toBeNull()
    expect(row.reassigned).toBe(true)
    const sum = row.tramos.reduce((a, x) => a + (x.amount || 0), 0)
    expect(sum).toBeCloseTo(1000, 6)
    expect(row.tramos[0].amount).toBe(200) // 10 / (10+15+25) × 1000
  })
  it('sin historia suficiente: el monto del símbolo queda entero, sin tramos', () => {
    const r = ladderSplit(500, [{ t: 'A', p: 50 }, { t: 'B', p: 50 }], { A: null, B: ladderReading(rising(250)) })
    expect(r.rows[0]).toMatchObject({ t: 'A', amount: 250, noHistory: true, tramos: null })
    expect(r.total).toBe(500)
  })
})

describe('proyección de aportes', () => {
  it('rendimiento 0: lo que pondrías', () => {
    const r = projectContributions({ monthly: 100, years: 10, rate: 0 })
    expect(r.value).toBeCloseTo(12000)
    expect(r.put).toBe(12000)
    expect(r.growth).toBeCloseTo(0)
    expect(r.byYear).toHaveLength(10)
  })
  it('interés compuesto mensual equivalente al anual', () => {
    // 1.000 iniciales al 10 % anual durante 1 año sin aportes ≈ 1.100 (más 1 centavo de aporte).
    const r = projectContributions({ monthly: 0.01, years: 1, rate: 10, initial: 1000 })
    expect(r.value).toBeCloseTo(1100.13, 1)
    const r2 = projectContributions({ monthly: 400, years: 10, rate: 5 })
    expect(r2.value).toBeGreaterThan(r2.put)
    // 400 × ((1,05^10 − 1) ÷ (1,05^(1/12) − 1)) = 400 × 154,36 ≈ 61.745
    expect(Math.round(r2.value)).toBe(61745)
  })
  it('rendimiento negativo resta', () => {
    expect(projectContributions({ monthly: 100, years: 5, rate: -5 }).growth).toBeLessThan(0)
  })
  it('valida años, rendimiento y montos', () => {
    expect(validateProjection({ monthly: 0, years: 10, rate: 5 }).fields).toEqual({ monthly: 'monthly_invalid' })
    expect(validateProjection({ monthly: 100, years: 0, rate: 5 }).fields).toEqual({ years: 'years_range' })
    expect(validateProjection({ monthly: 100, years: 2.5, rate: 5 }).fields).toEqual({ years: 'years_range' })
    expect(validateProjection({ monthly: 100, years: 51, rate: 5 }).fields).toEqual({ years: 'years_range' })
    expect(validateProjection({ monthly: 100, years: 10, rate: 25 }).fields).toEqual({ rate: 'rate_range' })
    expect(validateProjection({ monthly: 100, years: 10, rate: 5, initial: -1 }).fields).toEqual({ initial: 'initial_invalid' })
  })
})

describe('planes guardados', () => {
  const ts = 1763600000000
  const trade = { id: 'ptrade01', k: 'trade', ts, t: 'voo', ccy: 'USD', entry: 550, stop: 500, units: 4, cap: 20000, risk: 1 }
  const aporte = { id: 'paporte1', k: 'aporte', ts: ts - 1000, m: 400, cad: 'monthly', lad: 'even', alloc: [{ t: 'VOO', p: 60 }, { t: 'AAPL', p: 40 }], yrs: 10, rate: 5 }
  it('limpia y descarta lo que no sirve', () => {
    expect(normalizePlan(trade)).toMatchObject({ t: 'VOO', stop: 500, name: '' })
    expect(normalizePlan({ ...trade, stop: 600 }).stop).toBeNull() // stop sobre la entrada: inválido → estimado
    expect(normalizePlan({ ...trade, id: 'x' })).toBeNull()
    expect(normalizePlan({ ...trade, risk: 50 })).toBeNull()
    expect(normalizePlan({ ...trade, k: 'otro' })).toBeNull()
    expect(normalizePlan({ ...aporte, lad: 'short', cad: 'diario', alloc: [{ t: 'VOO', p: 60 }, { t: '!!', p: 40 }] })).toMatchObject({ lad: 'even', cad: 'monthly', alloc: [{ t: 'VOO', p: 60 }] })
    expect(normalizePlan({ ...trade, name: 'x'.repeat(80) }).name).toHaveLength(40)
  })
  it('lee invest_plans de los metadatos, el más nuevo primero y sin repetidos', () => {
    const user = { user_metadata: { [PLANS_KEY]: { v: 1, list: [aporte, trade, trade, { basura: 1 }] } } }
    expect(readPlans(user).map(p => p.id)).toEqual(['ptrade01', 'paporte1'])
    expect(readPlans(null)).toEqual([])
    expect(readPlans({ user_metadata: { [PLANS_KEY]: 'x' } })).toEqual([])
  })
  it('topes: cantidad y tamaño', () => {
    const many = Array.from({ length: MAX_PLANS + 1 }, (_, i) => ({ ...trade, id: `pp${String(i).padStart(4, '0')}`, ts: ts + i }))
    expect(validatePlans(many).error).toBe('plans_full')
    expect(validatePlans(many.slice(0, MAX_PLANS)).ok).toBe(true)
    // 20 planes de aportes con 20 símbolos cada uno no entran en el tope de bytes.
    const big = Array.from({ length: MAX_PLANS }, (_, i) => ({ ...aporte, id: `pb${String(i).padStart(4, '0')}`, name: 'n'.repeat(40), alloc: Array.from({ length: 20 }, (_, j) => ({ t: `TICKER${j}.SN`, p: 5 })) }))
    expect(plansBytes(big)).toBeGreaterThan(MAX_PLANS_BYTES)
    expect(validatePlans(big).error).toBe('plans_too_big')
    // Pero 20 planes normales sí.
    const normal = Array.from({ length: MAX_PLANS }, (_, i) => ({ ...(i % 2 ? trade : aporte), id: `pn${String(i).padStart(4, '0')}` }))
    expect(validatePlans(normal).ok).toBe(true)
  })
  it('agregar, editar (mismo id), borrar y deshacer', () => {
    let list = upsertPlan([], trade).list
    list = upsertPlan(list, aporte).list
    expect(list.map(p => p.id)).toEqual(['ptrade01', 'paporte1'])
    const edited = upsertPlan(list, { ...trade, entry: 540, name: 'VOO de diciembre' }).list
    expect(edited).toHaveLength(2)
    expect(edited.find(p => p.id === 'ptrade01')).toMatchObject({ entry: 540, name: 'VOO de diciembre' })
    const del = removePlan(edited, 'ptrade01')
    expect(del.list.map(p => p.id)).toEqual(['paporte1'])
    expect(removePlan(edited, 'nada').ok).toBe(false)
    expect(restorePlan(del.list, del.removed, del.index).list.map(p => p.id)).toEqual(['ptrade01', 'paporte1'])
    expect(upsertPlan(list, { id: 'mal' }).error).toBe('plan_invalid')
  })
  it('plan desde la calculadora: stop estimado se guarda como null', () => {
    const sized = sizeInUsd({ entry: 550, stop: '', fx: 1, capital: 20000, riskPct: 1, ticker: 'VOO' })
    const p = tradePlanFrom({ ticker: 'VOO', entry: 550, stop: '', capital: 20000, risk: 1 }, sized, { now: ts, id: 'pcalc001' })
    expect(p).toMatchObject({ id: 'pcalc001', k: 'trade', t: 'VOO', stop: null, units: sized.units })
    expect(newPlanId(ts, () => 0.5)).toMatch(/^p[a-z0-9]{4,20}$/)
  })
  it('riesgo de un plan con la tasa de hoy', () => {
    expect(planRisk(normalizePlan(trade), 1)).toMatchObject({ usd: 200, pct: 0.01, estimated: false })
    const est = planRisk(normalizePlan({ ...trade, stop: null }), 1)
    expect(est.estimated).toBe(true)
    expect(est.usd).toBeCloseTo(4 * 550 * 0.08)
    expect(planRisk(normalizePlan(trade), null)).toBeNull()
  })
})

describe('montos escritos a mano', () => {
  it('los grupos de miles no se leen como decimales', () => {
    expect(amount('10.000')).toBe(10000)
    expect(amount('1.250.000')).toBe(1250000)
    expect(amount('10,000')).toBe(10000)
    expect(amount('10.000,50')).toBe(10000.5)
    expect(amount('2.5')).toBe(2.5)
    expect(amount('400')).toBe(400)
    expect(amount('')).toBeNaN()
  })
})
