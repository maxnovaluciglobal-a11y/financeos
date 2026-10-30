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

  it('el resto (Más, Ajustes, deudas, Panorama, legales, herramientas de país) enciende Más', () => {
    for (const id of ['more', 'settings', 'debts', 'coach', 'panorama', 'privacy', 'terms', 'apv', 'steuer']) {
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

import { moreSections, PANORAMA_PAGES, navItemVisible } from './navConfig.js'

const COUNTRIES = ['CL', 'VE', 'AR', 'MX', 'CO', 'PE', 'EC', 'ES', 'PT', 'DE', 'US']
const flat = (secs) => secs.flatMap(g => g.items.flatMap(i => [i.id, ...(i.items || []).map(x => x.id)]))

describe('"Más" (poda P1): 4 grupos, ≤ 10 filas, nada inalcanzable', () => {
  it('4 grupos en orden: Mi dinero · Análisis · Herramientas · Cuenta', () => {
    expect(moreSections('CL').map(g => g.sec)).toEqual(['more.sec.money', 'more.sec.panorama', 'nav.sec.tools', 'nav.sec.account'])
    expect(moreSections('CL')[0].items.map(i => i.id)).toEqual(['debts', 'recurring', 'income', 'import'])
  })

  it('como mucho 10 filas en cualquier país, con todos los módulos encendidos', () => {
    for (const cc of COUNTRIES) {
      const rows = moreSections(cc, {}).reduce((n, g) => n + g.items.length, 0)
      expect(rows, cc).toBeLessThanOrEqual(10)
    }
  })

  it('cada ítem del NAV de cada país es pestaña, fila, hoja del país, Panorama o Fijos › Suscripciones', () => {
    for (const cc of COUNTRIES) {
      const ids = flat(moreSections(cc, {}))
      const reach = new Set([...TAB_IDS, ...ids, ...PANORAMA_PAGES, 'dashboard'])
      for (const it_ of ALL_ITEMS.filter(i => navItemVisible(i, cc, {}))) {
        expect(reach.has(it_.id), `${cc}:${it_.id}`).toBe(true)
      }
      for (const tab of TAB_IDS) expect(moreSections(cc).flatMap(g => g.items.map(i => i.id)), tab).not.toContain(tab)
    }
  })

  it('varias herramientas del país van en una sola fila con hoja; una sola, directa', () => {
    const cl = moreSections('CL').find(g => g.sec === 'nav.sec.tools').items
    const sheet = cl.find(i => i.id === 'countryTools')
    expect(sheet.sheet).toBe(true)
    expect(sheet.items.map(i => i.id)).toEqual(['hipoteca', 'apv'])
    const de = moreSections('DE').find(g => g.sec === 'nav.sec.tools').items.map(i => i.id)
    expect(de).toContain('steuer')
    expect(de).not.toContain('countryTools')
  })

  it('Cuenta al final: Ajustes', () => {
    const secs = moreSections('CL')
    expect(secs[secs.length - 1].items.map(i => i.id)).toEqual(['settings'])
  })
})

describe('"Más" (R13): calculadora de tasa a un toque en VE/AR', () => {
  it('VE: Multimoneda primera en Herramientas, una sola vez', () => {
    const tools = moreSections('VE').find(g => g.sec === 'nav.sec.tools').items
    expect(tools[0]).toMatchObject({ id: 'multimoneda', lb: 'refcur.tool', tool: true, proOnly: true })
    expect(flat(moreSections('VE')).filter(id => id === 'multimoneda')).toHaveLength(1)
  })
  it('AR: Dólar y rendimientos primero; Inflación directa', () => {
    const tools = moreSections('AR').find(g => g.sec === 'nav.sec.tools').items.map(i => i.id)
    expect(tools.slice(0, 2)).toEqual(['multidolar', 'inflacion'])
  })
  it('fuera de VE/AR no hay calculadora de tasa', () => {
    for (const cc of ['CL', 'DE', 'MX']) expect(flat(moreSections(cc)).some(id => id === 'multimoneda' || id === 'multidolar')).toBe(false)
  })
})

describe('módulos que se activan (poda P3) en "Más" y el riel', () => {
  const fresh = { modules: { properties: false, advisor: false } }
  it('apagados: no ocupan fila y aparece "Activar más funciones"', () => {
    const ids = flat(moreSections('CL', fresh))
    expect(ids).not.toContain('projects')
    expect(ids).not.toContain('advisor')
    expect(ids).toContain('modules')
    expect(navItemVisible(ALL_ITEMS.find(i => i.id === 'projects'), 'CL', fresh)).toBe(false)
  })
  it('una cuenta existente (sin `modules`) los ve sin la fila de activar', () => {
    const ids = flat(moreSections('CL', {}))
    expect(ids).toContain('projects')
    expect(ids).toContain('advisor')
    expect(ids).not.toContain('modules')
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
