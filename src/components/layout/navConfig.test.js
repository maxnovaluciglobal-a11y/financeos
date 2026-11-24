import { describe, it, expect } from 'vitest'
import { activeTabFor, TAB_IDS, NAV, ALL_ITEMS, showProChip, tabMotion } from './navConfig.js'

describe('activeTabFor (R04, Inicio v2): cada página enciende una de las 3 pestañas', () => {
  it('Inicio', () => {
    expect(activeTabFor('dashboard')).toBe('dashboard')
    expect(activeTabFor(undefined)).toBe('dashboard')
  })

  it('las páginas de la sección Movimientos encienden Movimientos', () => {
    for (const id of ['movements', 'income', 'recurring', 'import', 'subscriptions']) {
      expect(activeTabFor(id), id).toBe('movements')
    }
  })

  it('tres pestañas: Inicio · Movimientos · Más; Presupuestos y Metas encienden Más (Inicio v2)', () => {
    expect(TAB_IDS).toEqual(['dashboard', 'movements', 'more'])
    expect(activeTabFor('budgets')).toBe('more')
    expect(activeTabFor('goals')).toBe('more')
  })

  it('el resto (Más, Ajustes, deudas, Panorama, legales, herramientas de país) enciende Más', () => {
    for (const id of ['more', 'settings', 'debts', 'coach', 'panorama', 'privacy', 'terms', 'apv', 'steuer']) {
      expect(activeTabFor(id), id).toBe('more')
    }
  })

  it('ninguna página del NAV queda sin pestaña', () => {
    for (const it_ of ALL_ITEMS) expect(TAB_IDS).toContain(activeTabFor(it_.id))
  })

  it('Presupuestos y Metas siguen alcanzables: primeras filas de Más en todo país', () => {
    for (const cc of COUNTRIES) expect(moreSections(cc)[0].items.slice(0, 2).map(i => i.id), cc).toEqual(['budgets', 'goals'])
  })

  it('Ajustes sigue alcanzable desde el Menú (vive en NAV)', () => {
    expect(NAV.some(g => g.items.some(i => i.id === 'settings'))).toBe(true)
  })
})

import { moreSections, PANORAMA_PAGES, navItemVisible } from './navConfig.js'

const COUNTRIES = ['CL', 'VE', 'AR', 'MX', 'CO', 'PE', 'EC', 'ES', 'PT', 'DE', 'US']
const flat = (secs) => secs.flatMap(g => g.items.flatMap(i => [i.id, ...(i.items || []).map(x => x.id)]))

