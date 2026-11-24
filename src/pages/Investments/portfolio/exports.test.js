// Exportar de Inversiones: misma lógica en Portafolio y en Ajustes › Inversiones (F7).
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { backupFile, operationsFile, positionsFile } from './exports.js'
import { setTargetsValue, __resetTargets } from './targetsStore.js'
import { ptFor } from './text.js'
import { parseBackup } from '../../../utils/investCsv.js'

const { t } = ptFor('es')
const now = new Date(2026, 10, 23)
const pb = {
  positions: { rows: [{ t: 'VOO', type: 'ETF', ccy: 'USD', sh: 2, avgCost: 400, price: 500, value: 1000, pnl: 200, ret: 0.25, weight: 1, stop: null, fxCost: null }], total: { value: 1000, pnl: 200, ret: 0.25 } },
  holdings: [{ id: '1', t: 'VOO', type: 'ETF', sh: 2, cost: 400, stop: null, fxCost: null, note: '' }],
  ops: [],
  capital: 5000,
}

describe('exports.js', () => {
  it('nombres con fecha y textos de Portafolio en el idioma de la persona', () => {
    const f = positionsFile(pb, t, now)
    expect(f.name).toBe('moyiq-inversiones-2026-11-23.csv')
    expect(f.mime).toMatch(/^text\/csv/)
    expect(f.text).toContain(t('pf.csv.h.ticker'))
    expect(f.text).toContain('VOO')
    expect(operationsFile(pb, t, now).name).toBe('moyiq-operaciones-2026-11-23.csv')
  })

  it('la copia JSON lleva lo que sigues y se puede volver a importar', async () => {
    const listWatchlist = vi.fn(async () => ({ ok: true, data: ['AAPL'] }))
    const f = await backupFile({ pb, listWatchlist, now })
    expect(f.name).toBe('moyiq-inversiones-copia-2026-11-23.json')
    expect(JSON.parse(f.text).watchlist).toEqual(['AAPL'])
    expect(parseBackup(f.text).ok).toBe(true)
  })

  it('sin la lista de seguimiento (error o red) no arma una copia incompleta', async () => {
    expect(await backupFile({ pb, listWatchlist: async () => ({ ok: false, error: 'network' }), now })).toEqual({ error: 'watchlist' })
    expect(await backupFile({ pb, listWatchlist: async () => { throw new Error('x') }, now })).toEqual({ error: 'watchlist' })
  })

  it('sin targets explícitos lleva los objetivos de Portafolio (targetsStore), como pide Ajustes', async () => {
    const listWatchlist = async () => ({ ok: true, data: [] })
    setTargetsValue({ VOO: 60 })
    try {
      const f = await backupFile({ pb, listWatchlist, now })
      expect(JSON.parse(f.text).targets).toEqual({ VOO: 60 })
      expect(JSON.parse((await backupFile({ pb, targets: null, listWatchlist, now })).text).targets ?? null).toBe(null)
    } finally { __resetTargets() }
  })

  it('en el demo no pide la lista al servidor', async () => {
    const listWatchlist = vi.fn()
    await backupFile({ pb, demo: true, listWatchlist, now })
    expect(listWatchlist).not.toHaveBeenCalled()
  })

  it('Portafolio usa este módulo (sin duplicar la lógica)', () => {
    const src = readFileSync(fileURLToPath(new URL('./PortfolioTab.jsx', import.meta.url)), 'utf8')
    expect(src).toContain("from './exports.js'")
    expect(src).not.toMatch(/holdingsCsv|operationsCsv|backupJson/)
  })
})
