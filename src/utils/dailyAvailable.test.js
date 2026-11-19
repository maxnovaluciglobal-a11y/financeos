import { describe, it, expect } from 'vitest'
import { dailyAvailable, paydayOf, paceGap, dayAt, keyStep, lensPlacement, xOf, yDomain, yOf, CHART_W, CHART_PAD } from './dailyAvailable.js'
import { homeMonthTotals } from '../pages/Dashboard/dashboardModel.js'

const NOW = new Date(2026, 10, 18, 12) // 18-nov-2026
const inc = [
  { id: 1, date: '2026-11-15', amount: 1150 },
  { id: 2, date: '2026-11-03', amount: 200 },
  { id: 3, date: '2026-10-30', amount: 999 },   // otro mes
]
const exp = [
  { id: 1, date: '2026-11-01', amount: 40 },
  { id: 2, date: '2026-11-10', amount: 15.25 },
  { id: 3, date: '2026-11-18', amount: 60 },
  { id: 4, date: '2026-11-25', amount: 10 },    // fecha futura: cuenta hoy
]

describe('dailyAvailable', () => {
  const s = dailyAvailable({ incomes: inc, expenses: exp, activeMonth: '2026-11', now: NOW, reference: 1350, projBal: 500 })

  it('acumula ingresos menos gastos por día y corta en hoy', () => {
    expect(s.mode).toBe('current')
    expect(s.days).toBe(30)
    expect(s.lastDay).toBe(18)
    expect(s.avail[1]).toBe(-40)
    expect(s.avail[3]).toBe(160)
    expect(s.avail[10]).toBe(144.75)
    expect(s.avail[15]).toBe(1294.75)
    expect(s.spent[10]).toBe(15.25)
    expect(s.earned[15]).toBe(1150)
  })

  it('el punto de hoy es exactamente "Te queda" (lo futuro cuenta hoy)', () => {
    const { cur } = homeMonthTotals({ incomes: inc, expenses: exp, activeMonth: '2026-11', now: NOW })
    expect(s.avail[s.lastDay]).toBe(cur.freeFlow)
    expect(s.spent[18]).toBe(70)
  })

  it('ritmo ideal = ingresos hasta el día − referencia × día / días', () => {
    expect(s.ideal[15]).toBeCloseTo(1350 - 1350 * 15 / 30, 2)
    expect(s.ideal[30]).toBeCloseTo(0, 2)
    // distancia al ritmo = referencia × hoy / días − gastado
    expect(paceGap(s)).toBeCloseTo(1350 * 18 / 30 - 125.25, 2)
  })

  it('proyección solo en el mes en curso y antes del último día', () => {
    expect(s.projEnd).toBe(500)
    const past = dailyAvailable({ incomes: inc, expenses: exp, activeMonth: '2026-10', now: NOW, projBal: 10 })
    expect(past.mode).toBe('past')
    expect(past.lastDay).toBe(31)
    expect(past.projEnd).toBeNull()
    expect(past.avail[31]).toBe(999)
  })

  it('mes futuro: sin días que mirar; sin referencia, sin ritmo', () => {
    const fut = dailyAvailable({ incomes: inc, expenses: exp, activeMonth: '2026-12', now: NOW })
    expect(fut.lastDay).toBe(0)
    expect(fut.ideal).toBeNull()
    expect(paceGap(fut)).toBeNull()
  })

  it('día de cobro: el ingreso más grande, registrado o previsto', () => {
    expect(s.payday).toBe(15)
    expect(paydayOf({ incomes: [], activeMonth: '2026-11', plan: [
      { kind: 'income', date: '2026-11-28', expected: 900, status: 'pending', rule: {} },
      { kind: 'income', date: '2026-11-05', expected: 100, status: 'pending', rule: {} },
      { kind: 'income', date: '2026-11-07', expected: 5000, status: 'pending', rule: { inv: true } },
      { kind: 'expense', date: '2026-11-01', expected: 9999, status: 'pending', rule: {} },
    ], days: 30 })).toBe(28)
    expect(paydayOf({ incomes: [], activeMonth: '2026-11', plan: [] })).toBeNull()
  })
})

