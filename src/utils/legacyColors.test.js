// Colores guardados con la marca anterior (Entrega 1 del rebranding): se
// convierten al leer, al importar un respaldo y al recibir el sync, sin migrar
// la base. Los valores por defecto del código ya son de la paleta nueva.
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LEGACY_COLOR_MAP, convertLegacyColor, convertColorList, convertLegacyColorPayload } from './legacyColors.js'
import { TOKENS_LIGHT } from '../styles/tokens.js'

const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)) },
  removeItem: (k) => { mem.delete(k) },
  key: (i) => [...mem.keys()][i] ?? null,
  get length() { return mem.size },
  clear: () => mem.clear(),
}

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..')
const NAVY = '#14213D', LATON = '#B8863B'

describe('convertLegacyColor', () => {
  it('Navy y Latón pasan a morado 700 y ámbar 600', () => {
    expect(convertLegacyColor(NAVY)).toBe('#3C2282')
    expect(convertLegacyColor(LATON)).toBe('#B07414')
  })
  it('acepta minúsculas, espacios y hex de 3 dígitos equivalentes', () => {
    expect(convertLegacyColor(' #14213d ')).toBe('#3C2282')
  })
  it('un color nuevo, desconocido o ausente queda igual (idempotente)', () => {
    expect(convertLegacyColor('#3C2282')).toBe('#3C2282')
    expect(convertLegacyColor('#123456')).toBe('#123456')
    expect(convertLegacyColor(undefined)).toBe(undefined)
    expect(convertLegacyColor(null)).toBe(null)
    for (const v of Object.values(LEGACY_COLOR_MAP)) expect(convertLegacyColor(v)).toBe(v)
  })
  it('todo destino del mapa es un color de la paleta nueva', () => {
    const palette = new Set(Object.values(TOKENS_LIGHT).map((h) => h.toUpperCase()))
    for (const [from, to] of Object.entries(LEGACY_COLOR_MAP)) expect(palette.has(to), `${from} → ${to}`).toBe(true)
  })
})

describe('convertColorList / convertLegacyColorPayload', () => {
  it('convierte solo las metas con color viejo y conserva el resto del registro', () => {
    const goals = [
      { id: 'g1', name: 'Fondo', color: LATON, saved: 10 },
      { id: 'g2', name: 'Viaje', color: '#3C2282' },
      { id: 'g3', name: 'Sin color' },
    ]
    const { list, changed } = convertColorList(goals)
    expect(list[0]).toEqual({ id: 'g1', name: 'Fondo', color: '#B07414', saved: 10 })
    expect(list[1]).toBe(goals[1])
    expect(list[2]).toBe(goals[2])
    expect(changed).toHaveLength(1)
    expect(goals[0].color).toBe(LATON) // no muta la entrada
  })
  it('sin nada que cambiar devuelve la misma lista y el mismo payload', () => {
    const goals = [{ id: 'g', color: '#3C2282' }]
    expect(convertColorList(goals).list).toBe(goals)
    const data = { goals, incomes: [] }
    expect(convertLegacyColorPayload(data)).toBe(data)
    expect(convertLegacyColorPayload(null)).toBe(null)
    expect(convertLegacyColorPayload({ incomes: [] })).toEqual({ incomes: [] })
  })
})

describe('importar un respaldo o un blob del sync (importAllData)', () => {
  let db, conn
  beforeAll(async () => {
    db = await import('../core/db/index.js')
    conn = await db.getDB()
  })
  it('las metas entran con el color nuevo', async () => {
    await db.importAllData({
      incomes: [], expenses: [], budgets: [], debts: [], subscriptions: [],
      goals: [{ id: 'g1', name: 'Fondo', target: 100, saved: 0, color: LATON }, { id: 'g2', name: 'Viaje', target: 50, saved: 0, color: NAVY }],
      settings: {}, version: '1.2',
    })
    const byId = Object.fromEntries((await conn.getAll('goals')).map((g) => [g.id, g.color]))
    expect(byId).toEqual({ g1: '#B07414', g2: '#3C2282' })
  })
})

describe('lectura y valores por defecto', () => {
  it('AppContext convierte las metas al rehidratar desde la base', () => {
    const src = readFileSync(join(SRC, 'context/AppContext.jsx'), 'utf8')
    expect(src).toMatch(/goals:\s*convertColorList\(goals\)\.list/)
  })
  it('el sync entra por importAllData (que convierte)', () => {
    const src = readFileSync(join(SRC, 'core/sync.js'), 'utf8')
    expect(src).toMatch(/importAllData\(remote\.payload\)/)
    expect(readFileSync(join(SRC, 'core/db/index.js'), 'utf8')).toMatch(/convertLegacyColorPayload\(unifyCategoryPayload\(input\)\)/)
  })
  it('ningún valor por defecto del código usa un color viejo', async () => {
    const { buildGoal } = await import('../pages/Goals/goalFlow.js')
    expect(buildGoal({ name: 'x', target: 1 }, { now: 1 }).color).toBe('#3C2282')
    const { CAT_COLORS, SEED_GOALS } = await import('./index.js')
    for (const c of [...Object.values(CAT_COLORS), ...SEED_GOALS.map((g) => g.color)]) expect(convertLegacyColor(c)).toBe(c)
  })
})
