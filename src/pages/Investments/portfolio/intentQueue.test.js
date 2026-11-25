// Lo que Resumen pide abrir en Portafolio se lee una sola vez y solo acepta
// las acciones conocidas.
import { describe, it, expect } from 'vitest'
import { queuePortIntent, takePortIntent } from './intentQueue.js'

describe('intentQueue', () => {
  it('una vez, y nada desconocido', () => {
    queuePortIntent('deposit')
    expect(takePortIntent()).toBe('deposit')
    expect(takePortIntent()).toBeNull()
    queuePortIntent('borrar-todo')
    expect(takePortIntent()).toBeNull()
  })
})