describe('dayAt (qué día está bajo el puntero)', () => {
  const rect = { left: 100, width: CHART_W * 2 }   // gráfico a escala 2
  const atDay = (d) => rect.left + xOf(d, 30) * 2
  it('el centro de cada día devuelve ese día', () => {
    for (const d of [1, 2, 10, 15, 18]) expect(dayAt(atDay(d), rect, { days: 30, maxDay: 18 })).toBe(d)
  })
  it('se limita a [1, maxDay]', () => {
    expect(dayAt(0, rect, { days: 30, maxDay: 18 })).toBe(1)
    expect(dayAt(atDay(29), rect, { days: 30, maxDay: 18 })).toBe(18)
    expect(dayAt(99999, rect, { days: 30 })).toBe(30)
  })
  it('a mitad de camino entre dos días redondea al más cercano', () => {
    const mid = (atDay(10) + atDay(11)) / 2
    expect([10, 11]).toContain(dayAt(mid, rect, { days: 30, maxDay: 30 }))
    expect(dayAt(atDay(10) + 1, rect, { days: 30, maxDay: 30 })).toBe(10)
  })
  it('sin rectángulo válido no rompe', () => {
    expect(dayAt(50, null, { days: 30 })).toBe(1)
    expect(dayAt(50, { left: 0, width: 0 }, { days: 30 })).toBe(1)
  })
})

describe('keyStep (teclado del slider)', () => {
  it('flechas ±1, Re Pág/Av Pág ±7, Inicio y Fin', () => {
    expect(keyStep('ArrowLeft', 10, 18)).toBe(9)
    expect(keyStep('ArrowDown', 10, 18)).toBe(9)
    expect(keyStep('ArrowRight', 10, 18)).toBe(11)
    expect(keyStep('ArrowUp', 10, 18)).toBe(11)
    expect(keyStep('PageDown', 10, 18)).toBe(3)
    expect(keyStep('PageUp', 10, 18)).toBe(17)
    expect(keyStep('Home', 10, 18)).toBe(1)
    expect(keyStep('End', 10, 18)).toBe(18)
  })
  it('no se sale del mes ni de hoy', () => {
    expect(keyStep('ArrowLeft', 1, 18)).toBe(1)
    expect(keyStep('ArrowRight', 18, 18)).toBe(18)
    expect(keyStep('PageDown', 3, 18)).toBe(1)
    expect(keyStep('PageUp', 15, 18)).toBe(18)
  })
  it('otras teclas no son del slider', () => {
    expect(keyStep('Enter', 5, 18)).toBeNull()
    expect(keyStep('a', 5, 18)).toBeNull()
  })
})

describe('lensPlacement (la lente no queda bajo el dedo)', () => {
  it('con el dedo sube por encima del punto', () => {
    const p = lensPlacement({ x: 150, y: 200, mode: 'touch', width: 358 })
    expect(p.cy + 44).toBeLessThan(200)   // el borde inferior de la lente queda arriba del punto
    expect(p.cx).toBe(150)
  })
  it('cerca del borde superior se corre al costado', () => {
    const left = lensPlacement({ x: 60, y: 20, mode: 'touch', width: 358 })
    expect(Math.abs(left.cx - 60)).toBeGreaterThanOrEqual(44)
    const right = lensPlacement({ x: 300, y: 20, mode: 'touch', width: 358 })
    expect(right.cx).toBeLessThan(300)
  })
  it('con el mouse va centrada; en reposo, chica', () => {
    expect(lensPlacement({ x: 100, y: 80, mode: 'mouse', width: 358 })).toEqual({ cx: 100, cy: 80, scale: 1 })
    expect(lensPlacement({ x: 100, y: 80, mode: 'rest', width: 358 }).scale).toBe(0.5)
  })
  it('nunca sale del ancho del gráfico', () => {
    const p = lensPlacement({ x: 357, y: 200, mode: 'touch', width: 358 })
    expect(p.cx).toBeLessThanOrEqual(358 - 44 + 6)
  })
})

describe('escala', () => {
  it('yDomain incluye toda la serie y el ideal; yOf invierte el eje', () => {
    const s = dailyAvailable({ incomes: inc, expenses: exp, activeMonth: '2026-11', now: NOW, reference: 1350 })
    const dom = yDomain(s)
    expect(dom[0]).toBeLessThan(-40)
    expect(dom[1]).toBeGreaterThan(1350)
    expect(yOf(dom[1], dom)).toBeCloseTo(CHART_PAD.t, 5)
    expect(yOf(dom[0], dom)).toBeGreaterThan(yOf(0, dom))
  })
})
