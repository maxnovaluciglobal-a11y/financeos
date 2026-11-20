// src/pages/Investments/Asset.jsx — ficha del activo (pantalla empujada
// 'investAsset', Inversiones completo F0). El ticker viene de la entrada del
// historial (utils/investNav.js). F0 trae el precio, un minigráfico y el
// gráfico de velas básico (lazy: la librería no está en el JS inicial); el
// resto de la ficha llega en F3 y se dice.
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Equal } from 'lucide-react'
import { PageHeader } from '../../components/ui/index.jsx'
import Money from '../../components/Money.jsx'
import Sparkline from '../../components/charts/Sparkline.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { investApi } from '../../core/investApi.js'
import { ASSET_EVENT, currentAssetTicker } from '../../utils/investNav.js'
import { useInvestAccess } from '../../hooks/useInvestAccess.js'
import { investFullHere } from '../../utils/uiFlags.js'
import { fmtPct } from '../../utils/index.js'
import { Wip } from './hub/InvestHub.jsx'
import { priceText } from './hub/TickerSearch.jsx'
import s from './hub/hub.module.css'

const CandleChart = lazy(() => import('../../components/charts/CandleChart.jsx'))

// Velas de ejemplo para el demo (la API no acepta el origen del demo):
// deterministas por ticker y marcadas "Datos de ejemplo".
export function sampleCandles(ticker, days = 126, end = Date.UTC(2026, 10, 20)) {
  let seed = [...String(ticker)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) || 1
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
  const out = []
  let px = 50 + rnd() * 250
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end - i * 86400000)
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue
    const open = px
    const close = Math.max(1, open * (1 + (rnd() - 0.48) * 0.04))
    const high = Math.max(open, close) * (1 + rnd() * 0.012)
    const low = Math.min(open, close) * (1 - rnd() * 0.012)
    out.push({ date: d.toISOString().slice(0, 10), open, high, low, close, volume: null })
    px = close
  }
  return out
}

// Qué muestra la ficha: 'ready' con un ticker y acceso, 'loading' mientras se
// revisa la cuenta (antes decía por un instante "No hay un activo elegido") y
// 'missing' en cualquier otro caso.
export function assetView({ full, demo, status, picked }) {
  if (!full || !picked) return 'missing'
  if (demo || status === 'granted') return 'ready'
  return status === 'loading' ? 'loading' : 'missing'
}

function useAssetTicker() {
  const [ticker, setTicker] = useState(currentAssetTicker)
  useEffect(() => {
    const sync = () => setTicker(currentAssetTicker())
    window.addEventListener(ASSET_EVENT, sync)
    window.addEventListener('popstate', sync)
    return () => { window.removeEventListener(ASSET_EVENT, sync); window.removeEventListener('popstate', sync) }
  }, [])
  return ticker
}

export default function InvestAsset({ setPage }) {
  const { t } = useT()
  const app = useApp() || {}
  const demo = !!app.settings?.isDemo
  const picked = useAssetTicker()
  const { status } = useInvestAccess()
  const [full] = useState(investFullHere)
  // Misma puerta que Inversiones: sin el interruptor o sin acceso, no hay ficha.
  const view = assetView({ full, demo, status, picked })
  const ticker = view === 'ready' ? picked : null
  const [quote, setQuote] = useState({ phase: 'loading', q: null })
  const [hist, setHist] = useState({ phase: 'loading', rows: null })

  useEffect(() => {
    if (!ticker) return undefined
    if (demo) {
      const rows = sampleCandles(ticker)
      const last = rows[rows.length - 1], prev = rows[rows.length - 2]
      setHist({ phase: 'ready', rows })
      setQuote({ phase: 'ready', q: { price: last.close, changePct: last.close / prev.close - 1, currency: 'USD' } })
      return undefined
    }
    let alive = true
    setQuote({ phase: 'loading', q: null })
    setHist({ phase: 'loading', rows: null })
    investApi.quote(ticker).then(q => { if (alive) setQuote({ phase: q ? 'ready' : 'none', q }) })
    investApi.history(ticker, '6mo', '1d').then(rows => { if (alive) setHist({ phase: rows ? 'ready' : 'error', rows }) })
    return () => { alive = false }
  }, [ticker, demo])

  const closes = useMemo(() => (hist.rows || []).slice(-30).map(r => r.close), [hist.rows])

  // Mientras se revisa la cuenta, un aviso breve (no "falta el activo", que
  // después se corrige solo).
  if (view === 'loading') {
    return (
      <div className={s.hub}>
        <PageHeader title={picked} sub={t('invest.asset.label')} />
        <p className={s.assetNote} role="status">{t('invest.gate.loading')}</p>
      </div>
    )
  }

  if (!ticker) {
    return (
      <div className={s.hub}>
        <PageHeader title={t('invest.asset.label')} sub={t('nav.investments')} />
        <p className={s.assetNote}>{t('invest.asset.missing')}</p>
        <button type="button" className={s.btn} onClick={() => setPage?.('investments')}>{t('invest.asset.toHub')}</button>
      </div>
    )
  }

  const q = quote.q
  const pct = q ? q.changePct : null
  const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'
  const Ic = dir === 'up' ? ArrowUp : dir === 'down' ? ArrowDown : Equal
  const sparkPct = closes.length > 1 ? fmtPct(closes[closes.length - 1] / closes[0] - 1, { signed: true }) : ''

  return (
    <div className={s.hub}>
      <PageHeader title={ticker} sub={t('invest.asset.label')} />
      <section aria-label={t('invest.asset.price')}>
        {q ? (
          <div className={s.assetHead}>
            <span className={s.assetPrice}><Money>{priceText(q)}</Money></span>
            <span className={s.assetDay} data-tone={dir}><Ic size={14} strokeWidth={2.2} aria-hidden="true" />{t('invest.asset.day', { pct: fmtPct(pct, { signed: true }) })}</span>
            {closes.length > 1 && <Sparkline values={closes} width={96} height={28} label={t('invest.spark.label', { t: ticker, n: closes.length, pct: sparkPct })} />}
          </div>
        ) : (
          <p className={s.assetNote} role="status">{quote.phase === 'loading' ? t('invest.search.preview.loading', { t: ticker }) : t('invest.asset.noQuote')}</p>
        )}
        {q && !demo && <p className={s.assetNote}>{t('invest.asset.ccy', { ccy: q.currency || 'USD' })}</p>}
      </section>

      <section className={s.chartBox}>
        {hist.phase === 'ready' ? (
          <Suspense fallback={<p className={s.assetNote} role="status">{t('invest.chart.loading')}</p>}>
            <CandleChart candles={hist.rows} label={t('invest.chart.label', { t: ticker })} />
          </Suspense>
        ) : (
          <p className={s.assetNote} role="status">{hist.phase === 'loading' ? t('invest.chart.loading') : t('invest.chart.error')}</p>
        )}
        {demo && <p className={s.assetNote}>{t('invest.chart.sample')}</p>}
        {!demo && hist.phase === 'ready' && <p className={s.assetNote}>{t('invest.card.source', { source: 'Yahoo Finance' })}</p>}
      </section>

      <Wip id="asset" text={t('invest.asset.soon')} />
    </div>
  )
}
