import { describe, it, expect } from 'vitest'
import { normalize, moveIndex, typeaheadIndex, isTypeaheadKey } from './listboxKeys.js'

const LABELS = ['Chile', 'México', 'Argentina', 'Colombia', 'Ecuador', 'Perú', 'Venezuela', 'Estados Unidos', 'España', 'Portugal', 'Alemania', 'Otro país']

describe('moveIndex', () => {
  it('flechas sin dar la vuelta', () => {
    expect(moveIndex('ArrowDown', 0, 3)).toBe(1)
    expect(moveIndex('ArrowDown', 2, 3)).toBe(2)
    expect(moveIndex('ArrowUp', 0, 3)).toBe(0)
    expect(moveIndex('ArrowUp', 2, 3)).toBe(1)
  })
  it('Home / End / PageDown / PageUp', () => {
    expect(moveIndex('Home', 5, 12)).toBe(0)
    expect(moveIndex('End', 0, 12)).toBe(11)
    expect(moveIndex('PageDown', 5, 12)).toBe(11)
    expect(moveIndex('PageUp', 5, 12)).toBe(0)
  })
  it('sin activo arranca en 0; lista vacía → -1', () => {
    expect(moveIndex('ArrowDown', -1, 3)).toBe(1)
    expect(moveIndex('ArrowDown', 0, 0)).toBe(-1)
  })
})

describe('typeaheadIndex', () => {
  it('ignora mayúsculas y tildes', () => {
    expect(normalize('Perú')).toBe('peru')
    expect(typeaheadIndex('peru', LABELS, 0)).toBe(5)
    expect(typeaheadIndex('MEX', LABELS, 0)).toBe(1)
  })
  it('una letra cicla desde la opción siguiente a la activa', () => {
    // E: Ecuador(4), Estados Unidos(7), España(8)
    expect(typeaheadIndex('e', LABELS, 0)).toBe(4)
    expect(typeaheadIndex('e', LABELS, 4)).toBe(7)
    expect(typeaheadIndex('e', LABELS, 8)).toBe(4)
    expect(typeaheadIndex('eee', LABELS, 7)).toBe(8)
  })
  it('prefijo de varias letras busca desde la activa', () => {
    expect(typeaheadIndex('co', LABELS, 0)).toBe(3)
    expect(typeaheadIndex('col', LABELS, 3)).toBe(3)
    expect(typeaheadIndex('esp', LABELS, 0)).toBe(8)
  })
  it('sin coincidencia → -1', () => {
    expect(typeaheadIndex('zz', LABELS, 0)).toBe(-1)
    expect(typeaheadIndex('', LABELS, 0)).toBe(-1)
  })
})

describe('isTypeaheadKey', () => {
  it('solo caracteres imprimibles sin modificadores y sin espacio', () => {
    expect(isTypeaheadKey({ key: 'a' })).toBe(true)
    expect(isTypeaheadKey({ key: ' ' })).toBe(false)
    expect(isTypeaheadKey({ key: 'ArrowDown' })).toBe(false)
    expect(isTypeaheadKey({ key: 'a', metaKey: true })).toBe(false)
  })
})
