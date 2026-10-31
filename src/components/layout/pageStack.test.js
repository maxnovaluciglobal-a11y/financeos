import { describe, it, expect } from 'vitest'
import { tabPress, chromeFor, navAction, bootEntries, backAction, backTarget, isRootPage, isStackState } from './pageStack.js'
import { ALL_ITEMS, TAB_IDS } from './navConfig.js'

// Todas las páginas que App.jsx / DemoShell.jsx saben dibujar (renderPage).
const ALL_PAGES = [
  'dashboard', 'income', 'budgets', 'debts', 'goals', 'projects', 'networth', 'cashflow', 'reports',
  'settings', 'privacy', 'terms', 'license', 'disclaimer', 'advisor', 'subscriptions', 'coach', 'apv',
  'hipoteca', 'ppr', 'deducciones', 'ahorrofiscal', 'inflacion', 'resico', 'multidolar', 'irpfes', 'irspt',
  'multimoneda', 'steuer', 'movements', 'recurring', 'import', 'more',
]

describe('chromeFor (R14): qué páginas llevan barra, "‹" y "+"', () => {
  it('solo Inicio, Movimientos y Menú muestran la barra, sin "‹"', () => {
    for (const p of ['dashboard', 'movements', 'budgets', 'goals', 'more']) {
      const c = chromeFor(p)
      expect(c.tabBar, p).toBe(true)
      expect(c.back, p).toBe(false)
      expect(c.fab, p).toBe(true)
    }
  })

  it('toda otra página se abre empujada: sin barra y con "‹"', () => {
    for (const p of ALL_PAGES.filter(p => !TAB_IDS.includes(p))) {
      const c = chromeFor(p)
      expect(c.tabBar, p).toBe(false)
      expect(c.back, p).toBe(true)
      expect(TAB_IDS, p).toContain(c.parent)
    }
  })

  it('cada ítem del Menú (NAV) que no es raíz vuelve a una raíz', () => {
    for (const it_ of ALL_ITEMS.filter(i => !TAB_IDS.includes(i.id))) {
      expect(chromeFor(it_.id).back, it_.id).toBe(true)
    }
  })

  it('el "+" solo queda en las secundarias de registrar movimientos (Ingresos)', () => {
    expect(chromeFor('income').fab).toBe(true)
    for (const p of ['debts', 'reports', 'settings', 'recurring', 'import', 'subscriptions', 'privacy', 'multimoneda']) {
      expect(chromeFor(p).fab, p).toBe(false)
    }
  })

  it('la raíz de origen por defecto sigue activeTabFor (R04)', () => {
    expect(chromeFor('debts').parent).toBe('more')
    expect(chromeFor('settings').parent).toBe('more')
    expect(chromeFor('income').parent).toBe('movements')
    expect(chromeFor('recurring').parent).toBe('movements')
  })
})

describe('navAction: qué se apila en el historial', () => {
  it('cambiar de pestaña reemplaza (las pestañas no se apilan)', () => {
    expect(navAction('dashboard', 'more')).toBe('replace')
    expect(navAction('more', 'movements')).toBe('replace')
  })
  it('abrir una pantalla apila', () => {
    expect(navAction('more', 'debts')).toBe('push')
    expect(navAction('dashboard', 'reports')).toBe('push')
    expect(navAction('debts', 'settings')).toBe('push')
    expect(navAction('budgets', 'goals')).toBe('replace')
  })
  it('ir a una raíz desde una pantalla empujada también apila (sidebar, enlaces internos)', () => {
    expect(navAction('debts', 'dashboard')).toBe('push')
  })
  it('misma página o destino vacío: nada', () => {
    expect(navAction('goals', 'goals')).toBe('none')
    expect(navAction('goals', undefined)).toBe('none')
  })
})

describe('bootEntries: abrir directo (enlace o página restaurada)', () => {
  it('una raíz abre una sola entrada', () => {
    expect(bootEntries('movements')).toEqual([{ fosPage: 'movements', fosDepth: 0 }])
    expect(bootEntries(undefined)[0].fosPage).toBe('dashboard')
  })
  it('una secundaria siembra su raíz debajo, así atrás no sale de la app', () => {
    expect(bootEntries('debts')).toEqual([
      { fosPage: 'more', fosDepth: 0 },
      { fosPage: 'debts', fosDepth: 1, fosFrom: 'more' },
    ])
  })
})

describe('backAction / backTarget', () => {
  it('con una entrada propia debajo usa history.back()', () => {
    expect(backAction({ fosPage: 'debts', fosDepth: 1 }, 'debts')).toEqual({ type: 'history' })
  })
  it('sin historial (estado perdido) reemplaza por la raíz', () => {
    expect(backAction(null, 'debts')).toEqual({ type: 'replace', page: 'more' })
    expect(backAction({ fosPage: 'debts', fosDepth: 0 }, 'debts')).toEqual({ type: 'replace', page: 'more' })
    expect(backAction({ fosPage: 'reports', fosDepth: 3 }, 'debts')).toEqual({ type: 'replace', page: 'more' })
  })
  it('"‹" dice de dónde viniste (Inicio → Presupuestos vuelve a Inicio)', () => {
    expect(backTarget({ fosPage: 'reports', fosDepth: 1, fosFrom: 'dashboard' }, 'reports')).toBe('dashboard')
    expect(backTarget({ fosPage: 'debts', fosDepth: 1 }, 'debts')).toBe('more')
    expect(backTarget(null, 'income')).toBe('movements')
    expect(backTarget({ fosPage: 'more', fosDepth: 0 }, 'more')).toBe(null)
  })
  it('isRootPage / isStackState', () => {
    expect(isRootPage('more')).toBe(true)
    expect(isRootPage('goals')).toBe(true)
    expect(isRootPage('budgets')).toBe(true)
    expect(isRootPage('debts')).toBe(false)
    expect(isStackState({ fosPage: 'goals' })).toBe(true)
    expect(isStackState({ usr: 1 })).toBe(false)
    expect(isStackState(null)).toBe(false)
  })
})

describe('tabPress (causa 11)', () => {
  it('la pestaña activa sube al inicio; otra, navega', () => {
    expect(tabPress('movements', 'movements')).toBe('top')
    expect(tabPress('dashboard', 'movements')).toBe('go')
  })
})
