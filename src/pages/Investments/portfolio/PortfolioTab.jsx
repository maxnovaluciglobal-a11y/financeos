// src/pages/Investments/portfolio/PortfolioTab.jsx — pestaña Portafolio (F1).
// Cuatro sub-pestañas como en Invest: Posiciones, Movimientos, Dividendos y
// Objetivos, con las hojas de nueva/editar/eliminar posición, registrar y
// eliminar operación, importar CSV, restaurar la copia JSON y exportar.
// La sub-pestaña vive en la entrada del historial y en fos_invest_port_tab
// (investNav). Los datos, solo en memoria (usePortfolioBook).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../../context/AppContext.jsx'
import { PORT_TABS, bootPortTab, rememberPortTab, tabKeyTarget, openAsset } from '../../../utils/investNav.js'
import { displayRate } from '../../../utils/investValuation.js'
import { holdingsCsv, operationsCsv, backupJson, exportName } from '../../../utils/investCsv.js'
import { sortOpsDesc } from '../../../utils/investLedger.js'
import { investData } from '../../../core/investData.js'
import { usePortfolioBook } from './usePortfolioBook.js'
import { makeFmt, downloadText } from './format.js'
import { DISPLAY_CCY_KEY, initialDisplayCcy } from './view.js'
import { usePT } from './text.js'
import { ConfirmSheet, ImportSheet, PositionSheet, TradeSheet } from './sheets.jsx'
import Positions from './Positions.jsx'
import Movements from './Movements.jsx'
import Dividends from './Dividends.jsx'
import Targets from './Targets.jsx'
import s from './portfolio.module.css'

const safeStorage = {
  getItem: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  setItem: (k, v) => { try { localStorage.setItem(k, v) } catch { /* modo privado: vale para esta visita */ } },
}

