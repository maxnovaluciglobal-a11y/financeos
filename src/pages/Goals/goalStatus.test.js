import { describe, it, expect } from 'vitest'
import { goalStatuses, monthsLeft, paceBudget } from './goalStatus.js'
import { monthLeft } from '../../utils/monthLeft.js'

describe('monthsLeft', () => {
  it('cuenta el mes activo', () => {
    expect(monthsLeft('2026-10', '2026-10')).toBe(1)
    expect(monthsLeft('2026-10', '2027-09-15')).toBe(12)
    expect(monthsLeft('2026-10', '2026-09')).toBe(0)
    expect(monthsLeft('2026-10', '')).toBe(null)
  })
})

describe('goalStatuses (UI-Q5)', () => {
  const base = { activeMonth: '2026-10' }
  it('cumplida, sin fecha y vencida', () => {
    const s = goalStatuses([
      { id: 'a', target: 100, saved: 100 },
      { id: 'b', target: 100, saved: 10 },
      { id: 'c', target: 100, saved: 10, targetDate: '2026-08' },
    ], { ...base, available: 1000 })
    expect(s).toEqual({ a: 'done', b: 'none', c: 'behind' })
  })
  it('un porcentaje bajo no es atraso si el aporte mensual entra en lo disponible', () => {
    // 24 % ahorrado, faltan 3.800.000 en 15 meses = 253.333/mes; hay 2.500.000
    const s = goalStatuses([{ id: 'g', target: 5_000_000, saved: 1_200_000, targetDate: '2027-12-31' }], { ...base, available: 2_500_000 })
    expect(s.g).toBe('onTrack')
  })
  it('lo disponible se reparte por prioridad y después por fecha', () => {
    const goals = [
      { id: 'baja', target: 600, saved: 0, targetDate: '2026-12', priority: 'Baja' }, // 200/mes
      { id: 'alta', target: 300, saved: 0, targetDate: '2026-12', priority: 'Alta' }, // 100/mes
      { id: 'media', target: 300, saved: 0, targetDate: '2026-12', priority: 'Media' }, // 100/mes
    ]
    expect(goalStatuses(goals, { ...base, available: 250 })).toEqual({ alta: 'onTrack', media: 'onTrack', baja: 'behind' })
  })
  it('sin disponible (o negativo) toda meta con fecha queda atrasada', () => {
    const s = goalStatuses([{ id: 'g', target: 100, saved: 0, targetDate: '2027-01' }], { ...base, available: -50 })
    expect(s.g).toBe('behind')
  })
})

describe('paceBudget: aportar no atrasa la meta', () => {
  it('apartar 100 a una meta que pide 100/mes la deja a tiempo', () => {
    const goal = { id: 'g', target: 1200, saved: 0, targetDate: '2027-10' } // 12 meses desde 2026-11
    const incomes = [{ amount: 1000, date: '2026-11-01' }]
    const expenses = [{ amount: 850, date: '2026-11-02' }]
    const before = monthLeft({ incomes, expenses, month: '2026-11' })
    expect(goalStatuses([goal], { activeMonth: '2026-11', available: paceBudget(before) }).g).toBe('onTrack')
    const sa = { id: 's1', kind: 'setAside', dest: 'goal', goalId: 'g', amount: 100, date: '2026-11-03' }
    const after = monthLeft({ incomes, expenses, setAsides: [sa], month: '2026-11' })
    expect(after.left).toBe(50)
    expect(paceBudget(after)).toBe(150)
    expect(goalStatuses([{ ...goal, saved: 100 }], { activeMonth: '2026-11', available: paceBudget(after) }).g).toBe('onTrack')
  })
  it('lo apartado para invertir sí resta del ritmo', () => {
    expect(paceBudget({ left: 50, setAsideGoals: 0, setAsideInvest: 100 })).toBe(50)
    expect(paceBudget(null)).toBe(0)
  })
})
