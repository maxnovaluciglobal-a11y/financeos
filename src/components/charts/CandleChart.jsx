// src/components/charts/CandleChart.jsx — gráfico de velas de la ficha del activo.
//
// Usa TradingView Lightweight Charts (decisión de Walter del 20-nov-2026). La
// librería pesa ~45 kB gzip: este archivo solo se carga con lazy() desde la
// ficha (chunk tvcharts-*, fuera del JS inicial y del precache; lo vigila
// scripts/bundleBudget.js). La licencia (Apache 2.0 + aviso NOTICE) pide el
// crédito a TradingView: va el logo del gráfico (attributionLogo) Y una línea
// de texto con enlace, visible siempre.
//
// El canvas no es legible por lector de pantalla: la figura lleva role="img"
// con una descripción, y la ficha muestra las cifras en texto aparte.
//
// F3 (20-nov-2026): capas opcionales sobre las velas. `lines` son las medias
// y las bandas ([{ key, data: [{time, value}], color: '--token', dashed }]) y
// `volume` el histograma de volumen ([{ time, value, up }]) en el quinto
// inferior del mismo gráfico, con su propia escala (como Invest).
import { useEffect, useRef } from 'react'
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, LineStyle, ColorType } from 'lightweight-charts'
import { useT } from '../../i18n/useT.js'
import { TOKENS_LIGHT as P } from '../../styles/tokens.js'

// Colores de los tokens (--pos, --neg…) a rgb: el canvas no entiende var().
function tokenColor(name, fallback) {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    if (!raw) return fallback
    const c = document.createElement('canvas')
    c.width = c.height = 1
    const ctx = c.getContext('2d')
    if (!ctx) return fallback
    ctx.fillStyle = fallback
    ctx.fillStyle = raw
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`
  } catch { return fallback }
}

function palette() {
  return {
    up: tokenColor('--pos', P['--green-700']),
    down: tokenColor('--neg', P['--red-700']),
    text: tokenColor('--th', P['--gray-600']),
    grid: tokenColor('--brd', 'rgba(0,0,0,0.08)'),
  }
}

export function toSeriesData(candles) {
  const seen = new Set()
  return (candles || [])
    .filter(c => c && /^\d{4}-\d{2}-\d{2}$/.test(String(c.date)) && [c.open, c.high, c.low, c.close].every(v => Number.isFinite(Number(v)) && Number(v) > 0))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .filter(c => (seen.has(c.date) ? false : seen.add(c.date)))
    .map(c => ({ time: c.date, open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close) }))
}

const EMPTY = []

export function toLineData(points, keep = []) {
  const seen = new Set()
  return (points || [])
    .filter(p => p && /^\d{4}-\d{2}-\d{2}$/.test(String(p.time)) && p.value != null && p.value !== '' && Number.isFinite(Number(p.value)))
    .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
    .filter(p => (seen.has(p.time) ? false : seen.add(p.time)))
    .map(p => {
      const o = { time: p.time, value: Number(p.value) }
      for (const k of keep) o[k] = p[k]
      return o
    })
}
export function toVolumeData(points) {
  return toLineData(points, ['up']).filter(p => p.value > 0).map(p => ({ ...p, up: !!p.up }))
}
// 'rgba(r, g, b, a)' → misma tinta con otra opacidad.
export function withAlpha(rgba, alpha) {
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(String(rgba))
  return m ? `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})` : rgba
}

export default function CandleChart({ candles, label, height = 280, lines = EMPTY, volume = EMPTY }) {
  const { t } = useT()
  const box = useRef(null)
  const api = useRef(null)
  const extras = useRef([])

  useEffect(() => {
    const el = box.current
    if (!el) return undefined
    const p = palette()
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: p.text, fontFamily: 'Inter, system-ui, sans-serif', attributionLogo: true },
      grid: { vertLines: { color: p.grid }, horzLines: { color: p.grid } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: { mode: 1 },
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: p.up, downColor: p.down, wickUpColor: p.up, wickDownColor: p.down, borderVisible: false,
    })
    api.current = { chart, series, repaintExtras: null }
    // Tema claro/oscuro: se vuelven a leer los tokens.
    const repaint = () => {
      const q = palette()
      chart.applyOptions({ layout: { textColor: q.text }, grid: { vertLines: { color: q.grid }, horzLines: { color: q.grid } } })
      series.applyOptions({ upColor: q.up, downColor: q.down, wickUpColor: q.up, wickDownColor: q.down })
      api.current?.repaintExtras?.()
    }
    const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null
    mq?.addEventListener?.('change', repaint)
    const mo = typeof MutationObserver === 'function' ? new MutationObserver(repaint) : null
    mo?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] })
    return () => {
      mq?.removeEventListener?.('change', repaint)
      mo?.disconnect()
      api.current = null
      chart.remove()
    }
  }, [])

  useEffect(() => {
    const a = api.current
    if (!a) return
    a.series.setData(toSeriesData(candles))
    // Las capas se rehacen con los datos (cambian con el rango).
    for (const x of extras.current) { try { a.chart.removeSeries(x.series) } catch { /* ya no estaba */ } }
    extras.current = []
    const vol = toVolumeData(volume)
    if (vol.length) {
      const hs = a.chart.addSeries(HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' }, priceLineVisible: false, lastValueVisible: false })
      hs.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
      extras.current.push({ series: hs, kind: 'vol', raw: vol })
    }
    for (const l of lines || []) {
      const data = toLineData(l.data)
      if (!data.length) continue
      const ls = a.chart.addSeries(LineSeries, {
        lineWidth: l.width || 1.5, lineStyle: l.dashed ? LineStyle.Dashed : LineStyle.Solid,
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      })
      ls.setData(data)
      extras.current.push({ series: ls, kind: 'line', color: l.color })
    }
    a.repaintExtras = () => {
      const p = palette()
      for (const x of extras.current) {
        if (x.kind === 'line') x.series.applyOptions({ color: tokenColor(x.color, p.text) })
        else x.series.setData(x.raw.map(v => ({ time: v.time, value: v.value, color: withAlpha(v.up ? p.up : p.down, 0.35) })))
      }
    }
    a.repaintExtras()
    a.chart.timeScale().fitContent()
  }, [candles, lines, volume])

  return (
    <figure style={{ margin: 0 }}>
      <div ref={box} role="img" aria-label={label} style={{ width: '100%', height }} />
      <figcaption style={{ marginTop: 2, fontSize: 'var(--t-footnote)', color: 'var(--th)' }}>
        <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>{t('invest.chart.credit')}</a>
      </figcaption>
    </figure>
  )
}
