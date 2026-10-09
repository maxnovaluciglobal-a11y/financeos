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

import { menuSections } from './navConfig.js'

describe('menuSections (R11): el Menú no pierde ningún ítem del NAV', () => {
  it('todos los ítems sin país aparecen, Planificación primero y Cuenta al final', () => {
    const secs = menuSections('CL')
    expect(secs[0].sec).toBe('nav.sec.planning')
    expect(secs[0].items[0].id).toBe('budgets')
    expect(secs[secs.length - 1].sec).toBe('nav.sec.account')
    const ids = secs.flatMap(g => g.items.map(i => i.id))
    for (const it_ of ALL_ITEMS.filter(i => !i.countries)) expect(ids).toContain(it_.id)
  })

  it('las herramientas de país dependen del país', () => {
    const de = menuSections('DE').flatMap(g => g.items.map(i => i.id))
    expect(de).toContain('steuer')
    expect(de).not.toContain('apv')
  })
})

describe('menuSections (R13): calculadora de tasa a un toque en VE/AR', () => {
  it('VE: "Herramientas" primero con Multimoneda, sin repetirla en "Tu país"', () => {
    const secs = menuSections('VE')
    expect(secs[0].sec).toBe('nav.sec.tools')
    expect(secs[0].items).toHaveLength(1)
    expect(secs[0].items[0]).toMatchObject({ id: 'multimoneda', lb: 'refcur.tool', tool: true, proOnly: true })
    const ids = secs.flatMap(g => g.items.map(i => i.id))
    expect(ids.filter(id => id === 'multimoneda')).toHaveLength(1)
  })
  it('AR: Dólar y rendimientos en Herramientas; Inflación sigue en "Tu país"', () => {
    const secs = menuSections('AR')
    expect(secs[0].items[0].id).toBe('multidolar')
    expect(secs.find(g => g.sec === 'nav.sec.country').items.map(i => i.id)).toEqual(['inflacion'])
  })
  it('el resto de países no tiene sección Herramientas', () => {
    for (const cc of ['CL', 'DE', 'MX']) expect(menuSections(cc).some(g => g.sec === 'nav.sec.tools')).toBe(false)
  })
})
