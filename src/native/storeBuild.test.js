// AND-5 (ronda 3): la compilación de las tiendas saca Stripe e Inversiones del bundle.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { STORE_BUILD } from './storeBuild.js'
import config from '../config.js'

describe('compilación de las tiendas', () => {
  it('en la web y en los tests no está activa: la web conserva sus enlaces de pago', () => {
    expect(STORE_BUILD).toBe(false)
    expect(config.pricing.trialCheckoutUrl).toMatch(/^https:\/\/buy\.stripe\.com\//)
  })
  it('vite.config.js define __STORE_BUILD__ desde MOYIQ_STORE_BUILD=1', () => {
    const src = readFileSync(new URL('../../vite.config.js', import.meta.url), 'utf8')
    expect(src).toMatch(/__STORE_BUILD__:\s*JSON\.stringify\(process\.env\.MOYIQ_STORE_BUILD === '1'\)/)
  })
  it('las páginas de Inversiones y los enlaces de Stripe dependen de STORE_BUILD', () => {
    for (const f of ['../App.jsx', '../demo/DemoShell.jsx', '../pages/Settings/InvestScreen.jsx', '../config.js', '../pages/legal/legalMeta.js']) {
      expect(readFileSync(new URL(f, import.meta.url), 'utf8'), f).toContain('STORE_BUILD')
    }
  })
})