describe('"Más" (poda P1, Inicio v2): 4 grupos, ≤ 12 filas, nada inalcanzable', () => {
  it('4 grupos en orden: Mi dinero · Análisis · Herramientas · Cuenta', () => {
    expect(moreSections('CL').map(g => g.sec)).toEqual(['more.sec.money', 'more.sec.panorama', 'nav.sec.tools', 'nav.sec.account'])
    expect(moreSections('CL')[0].items.map(i => i.id)).toEqual(['budgets', 'goals', 'debts', 'recurring', 'income', 'import'])
  })

  it('como mucho 12 filas en cualquier país, con todos los módulos encendidos', () => {
    for (const cc of COUNTRIES) {
      const rows = moreSections(cc, {}).reduce((n, g) => n + g.items.length, 0)
      expect(rows, cc).toBeLessThanOrEqual(12)
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

describe('módulo Inversiones en "Más"', () => {
  const on = { modules: { properties: true, advisor: true, investments: true } }
  const rowsOf = (cc, settings) => moreSections(cc, settings).reduce((n, g) => n + g.items.length, 0)
  const STATES = [true, false].flatMap(p => [true, false].flatMap(a => [true, false].map(i => ({ modules: { properties: p, advisor: a, investments: i } }))))

  it('apagado por defecto: nadie tiene una fila nueva, ni siquiera "Activar más funciones"', () => {
    for (const cc of COUNTRIES) {
      expect(flat(moreSections(cc, {}))).not.toContain('investments')
      expect(flat(moreSections(cc, {}))).not.toContain('modules')
    }
  })
  it('encendido: fila en Herramientas, sin etiqueta PRO', () => {
    const it_ = moreSections('CL', on).find(g => g.sec === 'nav.sec.tools').items.find(i => i.id === 'investments')
    expect(it_).toBeDefined()
    expect(showProChip(it_, 'starter')).toBe(false)
  })
  it('≤ 12 filas en todo país y toda combinación de módulos', () => {
    for (const cc of COUNTRIES) for (const st of STATES) expect(rowsOf(cc, st), `${cc} ${JSON.stringify(st)}`).toBeLessThanOrEqual(12)
  })
  // I-5 (benchmark/05-coherencia-360): un mismo destino no cambia de lugar según el país.
  it('encendido: Inversiones está en Herramientas en TODO país y toda combinación de módulos', () => {
    for (const cc of COUNTRIES) for (const st of STATES.filter(x => x.modules.investments)) {
      const tools = moreSections(cc, st).find(g => g.sec === 'nav.sec.tools').items.map(i => i.id)
      expect(tools, `${cc} ${JSON.stringify(st)}`).toContain('investments')
    }
  })
  it('nada desaparece: cada ítem visible del NAV sigue alcanzable con cualquier combinación de módulos', () => {
    for (const cc of COUNTRIES) for (const st of STATES) {
      const reach = new Set([...TAB_IDS, ...flat(moreSections(cc, st)), ...PANORAMA_PAGES, 'dashboard'])
      for (const it_ of ALL_ITEMS.filter(i => navItemVisible(i, cc, st))) {
        expect(reach.has(it_.id), `${cc} ${JSON.stringify(st)}: ${it_.id}`).toBe(true)
      }
    }
  })
  it('AR con todo encendido: calculadora a un toque, Inflación directa, Modo asesor y Propiedades en "Más herramientas"', () => {
    const tools = moreSections('AR', on).find(g => g.sec === 'nav.sec.tools').items
    expect(tools.map(i => i.id)).toEqual(['multidolar', 'inflacion', 'moreTools', 'investments'])
    const sheet = tools.find(i => i.id === 'moreTools')
    expect(sheet).toMatchObject({ sheet: true, lb: 'more.moreTools', proOnly: true })
    expect(sheet.items.map(i => i.id)).toEqual(['projects', 'advisor'])
    expect(rowsOf('AR', on)).toBe(12)
  })
  it('AR sin Propiedades: Modo asesor y "Activar más funciones" van juntos a la hoja; Inflación sigue directa', () => {
    const st = { modules: { properties: false, advisor: true, investments: true } }
    const tools = moreSections('AR', st).find(g => g.sec === 'nav.sec.tools').items
    expect(tools.map(i => i.id)).toEqual(['multidolar', 'inflacion', 'moreTools', 'investments'])
    expect(tools.find(i => i.id === 'moreTools').items.map(i => i.id)).toEqual(['advisor', 'modules'])
  })
  it('AR: Inflación es fila directa con cualquier combinación de módulos', () => {
    for (const st of STATES) {
      const tools = moreSections('AR', st).find(g => g.sec === 'nav.sec.tools').items.map(i => i.id)
      expect(tools.slice(0, 2), JSON.stringify(st)).toEqual(['multidolar', 'inflacion'])
    }
  })
  it('sin pasarse del tope no se pliega nada: la hoja solo lleva herramientas del país', () => {
    for (const cc of COUNTRIES.filter(c => c !== 'AR')) for (const st of STATES) {
      const tools = moreSections(cc, st).find(g => g.sec === 'nav.sec.tools')?.items || []
      expect(tools.map(i => i.id), cc).not.toContain('moreTools')
      const ids = flat(moreSections(cc, st))
      if (st.modules.advisor) expect(moreSections(cc, st).find(g => g.sec === 'nav.sec.tools').items.map(i => i.id), cc).toContain('advisor')
      expect(ids).toContain('panorama')
    }
  })
  it('el riel de escritorio lo muestra solo encendido', () => {
    const it_ = ALL_ITEMS.find(i => i.id === 'investments')
    expect(navItemVisible(it_, 'AR', on)).toBe(true)
    expect(navItemVisible(it_, 'AR', {})).toBe(false)
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

describe('tabMotion', () => {
  it('desliza hacia el lado de la pestaña tocada', () => {
    expect(tabMotion('dashboard', 'more')).toBe('tab-next')
    expect(tabMotion('more', 'movements')).toBe('tab-prev')
  })
  it('vuelve al fundido sin interruptor o fuera de las pestañas', () => {
    expect(tabMotion('dashboard', 'budgets', false)).toBe('tab')
    expect(tabMotion('dashboard', 'settings')).toBe('tab')
    expect(tabMotion('budgets', 'budgets')).toBe('tab')
  })
})
