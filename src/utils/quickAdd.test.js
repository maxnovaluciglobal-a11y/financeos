import { describe, it, expect } from 'vitest'
import {
  ruleKey, suggestCategory, nextAutoCategory, topRepeats, fromUsd, buildUsdNote, appendNote,
  keyToKeypad, isTextEntryTarget, buildDetailedPrefill, DETAILED_PREFILL_KEY,
} from './quickAdd.js'
import { KEY_BACKSPACE, KEY_DECIMAL } from './keypad.js'

const rules = { jumbo: 'Alimentación', 'farmacia ahumada': 'Salud', 'farmacia cruz verde': 'Salud', uber: 'Transporte', 'uber eats': 'Alimentación', sueldo: 'Salario' }

describe('ruleKey', () => {
  it('normaliza mayúsculas, acentos y espacios', () => {
    expect(ruleKey('  Café   Pérez ')).toBe('cafe perez')
    expect(ruleKey(null)).toBe('')
  })
})

describe('suggestCategory', () => {
  it('coincidencia exacta, sin importar acentos ni mayúsculas', () => {
    expect(suggestCategory('JUMBO', rules)).toBe('Alimentación')
    expect(suggestCategory('Farmacia Ahumada ', rules)).toBe('Salud')
  })
  it('prefijo de 3+ letras cuando todas las llaves coinciden en la categoría', () => {
    expect(suggestCategory('farm', rules)).toBe('Salud')
    expect(suggestCategory('jum', rules)).toBe('Alimentación')
  })
  it('prefijo ambiguo o corto: no sugiere', () => {
    expect(suggestCategory('ube', rules)).toBeNull() // uber → Transporte, uber eats → Alimentación
    expect(suggestCategory('ju', rules)).toBeNull()
    expect(suggestCategory('', rules)).toBeNull()
    expect(suggestCategory('jumbo', null)).toBeNull()
  })
  it('exacta gana al prefijo ambiguo', () => {
    expect(suggestCategory('uber', rules)).toBe('Transporte')
  })
  it('respeta las categorías válidas del tipo activo', () => {
    const expenseCats = ['Alimentación', 'Salud', 'Transporte']
    expect(suggestCategory('sueldo', rules, expenseCats)).toBeNull()
    expect(suggestCategory('sueldo', rules, ['Salario'])).toBe('Salario')
  })
})

describe('nextAutoCategory', () => {
  it('aplica la sugerida si el usuario no eligió a mano', () => {
    expect(nextAutoCategory({ desc: 'jumbo', rules, current: 'Otros' })).toBe('Alimentación')
  })
  it('no pisa una categoría elegida a mano en esta apertura', () => {
    expect(nextAutoCategory({ desc: 'jumbo', rules, manual: true, current: 'Ropa' })).toBeNull()
  })
  it('no hace nada si ya es la misma o no hay sugerencia', () => {
    expect(nextAutoCategory({ desc: 'jumbo', rules, current: 'Alimentación' })).toBeNull()
    expect(nextAutoCategory({ desc: 'algo nuevo', rules, current: 'Otros' })).toBeNull()
  })
})

describe('topRepeats', () => {
  const today = '2026-11-20'
  const recs = [
    { description: 'Café', category: 'Alimentación', amount: 3, date: '2026-11-01', createdAt: 'a' },
    { description: 'cafe', category: 'Alimentación', amount: 3.5, date: '2026-11-18', createdAt: 'b' },
    { description: 'Café', category: 'Alimentación', amount: 4, date: '2026-11-10', createdAt: 'c' },
    { description: 'Uber', category: 'Transporte', amount: 8, date: '2026-11-05' },
    { description: 'Uber', category: 'Transporte', amount: 9, date: '2026-11-15' },
    { description: 'Cine', category: 'Entretención', amount: 12, date: '2026-11-19' },
    { description: 'Luz', category: 'Servicios', amount: 30, date: '2026-10-01' },
    { description: 'Antiguo', category: 'Otros', amount: 99, date: '2026-01-01' },
    { description: 'Antiguo', category: 'Otros', amount: 99, date: '2026-01-02' },
    { description: 'Antiguo', category: 'Otros', amount: 99, date: '2026-01-03' },
    { description: 'Antiguo', category: 'Otros', amount: 99, date: '2026-01-04' },
    { description: 'Cero', category: 'Otros', amount: 0, date: '2026-11-19' },
  ]
  it('los 3 más frecuentes de 90 días, con el monto de la ocurrencia más reciente', () => {
    const r = topRepeats(recs, { today })
    expect(r.map(x => x.description)).toEqual(['cafe', 'Uber', 'Cine'])
    expect(r[0]).toMatchObject({ amount: 3.5, category: 'Alimentación', count: 3 })
    expect(r[1]).toMatchObject({ amount: 9, count: 2 })
  })
  it('a igual frecuencia, el más reciente primero', () => {
    const r = topRepeats([
      { description: 'A', category: 'X', amount: 1, date: '2026-11-01' },
      { description: 'B', category: 'X', amount: 1, date: '2026-11-03' },
      { description: 'C', category: 'X', amount: 1, date: '2026-11-03', createdAt: '2' },
    ], { today })
    expect(r.map(x => x.description)).toEqual(['C', 'B', 'A'])
  })
  it('misma descripción con otra categoría es otro grupo', () => {
    const r = topRepeats([
      { description: 'Jumbo', category: 'Alimentación', amount: 10, date: '2026-11-01' },
      { description: 'Jumbo', category: 'Hogar', amount: 20, date: '2026-11-02' },
    ], { today })
    expect(r).toHaveLength(2)
  })
  it('usa `source` en ingresos', () => {
    expect(topRepeats([{ source: 'Sueldo', category: 'Salario', amount: 1000, date: '2026-11-01' }], { today })[0].description).toBe('Sueldo')
  })
  it('sin nada en la ventana: cae al último de todos', () => {
    const r = topRepeats([
      { description: 'Viejo', category: 'Otros', amount: 5, date: '2025-01-01' },
      { description: 'Menos viejo', category: 'Otros', amount: 6, date: '2025-02-01' },
    ], { today })
    expect(r).toEqual([expect.objectContaining({ description: 'Menos viejo', amount: 6 })])
  })
  it('lista vacía o sin montos', () => {
    expect(topRepeats([], { today })).toEqual([])
    expect(topRepeats([{ amount: 0, date: today }], { today })).toEqual([])
    expect(topRepeats(null, { today })).toEqual([])
  })
})

