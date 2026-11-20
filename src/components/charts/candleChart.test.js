// La librería de velas solo se carga con lazy(): ningún archivo fuera de
// CandleChart.jsx la importa, y CandleChart.jsx solo se importa con import().
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toSeriesData } from './CandleChart.jsx'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '../..')
function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.jsx?$/.test(n) && !/\.test\.jsx?$/.test(n)) out.push(p)
  }
  return out
}

describe('CandleChart', () => {
  it('lightweight-charts solo entra por CandleChart.jsx, y este solo por import()', () => {
    const offenders = []
    for (const f of walk(SRC)) {
      const rel = relative(SRC, f)
      const code = readFileSync(f, 'utf8')
      if (/from\s+['"]lightweight-charts['"]/.test(code) && rel !== 'components/charts/CandleChart.jsx') offenders.push(rel)
      if (/import\s+[\w{},\s*]+\s+from\s+['"][./]*[\w/]*CandleChart(\.jsx)?['"]/.test(code)) offenders.push(`${rel} (import estático)`)
    }
    expect(offenders).toEqual([])
  })
  it('el crédito a TradingView está en el gráfico y en texto', () => {
    const code = readFileSync(join(SRC, 'components/charts/CandleChart.jsx'), 'utf8')
    expect(code).toContain('attributionLogo: true')
    expect(code).toContain("t('invest.chart.credit')")
    expect(code).toContain('https://www.tradingview.com/')
  })
  it('toSeriesData ordena por fecha, quita repetidas y velas inválidas', () => {
    expect(toSeriesData([
      { date: '2026-11-19', open: 2, high: 3, low: 1, close: 2.5 },
      { date: '2026-11-18', open: 1, high: 2, low: 0.5, close: 1.5 },
      { date: '2026-11-18', open: 9, high: 9, low: 9, close: 9 },
      { date: '2026-11-17', open: null, high: 2, low: 1, close: 1 },
      { date: 'ayer', open: 1, high: 1, low: 1, close: 1 },
    ])).toEqual([
      { time: '2026-11-18', open: 1, high: 2, low: 0.5, close: 1.5 },
      { time: '2026-11-19', open: 2, high: 3, low: 1, close: 2.5 },
    ])
  })
})
