import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { es } from '../../i18n/es.js'
import { en } from '../../i18n/en.js'
import { pt } from '../../i18n/pt.js'
import { de } from '../../i18n/de.js'
import { interpolate } from '../../i18n/translate.js'
import {
  SETTINGS_SECTIONS, SETTINGS_GROUPS, GROUP_IDS, CONTROL_MAP, searchSettings,
  subFromState, withSub, SUB_KEY, isGroupId, requestSettingsSub, takePendingSub,
} from './settingsIndex.js'

const here = dirname(fileURLToPath(import.meta.url))
const src = (f) => readFileSync(join(here, f), 'utf8')
const tFor = (d) => (k, v) => interpolate(d[k] ?? es[k] ?? k, v)
const tEs = tFor(es)
const tEn = tFor(en)

describe('Ajustes: grupos (R10)', () => {
  it('las 11 filas (10 de R10 + Funciones de la poda P3), en orden, y cada una en una sola sección', () => {
    expect(GROUP_IDS).toEqual(['profile', 'currency', 'appearance', 'templates', 'features', 'data', 'security', 'notifications', 'plan', 'advanced', 'danger'])
    const inSections = SETTINGS_SECTIONS.flatMap(s => s.groups)
    expect(inSections).toEqual(GROUP_IDS)
  })

  it('título, descripción, palabras clave y ajustes de adentro existen en los 4 idiomas', () => {
    const keys = [
      ...SETTINGS_SECTIONS.map(s => s.title),
      ...SETTINGS_GROUPS.flatMap(g => [g.title, g.desc, g.kw, ...g.items.flatMap(i => [i.label, i.kw].filter(Boolean))]),
    ]
    for (const d of [es, en, pt, de]) for (const k of keys) expect(typeof d[k], k).toBe('string')
  })

  it('cada ajuste de adentro tiene su data-setting en la subpantalla', () => {
    const all = readdirSync(here).filter(f => f.endsWith('.jsx')).map(src).join('\n')
    for (const g of SETTINGS_GROUPS) for (const it of g.items) {
      expect(all.includes(`id="${it.id}"`) || all.includes(`data-setting="${it.id}"`), `${g.id}.${it.id}`).toBe(true)
    }
  })
})

describe('Ajustes: no se pierde ningún control (antes → ahora)', () => {
  it('cada control de la pantalla única sigue en el archivo de su subpantalla', () => {
    for (const [needle, group, file] of CONTROL_MAP) {
      expect(src(file).includes(needle), `${needle} → ${file}`).toBe(true)
      if (group) expect(isGroupId(group), needle).toBe(true)
      if (needle.startsWith('settings.')) expect(typeof es[needle], needle).toBe('string')
    }
  })

  it('cada subpantalla del mapa se monta desde la raíz', () => {
    const root = src('index.jsx')
    for (const id of GROUP_IDS) expect(root.includes(`sub === '${id}'`), id).toBe(true)
  })

  it('ya no quedan <select> nativos en Ajustes', () => {
    for (const f of readdirSync(here).filter(f => f.endsWith('.jsx'))) expect(src(f), f).not.toMatch(/<select\b/)
  })

  it('Zona de riesgo no usa Latón: sus botones son "danger"', () => {
    const d = src('DangerScreen.jsx')
    expect(d).not.toMatch(/variant="primary"/)
    expect(src('DeleteAccountSection.jsx')).not.toMatch(/variant="primary"/)
  })

  it('a lo sumo un primario Latón visible de entrada por subpantalla', () => {
    // Fuera de los flujos abiertos (formularios de frase de paso / PIN), que
    // reemplazan lo que había en ese bloque.
    expect(src('SyncSection.jsx').match(/<Btn variant="primary"(?![^>]*type="submit")/g) || []).toEqual([])
    const sec = src('SecuritySection.jsx').split('function SetupFlow')[0]
    expect(sec.match(/variant="primary"/g) || []).toEqual([])
    expect((src('PlanScreen.jsx') + src('UpgradeCard.jsx')).match(/variant="primary"/g)).toHaveLength(1)
  })
})

describe('searchSettings', () => {
  it('consulta vacía → null (lista normal)', () => {
    expect(searchSettings('', tEs)).toBeNull()
    expect(searchSettings('   ', tEs)).toBeNull()
  })

  it('encuentra la fila por su título, sin tildes ni mayúsculas', () => {
    const r = searchSettings('apariencia', tEs)
    expect(r[0]).toMatchObject({ kind: 'group', groupId: 'appearance' })
    expect(searchSettings('PAIS', tEs)[0]).toMatchObject({ groupId: 'profile' })
  })

  it('encuentra por palabra clave y salta a ajustes de adentro', () => {
    const r = searchSettings('oscuro', tEs)
    expect(r.some(x => x.groupId === 'appearance')).toBe(true)
    const csv = searchSettings('csv', tEs)
    expect(csv.find(x => x.kind === 'item')).toMatchObject({ groupId: 'data', itemId: 'csv' })
    const dual = searchSettings('equivalente usd', tEs)
    expect(dual.some(x => x.kind === 'item' && x.itemId === 'dual')).toBe(true)
  })

  it('todas las palabras tienen que coincidir', () => {
    expect(searchSettings('respaldo zzzz', tEs)).toEqual([])
  })

  it('funciona en el idioma activo', () => {
    expect(searchSettings('dark', tEn).some(x => x.groupId === 'appearance')).toBe(true)
    expect(searchSettings('backup', tEn)[0]).toMatchObject({ groupId: 'data' })
  })

  it('las acciones destructivas se encuentran en Zona de riesgo', () => {
    const r = searchSettings('eliminar cuenta', tEs)
    expect(r[0]).toMatchObject({ groupId: 'danger' })
    expect(r.some(x => x.itemId === 'deleteAccount')).toBe(true)
  })

  it('no repite un ajuste que se llama igual que su fila', () => {
    const r = searchSettings('notificaciones', tEs)
    const ids = r.map(x => `${x.groupId}|${x.itemId || ''}`)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('subpantalla en history.state', () => {
  it('lee solo ids válidos', () => {
    expect(subFromState(null)).toBeNull()
    expect(subFromState({ [SUB_KEY]: 'data' })).toBe('data')
    expect(subFromState({ [SUB_KEY]: 'nada' })).toBeNull()
  })
  it('conserva el estado de pageStack y quita el scroll de la raíz', () => {
    const st = withSub({ fosPage: 'settings', fosDepth: 1, fosScroll: 300 }, 'plan')
    expect(st).toEqual({ fosPage: 'settings', fosDepth: 1, [SUB_KEY]: 'plan' })
    expect(withSub(st, null)).toEqual({ fosPage: 'settings', fosDepth: 1 })
  })
})

describe('abrir una subpantalla desde otra página', () => {
  const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) } }
  it('se consume una sola vez y solo con ids válidos', () => {
    const st = mem()
    requestSettingsSub('plan', st)
    expect(takePendingSub(st)).toBe('plan')
    expect(takePendingSub(st)).toBeNull()
    requestSettingsSub('nada', st)
    expect(takePendingSub(st)).toBeNull()
  })
})
