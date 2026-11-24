// src/pages/Investments/portfolio/exports.js — exportar posiciones (CSV),
// movimientos (CSV) y la copia (JSON) de Inversiones. Lo usan Portafolio y
// Ajustes › Inversiones (F7), con los mismos textos de Portafolio (usePT).
// Se genera en el momento y se descarga: la app no guarda copia.
import { holdingsCsv, operationsCsv, backupJson, exportName } from '../../../utils/investCsv.js'
import { sortOpsDesc } from '../../../utils/investLedger.js'
import { investData } from '../../../core/investData.js'
import { downloadText } from './format.js'
import { getTargets } from './targetsStore.js'

export const csvLabels = (t) => ({
  ticker: t('pf.csv.h.ticker'), type: t('pf.csv.h.type'), ccy: t('pf.csv.h.ccy'), shares: t('pf.csv.h.shares'), entry: t('pf.csv.h.entry'),
  price: t('pf.csv.h.price'), value: t('pf.csv.h.value'), pnl: t('pf.csv.h.pnl'), ret: t('pf.csv.h.ret'), weight: t('pf.csv.h.weight'),
  stop: t('pf.csv.h.stop'), fxCost: t('pf.csv.h.fxCost'), total: 'TOTAL', noFx: t('pf.noFx'),
})
export const opLabels = (t) => ({
  id: t('pf.csv.o.id'), date: t('pf.csv.o.date'), ticker: t('pf.csv.h.ticker'), type: t('pf.csv.h.type'), ccy: t('pf.csv.h.ccy'), price: t('pf.csv.h.price'),
  qty: t('pf.csv.o.qty'), amount: t('pf.csv.o.amount'), fx: t('pf.csv.o.fx'), pnl: t('pf.csv.o.pnl'), rsi: 'RSI', note: t('pf.csv.o.note'),
  cash: t('pf.csv.o.cash'), reinvested: t('pf.csv.o.reinvested'), edited: t('pf.csv.o.edited'), source: t('pf.csv.o.source'), yes: t('pf.yes'), no: t('pf.no'),
  types: Object.fromEntries(['buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'bonus'].map(k => [k, t(`pf.op.${k}`)])),
})

// Archivo { name, text, mime } (separado de la descarga para poder probarlo).
export const positionsFile = (pb, t, now = new Date()) =>
  ({ name: `${exportName('moyiq-inversiones', now)}.csv`, text: holdingsCsv(pb.positions.rows, csvLabels(t)), mime: 'text/csv;charset=utf-8' })
export const operationsFile = (pb, t, now = new Date()) =>
  ({ name: `${exportName('moyiq-operaciones', now)}.csv`, text: operationsCsv(sortOpsDesc(pb.ops).reverse(), opLabels(t)), mime: 'text/csv;charset=utf-8' })
// Copia JSON. Los objetivos de Portafolio salen de targetsStore si quien llama
// no los pasa (Ajustes no los tiene a mano). Si no se pudo leer la lista de
// seguimiento, no se arma una copia incompleta que parezca completa: vuelve
// { error: 'watchlist' } y quien llama lo avisa.
export async function backupFile({ pb, targets = getTargets(), demo = false, listWatchlist = () => investData.listWatchlist(), now = new Date() }) {
  let w
  try { w = demo ? { ok: true, data: [] } : await listWatchlist() } catch { w = { ok: false } }
  if (!w?.ok) return { error: 'watchlist' }
  const text = backupJson({ holdings: pb.holdings, operations: pb.ops, watchlist: w.data || [], capital: pb.capital, targets: targets ?? null })
  return { name: `${exportName('moyiq-inversiones-copia', now)}.json`, text, mime: 'application/json' }
}

export const download = (f) => downloadText(f.name, f.text, f.mime)
