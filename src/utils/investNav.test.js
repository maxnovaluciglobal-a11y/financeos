import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  INVEST_TABS, PORT_TABS, PORT_TAB_KEY, bootPortTab, rememberPortTab, queueInvestTab, initialTab, tabFromOpen, tabFromSearch, tabKeyTarget, normAssetTicker, bootTab, rememberTab,
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
  it('sub-pestañas de Portafolio: historial → guardada → Posiciones', () => {
    globalThis.history = fakeHistory()
    expect(PORT_TABS).toEqual(['posiciones', 'movimientos', 'dividendos', 'objetivos'])
    const s = mem()
    expect(bootPortTab({ storage: s })).toBe('posiciones')
    rememberPortTab('dividendos', s)
    expect(s.m.get(PORT_TAB_KEY)).toBe('dividendos')
    expect(PORT_TAB_KEY.startsWith('fos_')).toBe(true)
    expect(bootPortTab({ storage: mem() })).toBe('dividendos') // de la entrada del historial
    globalThis.history = fakeHistory()
    expect(bootPortTab({ storage: s })).toBe('dividendos')
    rememberPortTab('x', s)
    expect(s.m.get(PORT_TAB_KEY)).toBe('dividendos')
  })
  it('un destino pedido desde otra pantalla se usa una sola vez y gana', () => {
    globalThis.history = fakeHistory()
    globalThis.history.state = { invTab: 'lista' }
    queueInvestTab('portafolio', 'movimientos')
    expect(bootTab({ search: '', storage: mem() })).toBe('portafolio')
    expect(bootPortTab({ storage: mem() })).toBe('movimientos')
    expect(bootPortTab({ storage: mem() })).toBe('posiciones')
    queueInvestTab('nada')
    expect(bootTab({ search: '', storage: mem() })).toBe('portafolio') // ya quedó en el historial
  })
})

describe('enlace que vuelve de OAuth o del correo', () => {
  it('bootTab lee la search que resolvió initialSearch al arrancar', async () => {
    __resetInvestNav()
    globalThis.history = fakeHistory()
    const deepLink = await import('./deepLink.js')
    const store = { ...mem(), removeItem: () => {} }
    const m = mem(); store.getItem = m.getItem; store.setItem = m.setItem
    deepLink.stashOpenForOAuth('?open=invest-lista', store, 1000)
    // La vuelta de Google llega sin la query; initialSearch recupera el destino.
    expect(deepLink.initialSearch('', store, 2000, { local: mem(), hash: '' })).toBe('?open=invest-lista')
    expect(bootTab({ storage: mem() })).toBe('lista')
  })
})
