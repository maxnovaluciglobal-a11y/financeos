// C8 de la auditoría de branding (23-nov-2026): en el demo, "Registrar
// operaciones" y "N aportes" abrían invest.moyiq.app/app/, que sin sesión pide
// iniciar sesión. Ahora abren Inversiones dentro de la app. Desde el C6
// (23-nov-2026, invest.moyiq.app/app redirige a la app) vale también con cuenta.
import { describe, it, expect, vi, beforeEach } from 'vitest'
// Textos de Inversiones registrados como al entrar a la sección.
import './i18n/investStrings.js'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

let portfolio = { demo: true, phase: 'ready', snapshot: null, inv: null, rate: null }
vi.mock('../../hooks/useInvestPortfolio.js', () => ({ useInvestPortfolio: () => portfolio }))
vi.mock('../../context/AppContext.jsx', async () => {
  const { createContext } = await import('react')
  return { AppContext: createContext(null), useApp: () => ({ settings: { currency: 'USD', language: 'es', isDemo: true } }) }
})
vi.mock('../../i18n/useT.js', async () => {
  const { translate } = await import('../../i18n/translate.js')
  const useT = () => ({ t: (key, vars) => translate('es', key, vars), lang: 'es' })
  return { useT, useTFor: useT }
})
const { default: Portfolio } = await import('./Portfolio.jsx')
const { translate } = await import('../../i18n/translate.js')

describe('Portfolio en el demo (C8)', () => {
  beforeEach(() => { portfolio = { demo: true, phase: 'ready', snapshot: null, inv: null, rate: null } })

  it('con onOpenHere: botón que se queda en la app, sin enlace a invest.moyiq.app', () => {
    const html = renderToStaticMarkup(createElement(Portfolio, { onOpenHere: () => {} }))
    expect(html).toContain(translate('es', 'invest.port.manageHere'))
    expect(html).not.toMatch(/href="[^"]*invest\.moyiq\.app\/app/)
    expect(html).not.toContain('versión web de Inversiones')
  })

  it('con cuenta (no demo) también se queda en la app (C6)', () => {
    portfolio = { ...portfolio, demo: false }
    const html = renderToStaticMarkup(createElement(Portfolio, { onOpenHere: () => {} }))
    expect(html).toContain(translate('es', 'invest.port.manageHere'))
    expect(html).not.toMatch(/invest\.moyiq\.app\/app/)
  })

  it('sin onOpenHere no hay botón ni enlace al sitio aparte', () => {
    const html = renderToStaticMarkup(createElement(Portfolio))
    expect(html).not.toMatch(/invest\.moyiq\.app\/app/)
    expect(html).not.toContain(translate('es', 'invest.port.manageHere'))
  })
})

describe('ningún enlace de la app lleva a la app de invest.moyiq.app (C8)', () => {
  const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
  it('Portfolio e InvestCard no enlazan a ${INVEST_ORIGIN}/app/', () => {
    for (const src of [read('./Portfolio.jsx'), read('../Panorama/InvestCard.jsx')]) {
      expect(src).not.toMatch(/INVEST_ORIGIN\}\/app/)
    }
  })
  it('Inversiones le pasa onOpenHere a Portfolio siempre (con cuenta y en el demo)', () => {
    const src = read('./index.jsx')
    expect(src).toContain("const openHere = () => { queueInvestTab('portafolio', 'movimientos'); setFull(true) }")
    expect(src).toContain('<Portfolio onOpenHere={openHere} />')
  })
  it('ya no queda el traspaso a invest.moyiq.app/app (openInvest, #aporte=)', () => {
    for (const src of [read('./Portfolio.jsx'), read('../Panorama/InvestCard.jsx'), read('./index.jsx')]) {
      expect(src).not.toMatch(/openInvest|investHandoff|aporteHandoff|#aporte=/)
    }
  })
  it('"Fuentes y licencias" sigue apuntando a invest.moyiq.app/datos-y-licencias.html', () => {
    expect(read('./Portfolio.jsx')).toContain('${INVEST_ORIGIN}/datos-y-licencias.html')
    expect(read('../Panorama/InvestCard.jsx')).toContain('${INVEST_ORIGIN}/datos-y-licencias.html')
  })
})
