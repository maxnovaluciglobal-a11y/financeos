import { describe, it, expect } from 'vitest'
import { dailyAvailable, paceToday, paydayOf, dayAt, keyStep, lensPlacement, xOf, yDomain, yOf, CHART_W, CHART_PAD } from './dailyAvailable.js'
import { homeMonthTotals } from '../pages/Dashboard/dashboardModel.js'
import { projectEndOfMonth } from './projection.js'

const NOW = new Date(2026, 10, 18, 12) // 18-nov-2026
const inc = [
  { id: 1, date: '2026-11-03', amount: 200 },
  { id: 2, date: '2026-11-15', amount: 1150 },   // ingreso a mitad de mes
  { id: 3, date: '2026-10-30', amount: 999 },    // otro mes
]
const exp = [
  { id: 1, date: '2026-11-01', amount: 40 },
  { id: 2, date: '2026-11-10', amount: 15.25 },
  { id: 3, date: '2026-11-18', amount: 60 },
  { id: 4, date: '2026-11-25', amount: 10 },     // fecha futura: cuenta hoy
]
const S = dailyAvailable({ incomes: inc, expenses: exp, activeMonth: '2026-11', now: NOW, income: 1350 })

describe('gasto acumulado del mes', () => {
  it('solo sube: los ingresos no producen saltos', () => {
    expect(S.lastDay).toBe(18)
    for (let d = 2; d <= S.lastDay; d++) expect(S.spentCum[d]).toBeGreaterThanOrEqual(S.spentCum[d - 1])
    expect(S.spentCum[1]).toBe(40)
    expect(S.spentCum[10]).toBe(55.25)
    expect(S.spentCum[15]).toBe(55.25)   // el cobro del 15 no mueve la línea
  })
  it('hoy: gastado = gastos del mes y disponible = "Te queda" (lo futuro cuenta hoy)', () => {
    const { cur } = homeMonthTotals({ incomes: inc, expenses: exp, activeMonth: '2026-11', now: NOW })
    expect(S.spentCum[18]).toBe(cur.totalExp)
    expect(S.avail[18]).toBe(cur.freeFlow)
    expect(S.spent[18]).toBe(70)
    expect(S.avail[10]).toBe(144.75)    // "te quedaban" el martes 10
  })
  it('ritmo ideal: una recta de ~0 al ingreso del mes el último día', () => {
    expect(S.ideal[30]).toBe(1350)
    expect(S.ideal[1]).toBeCloseTo(45, 5)
    const step = S.ideal[2] - S.ideal[1]
    for (let d = 2; d < 30; d++) expect(S.ideal[d + 1] - S.ideal[d]).toBeCloseTo(step, 1)
  })
  it('proyección = la de la tarjeta Proyección (projection.js), nunca menos que lo gastado', () => {
    const p = projectEndOfMonth({ incomes: inc, expenses: exp, activeMonth: '2026-11', now: NOW })
    expect(S.projEnd).toBe(Math.max(S.spentCum[18], p.projExp))
  })
  it('ENG-N2: el arriendo del día 1 no se extrapola como gasto diario', () => {
    // 5-nov: ingreso 2.000.000, arriendo 950.000 el día 1 (fijo) y 200.000 de gasto variable.
    const now = new Date(2026, 10, 5, 12)
    const incomes = [{ date: '2026-11-01', amount: 2000000 }]
    const expenses = [
      { date: '2026-11-01', amount: 950000, recurringId: 'r-arriendo' },
      { date: '2026-11-02', amount: 50000 }, { date: '2026-11-03', amount: 50000 },
      { date: '2026-11-04', amount: 50000 }, { date: '2026-11-05', amount: 50000 },
    ]
    const sr = dailyAvailable({ incomes, expenses, activeMonth: '2026-11', now, income: 2000000 })
    const p = projectEndOfMonth({ incomes, expenses, activeMonth: '2026-11', now })
    expect(sr.projEnd).toBe(p.projExp)
    expect(sr.projEnd).toBe(2400000)          // 1.150.000 + 50.000 × 25 días; antes daba 6.900.000
    // Los fijos que faltan se suman, igual que en la tarjeta Proyección.
    const withPending = dailyAvailable({ incomes, expenses, activeMonth: '2026-11', now, income: 2000000, pending: { income: 0, expense: 30000, count: 1 } })
    expect(withPending.projEnd).toBe(2430000)
  })
  it('sin ingreso no hay ideal ni píldora; mes cerrado sin proyección; mes futuro sin días', () => {
    const noInc = dailyAvailable({ incomes: [], expenses: exp, activeMonth: '2026-11', now: NOW })
    expect(noInc.ideal).toBeNull()
    expect(paceToday(noInc)).toBeNull()
    const past = dailyAvailable({ incomes: inc, expenses: exp, activeMonth: '2026-10', now: NOW, income: 999 })
    expect(past.lastDay).toBe(31)
    expect(past.projEnd).toBeNull()
    expect(paceToday(past)).toBeNull()
    expect(dailyAvailable({ incomes: inc, expenses: exp, activeMonth: '2026-12', now: NOW }).lastDay).toBe(0)
  })
  it('día de cobro: el ingreso más grande, registrado o previsto', () => {
    expect(S.payday).toBe(15)
    expect(paydayOf({ incomes: [], activeMonth: '2026-11', plan: [
      { kind: 'income', date: '2026-11-28', expected: 900, status: 'pending', rule: {} },
      { kind: 'income', date: '2026-11-07', expected: 5000, status: 'pending', rule: { inv: true } },
      { kind: 'expense', date: '2026-11-01', expected: 9999, status: 'pending', rule: {} },
    ], days: 30 })).toBe(28)
    expect(paydayOf({ incomes: [], activeMonth: '2026-11', plan: [] })).toBeNull()
  })
})

