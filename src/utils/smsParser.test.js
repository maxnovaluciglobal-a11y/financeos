import { describe, it, expect } from 'vitest'
import { parseTransactionText, toKeypadAmount } from './smsParser.js'

describe('parseTransactionText · monto', () => {
  it.each([
    ['Compra $23.400 en Jumbo', 23400],
    ['Compra por $12.990 en Lider 05/10/2026', 12990],
    ['Cargo US$14.99 en Netflix', 14.99],
    ['Compra MX$350.00 en OXXO', 350],
    ['Compra COP 50.000 en Exito', 50000],
    ['Compra $1.234,56 en Mercadona', 1234.56],
    ['Compra $1,234.56 en Walmart', 1234.56],
    ['Compra $12,99 en Kiosco', 12.99],
    ['Compra $12,990 en Kiosco', 12990],
  ])('%s -> %s', (text, amount) => {
    expect(parseTransactionText(text).amount).toBe(amount)
  })

  it('sin monto devuelve amount null y confianza baja', () => {
    const r = parseTransactionText('Compra en Jumbo aprobada')
    expect(r.amount).toBeNull()
    expect(r.confidence).toBe('low')
  })
})

describe('parseTransactionText · fecha', () => {
  it('detecta dd/mm/yyyy', () => {
    expect(parseTransactionText('Compra $5.000 en Jumbo 05/10/2026 14:32').date).toBe('2026-10-05')
  })

  it('detecta dd-mm-yy y completa el siglo', () => {
    expect(parseTransactionText('Compra $5.000 en Jumbo el 7-3-26').date).toBe('2026-03-07')
  })

  it('descarta fechas fuera de rango o que no existen', () => {
    expect(parseTransactionText('Compra $5.000 en Jumbo 15/13/2026').date).toBeNull()
    expect(parseTransactionText('Compra $5.000 en Jumbo 31/02/2026').date).toBeNull()
  })

  it('sin fecha devuelve null', () => {
    expect(parseTransactionText('Compra $5.000 en Jumbo').date).toBeNull()
  })
})

describe('parseTransactionText · comercio, tipo y confianza', () => {
  it('extrae el comercio y recorta la fecha pegada', () => {
    const r = parseTransactionText('Compra $5.000 en Jumbo Costanera 05/10/2026')
    expect(r.merchant).toBe('Jumbo Costanera')
    expect(r.type).toBe('expense')
    expect(r.confidence).toBe('high')
  })

  it('reconoce un abono como ingreso', () => {
    const r = parseTransactionText('Recibiste una transferencia de $150.000 el 01/10/2026')
    expect(r.type).toBe('income')
    expect(r.confidence).toBe('high')
  })

  it('texto vacío o muy corto devuelve null', () => {
    expect(parseTransactionText('')).toBeNull()
    expect(parseTransactionText('abc')).toBeNull()
    expect(parseTransactionText(null)).toBeNull()
  })
})

describe('toKeypadAmount', () => {
  it.each([
    [14.99, '14,99'],
    [12.5, '12,5'],
    [12990, '12990'],
    [100, '100'],
    [10.5, '10,5'],
    [1234.567, '1234,57'],
    [0.5, '0,5'],
  ])('%s -> %s', (n, out) => {
    expect(toKeypadAmount(n)).toBe(out)
  })

  it('nunca deja punto, así la tecla "," no arma "12.5,3"', () => {
    const s = toKeypadAmount(parseTransactionText('Cargo US$12.50 en Uber').amount)
    expect(s).toBe('12,5')
    expect(s.includes('.')).toBe(false)
  })

  it('valores no válidos devuelven cadena vacía', () => {
    expect(toKeypadAmount(null)).toBe('')
    expect(toKeypadAmount(0)).toBe('')
    expect(toKeypadAmount(-3)).toBe('')
    expect(toKeypadAmount(NaN)).toBe('')
  })
})
