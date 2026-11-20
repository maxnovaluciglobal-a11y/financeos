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
import { useEffect, useRef } from 'react'
import { createChart, CandlestickSeries, ColorType } from 'lightweight-charts'
import { useT } from '../../i18n/useT.js'

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
    up: tokenColor('--pos', '#1a7f4b'),
    down: tokenColor('--neg', '#c0362c'),
    text: tokenColor('--th', '#5b5675'),
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

export default function CandleChart({ candles, label, height = 280 }) {
  const { t } = useT()
  const box = useRef(null)
  const api = useRef(null)

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
    api.current = { chart, series }
    // Tema claro/oscuro: se vuelven a leer los tokens.
    const repaint = () => {
      const q = palette()
      chart.applyOptions({ layout: { textColor: q.text }, grid: { vertLines: { color: q.grid }, horzLines: { color: q.grid } } })
      series.applyOptions({ upColor: q.up, downColor: q.down, wickUpColor: q.up, wickDownColor: q.down })
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
    if (!api.current) return
    api.current.series.setData(toSeriesData(candles))
    api.current.chart.timeScale().fitContent()
  }, [candles])

  return (
    <figure style={{ margin: 0 }}>
      <div ref={box} role="img" aria-label={label} style={{ width: '100%', height }} />
      <figcaption style={{ marginTop: 6, fontSize: 'var(--t-footnote)', color: 'var(--th)' }}>
        <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{t('invest.chart.credit')}</a>
      </figcaption>
    </figure>
  )
}
