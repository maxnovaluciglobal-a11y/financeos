// src/utils/investEsencial.js — cifras de la vista esencial de Inversiones
// (ajustes del 20-nov-2026; benchmark 00-SINTESIS §3-4). Lógica pura, sin
// textos: la pantalla traduce las claves.
//
//  · putAndGain: "Pusiste" (lo que aportaste) y "El mercado sumó" (lo que
//    ganó o perdió), con el desglose Precio + Dividendos + Dólar solo cuando
//    hay datos para separarlo.
//  · beatChecks: "¿Le ganaste a la inflación y al dólar?" solo con lo que se
//    puede calcular sin inventar.
//  · companyBrief: "Esta empresa en 30 segundos" con los datos que ya trae la
//    API (cotización, un año de velas y fundamentales).
// Regla de todo el archivo: sin dato, null. Nunca un número supuesto.
import { capParts, hasFundamentals, normalizeFundamentals } from './investAsset.js'
import { dailyReturns, volatility } from './investIndicators.js'

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const EPS = 0.005

// ── Pusiste / El mercado sumó ─────────────────────────────────────
// ledger: el libro (investLedger.book o investCash.cashBook) o null si no hay
// operaciones. totals: portfolioTotals (Resumen) o positionRows().totals
// (Portafolio): { value, cost, total|pl, fxEffect, fxKnown, fxUnknown,
// excluded }. Todo en US$.
//
// Con depósitos u operaciones completos manda el libro: Pusiste = lo aportado
// (depósitos − retiros + compras de afuera + posiciones cargadas a su costo) y
// El mercado sumó = valor actual − lo aportado. Si no, lo invertido en las
// posiciones de hoy y su resultado.
// Desglose: Dividendos = los cobrados en el libro; Dólar = el efecto del tipo
// de cambio desde la compra, solo si TODAS las posiciones en otra moneda
// tienen el tipo de cambio de la compra (si no, quedaría mezclado con el
// precio); Precio = el resto. Se muestra solo si hay dividendos o dólar.
export function putAndGain({ ledger = null, totals = null } = {}) {
  const fromLedger = !!ledger && ledger.complete && ledger.contributed > EPS && ledger.gain != null &&
    (ledger.deposits > EPS || ledger.implicit > EPS || ledger.dividends > EPS)
  let basis, put, gain, value
  if (fromLedger) {
    basis = 'contributed'
    put = ledger.contributed
    gain = ledger.gain
    value = ledger.value
  } else if (totals && totals.cost > EPS) {
    basis = 'invested'
    put = totals.cost
    value = totals.value
    gain = isNum(totals.total) ? totals.total : isNum(totals.pl) ? totals.pl : totals.value - totals.cost
  } else {
    return null
  }
  if (!isNum(put) || !isNum(gain)) return null

  const dividends = fromLedger && ledger.dividends > EPS ? ledger.dividends : 0
  const fxOk = !!totals && totals.fxKnown > 0 && !(totals.fxUnknown > 0) && isNum(totals.fxEffect) && Math.abs(totals.fxEffect) >= EPS
  const fx = fxOk ? totals.fxEffect : 0
  const parts = dividends || fx
    ? { price: gain - dividends - fx, dividends: dividends || null, fx: fxOk ? fx : null }
    : null
  return {
    basis, put, gain, value,
    pct: put > EPS ? gain / put : null,
    parts,
    // Quedaron montos fuera (sin tipo de cambio): la pantalla lo avisa.
    partial: !!totals && totals.excluded > 0,
  }
}

// ── ¿Le ganaste a la inflación y al dólar? ────────────────────────
// Dólar: el portafolio se mide en US$, así que "guardar los dólares sin
// invertir" rinde 0: le ganaste si el mercado sumó. Solo para quien no usa
// dólares como moneda (para quien usa US$ la pregunta no dice nada).
// Inflación: hace falta la inflación de la misma moneda y del mismo período.
// moyiq no tiene una serie de inflación en dólares, así que hoy no se calcula;
// `inflation` ({ pct }) queda para cuando haya una fuente con licencia.
export function beatChecks(summary, { currency = 'USD', inflation = null } = {}) {
  if (!summary || summary.pct == null) return null
  const out = []
  if (String(currency || 'USD').toUpperCase() !== 'USD') {
    out.push({ key: 'usd', beat: summary.gain > EPS, even: Math.abs(summary.gain) <= EPS, pct: summary.pct })
  }
  if (inflation && isNum(inflation.pct)) {
    out.push({ key: 'inflation', beat: summary.pct > inflation.pct, even: Math.abs(summary.pct - inflation.pct) < 0.0005, pct: summary.pct, ref: inflation.pct })
  }
  return out.length ? out : null
}

// ── Esta empresa en 30 segundos ───────────────────────────────────
// Tamaño por valor en bolsa (capitalización, en la moneda de la fuente).
export function sizeBand(marketCap) {
  const v = Number(marketCap)
  if (!(v > 0)) return null
  if (v >= 200e9) return 'mega'
  if (v >= 10e9) return 'large'
  if (v >= 2e9) return 'mid'
  if (v >= 300e6) return 'small'
  return 'micro'
}

