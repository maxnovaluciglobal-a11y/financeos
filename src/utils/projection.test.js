// Cobertura de src/utils/projection.js — regresión del bug de timezone
// encontrado en la auditoría financiera del 13-sep-2026 (Fase C): la función
// mezclaba `now` calculado en hora LOCAL (now.getFullYear()/getMonth()/getDate())
// con `nowMonth` calculado en UTC (new Date().toISOString().slice(0,7)).
//
// Para un usuario al oeste de UTC (todo LATAM), cerca de medianoche UTC el
// "mes" en UTC ya avanza al mes siguiente mientras localmente todavía es el
// último día del mes anterior. Eso hacía que completeOrAll() clasificara el
// mes activo (aún en curso, con datos parciales) como "mes previo completo"
// y lo mezclara en el promedio histórico de 3 meses — inflando o deflactando
// silenciosamente avgInc/avgExp según cuánto llevara gastado ese día.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { projectEndOfMonth } from './projection.js'

describe('projectEndOfMonth — mes activo no debe contaminar el promedio histórico', () => {
  const originalTZ = process.env.TZ

  beforeEach(() => {
    // America/Bogota: UTC-5 fijo, sin horario de verano — determinístico.
    process.env.TZ = 'America/Bogota'
  })

  afterEach(() => {
    process.env.TZ = originalTZ
    vi.useRealTimers()
  })

  it('excluye el mes activo (en curso) del promedio de meses previos, incluso cuando UTC ya cruzó al mes siguiente', () => {
    // 2026-10-01T02:00:00Z == 2026-09-30T21:00:00 hora Bogotá (UTC-5):
    // localmente es todavía 30-sep, pero el string ISO en UTC ya dice "2026-10".
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-01T02:00:00Z'))

    const expenses = [
      // Agosto: mes previo completo real — 300 en total.
      { date: '2026-08-05', amount: 100 },
      { date: '2026-08-15', amount: 200 },
      // Septiembre (mes activo, EN CURSO el 30 a las 21h local): solo 30 gastados.
      { date: '2026-09-30', amount: 30 },
    ]
    const incomes = []

    const result = projectEndOfMonth({ incomes, expenses, activeMonth: '2026-09' })

    // El promedio histórico debe basarse SOLO en agosto (300), nunca mezclar
    // el septiembre parcial (30) — antes del fix daba (300+30)/2 = 165.
    expect(result.avgExp).toBe(300)
    expect(result.avgExpMonths).toBe(1)
    // `today` se calcula en hora LOCAL: en Bogotá sigue siendo 30-sep.
    expect(result.today).toBe(30)
    expect(result.curExp).toBe(30)
  })
})

// Auditoría 360 (12-logica-financiera.md, casos de t1.mjs).
describe('projectEndOfMonth — fijos pendientes y meses cerrados (FIN-1, FIN-9)', () => {
  it('FIN-1: día 5, sueldo 1.000.000, 20.000 diarios y arriendo fijo de 450.000 pendiente -> gasto 1.070.000 y saldo -70.000', () => {
    const now = new Date(2026, 9, 5, 12)
    const incomes = [{ date: '2026-10-01', amount: 1000000 }]
    const expenses = ['01', '02', '03', '04', '05'].map(d => ({ date: `2026-10-${d}`, amount: 20000 }))
    const before = projectEndOfMonth({ incomes, expenses, activeMonth: '2026-10', now })
    expect(before.projBal).toBe(380000)
    const after = projectEndOfMonth({ incomes, expenses, activeMonth: '2026-10', now, pending: { income: 0, expense: 450000 } })
    expect(after.projExp).toBe(1070000)
    expect(after.projBal).toBe(-70000)
  })

  it('FIN-1: un fijo ya registrado (recurringId) no entra en la mediana diaria', () => {
    const now = new Date(2026, 9, 3, 12)
    const expenses = [
      { date: '2026-10-01', amount: 450000, recurringId: 'r1' },
      { date: '2026-10-02', amount: 10000 },
      { date: '2026-10-03', amount: 10000 },
    ]
    const r = projectEndOfMonth({ incomes: [], expenses, activeMonth: '2026-10', now })
    expect(r.medianDaily).toBe(10000)
    expect(r.projExp).toBe(470000 + 10000 * 28)
  })

  it('FIN-1: el sueldo fijo pendiente cuenta como ingreso previsto', () => {
    const now = new Date(2026, 9, 2, 12)
    const r = projectEndOfMonth({ incomes: [], expenses: [{ date: '2026-10-01', amount: 1000 }], activeMonth: '2026-10', now, pending: { income: 900000, expense: 0 } })
    expect(r.projInc).toBe(900000)
  })

  it('FIN-9: septiembre cerrado (ingreso 1.000, gasto 500, meses previos de 1.100) proyecta el resultado real', () => {
    const now = new Date(2026, 9, 18, 12)
    const incomes = [], expenses = []
    for (const m of ['2026-07', '2026-08', '2026-09']) {
      incomes.push({ date: `${m}-01`, amount: 1000 })
      expenses.push({ date: `${m}-05`, amount: m === '2026-09' ? 500 : 1100 })
    }
    const r = projectEndOfMonth({ incomes, expenses, activeMonth: '2026-09', now, pending: { income: 0, expense: 999 } })
    expect(r.mode).toBe('past')
    expect(r.projExp).toBe(500)
    expect(r.projInc).toBe(1000)
    expect(r.projBal).toBe(500)
    expect(r.daysLeft).toBe(0)
  })

  it('mes futuro: solo lo registrado y lo previsto, sin promedio', () => {
    const now = new Date(2026, 9, 18, 12)
    const r = projectEndOfMonth({ incomes: [{ date: '2026-09-01', amount: 5000 }], expenses: [{ date: '2026-09-02', amount: 4000 }], activeMonth: '2026-11', now, pending: { income: 1000, expense: 300 } })
    expect(r.mode).toBe('future')
    expect(r.projInc).toBe(1000)
    expect(r.projExp).toBe(300)
  })
})
