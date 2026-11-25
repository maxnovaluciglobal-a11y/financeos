// Importador con columnas elegidas (Inversiones v2): CSV y Excel, presets
// genérico, Fintual y Racional (estos dos, formato por confirmar).
import { describe, it, expect } from 'vitest'
import { PRESETS, PRESET_IDS, DECIMAL_MODES, applyMap, autoMap, csvTable, normHead, numOf, tableFrom, toTicker, xlsxCell } from './investMappedImport.js'
import { xlsxTable } from './investXlsx.js'
import { holdingsCsv, parseHoldingsCsv } from './investCsv.js'

describe('csvTable', () => {
  it('detecta , ; y tabulador, y salta un título arriba', () => {
    expect(csvTable('Ticker,Unidades,Entrada\nAAPL,2,150').head).toEqual(['Ticker', 'Unidades', 'Entrada'])
    expect(csvTable('Ticker;Unidades;Entrada\nAAPL;2;150,5').rows[0]).toEqual(['AAPL', '2', '150,5'])
    expect(csvTable('Ticker\tUnidades\tEntrada\nAAPL\t2\t150').rows).toHaveLength(1)
    const t = csvTable('Mi cartola al 24-11\n\nFondo;Cuotas;Monto invertido\nRisky Norris;10,5;105.000')
    expect(t.head).toEqual(['Fondo', 'Cuotas', 'Monto invertido'])
  })
  it('vacío o sin filas: código de error', () => {
    expect(csvTable('').error).toBe('empty')
    expect(csvTable('Ticker,Unidades').error).toBe('no_rows')
  })
})

describe('autoMap y applyMap', () => {
  it('normaliza encabezados (tildes, mayúsculas, "(USD)")', () => {
    expect(normHead('  Símbolo (USD) ')).toBe('simbolo')
    expect(normHead('N° de cuotas')).toBe('n de cuotas')
  })
  it('el CSV que exporta Inversiones vuelve igual que con parseHoldingsCsv', () => {
    const labels = { ticker: 'Ticker', type: 'Tipo', ccy: 'Moneda', shares: 'Unidades', entry: 'Entrada', price: 'Precio', value: 'Valor', pnl: 'Resultado', ret: 'Retorno', weight: 'Peso', stop: 'Stop', fxCost: 'Tipo de cambio de compra', noFx: 'sin tipo de cambio' }
    const csv = holdingsCsv([
      { t: 'AAPL', type: 'Stock', ccy: 'USD', sh: 3, avgCost: 150.25, price: 190, stop: 140, valueUsd: 570, costUsd: 450.75, plUsd: 119.25, plPct: 0.26, weight: 0.6 },
      { t: 'VOO', type: 'ETF', ccy: 'USD', sh: 1, avgCost: 400, price: 420, valueUsd: 420, costUsd: 400, plUsd: 20, plPct: 0.05, weight: 0.4 },
    ], labels)
    const tb = csvTable(csv)
    const mine = applyMap(tb, autoMap(tb.head, 'generic'))
    expect(mine.errors).toEqual([])
    expect(mine.rows).toEqual(parseHoldingsCsv(csv).rows)
  })
  it('con monto total y sin precio, el precio sale de monto / unidades', () => {
    const tb = csvTable('Ticker,Cantidad,Monto invertido\nMSFT,4,1600')
    const m = autoMap(tb.head, 'generic')
    expect(m.cost).toBe(-1)
    expect(m.total).toBe(2)
    expect(applyMap(tb, m).rows).toEqual([{ t: 'MSFT', type: 'Stock', sh: 4, cost: 400 }])
  })
  it('sin las columnas mínimas: "need"; filas malas: el código de siempre con su línea', () => {
    const tb = csvTable('A,B,C\nx,1,2')
    expect(applyMap(tb, autoMap(tb.head)).errors).toEqual([{ code: 'need' }])
    const bad = csvTable('Ticker,Unidades,Entrada\nAAPL,0,10\nVOO,1,0\n=CMD,1,1\nTOTAL,1,1')
    expect(applyMap(bad, autoMap(bad.head)).errors.map(e => [e.code, e.line])).toEqual([['shares', 2], ['cost', 3], ['ticker', 4]])
  })
  it('una columna no se usa para dos datos', () => {
    const m = autoMap(['Ticker', 'Precio', 'Unidades'])
    expect(m.cost).toBe(1)
    expect(new Set(Object.values(m).filter(i => i >= 0)).size).toBe(Object.values(m).filter(i => i >= 0).length)
  })
  it('en los formatos de Chile, "1.600" son miles; "190.5" sigue siendo decimal', () => {
    expect(numOf('1.600', { thousandsDot: true })).toBe(1600)
    expect(numOf('$105.000', { thousandsDot: true })).toBe(105000)
    expect(numOf('1.234.567', { thousandsDot: true })).toBe(1234567)
    expect(numOf('190.5', { thousandsDot: true })).toBe(190.5)
    expect(numOf('1.234,56', { thousandsDot: true })).toBe(1234.56)
    expect(numOf('1.600')).toBe(1.6) // el genérico no adivina
  })
  it('los nombres de fondo quedan como identificador sin espacios ni tildes', () => {
    expect(toTicker('Risky Norris')).toBe('RISKYNORRIS')
    expect(toTicker('Moderate Pitt')).toBe('MODERATEPITT')
    expect(toTicker('cóndor')).toBe('CONDOR')
    expect(toTicker('Very Conservative Streep')).toBe('VERYCONSERVATIV')
    expect(toTicker('ABCDEFGHIJKLMNOPQ')).toHaveLength(17) // un símbolo no se corta: se avisa como inválido
  })
  it('Fintual y Racional están marcados como formato por confirmar; el genérico no', () => {
    expect(PRESET_IDS).toEqual(['generic', 'fintual', 'racional'])
    expect(PRESETS.generic.confirmed).toBe(true)
    expect(PRESETS.fintual.confirmed).toBe(false)
    expect(PRESETS.racional.confirmed).toBe(false)
  })
  it('preset Fintual (supuesto): fondo, cuotas y monto invertido', () => {
    const tb = csvTable('Fondo;Cuotas;Monto invertido\nRisky Norris;10,5;105.000\nVery Conservative Streep;2;2.000')
    const r = applyMap(tb, autoMap(tb.head, 'fintual'), { presetId: 'fintual' })
    expect(r.errors).toEqual([])
    expect(r.rows).toEqual([{ t: 'RISKYNORRIS', type: 'Stock', sh: 10.5, cost: 10000 }, { t: 'VERYCONSERVATIV', type: 'Stock', sh: 2, cost: 1000 }])
  })
  it('preset Racional (supuesto): nemotécnico, cantidad y precio promedio', () => {
    const tb = csvTable('Nemotécnico,Cantidad,Precio promedio,Tipo\nSQM-B,10,"45.000",acción\nAAPL,1,190.5,stock')
    const r = applyMap(tb, autoMap(tb.head, 'racional'), { presetId: 'racional' })
    expect(r.rows).toEqual([{ t: 'SQM-B', type: 'Stock', sh: 10, cost: 45000 }, { t: 'AAPL', type: 'Stock', sh: 1, cost: 190.5 }])
  })
})

