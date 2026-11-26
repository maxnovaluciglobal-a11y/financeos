// src/pages/Investments/Asset.jsx — ficha del activo (pantalla empujada
// 'investAsset', Inversiones completo F3). Rehace la ficha (drawer) de Invest
// (invest-web/app/index.html 7176-7553) como pantalla de moyiq:
//  · cabecera con precio y cambio del día, frescura del precio (Al día ·
//    Retraso N min · Mercado cerrado · Retraso no informado) y estado de la
//    bolsa (Invest: freshTag y marketStatusBadge); sin cotización, el último
//    cierre de las velas rotulado como tal;
//  · una fila de acciones (rediseño del 26-nov-2026): Registrar operación
//    (principal), Alerta (follow/AlertSheet.jsx, en el servidor con push),
//    Seguir/Siguiendo y "Más acciones" con agregar o editar la posición,
//    comparar con SPY (y con hasta 4 en Siguiendo) y compartir o copiar;
//  · gráfico de velas (TradingView Lightweight Charts, diferido) con medias de
//    20/50/200 días, bandas de Bollinger, volumen y capas RSI y MACD, 5 rangos;
//  · 4 pestañas: Mi posición (primero si tienes el activo: detalle, stop,
//    Editar y Eliminar), Indicadores, Fundamentales (12 métricas, rango de 52
//    semanas y resultados trimestrales) y Noticias. Abre en Mi posición si
//    tienes el activo y si no en Fundamentales, salvo que el historial o quien
//    abrió la ficha pida otra (utils/investAsset.js: pickTab).
// Orden (propuesta 2 del 26-nov-2026): precio y bolsa, tu posición en una
// línea, gráfico, acciones, pestañas, "Esta empresa en 30 segundos" recortado
// y al pie el interruptor "Vista completa" y el aviso educativo.
// Vista esencial (por defecto, utils/investView.js): una línea simple de
// precio y sin la pestaña Indicadores ni el stop; "Vista completa" devuelve todo.
// El ticker vive en la entrada del historial (utils/investNav.js); la pestaña y
// el rango también. Nada de la posición ni del ticker se guarda en el
// dispositivo. Textos: ./asset/strings.<idioma>.js (cargados con la ficha).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, BarChart3, Bell, Check, ClipboardList, Equal, MoreHorizontal, Pencil, Plus, Scale, Share2 } from 'lucide-react'
import { PageHeader } from '../../components/ui/index.jsx'
import Money from '../../components/Money.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { investApi } from '../../core/investApi.js'
import { investData, newOperationUid } from '../../core/investData.js'
import { ASSET_EVENT, assetView, currentAssetTicker, queueFollow, rememberAssetView, tabKeyTarget } from '../../utils/investNav.js'
import { investAlerts } from '../../core/investAlerts.js'
import { useInvestAccess } from '../../hooks/useInvestAccess.js'
import { investFullHere } from '../../utils/uiFlags.js'
import { fmtPct } from '../../utils/index.js'
import { assetRates, currencyOf, rateOf } from '../../utils/investValuation.js'
import { DEFAULT_RANGE, compareWith, historyRangeFor, pickTab, positionLine, rangeOf, scoreAsset, shareParts, visibleTabs } from '../../utils/investAsset.js'
import { buildTrade } from '../../utils/investTrade.js'
import { freshnessKey, freshnessTone, isUsEquity, marketStatus, quoteFreshness } from '../../utils/investQuoteMeta.js'
import { demoRow } from '../../demo/demoInvestAsset.js'
import { demoMarketApi, isSample } from '../../demo/demoMarketApi.js'
import { useAssetT } from './asset/assetDict.js'
import { InvestStringsGate } from './i18n/investStrings.js'
import { useAssetData } from './asset/useAssetData.js'
import { errorKey, fmtClock, fmtDay, fmtPx, fmtPxSigned, fmtUnits, isCryptoTicker, localDay, pxDecimals } from './asset/format.js'
import ChartPanel from './asset/ChartPanel.jsx'
import { FundamentalsPane, IndicatorsPane, MinePane, NewsPane } from './asset/Panes.jsx'
import { CompareSheet, ConfirmSheet, MenuSheet, PositionSheet, TradeSheet } from './asset/Sheets.jsx'
import Brief from './asset/Brief.jsx'
import { EduNotice, ViewToggle } from './esencial/ViewToggle.jsx'
import { useInvestView } from './esencial/useInvestView.js'
import { shows } from '../../utils/investView.js'
import AlertSheet from './follow/AlertSheet.jsx'
import { useFollowT } from './follow/dict.js'
import { demoAlertList, demoSaveAlert } from './follow/useFollowData.js'
import { pushResultText, usePushOffer } from './follow/shared.js'
import hub from './hub/hub.module.css'
import s from './asset/asset.module.css'
import InvestLimitSheet from './InvestLimitSheet.jsx'

