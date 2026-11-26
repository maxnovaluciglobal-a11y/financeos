// Vista esencial de la ficha: "Esta empresa en 30 segundos" con lo que trae la
// API (sin inventar), y el gráfico de línea simple en lugar de las velas.
import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Brief from './Brief.jsx'
import ChartPanel from './ChartPanel.jsx'
import { MinePane } from './Panes.jsx'
import { linePath } from './LineChart.jsx'
import es from './strings.es.js'
import { RISK_BANDS } from '../../../utils/investEsencial.js'

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ')
const NOW = Date.parse('2026-11-20T15:00:00Z')

function rows(n = 260, from = 100, step = 0.0008) {
  const out = []
  let d = Date.parse('2025-11-01T00:00:00Z'), p = from
  while (out.length < n) {
    const wd = new Date(d).getUTCDay()
    if (wd !== 0 && wd !== 6) {
      p *= 1 + step + (out.length % 2 ? 0.01 : -0.01)
      out.push({ date: new Date(d).toISOString().slice(0, 10), open: p, high: p * 1.01, low: p * 0.99, close: p, volume: 1000 })
    }
    d += 86400000
  }
  return out
}

describe('Esta empresa en 30 segundos', () => {
  it('familias de textos completas', () => {
    const need = [
      ...['mega', 'large', 'mid', 'small', 'micro'].map(k => `asset.brief.size.${k}`),
      ...['pays', 'none', 'crypto'].flatMap(k => [`asset.brief.div.${k}`, `asset.brief.div.${k}Text`]),
      ...['up', 'down', 'flat'].map(k => `asset.brief.year.${k}`),
      ...RISK_BANDS.flatMap(([k]) => [`asset.brief.risk.${k}`, `asset.brief.risk.${k}Text`]),
      ...['size', 'div', 'year', 'risk'].map(k => `asset.brief.k.${k}`),
    ]
    expect(need.filter(k => !(k in es))).toEqual([])
  })
  it('con fundamentales y un año de precios: qué hace, tamaño, dividendos, el año y el riesgo', () => {
    const fund = { phase: 'ready', data: { source: 'fmp', description: 'Apple Inc. designs and sells phones and computers. Second sentence.', sector: 'Technology', marketCap: 3.4e12, dividendYield: 0.005 } }
    const out = text(renderToStaticMarkup(h(Brief, { ticker: 'AAPL', quote: null, fund, rows: rows(), rowsPhase: 'ready', type: 'Stock', price: null, now: NOW, initialOpen: true })))
    for (const k of ['Esta empresa en 30 segundos', 'Qué hace', 'Apple Inc. designs and sells phones and computers.', 'Rubro: Tecnología', 'Muy grande', '3,4 billones', 'Paga', 'En el año', 'Riesgo']) expect(out, k).toContain(k)
    expect(out).not.toContain('Second sentence')
    expect(out).toMatch(/(Subió|Bajó) .+ Desde el último cierre de 2025/)
  })
  it('un fondo: sin "ETF" ni industria en jerga, y el aviso de inglés aunque no haya descripción', () => {
    const fund = { phase: 'ready', data: { source: 'fmp', sector: 'ETF', industry: 'Large Blend', marketCap: 5e11 } }
    const out = text(renderToStaticMarkup(h(Brief, { ticker: 'VOO', quote: null, fund, rows: null, rowsPhase: 'ready', type: 'ETF', now: NOW })))
    expect(out).toContain('Este fondo en 30 segundos')
    expect(out).not.toContain('Large Blend')
    expect(out).not.toContain('Rubro')
    const raw = text(renderToStaticMarkup(h(Brief, { ticker: 'XX', quote: null, fund: { phase: 'ready', data: { source: 'fmp', sector: 'Technology', industry: 'Consumer Electronics' } }, rows: null, rowsPhase: 'ready', type: 'Stock', now: NOW })))
    expect(raw).toContain('Rubro: Tecnología · Consumer Electronics')
    expect(raw).toContain(es['asset.brief.sourceLang'])
  })
  it('abre recortado: 2 datos y "Ver más" (aria-expanded) que despliega el resto', () => {
    const fund = { phase: 'ready', data: { source: 'fmp', description: 'Apple Inc. designs and sells phones and computers.', sector: 'Technology', marketCap: 3.4e12, dividendYield: 0.005 } }
    const html = renderToStaticMarkup(h(Brief, { ticker: 'AAPL', quote: null, fund, rows: rows(), rowsPhase: 'ready', type: 'Stock', price: null, now: NOW }))
    const out = text(html)
    expect(out).toContain('Muy grande')
    expect(out).toContain('Paga')
    expect(out).not.toContain('En el año')
    expect(out).not.toContain(es['asset.brief.source'])
    expect(html).toMatch(/aria-expanded="false"[^>]*>Ver más</)
    const open = renderToStaticMarkup(h(Brief, { ticker: 'AAPL', quote: null, fund, rows: rows(), rowsPhase: 'ready', type: 'Stock', price: null, now: NOW, initialOpen: true }))
    expect(open).toMatch(/aria-expanded="true"[^>]*>Ver menos</)
  })
  it('tamaño en palabras que sirven para empresa y para fondo', () => {
    for (const k of ['mid', 'small', 'micro']) expect(es[`asset.brief.size.${k}`]).toMatch(/o$/)
  })
  it('sin datos: lo dice, no inventa', () => {
    const out = text(renderToStaticMarkup(h(Brief, { ticker: 'XYZ', quote: null, fund: { phase: 'ready', data: null }, rows: null, rowsPhase: 'error', type: 'Stock', now: NOW })))
    expect(out).toContain('La fuente todavía no trae datos para resumir XYZ.')
    expect(out).not.toContain('Dividendos')
  })
  it('cripto: título propio y "No paga"', () => {
    const out = text(renderToStaticMarkup(h(Brief, { ticker: 'BTC-USD', quote: null, fund: { phase: 'ready', data: null }, rows: rows(), rowsPhase: 'ready', type: 'Crypto', now: NOW })))
    expect(out).toContain('Esta cripto en 30 segundos')
    expect(out).toContain('No paga')
  })
})

