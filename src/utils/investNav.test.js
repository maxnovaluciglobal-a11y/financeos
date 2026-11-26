import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  INVEST_TABS, LEGACY_TABS, normTab, PORT_TABS, PORT_TAB_KEY, bootPortTab, rememberPortTab, queueInvestTab, initialTab, tabFromOpen, tabFromSearch, tabKeyTarget, normAssetTicker, bootTab, rememberTab,
  openAsset, currentAssetTicker, TAB_KEY, ASSET_PAGE, __resetInvestNav,
  assetView, rememberAssetView, ASSET_VIEW_TABS, ASSET_VIEW_RANGES, bootFollowTab, followFromOpen, FOLLOW_TAB_KEY, takeFollowFocus,
} from './investNav.js'
import { pageFromSearch } from './deepLink.js'

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m } }
function fakeHistory() {
  const h = { state: null, replaceState: vi.fn((s) => { h.state = s }) }
  return h
}

describe('pestañas de Inversiones', () => {
  it('son las 5 del plan, en orden (Resumen · Portafolio · Siguiendo · Planificar · Mercado)', () => {
    expect(INVEST_TABS).toEqual(['resumen', 'portafolio', 'siguiendo', 'planificar', 'mercado'])
  })
  it('los nombres viejos (Hoy y Lista) redirigen a los nuevos', () => {
    expect(LEGACY_TABS).toEqual({ hoy: 'resumen', lista: 'siguiendo' })
    expect(normTab('hoy')).toBe('resumen')
    expect(normTab('lista')).toBe('siguiendo')
    expect(normTab('mercado')).toBe('mercado')
    expect(normTab('toString')).toBeNull()
    expect(normTab('otra')).toBeNull()
    expect(initialTab({ state: { invTab: 'hoy' } })).toBe('resumen')
    expect(initialTab({ saved: 'lista' })).toBe('siguiendo')
    expect(tabFromOpen('invest-hoy')).toBe('resumen')
    expect(tabFromOpen('invest-lista')).toBe('siguiendo')
    expect(pageFromSearch('?open=invest-hoy')).toBe('investments')
    expect(pageFromSearch('?open=invest-lista')).toBe('investments')
  })
  it('orden de la pestaña inicial: historial → enlace → guardada → Resumen', () => {
    expect(initialTab({ state: { invTab: 'siguiendo' }, linkTab: 'mercado', saved: 'resumen' })).toBe('siguiendo')
    expect(initialTab({ state: { invTab: 'x' }, linkTab: 'mercado', saved: 'resumen' })).toBe('mercado')
    expect(initialTab({ saved: 'planificar' })).toBe('planificar')
    expect(initialTab({ saved: 'otra' })).toBe('resumen')
    expect(initialTab()).toBe('resumen')
  })
  it('enlaces ?open=invest-<pestaña> abren Inversiones en esa pestaña', () => {
    for (const t of INVEST_TABS) {
      expect(tabFromOpen(`invest-${t}`)).toBe(t)
      expect(pageFromSearch(`?open=invest-${t}`)).toBe('investments')
    }
    expect(pageFromSearch('?open=invest')).toBe('investments')
    expect(tabFromOpen('invest-otra')).toBeNull()
    expect(tabFromSearch('?open=invest-siguiendo&ref=x')).toBe('siguiendo')
    expect(tabFromSearch('?open=import')).toBeNull()
    expect(pageFromSearch('?open=invest-otra')).toBeNull()
  })
  it('flechas, Inicio y Fin recorren las pestañas en círculo', () => {
    expect(tabKeyTarget('ArrowRight', 'mercado')).toBe('resumen')
    expect(tabKeyTarget('ArrowLeft', 'resumen')).toBe('mercado')
    expect(tabKeyTarget('Home', 'siguiendo')).toBe('resumen')
    expect(tabKeyTarget('End', 'siguiendo')).toBe('mercado')
    expect(tabKeyTarget('a', 'siguiendo')).toBeNull()
  })
})

