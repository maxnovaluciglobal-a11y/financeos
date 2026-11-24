// Paridad entre pantallas — QA pre-tiendas (23-nov-2026, auditoría
// 2026-11-23-revision-pre-tiendas/30-qa-funcional.md). Cada bloque fija una
// cifra que antes salía distinta (o con otro signo) según la pantalla.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { fmtSignedMoney, setMoneyLocale } from './index.js'
import { calcNetWorth } from './netWorth.js'
import { withInvest } from './investNetWorth.js'

const src = (rel) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8')

describe('B3: patrimonio neto con su signo y una sola cifra', () => {
  it('activos 4.520 − pasivos 27.321,95 da −22.801,95 (nunca positivo)', () => {
    setMoneyLocale('USD', 'en')
    const nw = calcNetWorth({ goals: [{ saved: 4520 }], debts: [{ id: 1, balance: 27321.95 }], incomes: [], expenses: [], settings: {} })
    expect(nw.netWorth).toBeCloseTo(-22801.95, 2)
    expect(fmtSignedMoney(nw.netWorth, '$')).toBe('−$22,801.95')
    // Con Inversiones (12.500) es −10.301,95, la cifra de la página Patrimonio.
    const all = withInvest(nw, { amount: 12500, usd: 12500 })
    expect(fmtSignedMoney(all.netWorth, '$')).toBe('−$10,301.95')
  })

  it('toda pantalla con patrimonio usa useNetWorth (no su propio calcNetWorth)', () => {
    for (const f of ['pages/NetWorth/index.jsx', 'pages/Advisor/index.jsx', 'pages/Reports/index.jsx', 'pages/Panorama/AnalysisGrid.jsx']) {
      const s = src(f)
      expect(s, f).toContain("from '../../hooks/useNetWorth.js'")
      expect(s, f).not.toMatch(/calcNetWorth\(/)
    }
  })

  it('Modo Asesor y su PDF formatean el patrimonio con signo', () => {
    expect(src('pages/Advisor/index.jsx')).toContain('fmtSignedMoney(nw.netWorth')
    expect(src('pages/Advisor/ReportePDF.jsx')).toContain('fmtSignedMoney(netWorth.netWorth')
    expect(src('pages/Reports/ReportPDF.jsx')).toMatch(/const fmt = \(n, sym = '\$'\) => fmtSignedMoney/)
  })
})