describe('paceToday: la píldora es la misma cuenta que el Anillo Vivo', () => {
  it('gap = ideal(hoy) − gastado(hoy)', () => {
    const p = paceToday(S)
    expect(p.gap).toBeCloseTo(1350 * 18 / 30 - 125.25, 2)
    expect(p.level).toBe('ok')
  })
  it('over = gastado/ingreso − hoy/días, igual que pulse en Dashboard', () => {
    const p = paceToday(S)
    const proj = projectEndOfMonth({ incomes: inc, expenses: exp, activeMonth: '2026-11', now: NOW })
    const pulseOver = 125.25 / 1350 - proj.today / proj.daysInMonth
    expect(p.over).toBeCloseTo(pulseOver, 6)
  })
  it('gastar de más da "por detrás" y nivel de atención o riesgo', () => {
    const heavy = dailyAvailable({ incomes: inc, expenses: [...exp, { date: '2026-11-17', amount: 900 }], activeMonth: '2026-11', now: NOW, income: 1350 })
    const p = paceToday(heavy)
    expect(p.gap).toBeLessThan(0)
    expect(['attention', 'risk']).toContain(p.level)
  })
  it('pareja dentro del 2 % del ingreso', () => {
    const even = dailyAvailable({ incomes: [], expenses: [{ date: '2026-11-05', amount: 810 }], activeMonth: '2026-11', now: NOW, income: 1350 })
    expect(paceToday(even).even).toBe(true)
  })
})

describe('dayAt (qué día está bajo el puntero)', () => {
  const rect = { left: 100, width: CHART_W * 2 }
  const atDay = (d) => rect.left + xOf(d, 30) * 2
  it('el centro de cada día devuelve ese día', () => {
    for (const d of [1, 2, 10, 15, 18]) expect(dayAt(atDay(d), rect, { days: 30, maxDay: 18 })).toBe(d)
  })
  it('se limita a [1, maxDay]', () => {
    expect(dayAt(0, rect, { days: 30, maxDay: 18 })).toBe(1)
    expect(dayAt(atDay(29), rect, { days: 30, maxDay: 18 })).toBe(18)
    expect(dayAt(99999, rect, { days: 30 })).toBe(30)
  })
  it('sin rectángulo válido no rompe', () => {
    expect(dayAt(50, null, { days: 30 })).toBe(1)
    expect(dayAt(50, { left: 0, width: 0 }, { days: 30 })).toBe(1)
  })
})

describe('keyStep (teclado del slider)', () => {
  it('flechas ±1, Re Pág/Av Pág ±7, Inicio y Fin, sin salirse', () => {
    expect(keyStep('ArrowLeft', 10, 18)).toBe(9)
    expect(keyStep('ArrowUp', 10, 18)).toBe(11)
    expect(keyStep('PageDown', 10, 18)).toBe(3)
    expect(keyStep('PageUp', 15, 18)).toBe(18)
    expect(keyStep('Home', 10, 18)).toBe(1)
    expect(keyStep('End', 10, 18)).toBe(18)
    expect(keyStep('ArrowLeft', 1, 18)).toBe(1)
    expect(keyStep('Enter', 5, 18)).toBeNull()
  })
})

describe('lensPlacement (la lente no queda bajo el dedo)', () => {
  it('con el dedo sube por encima; cerca del borde superior, al costado', () => {
    const p = lensPlacement({ x: 150, y: 200, mode: 'touch', width: 358 })
    expect(p.cy + 44).toBeLessThan(200)
    expect(Math.abs(lensPlacement({ x: 60, y: 20, mode: 'touch', width: 358 }).cx - 60)).toBeGreaterThanOrEqual(44)
  })
  it('con el mouse centrada; en reposo, chica; nunca fuera del ancho', () => {
    expect(lensPlacement({ x: 100, y: 80, mode: 'mouse', width: 358 })).toEqual({ cx: 100, cy: 80, scale: 1 })
    expect(lensPlacement({ x: 100, y: 80, mode: 'rest', width: 358 }).scale).toBe(0.5)
    expect(lensPlacement({ x: 357, y: 200, mode: 'touch', width: 358 }).cx).toBeLessThanOrEqual(358 - 44 + 6)
  })
})

describe('escala', () => {
  it('de 0 a lo más alto con aire arriba; nada queda por encima del borde', () => {
    const dom = yDomain(S)
    expect(dom[0]).toBe(0)
    expect(dom[1]).toBeGreaterThan(1350)
    expect(yOf(1350, dom)).toBeGreaterThan(CHART_PAD.t)
    expect(yOf(S.spentCum[18], dom)).toBeGreaterThan(CHART_PAD.t)
  })
})
