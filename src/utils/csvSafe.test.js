import { describe, it, expect } from 'vitest'
import { csvCell, toCsv } from './csvSafe.js'

describe('csvCell (DAT-15)', () => {
  it('neutraliza textos que Excel interpretaría como fórmula', () => {
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`)
    expect(csvCell('+1+2')).toBe(`"'+1+2"`)
    expect(csvCell('-2+3')).toBe(`"'-2+3"`)
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`)
    expect(csvCell('\tcmd')).toBe(`"'\tcmd"`)
  })
  it('deja intactos los números, incluso negativos', () => {
    expect(csvCell(-1500.5)).toBe('"-1500.5"')
    expect(csvCell(0)).toBe('"0"')
  })
  it('escapa comillas y trata null/undefined como vacío', () => {
    expect(csvCell('Pago "luz"')).toBe('"Pago ""luz"""')
    expect(csvCell(null)).toBe('""')
    expect(csvCell(undefined)).toBe('""')
  })
  it('arma filas separadas por coma y líneas por salto', () => {
    expect(toCsv([['a', 1], ['=b', -2]])).toBe(`"a","1"\n"'=b","-2"`)
  })
})