describe('Excel', () => {
  it('xlsxCell aplana fórmulas, texto enriquecido y fechas', () => {
    expect(xlsxCell({ formula: 'A1*2', result: 4 })).toBe(4)
    expect(xlsxCell({ richText: [{ text: 'AA' }, { text: 'PL' }] })).toBe('AAPL')
    expect(xlsxCell(new Date(Date.UTC(2026, 10, 24)))).toBe('2026-11-24')
    expect(xlsxCell(null)).toBe('')
  })
  it('tableFrom deja números como números (sin pasar por separadores de miles)', () => {
    const tb = tableFrom([['', ''], ['Ticker', 'Unidades', 'Entrada'], ['AAPL', 2, 1234.5], ['', '', '']])
    expect(tb.rows).toEqual([['AAPL', 2, 1234.5]])
    expect(applyMap(tb, autoMap(tb.head)).rows).toEqual([{ t: 'AAPL', type: 'Stock', sh: 2, cost: 1234.5 }])
  })
  it('xlsxTable lee la primera hoja con el cargador inyectado', async () => {
    const rows = [['Ticker', 'Unidades', 'Entrada'], ['VOO', 1, 400]]
    class Workbook {
      constructor() { this.xlsx = { load: async () => {} }; this.worksheets = [{ eachRow: (_o, fn) => rows.forEach(r => fn({ values: [undefined, ...r] })) }] }
    }
    const tb = await xlsxTable(new ArrayBuffer(0), async () => ({ default: { Workbook } }))
    expect(tb).toEqual({ head: ['Ticker', 'Unidades', 'Entrada'], rows: [['VOO', 1, 400]], lines: [2] })
  })
})

describe('revisión previa al lanzamiento', () => {
  it('la línea de un error cuenta los títulos y líneas vacías de arriba', () => {
    const tb = csvTable('Mi cartola al 24-11\n\nTicker;Unidades;Entrada\nAAPL;0;10\n\nVOO;1;0')
    expect(tb.lines).toEqual([4, 6])
    expect(applyMap(tb, autoMap(tb.head)).errors.map(e => [e.code, e.line])).toEqual([['shares', 4], ['cost', 6]])
    const x = tableFrom([['Reporte'], ['', ''], ['Ticker', 'Unidades', 'Entrada'], ['AAPL', 0, 1]])
    expect(applyMap(x, autoMap(x.head)).errors[0].line).toBe(4)
  })
  it('separador decimal elegido: "1.000" es mil o uno', () => {
    expect(numOf('1.000', { decimal: 'comma' })).toBe(1000)
    expect(numOf('1.000', { decimal: 'dot' })).toBe(1)
    expect(numOf('1,234.5', { decimal: 'dot' })).toBe(1234.5)
    expect(numOf('1.234,5', { decimal: 'comma' })).toBe(1234.5)
    const tb = csvTable('Ticker;Unidades;Entrada\nAAPL;2;1.000')
    expect(applyMap(tb, autoMap(tb.head), { decimal: 'comma' }).rows[0].cost).toBe(1000)
    expect(applyMap(tb, autoMap(tb.head), { decimal: 'dot' }).rows[0].cost).toBe(1)
    expect(DECIMAL_MODES).toEqual(['auto', 'comma', 'dot'])
  })
  it('dos nombres que se cortan igual no quedan como la misma posición', () => {
    const tb = csvTable('Fondo;Cuotas;Monto invertido\nVery Conservative Streep;1;100\nVery Conservative Stable;1;100\nVery Conservative Streep;1;50')
    const r = applyMap(tb, autoMap(tb.head, 'fintual'), { presetId: 'fintual' })
    expect(r.rows.map(x => x.t)).toEqual(['VERYCONSERVATIV', 'VERYCONSERVATI2', 'VERYCONSERVATIV'])
  })
})

