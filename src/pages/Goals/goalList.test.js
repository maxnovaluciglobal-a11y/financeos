import { describe, it, expect } from 'vitest'
import { fixedBuckets } from './goalFlow.js'
import { listedGoals, bucketGoalOf } from './goalList.js'

const em = { id: 'e1', name: 'Fondo de emergencia', target: 300, saved: 50 }
const em2 = { id: 'e2', name: 'Otro', kind: 'emergency', target: 100, saved: 0 }
const gen = { id: 'g1', name: 'Ahorros generales', target: 0, saved: 10 }
const trip = { id: 't1', name: 'Viaje', target: 900, saved: 100 }

describe('bolsas sin tarjeta duplicada (poda P2)', () => {
  it('la meta de una bolsa sale de la lista; las demás quedan en su orden', () => {
    const goals = [trip, em, gen]
    const buckets = fixedBuckets(goals)
    expect(listedGoals(goals, buckets)).toEqual([trip])
    expect(bucketGoalOf(buckets, em)?.id).toBe('emergency')
    expect(bucketGoalOf(buckets, trip)).toBeNull()
  })
  it('solo sale la meta elegida para la bolsa: una segunda de emergencia sigue en la lista', () => {
    const goals = [em, em2, trip]
    expect(listedGoals(goals, fixedBuckets(goals))).toEqual([em2, trip])
  })
  it('compara por id (la meta puede llegar como copia) y tolera entradas vacías', () => {
    const buckets = fixedBuckets([em])
    expect(listedGoals([{ ...em }, trip], buckets)).toEqual([trip])
    expect(listedGoals(null, buckets)).toEqual([])
    expect(listedGoals([trip, null], null)).toEqual([trip])
    expect(listedGoals([], fixedBuckets([]))).toEqual([])
  })
})