describe('historial y ficha del activo', () => {
  beforeEach(() => { __resetInvestNav(); globalThis.history = fakeHistory() })

  it('la pestaña queda en la entrada del historial y en la clave de la cuenta', () => {
    globalThis.history.state = { fosPage: 'investments', fosDepth: 1 }
    const s = mem()
    rememberTab('siguiendo', s)
    expect(globalThis.history.state).toEqual({ fosPage: 'investments', fosDepth: 1, invTab: 'siguiendo' })
    expect(s.m.get(TAB_KEY)).toBe('siguiendo')
    expect(TAB_KEY.startsWith('fos_')).toBe(true)
    rememberTab('nada', s)
    expect(s.m.get(TAB_KEY)).toBe('siguiendo')
  })
  it('el enlace manda una sola vez por carga', () => {
    expect(bootTab({ search: '?open=invest-mercado', storage: mem() })).toBe('mercado')
    expect(bootTab({ search: '?open=invest-mercado', storage: mem() })).toBe('resumen')
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
  it('la ficha recuerda pestaña y rango en su entrada del historial; ticker nuevo arranca de cero', () => {
    const setPage = vi.fn((p) => { globalThis.history.state = { ...(globalThis.history.state || {}), fosPage: p, fosDepth: 2 } })
    globalThis.window = { dispatchEvent: vi.fn() }
    globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail } }
    openAsset(setPage, 'MSFT', { tab: 'mine' })
    expect(assetView()).toEqual({ tab: 'mine', range: null })
    rememberAssetView({ tab: 'fund', range: '3A' })
    expect(globalThis.history.state).toMatchObject({ invTicker: 'MSFT', invAssetTab: 'fund', invAssetRange: '3A' })
    rememberAssetView({ tab: 'nada', range: '9Z' })
    expect(assetView()).toEqual({ tab: 'fund', range: '3A' })
    openAsset(setPage, 'AAPL', { tab: 'otra' })
    expect(assetView()).toEqual({ tab: null, range: null })
    expect(ASSET_VIEW_TABS).toEqual(['ind', 'fund', 'mine', 'news'])
    expect(ASSET_VIEW_RANGES).toEqual(['1M', '3M', '6M', '1A', '3A'])
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
    globalThis.history.state = { invTab: 'siguiendo' }
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
    deepLink.stashOpenForOAuth('?open=invest-siguiendo', store, 1000)
    // La vuelta de Google llega sin la query; initialSearch recupera el destino.
    expect(deepLink.initialSearch('', store, 2000, { local: mem(), hash: '' })).toBe('?open=invest-siguiendo')
    expect(bootTab({ storage: mem() })).toBe('siguiendo')
  })
})

describe('aviso de una alerta de precio (?open=invest-alertas)', () => {
  beforeEach(() => { __resetInvestNav(); globalThis.history = fakeHistory() })
  it('abre Siguiendo › Mi lista con las alertas a la vista aunque la sub-pestaña guardada sea otra', () => {
    expect(pageFromSearch('?open=invest-alertas')).toBe('investments')
    expect(tabFromOpen('invest-alertas')).toBe('siguiendo')
    expect(followFromOpen('invest-alertas')).toBe('alertas')
    expect(followFromOpen('invest-siguiendo')).toBeNull()
    const st = mem(); st.setItem(FOLLOW_TAB_KEY, 'comparar')
    expect(bootTab({ search: '?open=invest-alertas', storage: mem() })).toBe('siguiendo')
    expect(bootFollowTab({ storage: st })).toBe('lista')
    expect(takeFollowFocus()).toBe('alertas')
    expect(globalThis.history.state).toMatchObject({ invTab: 'siguiendo', invFollow: 'lista' })
  })
  it('una vez por carga; si la entrada del historial ya tiene pestaña, manda esa', () => {
    expect(bootTab({ search: '?open=invest-alertas', storage: mem() })).toBe('siguiendo')
    bootFollowTab({ storage: mem() })
    __resetInvestNav()
    globalThis.history.state = { invTab: 'mercado' }
    expect(bootTab({ search: '?open=invest-alertas', storage: mem() })).toBe('mercado')
    expect(bootFollowTab({ storage: mem() })).toBe('lista')
  })
})
