// src/pages/Investments/Asset.jsx — ficha del activo (pantalla empujada
// 'investAsset', Inversiones completo F3). Rehace la ficha (drawer) de Invest
// (invest-web/app/index.html 7176-7553) como pantalla de moyiq:
//  · cabecera con precio y cambio del día;
//  · 6 acciones: agregar o editar la posición, registrar operación, seguir o
//    dejar de seguir, alerta (acceso que avisa que llega con la pestaña Lista),
//    comparar con SPY y compartir o copiar;
//  · gráfico de velas (TradingView Lightweight Charts, diferido) con medias de
//    20/50/200 días, bandas de Bollinger, volumen y capas RSI y MACD, 5 rangos;
//  · 4 pestañas: Indicadores, Fundamentales (12 métricas, rango de 52 semanas
//    y resultados trimestrales), Mi posición y Noticias.
// El ticker vive en la entrada del historial (utils/investNav.js); la pestaña y
// el rango también. Nada de la posición ni del ticker se guarda en el
// dispositivo. Textos: ./asset/strings.<idioma>.js (cargados con la ficha).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, BarChart3, Bell, Check, ClipboardList, Equal, Pencil, Plus, Scale, Share2 } from 'lucide-react'
import { PageHeader } from '../../components/ui/index.jsx'
import Money from '../../components/Money.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { investApi } from '../../core/investApi.js'
import { investData, newOperationUid } from '../../core/investData.js'
import { ASSET_EVENT, assetView, currentAssetTicker, rememberAssetView, tabKeyTarget } from '../../utils/investNav.js'
import { useInvestAccess } from '../../hooks/useInvestAccess.js'
import { investFullHere } from '../../utils/uiFlags.js'
import { fmtPct } from '../../utils/index.js'
import { assetRates, currencyOf, rateOf } from '../../utils/investValuation.js'
import { DEFAULT_RANGE, compareWith, historyRangeFor, pickTab, rangeOf, scoreAsset, shareParts, visibleTabs } from '../../utils/investAsset.js'
import { buildTrade } from '../../utils/investTrade.js'
import { demoRow, sampleCandles } from '../../demo/demoInvestAsset.js'
import { useAssetT } from './asset/assetDict.js'
import { useAssetData } from './asset/useAssetData.js'
import { errorKey, fmtPx, fmtPxSigned, isCryptoTicker, localDay, pxDecimals } from './asset/format.js'
import ChartPanel from './asset/ChartPanel.jsx'
import { FundamentalsPane, IndicatorsPane, MinePane, NewsPane } from './asset/Panes.jsx'
import { CompareSheet, PositionSheet, TradeSheet } from './asset/Sheets.jsx'
import hub from './hub/hub.module.css'
import s from './asset/asset.module.css'

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
  const { t } = useAssetT()
  const app = useApp() || {}
  const toast = app.showToast || (() => {})
  const demo = !!app.settings?.isDemo
  const picked = useAssetTicker()
  const { status } = useInvestAccess()
  const [full] = useState(investFullHere)
  // Misma puerta que Inversiones: sin el interruptor o sin acceso, no hay ficha.
  const ticker = full && (demo || status === 'granted') ? picked : null

  const d = useAssetData(ticker, { demo })
  const [view, setView] = useState(() => ({ tab: assetView().tab || 'ind', range: assetView().range || DEFAULT_RANGE }))
  const [layers, setLayers] = useState({ rsi: false, macd: false })
  const [sheet, setSheet] = useState(null) // 'pos' | 'trade' | 'cmp'
  const [closeAsk, setCloseAsk] = useState(false)
  const [alertNote, setAlertNote] = useState(false)
  const [bench, setBench] = useState({ phase: 'idle', rows: null, t: null })
  const tabRefs = useRef({})

  // Ticker nuevo (o Atrás a otra ficha): la vista de esa entrada del historial.
  useEffect(() => {
    const v = assetView()
    setView({ tab: v.tab || 'ind', range: v.range || DEFAULT_RANGE })
    setLayers({ rsi: false, macd: false }); setSheet(null); setCloseAsk(false); setAlertNote(false)
    setBench({ phase: 'idle', rows: null, t: null })
  }, [ticker])
  useEffect(() => { rememberAssetView(view) }, [view])

  const lots = d.lots.data || []
  const hasPos = lots.some(h => h.sh > 0)
  const tab = d.lots.phase === 'loading' && view.tab === 'mine' ? 'mine' : pickTab(view.tab, hasPos)
  const tabs = visibleTabs(hasPos || (d.lots.phase === 'loading' && view.tab === 'mine'))
  const q = d.quote.data
  const ccy = currencyOf(ticker, q?.currency)
  const rows1y = d.hist1y.data
  const score = useMemo(() => (rows1y ? scoreAsset(rows1y) : null), [rows1y])
  const price = q?.price > 0 ? q.price : score?.last ?? null
  const range = rangeOf(view.range)
  const long = range.n > 252
  const chartRows = long ? d.hist5y.data : rows1y
  const chartPhase = long ? d.hist5y.phase : d.hist1y.phase
  const type = lots[0]?.type || (demo ? demoRow(ticker)?.type : null) || (isCryptoTicker(ticker) ? 'Crypto' : 'Stock')
  const followed = (d.watch.data || []).includes(ticker)

  // Cargas por pestaña y por rango (no antes de hacer falta).
  const { need5y, needFund, needNews, needMine } = d
  useEffect(() => { if (ticker && long) need5y() }, [ticker, long, need5y])
  useEffect(() => {
    if (!ticker) return
    if (tab === 'fund') needFund()
    if (tab === 'news') needNews()
    if (tab === 'mine') needMine()
  }, [ticker, tab, needFund, needNews, needMine])

  const setTab = useCallback((k) => setView(v => ({ ...v, tab: k })), [])
  function onTabKey(e) {
    const next = tabKeyTarget(e.key, tab, tabs)
    if (!next) return
    e.preventDefault()
    setTab(next)
    tabRefs.current[next]?.focus()
  }

  // ── Acciones ──
  async function toggleFollow() {
    if (demo) {
      d.setWatch(w => ({ ...w, data: followed ? (w.data || []).filter(x => x !== ticker) : [...(w.data || []), ticker] }))
      toast(t('asset.err.demo'))
      return
    }
    const r = followed ? await investData.removeWatch(ticker) : await investData.addWatch(ticker)
    if (!r.ok) { toast(t(errorKey(r.error)), 'error'); return }
    d.setWatch(w => ({ phase: 'ready', data: followed ? (w.data || []).filter(x => x !== ticker) : [...new Set([...(w.data || []), ticker])] }))
    toast(t(followed ? 'asset.follow.removed' : 'asset.follow.added', { t: ticker }))
  }

  async function share() {
    const p = shareParts(ticker, { name: q?.name, priceText: price ? fmtPx(price, ccy) : '', pctText: q ? fmtPct(q.changePct, { signed: true }) : '' })
    const text = t('asset.share.text', { t: p.t, name: p.name ? ` (${p.name})` : '', price: p.price || '—', pct: p.pct || '—' })
    try {
      if (typeof navigator !== 'undefined' && navigator.share) { await navigator.share({ title: ticker, text }); return }
    } catch (e) { if (e?.name === 'AbortError') return }
    try {
      await navigator.clipboard.writeText(text)
      toast(t('asset.share.copied', { t: ticker }))
    } catch { toast(t('asset.share.failed'), 'error') }
  }

  const benchT = compareWith(ticker)
  function openCompare() {
    setSheet('cmp')
    const want = long ? '5y' : '1y'
    if (bench.t === `${benchT}:${want}` && bench.phase === 'ready') return
    if (demo) { const c = sampleCandles(benchT); setBench({ phase: 'ready', rows: long ? c : c.slice(-252), t: `${benchT}:${want}` }); return }
    setBench({ phase: 'loading', rows: null, t: `${benchT}:${want}` })
    investApi.history(benchT, historyRangeFor(view.range), '1d').then(rows => setBench({ phase: rows ? 'ready' : 'error', rows, t: `${benchT}:${want}` }))
  }

  async function savePosition(value) {
    if (demo) return t('asset.err.demo')
    const prev = lots.length === 1 ? lots[0] : null
    const r = prev ? await investData.updateHolding(prev, value) : await investData.addHolding(value)
    if (!r.ok) return r.fields ? t('asset.form.errors') : t(errorKey(r.error))
    setSheet(null)
    toast(t(prev ? 'asset.pos.updated' : 'asset.pos.added', { t: ticker }))
    d.refreshMine()
    return null
  }

  async function saveStop(stop) {
    if (demo) { toast(t('asset.err.demo')); return }
    const r = await investData.setStop(lots[0], stop)
    if (!r.ok) { toast(t(errorKey(r.error)), 'error'); return }
    toast(t(stop == null ? 'asset.mine.stopRemoved' : 'asset.mine.stopSaved'))
    d.refreshMine()
  }

  async function saveTrade(form) {
    if (demo) return t('asset.err.demo')
    const ops = await investData.listOperations()
    if (!ops.ok) return ops.error === 'table_missing' ? t('asset.trade.tableMissing') : t(errorKey(ops.error))
    const seq = ops.data.reduce((m, o) => Math.max(m, Number(o.id) || 0), 0) + 1
    let fx = null
    if (ccy !== 'USD' && form.date === localDay()) {
      const [latam, ars] = await Promise.all([investApi.fxLatam(), ccy === 'ARS' ? investApi.fxArs() : null])
      fx = rateOf(ccy, assetRates(latam, ars).rates)
    }
    const holding = lots[0] || null
    const v = buildTrade({ ...form, rsi: score?.rsi }, { ticker, holding, ccy, fx, today: localDay(), uid: newOperationUid(), seq })
    if (!v.ok) return t('asset.form.errors')
    const saved = await investData.saveOperations([v.op])
    if (!saved.ok) return saved.error === 'table_missing' ? t('asset.trade.tableMissing') : t(errorKey(saved.error))
    const { adj } = v
    if (adj.action === 'close') { setCloseAsk(true); d.refreshMine(); return null }
    let r = { ok: true }
    if (adj.action === 'create') r = await investData.addHolding({ t: ticker, type: isCryptoTicker(ticker, type) ? 'Crypto' : 'Stock', sh: adj.sh, cost: adj.cost, fxCost: adj.fxCost })
    else if (adj.action === 'update' && holding) r = await investData.updateHolding(holding, { ...holding, sh: adj.sh, cost: adj.cost, fxCost: adj.fxCost })
    if (!r.ok) return t('asset.trade.posFailed')
    setSheet(null)
    toast(t(adj.action === 'create' ? 'asset.trade.created' : 'asset.trade.saved', { t: ticker }))
    d.refreshMine()
    return null
  }

  async function answerClose(remove) {
    if (!remove) { setCloseAsk(false); setSheet(null); return null }
    const r = await investData.deleteHolding(lots[0]?.id)
    if (!r.ok) return t(errorKey(r.error))
    setCloseAsk(false); setSheet(null)
    toast(t('asset.trade.removed', { t: ticker }))
    d.refreshMine()
    return null
  }

  if (!ticker) {
    return (
      <div className={hub.hub}>
        <PageHeader title={t('invest.asset.label')} sub={t('nav.investments')} />
        <p className={hub.assetNote}>{t('invest.asset.missing')}</p>
        <button type="button" className={hub.btn} onClick={() => setPage?.('investments')}>{t('invest.asset.toHub')}</button>
      </div>
    )
  }

  const pctDay = q ? q.changePct : null
  const dir = pctDay > 0 ? 'up' : pctDay < 0 ? 'down' : 'flat'
  const Ic = dir === 'up' ? ArrowUp : dir === 'down' ? ArrowDown : Equal
  const name = q?.name || (demo ? demoRow(ticker)?.name : null) || d.fund.data?.companyName || d.fund.data?.name || null
  const canEdit = lots.length <= 1
  const actsId = `asset-acts-${ticker}`

  return (
    <div className={s.page}>
      <PageHeader title={ticker} sub={name || t('invest.asset.label')} />

      <section aria-label={t('invest.asset.price')} className={s.head}>
        {q ? (
          <div className={s.priceRow}>
            <span className={s.price}><Money>{fmtPx(q.price, ccy)}</Money></span>
            <span className={s.day} data-tone={dir}>
              <Ic size={14} strokeWidth={2.2} aria-hidden="true" />
              {q.change != null ? t('asset.change', { amt: fmtPxSigned(q.change, ccy, { decimals: pxDecimals(q.price, ccy) }), pct: fmtPct(pctDay, { signed: true }) }) : t('invest.asset.day', { pct: fmtPct(pctDay, { signed: true }) })}
            </span>
          </div>
        ) : (
          <p className={s.note} role="status">{d.quote.phase === 'loading' ? t('invest.search.preview.loading', { t: ticker }) : t('invest.asset.noQuote')}</p>
        )}
        <p className={s.note}>{demo ? t('asset.sample') : q ? t('asset.priceSource', { source: q.source === 'coingecko' ? 'CoinGecko' : 'Yahoo Finance' }) : null}</p>
      </section>

      <section aria-labelledby={actsId}>
        <h2 id={actsId} className="sr-only">{t('asset.act.group', { t: ticker })}</h2>
        <div className={s.actions}>
          <button type="button" className={s.act} aria-pressed={followed} onClick={toggleFollow} disabled={d.watch.phase === 'loading'}>
            {followed ? <Check size={18} strokeWidth={2} aria-hidden="true" /> : <Plus size={18} strokeWidth={2} aria-hidden="true" />}
            {followed ? t('asset.act.following') : t('asset.act.follow')}
          </button>
          <button type="button" className={s.act} onClick={() => setSheet('pos')} disabled={d.lots.phase === 'loading' || !canEdit} aria-describedby={!canEdit ? `${actsId}-multi` : undefined}>
            {hasPos ? <Pencil size={18} strokeWidth={2} aria-hidden="true" /> : <BarChart3 size={18} strokeWidth={2} aria-hidden="true" />}
            {hasPos ? t('asset.act.editPos') : t('asset.act.addPos')}
          </button>
          <button type="button" className={s.act} onClick={() => { setCloseAsk(false); setSheet('trade') }} disabled={d.lots.phase === 'loading'}>
            <ClipboardList size={18} strokeWidth={2} aria-hidden="true" />{t('asset.act.trade')}
          </button>
          <button type="button" className={s.act} aria-expanded={alertNote} aria-controls={`${actsId}-alert`} onClick={() => setAlertNote(v => !v)}>
            <Bell size={18} strokeWidth={2} aria-hidden="true" />{t('asset.act.alert')}
          </button>
          <button type="button" className={s.act} onClick={openCompare}>
            <Scale size={18} strokeWidth={2} aria-hidden="true" />{t('asset.act.compare', { b: benchT })}
          </button>
          <button type="button" className={s.act} onClick={share}>
            <Share2 size={18} strokeWidth={2} aria-hidden="true" />{t('asset.act.share')}
          </button>
        </div>
        {!canEdit && <p id={`${actsId}-multi`} className={s.note}>{t('asset.pos.multi', { n: lots.length, t: ticker })}</p>}
        <div id={`${actsId}-alert`} role="status">
          {alertNote && <p className={s.notice}>{t('asset.alert.soon', { t: ticker })}</p>}
        </div>
      </section>

      <ChartPanel ticker={ticker} ccy={ccy} rows={chartRows} phase={chartPhase} range={range.key}
        onRange={(k) => setView(v => ({ ...v, range: k }))} layers={layers} onLayer={(k) => setLayers(l => ({ ...l, [k]: !l[k] }))} demo={demo}
        onRetry={demo ? null : () => d.retryHistory(long)} />

      <section>
        <div role="tablist" aria-label={t('asset.tabs.label', { t: ticker })} className={hub.tabs}>
          {tabs.map(k => (
            <button key={k} ref={el => { tabRefs.current[k] = el }} type="button" role="tab" id={`asset-tab-${k}`}
              aria-selected={tab === k} aria-controls="asset-panel" tabIndex={tab === k ? 0 : -1}
              className={hub.tab} onClick={() => setTab(k)} onKeyDown={onTabKey}>
              {t(`asset.tab.${k}`)}
            </button>
          ))}
        </div>
        <div role="tabpanel" id="asset-panel" aria-labelledby={`asset-tab-${tab}`} tabIndex={0} className={s.panel}>
          {tab === 'ind' && <IndicatorsPane ticker={ticker} ccy={ccy} score={score} phase={d.hist1y.phase === 'error' ? 'ready' : d.hist1y.phase} />}
          {tab === 'fund' && <FundamentalsPane ticker={ticker} ccy={ccy} price={price} quote={q} score={score} fund={d.fund} earn={d.earn} demo={demo} type={type} onRetry={() => needFund(true)} />}
          {tab === 'mine' && <MinePane ticker={ticker} ccy={ccy} price={q?.price > 0 ? q.price : null} lots={lots} weight={d.weight} profile={d.profile} cols={d.cols} demo={demo} onSaveStop={saveStop} />}
          {tab === 'news' && <NewsPane ticker={ticker} news={d.news} onRetry={() => needNews(true)} />}
        </div>
      </section>

      <PositionSheet open={sheet === 'pos'} onClose={() => setSheet(null)} ticker={ticker} ccy={ccy} prev={lots.length === 1 ? lots[0] : null}
        defaultType={type} price={price} onSave={savePosition} />
      <TradeSheet open={sheet === 'trade'} onClose={() => { setSheet(null); setCloseAsk(false) }} ticker={ticker} ccy={ccy} holding={lots[0] || null}
        price={price} rsi={score?.rsi} onSave={saveTrade} closeAsk={closeAsk} onCloseAnswer={answerClose} />
      <CompareSheet open={sheet === 'cmp'} onClose={() => setSheet(null)} a={ticker} b={benchT} rowsA={chartRows} phaseA={chartPhase} rowsB={bench.rows} phaseB={bench.phase}
        n={range.n} rangeLabel={t(`asset.range.long.${range.key}`)} demo={demo} />
    </div>
  )
}