describe('fromUsd', () => {
  it('convierte con la tasa y redondea a los decimales de la moneda', () => {
    expect(fromUsd(12, 885.4, 2)).toBe(10624.8)
    expect(fromUsd(1.005, 100, 2)).toBe(100.5)
    expect(fromUsd(10, 1234.567, 0)).toBe(12346)
  })
  it('sin tasa válida o monto: 0', () => {
    expect(fromUsd(10, 0)).toBe(0)
    expect(fromUsd(10, null)).toBe(0)
    expect(fromUsd(0, 885)).toBe(0)
    expect(fromUsd('x', 885)).toBe(0)
  })
})

describe('buildUsdNote / appendNote', () => {
  it('arma la nota con fuente y fecha', () => {
    expect(buildUsdNote({ usdText: 'US$12,00', localText: 'Bs.10.624,80', source: 'Tasa BCV', date: '29 oct' }))
      .toBe('US$12,00 → Bs.10.624,80 (Tasa BCV, 29 oct)')
  })
  it('sin fecha ni fuente', () => {
    expect(buildUsdNote({ usdText: 'US$1', localText: 'Bs.1' })).toBe('US$1 → Bs.1')
  })
  it('une notas sin duplicar', () => {
    expect(appendNote('', 'x')).toBe('x')
    expect(appendNote('a', 'x')).toBe('a · x')
    expect(appendNote('a · x', 'x')).toBe('a · x')
    expect(appendNote('a', '')).toBe('a')
  })
})

describe('keyToKeypad', () => {
  it('dígitos, decimal, borrar y Enter', () => {
    expect(keyToKeypad('7')).toBe('7')
    expect(keyToKeypad(',', 2)).toBe(KEY_DECIMAL)
    expect(keyToKeypad('.', 2)).toBe(KEY_DECIMAL)
    expect(keyToKeypad('Backspace')).toBe(KEY_BACKSPACE)
    expect(keyToKeypad('Enter')).toBe('save')
  })
  it('moneda sin decimales: la coma y el punto no hacen nada', () => {
    expect(keyToKeypad(',', 0)).toBeNull()
    expect(keyToKeypad('.', 0)).toBeNull()
  })
  it('otras teclas: null', () => {
    expect(keyToKeypad('a')).toBeNull()
    expect(keyToKeypad('Tab')).toBeNull()
    expect(keyToKeypad(undefined)).toBeNull()
  })
})

describe('isTextEntryTarget', () => {
  it('campos de texto, selects y contenteditable tienen dueño', () => {
    expect(isTextEntryTarget({ tagName: 'INPUT', type: 'text' })).toBe(true)
    expect(isTextEntryTarget({ tagName: 'TEXTAREA' })).toBe(true)
    expect(isTextEntryTarget({ tagName: 'SELECT' })).toBe(true)
    expect(isTextEntryTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true)
    expect(isTextEntryTarget({ tagName: 'INPUT', type: 'date' })).toBe(true)
  })
  it('el monto (readOnly), la hoja y los botones no, salvo para Enter en botones', () => {
    expect(isTextEntryTarget({ tagName: 'INPUT', type: 'text', readOnly: true })).toBe(false)
    expect(isTextEntryTarget({ tagName: 'DIV' })).toBe(false)
    expect(isTextEntryTarget(null)).toBe(false)
    expect(isTextEntryTarget({ tagName: 'BUTTON' })).toBe(false)
    expect(isTextEntryTarget({ tagName: 'BUTTON' }, { forEnter: true })).toBe(true)
    expect(isTextEntryTarget({ tagName: 'INPUT', type: 'checkbox' })).toBe(false)
    expect(isTextEntryTarget({ tagName: 'INPUT', type: 'checkbox' }, { forEnter: true })).toBe(true)
  })
})

describe('buildDetailedPrefill', () => {
  it('contrato con Movimientos', () => {
    expect(DETAILED_PREFILL_KEY).toBe('fos_detailed_expense_prefill')
    expect(buildDetailedPrefill({ description: ' Jumbo ', amount: 12.5, date: '2026-11-20', category: 'Alimentación', method: 'Débito' }))
      .toEqual({ description: 'Jumbo', amount: 12.5, date: '2026-11-20', category: 'Alimentación', method: 'Débito' })
  })
  it('sin monto: vacío', () => {
    expect(buildDetailedPrefill({ amount: 0 }).amount).toBe('')
  })
})
