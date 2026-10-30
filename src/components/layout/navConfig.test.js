import { describe, it, expect } from 'vitest'
import { activeTabFor, TAB_IDS, NAV, ALL_ITEMS, showProChip } from './navConfig.js'

describe('activeTabFor (R04, L2): cada página enciende una de las 5 pestañas', () => {
  it('Inicio', () => {
    expect(activeTabFor('dashboard')).toBe('dashboard')
    expect(activeTabFor(undefined)).toBe('dashboard')
  })

  it('las páginas de la sección Movimientos encienden Movimientos', () => {
    for (const id of ['movements', 'income', 'recurring', 'import', 'subscriptions']) {
      expect(activeTabFor(id), id).toBe('movements')
    }
  })

  it('Presupuestos y Metas son pestañas propias (L2)', () => {
    expect(activeTabFor('budgets')).toBe('budgets')
    expect(activeTabFor('goals')).toBe('goals')
    expect(TAB_IDS).toEqual(['dashboard', 'movements', 'budgets', 'goals', 'more'])
  })

  it('el resto (Menú, Ajustes, deudas, legales, herramientas de país) enciende Menú', () => {
    for (const id of ['more', 'settings', 'debts', 'coach', 'privacy', 'terms', 'apv', 'steuer']) {
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

describe('menuSections (R11, L2): ningún ítem del NAV queda inalcanzable', () => {
  it('cada ítem sin país es pestaña o está en el Menú, sin repetir las pestañas; Cuenta al final', () => {
    const secs = menuSections('CL')
    expect(secs[0].sec).toBe('nav.sec.planning')
    expect(secs[0].items[0].id).toBe('debts')
    expect(secs[secs.length - 1].sec).toBe('nav.sec.account')
    const ids = secs.flatMap(g => g.items.map(i => i.id))
    for (const it_ of ALL_ITEMS.filter(i => !i.countries)) {
      expect(TAB_IDS.includes(it_.id) || ids.includes(it_.id), it_.id).toBe(true)
    }
    for (const tab of TAB_IDS) expect(ids, tab).not.toContain(tab)
    expect(secs.some(g => g.sec === 'nav.sec.main')).toBe(false)
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

describe('showProChip (ola A3, H22)', () => {
  const pro = { id: 'cashflow', proOnly: true }
  const free = { id: 'income' }
  it('se muestra a Starter y sin licencia', () => {
    expect(showProChip(pro, 'starter')).toBe(true)
    expect(showProChip(pro, undefined)).toBe(true)
  })
  it('se oculta a Pro y Enterprise', () => {
    expect(showProChip(pro, 'pro')).toBe(false)
    expect(showProChip(pro, 'enterprise')).toBe(false)
  })
  it('nunca en ítems gratuitos', () => {
    expect(showProChip(free, 'starter')).toBe(false)
  })
})