// Cuánto subió o bajó en el año calendario: del último cierre del año pasado
// al precio de hoy (o al último cierre). Sin un cierre del año pasado en la
// serie, null (no se adivina el punto de partida).
export function yearChange(rows, { price = null, now = Date.now() } = {}) {
  const year = new Date(now).getUTCFullYear()
  const start = `${year}-01-01`
  const clean = (rows || []).filter(r => r && /^\d{4}-\d{2}-\d{2}$/.test(String(r.date)) && Number(r.close) > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  let base = null
  for (const r of clean) { if (r.date < start) base = r; else break }
  const thisYear = clean.filter(r => r.date >= start)
  if (!base || !thisYear.length) return null
  const last = price > 0 ? Number(price) : Number(thisYear[thisYear.length - 1].close)
  return { pct: last / Number(base.close) - 1, from: base.date, year }
}

// Riesgo en palabras: cuánto se mueve el precio (volatilidad del último año,
// anualizada). Con menos de 60 cierres no se dice nada.
export const RISK_BANDS = [
  ['low', 0.18],
  ['medium', 0.35],
  ['high', 0.6],
  ['veryHigh', Infinity],
]
export function riskWords(rows, { crypto = false } = {}) {
  const closes = (rows || []).map(r => Number(r?.close)).filter(v => v > 0)
  if (closes.length < 60) return null
  const vol = volatility(dailyReturns(closes.slice(-366)))
  if (vol == null) return null
  const yearly = vol * Math.sqrt(crypto ? 365 : 252)
  const band = RISK_BANDS.find(([, max]) => yearly < max)[0]
  return { band, yearly }
}

// Primera oración de la descripción de la fuente (viene en inglés), con tope.
export function firstSentence(text, max = 220) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  if (!s) return null
  // Fin de oración: un punto seguido de espacio o del final, con al menos 20
  // caracteres antes (así "Apple Inc. designs…" no se corta en "Inc.").
  let out = s
  for (const m of s.matchAll(/[.!?](?=\s|$)/g)) {
    if (m.index + 1 >= 20) { out = s.slice(0, m.index + 1); break }
  }
  return out.length > max ? `${out.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : out
}

// Rubros que publica la fuente (en inglés) → clave del diccionario de la ficha
// (asset.sector.<clave>). Lo que no está acá se muestra tal cual, con el aviso
// de que viene en inglés.
export const SECTOR_KEYS = {
  technology: 'technology', 'information technology': 'technology',
  healthcare: 'healthcare', 'health care': 'healthcare',
  'financial services': 'financial', financials: 'financial', financial: 'financial',
  'consumer cyclical': 'consumerCyclical', 'consumer discretionary': 'consumerCyclical',
  'consumer defensive': 'consumerDefensive', 'consumer staples': 'consumerDefensive',
  industrials: 'industrials', energy: 'energy', utilities: 'utilities',
  'real estate': 'realEstate', 'basic materials': 'basicMaterials', materials: 'basicMaterials',
  'communication services': 'communication',
}
export const sectorKey = (name) => SECTOR_KEYS[String(name || '').trim().toLowerCase()] || null

// quote: cotización (investApi.quote); fund: fundamentales crudos o null;
// rows: un año de velas; type: Stock · ETF · Crypto.
export function companyBrief({ quote = null, fund = null, rows = null, type = 'Stock', price = null, now = Date.now() } = {}) {
  const crypto = type === 'Crypto'
  const f = hasFundamentals(fund) ? normalizeFundamentals(fund) : null
  const cap = Number(f?.marketCap) > 0 ? Number(f.marketCap) : Number(quote?.marketCap) > 0 ? Number(quote.marketCap) : null
  // Un fondo: sin "industria" (viene en jerga: "Large Blend") y sin el rubro
  // "ETF", que no dice nada (el título ya dice "Este fondo").
  const etf = type === 'ETF' || /^etf$/i.test(String(f?.sector || '').trim())
  const sector = (etf ? [f?.sector] : [f?.sector, f?.industry])
    .map(x => (x == null ? '' : String(x).trim())).filter(x => x && !/^etf$/i.test(x))
  let dividend = null
  if (crypto) dividend = { kind: 'crypto' }
  else if (f) dividend = Number(f.dividendYield) > 0 ? { kind: 'pays', yield: Number(f.dividendYield) } : { kind: 'none' }
  const out = {
    what: f?.description ? firstSentence(f.description) : null,
    sector: [...new Set(sector)],
    size: cap ? { band: sizeBand(cap), cap: capParts(cap) } : null,
    dividend,
    year: yearChange(rows, { price, now }),
    risk: riskWords(rows, { crypto }),
    crypto,
    etf: type === 'ETF',
  }
  out.empty = !out.what && !out.sector.length && !out.size && !out.dividend && !out.year && !out.risk
  return out
}
