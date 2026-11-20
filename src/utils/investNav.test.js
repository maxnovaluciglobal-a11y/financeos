import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  INVEST_TABS, initialTab, tabFromOpen, tabFromSearch, tabKeyTarget, normAssetTicker, bootTab, rememberTab,
  openAsset, currentAssetTicker, TAB_KEY, ASSET_PAGE, __resetInvestNav,
} from './investNav.js'
import { pageFromSearch } from './deepLink.js'

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m } }
function fakeHistory() {
  const h = { state: null, replaceState: vi.fn((s) => { h.state = s }) }
  return h
}

describe('pestañas de Inversiones', () => {
  it('son las 5 del plan, en orden', () => {
    expect(INVEST_TABS).toEqual(['hoy', 'portafolio', 'lista', 'planificar', 'mercado'])
  })
  it('orden de la pestaña inicial: historial → enlace → guardada → Hoy', () => {
    expect(initialTab({ state: { invTab: 'lista' }, linkTab: 'mercado', saved: 'hoy' })).toBe('lista')
    expect(initialTab({ state: { invTab: 'x' }, linkTab: 'mercado', saved: 'hoy' })).toBe('mercado')
    expect(initialTab({ saved: 'planificar' })).toBe('planificar')
    expect(initialTab({ saved: 'otra' })).toBe('hoy')
    expect(initialTab()).toBe('hoy')
  })
  it('enlaces ?open=invest-<pestaña> abren Inversiones en esa pestaña', () => {
    for (const t of INVEST_TABS) {
      expect(tabFromOpen(`invest-${t}`)).toBe(t)
      expect(pageFromSearch(`?open=invest-${t}`)).toBe('investments')
    }
    expect(pageFromSearch('?open=invest')).toBe('investments')
    expect(tabFromOpen('invest-otra')).toBeNull()
    expect(tabFromSearch('?open=invest-lista&ref=x')).toBe('lista')
    expect(tabFromSearch('?open=import')).toBeNull()
    expect(pageFromSearch('?open=invest-otra')).toBeNull()
  })
  it('flechas, Inicio y Fin recorren las pestañas en círculo', () => {
    expect(tabKeyTarget('ArrowRight', 'mercado')).toBe('hoy')
    expect(tabKeyTarget('ArrowLeft', 'hoy')).toBe('mercado')
    expect(tabKeyTarget('Home', 'lista')).toBe('hoy')
    expect(tabKeyTarget('End', 'lista')).toBe('mercado')
    expect(tabKeyTarget('a', 'lista')).toBeNull()
  })
})

describe('historial y ficha del activo', () => {
  beforeEach(() => { __resetInvestNav(); globalThis.history = fakeHistory() })

  it('la pestaña queda en la entrada del historial y en la clave de la cuenta', () => {
    globalThis.history.state = { fosPage: 'investments', fosDepth: 1 }
    const s = mem()
    rememberTab('lista', s)
    expect(globalThis.history.state).toEqual({ fosPage: 'investments', fosDepth: 1, invTab: 'lista' })
    expect(s.m.get(TAB_KEY)).toBe('lista')
    expect(TAB_KEY.startsWith('fos_')).toBe(true)
    rememberTab('nada', s)
    expect(s.m.get(TAB_KEY)).toBe('lista')
  })
  it('el enlace manda una sola vez por carga', () => {
    expect(bootTab({ search: '?open=invest-mercado', storage: mem() })).toBe('mercado')
    expect(bootTab({ search: '?open=invest-mercado', storage: mem() })).toBe('hoy')
  })
  it('openAsset empuja la ficha y anota el ticker en esa entrada (no en el dispositivo)', () => {
    const setPage = vi.fn((p) => { globalThis.history.state = { fosPage: p, fosDepth: 2, fosFrom: 'investments' } })
    globalThis.window = { dispatchEvent: vi.fn() }
    globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail } }
    expect(openAsset(setPage, ' aapl ')).toBe(true)
    expect(setPage).toHaveBeenCalledWith(ASSET_PAGE)
    expect(globalThis.history.state).toMatchObject({ fosPage: ASSET_PAGE, invTicker: 'AAPL' })
    expect(currentAssetTicker()).toBe('AAPL')
    expect(openAsset(setPage, 'no válido')).toBe(false)
    delete globalThis.window
    delete globalThis.CustomEvent
  })
  it('normAssetTicker valida como la API', () => {
    expect(normAssetTicker('^gspc')).toBe('^GSPC')
    expect(normAssetTicker('<b>')).toBeNull()
  })
})
