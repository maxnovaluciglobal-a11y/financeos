import { describe, it, expect } from 'vitest'
import { activeTabFor, TAB_IDS, NAV, ALL_ITEMS } from './navConfig.js'

describe('activeTabFor (R04): cada página enciende una de las 3 pestañas', () => {
  it('Inicio', () => {
    expect(activeTabFor('dashboard')).toBe('dashboard')
    expect(activeTabFor(undefined)).toBe('dashboard')
  })

  it('las páginas de la sección Movimientos encienden Movimientos', () => {
    for (const id of ['movements', 'income', 'recurring', 'import', 'subscriptions']) {
      expect(activeTabFor(id), id).toBe('movements')
    }
  })

  it('el resto (Menú, Ajustes, metas, legales, herramientas de país) enciende Menú', () => {
    for (const id of ['more', 'settings', 'goals', 'budgets', 'debts', 'coach', 'privacy', 'terms', 'apv', 'steuer']) {
      expect(activeTabFor(id), id).toBe('more')
    }
  })

  it('ninguna página del NAV queda sin pestaña', () => {
    for (const it_ of ALL_ITEMS) expect(TAB_IDS).toContain(activeTabFor(it_.id))
  })

  it('Ajustes sigue alcanzable desde el Menú (vive en NAV)', () => {
    expect(NAV.some(g => g.items.some(i => i.id === 'settings'))).toBe(true)
  })
})