// Qué muestra la ficha: 'ready' con un ticker y acceso, 'loading' mientras se
// revisa la cuenta (antes decía por un instante "No hay un activo elegido") y
// 'missing' en cualquier otro caso.
export function assetGate({ full, demo, status, picked }) {
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

// Reloj de la cabecera: la frescura ("Retraso N min") avanza sola cada minuto.
function useMinuteClock(on) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return undefined
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(id)
  }, [on])
  return now
}

export default function InvestAsset(props) {
  return <InvestStringsGate><InvestAssetPage {...props} /></InvestStringsGate>
}

function InvestAssetPage({ setPage }) {
  const { t, ready } = useAssetT()
  const app = useApp() || {}
  const toast = app.showToast || (() => {})
  const demo = !!app.settings?.isDemo
  const picked = useAssetTicker()
  const { status } = useInvestAccess()
  const [investFull] = useState(investFullHere)
  // Misma puerta que Inversiones: sin el interruptor o sin acceso, no hay ficha.
  const gate = assetGate({ full: investFull, demo, status, picked })
  const ticker = gate === 'ready' ? picked : null

  const d = useAssetData(ticker, { demo })
  const [mode, setMode] = useInvestView()
  const full = shows(mode, 'indicators')
  // tab null = nadie pidió una: se elige con la posición (pickTab).
  const [view, setView] = useState(() => ({ tab: assetView().tab, range: assetView().range || DEFAULT_RANGE }))
  const [layers, setLayers] = useState({ rsi: false, macd: false })
  const [sheet, setSheet] = useState(null) // 'pos' | 'trade' | 'cmp' | 'more'
  const [editLot, setEditLot] = useState(null) // lote que se edita (varios lotes)
  const [delLot, setDelLot] = useState(null) // lote que se va a eliminar
  const [closeAsk, setCloseAsk] = useState(false)
  const [alertSheet, setAlertSheet] = useState(false)
  const [alerts, setAlerts] = useState([])
  const ft = useFollowT().t
  const push = usePushOffer(demo)
  const [bench, setBench] = useState({ phase: 'idle', rows: null, t: null })
  const tabRefs = useRef({})

  // Ticker nuevo (o Atrás a otra ficha): la vista de esa entrada del historial.
  useEffect(() => {
    const v = assetView()
    setView({ tab: v.tab, range: v.range || DEFAULT_RANGE })
    setLayers({ rsi: false, macd: false }); setSheet(null); setCloseAsk(false); setAlertSheet(false); setEditLot(null); setDelLot(null)
    setBench({ phase: 'idle', rows: null, t: null })
  }, [ticker])
  useEffect(() => { rememberAssetView(view) }, [view])

  const lots = d.lots.data || []
  const hasPos = lots.some(h => h.sh > 0)
  // En la vista esencial no está la pestaña Indicadores (RSI, MACD, medias).
  // Mientras llegan los lotes, si se pidió Mi posición (desde Portafolio) se
  // la muestra; sin pedido, la pestaña espera a saber si tienes el activo.
  const lotsLoading = d.lots.phase === 'loading'
  const tabs = visibleTabs(hasPos || (lotsLoading && view.tab === 'mine')).filter(k => full || k !== 'ind')
  const picked0 = lotsLoading && view.tab === 'mine' ? 'mine' : lotsLoading && !view.tab ? null : pickTab(view.tab, hasPos)
  const tab = picked0 == null ? null : tabs.includes(picked0) ? picked0 : tabs[0]
  const q = d.quote.data
  const ccy = currencyOf(ticker, q?.currency)
  const rows1y = d.hist1y.data
  const score = useMemo(() => (rows1y ? scoreAsset(rows1y) : null), [rows1y])
  const price = q?.price > 0 ? q.price : score?.last ?? null
  const range = rangeOf(view.range)
  const long = range.n > 252
  const chartRows = long ? d.hist5y.data : rows1y
  const chartPhase = long ? d.hist5y.phase : d.hist1y.phase
  // Qué es de ejemplo (demo sin respuesta de la API): cada pieza por separado.
  const chartSample = !!(long ? d.hist5y.sample : d.hist1y.sample)
  const quoteSample = !!d.quote.sample
  const type = lots[0]?.type || (demo ? demoRow(ticker)?.type : null) || (isCryptoTicker(ticker) ? 'Crypto' : 'Stock')
  const followed = (d.watch.data || []).includes(ticker)
  const now = useMinuteClock(!!q)

  // Cargas por pestaña y por rango (no antes de hacer falta).
  const { need5y, needFund, needNews, needMine } = d
  useEffect(() => { if (ticker && long) need5y() }, [ticker, long, need5y])
  // "En 30 segundos" usa los fundamentales (qué hace, tamaño, dividendos):
  // se piden al abrir la ficha, salvo para cripto (no tiene).
  const crypto = isCryptoTicker(ticker, type)
  useEffect(() => { if (ticker && !crypto) needFund() }, [ticker, crypto, needFund])
  useEffect(() => {
    if (!ticker) return
    if (tab === 'fund') needFund()
    if (tab === 'news') needNews()
    if (tab === 'mine') needMine()
  }, [ticker, tab, needFund, needNews, needMine])
  // La línea de la posición (arriba del gráfico) también lleva el peso.
  useEffect(() => { if (ticker && hasPos) needMine() }, [ticker, hasPos, needMine])

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

  // ── Alerta de precio (Siguiendo › Alertas; en el servidor, con push) ──
  async function openAlert() {
    setAlertSheet(true)
    if (demo) { setAlerts(demoAlertList()); return }
    const r = await investAlerts.list()
    setAlerts(r.ok ? r.data : [])
  }
  const quoteOf = useCallback(async (sym) => (sym === ticker && d.quote.data ? d.quote.data : (demo ? demoMarketApi : investApi).quote(sym)), [ticker, d.quote.data, demo])
  async function saveAlert(prev, input) {
    if (demo) return demoSaveAlert(prev, input)
    return prev ? investAlerts.update(prev.id, { ...input, active: prev.active }) : investAlerts.create(input)
  }
  function onAlertSaved(r, prev, value) {
    setAlertSheet(false)
    const msg = ft('fl.sheet.saved', { t: value.symbol })
    if (push.state === 'off') {
      toast(`${msg} ${ft('fl.push.off')}`, 'ok', {
        label: ft('fl.push.enable'),
        onAction: async () => { const [txt, tone] = pushResultText(await push.enable(), ft); if (txt) toast(txt, tone) },
      })
    } else if (push.state === 'noLicense' || push.state === 'unsupported') {
      // La alerta se guardó, pero no va a llegar al teléfono: se dice.
      toast(`${msg} ${ft(push.state === 'noLicense' ? 'fl.push.noLicense' : 'fl.push.unsupported')}`)
    } else toast(msg)
  }
  function compareMore() {
    setSheet(null)
    queueFollow({ sub: 'comparar', compare: [ticker, benchT] })
    setPage?.('investments')
  }

  const benchT = compareWith(ticker)
  function openCompare() {
    setSheet('cmp')
    const want = long ? '5y' : '1y'
    if (bench.t === `${benchT}:${want}` && bench.phase === 'ready') return
    setBench({ phase: 'loading', rows: null, t: `${benchT}:${want}` })
    ;(demo ? demoMarketApi : investApi).history(benchT, historyRangeFor(view.range), '1d').then(rows => setBench({ phase: rows ? 'ready' : 'error', rows, t: `${benchT}:${want}`, sample: isSample(rows) }))
  }

  async function savePosition(value) {
    if (demo) return t('asset.err.demo')
    const prev = editLot || (lots.length === 1 ? lots[0] : null)
    const r = prev ? await investData.updateHolding(prev, value) : await investData.addHolding(value)
    if (!r.ok) return r.fields ? t('asset.form.errors') : t(errorKey(r.error))
    setSheet(null); setEditLot(null)
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

  // Editar desde Mi posición (un lote o uno de varios) y desde "Más acciones".
  function openEdit(lot = null) { setEditLot(lot); setSheet('pos') }
  // Eliminar (antes en la fila de Portafolio): confirma y ofrece Deshacer.
  async function deleteLot() {
    const lot = delLot
    if (!lot) return
    if (demo) { setDelLot(null); toast(t('asset.err.demo')); return }
    const r = await investData.deleteHolding(lot.id)
    if (!r.ok) { toast(t(errorKey(r.error)), 'error'); return }
    setDelLot(null)
    d.refreshMine()
    const back = { t: lot.t || ticker, type: lot.type, sh: lot.sh, cost: lot.cost, stop: lot.stop, fxCost: lot.fxCost, note: lot.note }
    toast(t('asset.del.done', { t: ticker }), 'ok', {
      label: t('asset.undo'),
      onAction: async () => {
        const u = await investData.addHolding(back)
        if (!u.ok) toast(t(errorKey(u.error)), 'error')
        d.refreshMine()
      },
    })
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

  // Mientras se revisa la cuenta, un aviso breve (no "falta el activo", que
  // después se corrige solo).
  if (gate === 'loading') {
    return (
      <div className={hub.hub}>
        <PageHeader title={picked} sub={t('invest.asset.label')} />
        <p className={hub.assetNote} role="status">{t('invest.gate.loading')}</p>
      </div>
    )
  }

  // en/pt/de: hasta que llega el chunk del idioma, estado de carga (texto de la
  // app, ya en ese idioma) en vez de un instante en español.
  if (ticker && !ready) {
    return (
      <div className={s.page} aria-busy="true">
        <PageHeader title={ticker} sub={t('invest.asset.label')} />
        <p className={s.note} role="status">{t('invest.search.preview.loading', { t: ticker })}</p>
      </div>
    )
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

  // Frescura (solo precios reales: el ejemplo ya dice que es ejemplo) y bolsa.
  const fresh = q && !quoteSample ? quoteFreshness(q, now) : null
  const freshK = freshnessKey(fresh)
  const mkt = marketStatus(q, now, { usEquity: isUsEquity(ticker, ccy), crypto: isCryptoTicker(ticker, type) })
  const exName = mkt?.exchange ? t(`asset.ex.${mkt.exchange}`) : q?.exchange || null
  const mktText = mkt ? (exName ? t(mkt.open ? 'asset.mkt.open' : 'asset.mkt.closed', { ex: exName }) : t(mkt.open ? 'asset.mkt.anyOpen' : 'asset.mkt.anyClosed')) : exName
  const lastRow = !q && rows1y?.length ? rows1y[rows1y.length - 1] : null

  // Tu posición en una línea ("Tienes 12 u. · US$6.600 · ↑ +22,2 % · peso 52,8 %").
  const line = hasPos ? positionLine(lots, q?.price > 0 ? q.price : null, { weight: d.weight.data?.weight ?? null }) : null
  const LineIc = line?.dir === 'up' ? ArrowUp : line?.dir === 'down' ? ArrowDown : Equal
  const moreMenu = [
    { id: 'pos', icon: hasPos ? <Pencil size={20} aria-hidden="true" /> : <BarChart3 size={20} aria-hidden="true" />, label: hasPos ? t('asset.act.editPos') : t('asset.act.addPos'),
      sub: !canEdit ? t('asset.pos.multi', { n: lots.length, t: ticker }) : null, onPick: () => openEdit(null), disabled: lotsLoading || !canEdit },
    { id: 'cmp', icon: <Scale size={20} aria-hidden="true" />, label: t('asset.act.compare', { b: benchT }), onPick: openCompare },
    { id: 'share', icon: <Share2 size={20} aria-hidden="true" />, label: t('asset.act.share'), onPick: share },
  ]

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
        ) : d.quote.phase !== 'loading' && lastRow && score?.last ? (
          <>
            <div className={s.priceRow}>
              <span className={s.price}><Money>{fmtPx(score.last, ccy)}</Money></span>
            </div>
            <p className={s.note} role="status">{t('asset.lastClose', { date: fmtDay(lastRow.date) })}</p>
          </>
        ) : (
          <p className={s.note} role="status">{d.quote.phase === 'loading' ? t('invest.search.preview.loading', { t: ticker }) : t('invest.asset.noQuote')}</p>
        )}
        {(freshK || mktText) && (
          <ul className={s.meta}>
            {freshK && (
              <li className={s.tag} data-tone={freshnessTone(fresh)} title={t('asset.fresh.hint')}>
                <span>{t(freshK, { n: fresh.minutes, time: fmtClock(fresh.time, { now }) || '—' })}</span>
                <span className="sr-only">. {t('asset.fresh.hint')}</span>
              </li>
            )}
            {mktText && (
              <li className={s.tag} data-tone="neu">
                <span className="sr-only">{t('asset.mkt.label')}: </span>{mktText}
              </li>
            )}
          </ul>
        )}
        <p className={s.note}>{quoteSample ? t('asset.sample') : q ? t('asset.priceSource', { source: q.source === 'coingecko' ? 'CoinGecko' : 'Yahoo Finance' }) : lastRow ? t('asset.priceSource', { source: 'Yahoo Finance' }) : null}</p>
      </section>

      {line && (
        <section className={s.posLine} aria-label={t('asset.posLine.label', { t: ticker })}>
          <span><Money>{t('asset.posLine.units', { n: fmtUnits(line.sh) })}</Money></span>
          <span aria-hidden="true">·</span>
          <strong className={s.num}><Money>{fmtPx(line.value, ccy, { decimals: 0 })}</Money></strong>
          {line.plPct != null && <>
            <span aria-hidden="true">·</span>
            <span className={s.day} data-tone={line.dir}><LineIc size={13} strokeWidth={2.2} aria-hidden="true" />{fmtPct(line.plPct, { signed: true })}</span>
          </>}
          {line.weight != null && <>
            <span aria-hidden="true">·</span>
            <span className={s.muted}>{t('asset.posLine.weight', { p: fmtPct(line.weight, { decimals: 1 }) })}</span>
          </>}
        </section>
      )}

      <ChartPanel ticker={ticker} ccy={ccy} rows={chartRows} phase={chartPhase} range={range.key}
        onRange={(k) => setView(v => ({ ...v, range: k }))} layers={layers} onLayer={(k) => setLayers(l => ({ ...l, [k]: !l[k] }))} demo={chartSample}
        onRetry={() => d.retryHistory(long)} simple={!full} demoNoted={quoteSample} />

      <section aria-labelledby={actsId}>
        <h2 id={actsId} className="sr-only">{t('asset.act.group', { t: ticker })}</h2>
        <div className={s.actions}>
          <button type="button" className={`${s.act} ${s.actMain}`} onClick={() => { setCloseAsk(false); setSheet('trade') }} disabled={lotsLoading}>
            <ClipboardList size={18} strokeWidth={2} aria-hidden="true" />{t('asset.act.trade')}
          </button>
          <button type="button" className={`${s.act} ${s.actSm}`} aria-haspopup="dialog" aria-label={t('asset.act.alert')} onClick={openAlert}>
            <Bell size={18} strokeWidth={2} aria-hidden="true" /><span aria-hidden="true">{t('asset.act.alertShort')}</span>
          </button>
          <button type="button" className={`${s.act} ${s.actSm}`} aria-pressed={followed} onClick={toggleFollow} disabled={d.watch.phase === 'loading'}>
            {followed ? <Check size={18} strokeWidth={2} aria-hidden="true" /> : <Plus size={18} strokeWidth={2} aria-hidden="true" />}
            {followed ? t('asset.act.following') : t('asset.act.follow')}
          </button>
          <button type="button" className={`${s.act} ${s.actIcon}`} aria-haspopup="dialog" aria-label={t('asset.act.more')} onClick={() => setSheet('more')}>
            <MoreHorizontal size={20} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </section>

      <section>
        <div role="tablist" aria-label={t('asset.tabs.label', { t: ticker })} className={hub.tabs}>
          {tabs.map(k => (
            <button key={k} ref={el => { tabRefs.current[k] = el }} type="button" role="tab" id={`asset-tab-${k}`}
              aria-selected={tab === k} aria-controls="asset-panel" tabIndex={tab === k || (tab == null && k === tabs[0]) ? 0 : -1}
              className={hub.tab} onClick={() => setTab(k)} onKeyDown={onTabKey}>
              {t(`asset.tab.${k}`)}
            </button>
          ))}
        </div>
        <div role="tabpanel" id="asset-panel" aria-labelledby={tab ? `asset-tab-${tab}` : undefined} tabIndex={0} className={s.panel}>
          {tab == null && <p className={s.note} role="status">{t('asset.mine.loading')}</p>}
          {tab === 'ind' && <IndicatorsPane ticker={ticker} ccy={ccy} score={score} phase={d.hist1y.phase} onRetry={() => d.retryHistory(false)} />}
          {tab === 'fund' && <FundamentalsPane ticker={ticker} ccy={ccy} price={price} quote={q} score={score} fund={d.fund} earn={d.earn} fundSample={!!d.fund.sample} earnSample={!!d.earn.sample} type={type} onRetry={() => needFund(true)} />}
          {tab === 'mine' && <MinePane ticker={ticker} ccy={ccy} price={q?.price > 0 ? q.price : null} lots={lots} weight={d.weight} profile={d.profile} cols={d.cols} demo={demo} priceSample={quoteSample} onSaveStop={saveStop} showStop={shows(mode, 'stop')}
            onEdit={openEdit} onDelete={setDelLot} busy={lotsLoading} />}
          {tab === 'news' && <NewsPane ticker={ticker} news={d.news} onRetry={() => needNews(true)} />}
        </div>
      </section>

      <Brief ticker={ticker} quote={q} fund={crypto ? { phase: 'ready', data: null } : d.fund} rows={rows1y} rowsPhase={d.hist1y.phase} type={crypto ? 'Crypto' : type} price={price} now={now} />

      {/* Al pie: el interruptor (su explicación queda como descripción accesible,
          no a la vista) y el aviso educativo. */}
      <footer className={s.foot}>
        <div className={s.viewFoot}><ViewToggle view={mode} onChange={setMode} /></div>
        <EduNotice />
      </footer>

      <MenuSheet open={sheet === 'more'} onClose={() => setSheet(s0 => (s0 === 'more' ? null : s0))} title={t('asset.act.menuTitle', { t: ticker })} options={moreMenu} closeLabel={t('asset.close')} />
      <ConfirmSheet open={!!delLot} onClose={() => setDelLot(null)} onConfirm={deleteLot}
        title={t('asset.del.title', { t: ticker })}
        body={delLot ? t('asset.del.body', { units: fmtUnits(Number(delLot.sh)), entry: fmtPx(Number(delLot.cost), ccy) }) : ''}
        confirmLabel={t('asset.del.confirm')} cancelLabel={t('asset.cancel')} />
      <PositionSheet open={sheet === 'pos'} onClose={() => { setSheet(null); setEditLot(null) }} ticker={ticker} ccy={ccy} prev={editLot || (lots.length === 1 ? lots[0] : null)}
        defaultType={type} price={price} onSave={savePosition} />
      <TradeSheet open={sheet === 'trade'} onClose={() => { setSheet(null); setCloseAsk(false) }} ticker={ticker} ccy={ccy} holding={lots[0] || null}
        price={price} rsi={score?.rsi} onSave={saveTrade} closeAsk={closeAsk} onCloseAnswer={answerClose} />
      <CompareSheet open={sheet === 'cmp'} onClose={() => setSheet(null)} a={ticker} b={benchT} rowsA={chartRows} phaseA={chartPhase} rowsB={bench.rows} phaseB={bench.phase}
        n={range.n} rangeLabel={t(`asset.range.long.${range.key}`)} demo={chartSample || !!bench.sample} onMore={compareMore} />
      <AlertSheet open={alertSheet} onClose={() => setAlertSheet(false)} symbol={ticker} lockSymbol quoteOf={quoteOf}
        avgCost={hasPos && lots.length === 1 ? lots[0].cost : null} alerts={alerts} onSave={saveAlert} onSaved={onAlertSaved} pushState={push.state} />
      <InvestLimitSheet setPage={setPage} />
    </div>
  )
}
