// Primer arranque: idioma/país/moneda del navegador solo si no hay ajustes
// guardados. Corre contra fake-indexeddb.
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)) },
  removeItem: (k) => { mem.delete(k) },
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size },
  clear: () => mem.clear(),
}

const db = await import('./index.js')

function setNavigator(languages) {
  Object.defineProperty(globalThis, 'navigator', { value: { languages, language: languages[0] }, configurable: true })
}
const realNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator')

beforeEach(async () => { mem.clear(); await db.wipeLocalDevice(); mem.clear() })
afterEach(() => { if (realNav) Object.defineProperty(globalThis, 'navigator', realNav) })

describe('getSettings en el primer arranque', () => {
  it('sin ajustes guardados toma idioma, país y moneda del navegador', async () => {
    setNavigator(['en-US', 'en'])
    const s = await db.getSettings()
    expect(s).toMatchObject({ language: 'en', country: 'US', currency: 'USD' })
  })

  it('de-DE arranca en alemán, Alemania, EUR', async () => {
    setNavigator(['de-DE'])
    expect(await db.getSettings()).toMatchObject({ language: 'de', country: 'DE', currency: 'EUR' })
  })

  it('nunca pisa ajustes guardados', async () => {
    setNavigator(['en-US'])
    await db.saveSettings({ ...db.DEFAULT_SETTINGS, language: 'es', country: 'CL', currency: 'CLP' })
    expect(await db.getSettings()).toMatchObject({ language: 'es', country: 'CL', currency: 'CLP' })
  })

  it('un registro guardado viejo sin país sigue cayendo al default de siempre, no al navegador', async () => {
    setNavigator(['en-US'])
    await db.saveSettings({ language: 'es', currency: 'CLP' })
    expect((await db.getSettings()).country).toBe('CL')
  })
})