export default function PortfolioTab({ setPage, demo = false, view = 'esencial' }) {
  const { t } = usePT()
  const app = useApp() || {}
  const settings = app.settings || {}
  const showToast = app.showToast
  const toast = useCallback((msg, type = 'ok', action = null) => showToast?.(msg, type, action), [showToast])
  const pb = usePortfolioBook({ demo })
  const [sub, setSub] = useState(() => bootPortTab({ storage: safeStorage }))
  const refs = useRef({})
  useEffect(() => { rememberPortTab(sub, safeStorage) }, [sub])

  // Moneda de las cifras (USD, CLP, MXN, COP, ARS, PEN). Es una preferencia,
  // no un dato del portafolio.
  const [dispCcy, setDispCcyState] = useState(() => initialDisplayCcy(safeStorage.getItem(DISPLAY_CCY_KEY), settings.currency))
  const setDispCcy = (c) => { safeStorage.setItem(DISPLAY_CCY_KEY, c); setDispCcyState(c) }
  const disp = useMemo(() => displayRate(dispCcy, pb.market.latam, pb.rates.ars) || { ccy: 'USD', rate: 1, fallback: false, missing: dispCcy !== 'USD' }, [dispCcy, pb.market.latam, pb.rates.ars])
  const fmt = useMemo(() => makeFmt({ disp, currency: settings.currency, language: settings.language }), [disp, settings.currency, settings.language])

  // Objetivos: solo en memoria mientras Inversiones está abierta (no hay
  // tabla para guardarlos y llevan tickers: no se guardan en el dispositivo).
  const [targets, setTargets] = useState(null)

  // Hojas abiertas.
  const [pos, setPos] = useState(null) // { prev, prefill } | null
  const [del, setDel] = useState(null) // fila
  const [trade, setTrade] = useState(null) // prefill | null
  const [delOp, setDelOp] = useState(null) // operación
  const [imp, setImp] = useState(null) // 'csv' | 'json' | null

  function onSubKey(e) {
    const next = tabKeyTarget(e.key, sub, PORT_TABS)
    if (!next) return
    e.preventDefault()
    setSub(next)
    refs.current[next]?.focus()
  }

  const errMsg = (r) => t(r.error === 'demo' ? 'pf.err.demo' : r.error === 'timeout' || r.error === 'network' ? 'pf.err.network' : r.error === 'table_missing' ? 'pf.mov.missing' : r.error === 'session_required' ? 'pf.err.session_required' : 'pf.err.save_failed')

  // ── Posiciones ──
  async function savePosition(prev, input) {
    const r = await pb.saveHolding(prev, input)
    if (r.ok) { setPos(null); toast(t(prev ? 'pf.toast.posUpdated' : 'pf.toast.posAdded')) }
    return r
  }
  async function deletePosition() {
    const row = del
    const r = await pb.deleteHolding(row)
    if (!r.ok) { toast(errMsg(r), 'error'); return }
    setDel(null)
    const back = { t: row.t, type: row.type, sh: row.sh, cost: row.avgCost, stop: row.stop, fxCost: row.fxCost, note: row.note }
    toast(t('pf.toast.posDeleted', { t: row.t }), 'ok', {
      label: t('pf.undo'),
      onAction: async () => {
        const u = await pb.saveHolding(null, back, { allowZeroCost: back.cost === 0 })
        if (!u.ok) toast(errMsg(u), 'error')
      },
    })
  }
  async function setStop(row, stop) {
    const prev = pb.holdings.find(h => String(h.id) === String(row.id))
    if (!prev) return { ok: false, error: 'not_found' }
    const r = await pb.setStop(prev, stop)
    if (r.ok) toast(t(stop == null ? 'pf.toast.stopCleared' : 'pf.toast.stopSaved', { t: row.t }))
    else toast(t('pf.err.stop'), 'error')
    return r
  }

  // ── Operaciones ──
  async function recordTrade(form) {
    const r = await pb.recordTrade(form)
    if (!r.ok) return r
    setTrade(null)
    const e = r.effect
    const tk = r.op.ticker
    const closeRow = e.kind === 'close' ? pb.positions.rows.find(x => x.t === tk) : null
    if (r.effectFailed) toast(t('pf.toast.effectFailed', { t: tk }), 'error')
    else if (closeRow) toast(t('pf.toast.soldAll', { t: tk }))
    else if (e.kind === 'create') toast(t('pf.toast.created', { t: tk }))
    else if (e.kind === 'lots') toast(t('pf.toast.lots', { t: tk, n: e.count }), 'error')
    else toast(t('pf.toast.opSaved'))
    // Vendió todo: se pregunta si quita la posición (Invest abría "Eliminar").
    if (closeRow) setDel(closeRow)
    else setSub('movimientos')
    return r
  }
  async function deleteOperation() {
    const op = delOp
    const r = await pb.deleteOperation(op)
    if (!r.ok) { toast(errMsg(r), 'error'); return }
    setDelOp(null)
    toast(t('pf.toast.opDeleted'), 'ok', {
      label: t('pf.undo'),
      onAction: async () => { const u = await pb.importOperations([op]); if (!u.ok) toast(errMsg(u), 'error') },
    })
  }

  // ── Exportar (se genera en el momento y se descarga; la app no guarda copia) ──
  const csvLabels = () => ({
    ticker: t('pf.csv.h.ticker'), type: t('pf.csv.h.type'), ccy: t('pf.csv.h.ccy'), shares: t('pf.csv.h.shares'), entry: t('pf.csv.h.entry'),
    price: t('pf.csv.h.price'), value: t('pf.csv.h.value'), pnl: t('pf.csv.h.pnl'), ret: t('pf.csv.h.ret'), weight: t('pf.csv.h.weight'),
    stop: t('pf.csv.h.stop'), fxCost: t('pf.csv.h.fxCost'), total: 'TOTAL', noFx: t('pf.noFx'),
  })
  const opLabels = () => ({
    id: t('pf.csv.o.id'), date: t('pf.csv.o.date'), ticker: t('pf.csv.h.ticker'), type: t('pf.csv.h.type'), ccy: t('pf.csv.h.ccy'), price: t('pf.csv.h.price'),
    qty: t('pf.csv.o.qty'), amount: t('pf.csv.o.amount'), fx: t('pf.csv.o.fx'), pnl: t('pf.csv.o.pnl'), rsi: 'RSI', note: t('pf.csv.o.note'),
    cash: t('pf.csv.o.cash'), reinvested: t('pf.csv.o.reinvested'), edited: t('pf.csv.o.edited'), source: t('pf.csv.o.source'), yes: t('pf.yes'), no: t('pf.no'),
    types: Object.fromEntries(['buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'bonus'].map(k => [k, t(`pf.op.${k}`)])),
  })
  function exportPositions() {
    downloadText(`${exportName('moyiq-inversiones')}.csv`, holdingsCsv(pb.positions.rows, csvLabels()), 'text/csv;charset=utf-8')
    toast(t('pf.toast.exported'))
  }
  function exportOperations() {
    downloadText(`${exportName('moyiq-operaciones')}.csv`, operationsCsv(sortOpsDesc(pb.ops).reverse(), opLabels()), 'text/csv;charset=utf-8')
    toast(t('pf.toast.exported'))
  }
  async function exportBackup() {
    const w = demo ? { ok: true, data: [] } : await investData.listWatchlist()
    const json = backupJson({ holdings: pb.holdings, operations: pb.ops, watchlist: w.ok ? w.data : [], capital: pb.capital, targets })
    downloadText(`${exportName('moyiq-inversiones-copia')}.json`, json, 'application/json')
    toast(t('pf.toast.backup'))
  }

  const common = { pb, fmt, disp, demo, t, settings, view }
  const openTrade = (prefill = {}) => setTrade({ ...prefill })
  const actions = {
    addPosition: (prefill = null) => setPos({ prev: null, prefill }),
    editPosition: (row) => setPos({ prev: pb.holdings.find(h => String(h.id) === String(row.id)) || null, prefill: null }),
    deletePosition: (row) => setDel(row),
    openTrade,
    deleteOp: (op) => setDelOp(op),
    importCsv: () => setImp('csv'),
    restore: () => setImp('json'),
    exportPositions, exportOperations, exportBackup,
    setStop,
    openAsset: (tk) => openAsset(setPage, tk),
    goTargets: () => setSub('objetivos'),
    goPositions: () => setSub('posiciones'),
    setDispCcy,
    dispCcy,
  }

  const knownTickers = useMemo(() => [...new Set(pb.holdings.map(h => h.t))], [pb.holdings])

  return (
    <div className={s.wrap}>
      <div role="tablist" aria-label={t('pf.tabsLabel')} className={s.subtabs}>
        {PORT_TABS.map(k => (
          <button key={k} ref={el => { refs.current[k] = el }} type="button" role="tab" id={`pf-tab-${k}`}
            aria-selected={sub === k} aria-controls={`pf-panel-${k}`} tabIndex={sub === k ? 0 : -1}
            className={s.subtab} onClick={() => setSub(k)} onKeyDown={onSubKey}>
            {t(`pf.tab.${k}`)}
          </button>
        ))}
      </div>

      {demo && <p className={s.sample}>{t('pf.sample')}</p>}

      <div role="tabpanel" id={`pf-panel-${sub}`} aria-labelledby={`pf-tab-${sub}`} className={s.wrap}>
        {sub === 'posiciones' && <Positions {...common} actions={actions} targets={targets} />}
        {sub === 'movimientos' && <Movements {...common} actions={actions} expenses={app.expenses} setAsides={app.setAsides} />}
        {sub === 'dividendos' && <Dividends {...common} actions={actions} />}
        {sub === 'objetivos' && <Targets {...common} actions={actions} targets={targets} setTargets={setTargets} />}
      </div>

      <PositionSheet open={!!pos} onClose={() => setPos(null)} prev={pos?.prev || null} prefill={pos?.prefill || null}
        onSave={savePosition} rates={pb.rates.rates} demo={demo} stopColumn={pb.columns.stop} />
      <ConfirmSheet open={!!del} onClose={() => setDel(null)} onConfirm={deletePosition}
        title={del ? t('pf.del.title', { t: del.t }) : ''}
        body={del ? t('pf.del.body', { units: fmt.units(del.sh), entry: fmt.native(del.avgCost, del.ccy), price: fmt.native(del.price ?? del.avgCost, del.ccy) }) : ''}
        confirmLabel={t('pf.del.confirm')} cancelLabel={t('pf.cancel')} />
      <TradeSheet open={!!trade} onClose={() => setTrade(null)} prefill={trade} onSave={recordTrade}
        tickers={knownTickers} knownTickers={knownTickers} hasDeposits={pb.ops.some(o => o.type === 'deposit')} />
      <ConfirmSheet open={!!delOp} onClose={() => setDelOp(null)} onConfirm={deleteOperation}
        title={t('pf.delOp.title')} body={t('pf.delOp.body')} confirmLabel={t('pf.del.confirm')} cancelLabel={t('pf.cancel')} />
      <ImportSheet open={!!imp} mode={imp || 'csv'} existingTickers={knownTickers}
        onClose={(msg) => { setImp(null); if (msg) toast(msg) }}
        onImportHoldings={pb.importHoldings} onImportOps={pb.importOperations}
        onImportTargets={(tg) => setTargets(tg)} />
    </div>
  )
}