describe('gráfico de la vista esencial', () => {
  const props = { ticker: 'AAPL', ccy: 'USD', rows: rows(), phase: 'ready', range: '6M', onRange: () => {}, layers: { rsi: true, macd: true }, onLayer: () => {}, demo: false, onRetry: null }
  it('línea simple: sin velas, medias, Bollinger, RSI ni MACD', () => {
    const html = renderToStaticMarkup(h(ChartPanel, { ...props, simple: true }))
    expect(html).toContain('<path')
    expect(html).toMatch(/role="img"[^>]*aria-label="Precio de cierre de AAPL/)
    // La descripción completa se lee una sola vez (en el SVG); la sección lleva un nombre corto.
    expect(html.match(/Precio de cierre de AAPL/g)).toHaveLength(1)
    expect(html).not.toContain('velas')
    for (const k of [es['asset.layer.rsi'], es['asset.layer.macd'], es['asset.legend.sma20'], es['asset.legend.bb']]) expect(html, k).not.toContain(k)
  })
  it('la vista completa sigue con las capas y la leyenda', () => {
    const html = renderToStaticMarkup(h(ChartPanel, { ...props, simple: false }))
    for (const k of [es['asset.layer.rsi'], es['asset.layer.macd'], es['asset.legend.sma20']]) expect(html, k).toContain(k)
  })
  it('linePath necesita al menos 2 puntos y no sale del alto', () => {
    expect(linePath([1], 100, 50)).toBeNull()
    const d = linePath([1, 3, 2], 100, 50)
    expect(d.startsWith('M0.0,')).toBe(true)
    const ys = [...d.matchAll(/[ML][\d.]+,([\d.]+)/g)].map(m => Number(m[1]))
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...ys)).toBeLessThanOrEqual(50)
  })
})

describe('Mi posición en la vista esencial', () => {
  const base = { ticker: 'AAPL', ccy: 'USD', price: 200, lots: [{ id: 1, t: 'AAPL', sh: 2, cost: 150, stop: 180 }], weight: { phase: 'ready', data: { weight: 0.1, valueUsd: 400 } }, profile: { phase: 'ready', data: { limit: 25 } }, cols: { stop: true }, demo: false, onSaveStop: () => {} }
  it('sin stop ni riesgo al stop; en la completa siguen', () => {
    const ess = text(renderToStaticMarkup(h(MinePane, { ...base, showStop: false })))
    expect(ess).not.toContain(es['asset.mine.stopRisk'])
    const full = text(renderToStaticMarkup(h(MinePane, { ...base, showStop: true })))
    expect(full).toContain(es['asset.mine.stopRisk'])
  })
  it('trae lo que mostraba la fila de Portafolio: invertido, efecto del cambio, nota, Editar y Eliminar', () => {
    const lots = [{ id: 1, t: 'AAPL', sh: 2, cost: 150, stop: 180, fxCost: 950, note: 'Compra de prueba' }]
    const html = renderToStaticMarkup(h(MinePane, { ...base, lots, weight: { phase: 'ready', data: { weight: 0.1, valueUsd: 400, fxEffectUsd: -12 } }, onEdit: () => {}, onDelete: () => {} }))
    const out = text(html)
    for (const k of [es['asset.mine.cost'], es['asset.mine.fxEffect'], es['asset.mine.note'], 'Compra de prueba', es['asset.act.editPos'], es['asset.mine.delete']]) expect(out, k).toContain(k)
    expect(out).toContain('US$300') // invertido: 2 × 150
  })
  it('varios lotes: cada uno con Editar y Eliminar con nombre propio', () => {
    const lots = [{ id: 1, t: 'AAPL', sh: 2, cost: 150 }, { id: 2, t: 'AAPL', sh: 1, cost: 180 }]
    const html = renderToStaticMarkup(h(MinePane, { ...base, lots, onEdit: () => {}, onDelete: () => {} }))
    expect(html).toContain('aria-label="Editar el lote 2 de AAPL"')
    expect(html).toContain('aria-label="Eliminar el lote 1 de AAPL"')
    expect(html).not.toContain(es['asset.mine.delete'])
  })
})
