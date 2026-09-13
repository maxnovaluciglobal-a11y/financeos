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
