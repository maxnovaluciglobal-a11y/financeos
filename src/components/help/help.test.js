// Ayuda en la app (26-nov-2026): contenido en 4 idiomas, objetivos de los
// recorridos, regla de la primera visita, progreso (local + cuenta) y buscador.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { es, en, pt, de } from '../../i18n/withSections.js'
import { es as esMain } from '../../i18n/es.js'
import { en as enMain } from '../../i18n/en.js'
import { pt as ptMain } from '../../i18n/pt.js'
import { de as deMain } from '../../i18n/de.js'
import { PAGE_TOURS } from '../tour/pageTours.js'
import { NAV } from '../layout/navConfig.js'
import { GUIDES, GUIDE_ORDER, guideKeys, guideIdFor, searchGuides, visibleGuides, normalize } from './guides.js'
import { NEWS, visibleNews, unreadCount, newsKeys } from './news.js'
import {
  TOUR_PAGES, TOURS_SEEN_KEY, NEWS_READ_KEY, HELP_DIRTY_KEY,
  parseList, readList, addToList, markSeen, readSeen, shouldOfferTour, isUiBusy,
} from './helpCore.js'
import { pushBackDismiss, _resetBackStack } from '../../native/backStack.js'
import { cleanIds, mergeProgress, rpcRequest, startHelpSync, SAVE_DELAY_MS } from './progressSync.js'

const DICTS = { es, en, pt, de }
const SRC = join(__dirname, '../..')

const memStorage = (init = {}) => {
  const m = new Map(Object.entries(init))
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    _m: m,
  }
}

function files(dir) {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return n === 'node_modules' ? [] : files(p)
    return /\.(jsx?|tsx?)$/.test(n) && !/\.test\./.test(n) ? [p] : []
  })
}

describe('contenido de la ayuda en es, en, pt y de', () => {
  it('cada guía tiene resumen, 2 a 6 pasos, consejos y palabras clave en los 4 idiomas', () => {
    for (const id of Object.keys(GUIDES)) {
      const k = guideKeys(id)
      expect(k.steps.length, id).toBeGreaterThanOrEqual(2)
      expect(k.steps.length, id).toBeLessThanOrEqual(6)
      expect(k.tips.length, id).toBeLessThanOrEqual(3)
      for (const [lang, d] of Object.entries(DICTS)) {
        for (const key of [k.name, k.summary, k.keywords, ...k.steps, ...k.tips]) {
          expect(typeof d[key] === 'string' && d[key].trim().length > 0, `${lang}:${key}`).toBe(true)
        }
      }
    }
  })

  it('no sobran pasos ni consejos sin usar en los diccionarios', () => {
    const used = new Set(Object.keys(GUIDES).flatMap(id => { const k = guideKeys(id); return [k.summary, k.keywords, ...k.steps, ...k.tips] }))
    for (const [lang, d] of Object.entries(DICTS)) {
      const extra = Object.keys(d).filter(key => key.startsWith('help.g.') && !used.has(key))
      expect(extra, lang).toEqual([])
    }
  })

  it('las novedades: 10 a 15, ids únicos, lo más nuevo primero, con título y texto en los 4 idiomas', () => {
    expect(NEWS.length).toBeGreaterThanOrEqual(10)
    expect(NEWS.length).toBeLessThanOrEqual(15)
    expect(new Set(NEWS.map(n => n.id)).size).toBe(NEWS.length)
    const dates = NEWS.map(n => n.date)
    expect([...dates].sort().reverse()).toEqual(dates)
    for (const n of NEWS) {
      expect(n.id).toMatch(/^[a-z0-9][a-z0-9-]{0,63}$/)
      for (const [lang, d] of Object.entries(DICTS)) {
        const k = newsKeys(n.id)
        expect(d[k.title], `${lang}:${k.title}`).toBeTruthy()
        expect(d[k.text], `${lang}:${k.text}`).toBeTruthy()
      }
      if (n.page) expect(n.page === 'help' || NAV.some(g => g.items.some(it => it.id === n.page)), n.page).toBe(true)
    }
  })

  it('las novedades de Pro no salen donde la app no puede anunciar planes; las de Inversiones, solo con la sección', () => {
    expect(visibleNews({ proMarketing: false }).some(n => n.pro)).toBe(false)
    expect(visibleNews({ proMarketing: true }).some(n => n.pro)).toBe(true)
    expect(visibleNews({ investments: false, proMarketing: true }).some(n => n.page === 'investments')).toBe(false)
    expect(unreadCount(NEWS, [NEWS[0].id])).toBe(NEWS.length - 1)
  })

  it('los textos de la ayuda no viven en el diccionario principal (JS inicial)', () => {
    for (const d of [esMain]) {
      expect(Object.keys(d).filter(k => /^(help\.(g|news|panel|prompt)\.|tour\.(home|pano|mov|bud|inc|debt|rec|goals|settings|nw|coach|rep|cf|subs|imp|inv|proj|adv)\.)/.test(k))).toEqual([])
    }
    // Las 3 claves del "?" y del nombre del centro de ayuda sí, en los 4.
    const mains = [esMain, enMain, ptMain, deMain]
    for (const d of mains) for (const k of ['help.button', 'help.buttonUnread', 'help.center.title', 'tour.count']) expect(d[k], k).toBeTruthy()
  })
})

describe('recorridos en todas las pantallas del menú', () => {
  it('TOUR_PAGES (JS inicial) coincide con PAGE_TOURS (diferido)', () => {
    expect([...TOUR_PAGES].sort()).toEqual(Object.keys(PAGE_TOURS).sort())
  })

  it('cada pantalla del menú (salvo las del país) tiene recorrido y guía', () => {
    const country = new Set(NAV.find(g => g.sec === 'nav.sec.country').items.map(it => it.id))
    for (const it of NAV.flatMap(g => g.items)) {
      expect(guideIdFor(it.id), it.id).toBeTruthy()
      if (!country.has(it.id)) expect(PAGE_TOURS[it.id], it.id).toBeTruthy()
      else expect(guideIdFor(it.id)).toBe('country')
    }
    for (const id of GUIDE_ORDER) expect(GUIDES[id], id).toBeTruthy()
  })

  it('cada paso tiene de 1 a 6 pasos y su texto en los 4 idiomas', () => {
    for (const [page, steps] of Object.entries(PAGE_TOURS)) {
      expect(steps.length, page).toBeGreaterThanOrEqual(1)
      expect(steps.length, page).toBeLessThanOrEqual(6)
      for (const st of steps) for (const [lang, d] of Object.entries(DICTS)) {
        expect(d[st.title], `${lang}:${st.title}`).toBeTruthy()
        expect(d[st.body], `${lang}:${st.body}`).toBeTruthy()
      }
    }
  })

  it('cada data-tour que usa un paso existe en el código', () => {
    const src = files(SRC).map(f => readFileSync(f, 'utf8')).join('\n')
    // data-tour="x" o data-tour={cond ? 'x' : undefined}
    const found = new Set([
      ...[...src.matchAll(/data-tour=["']([a-z0-9-]+)["']/g)].map(m => m[1]),
      ...[...src.matchAll(/data-tour=\{[^}]*?'([a-z0-9-]+)'/g)].map(m => m[1]),
    ])
    const missing = Object.values(PAGE_TOURS).flat().map(s => s.id).filter(id => !found.has(id))
    expect(missing).toEqual([])
  })

  it('Shell no importa el recorrido ni el panel de forma estática (JS inicial)', () => {
    const shell = readFileSync(join(SRC, 'components/layout/Shell.jsx'), 'utf8')
    expect(shell).not.toMatch(/^import .*tour\/(Tour|pageTours)/m)
    expect(shell).not.toMatch(/^import .*HelpHost/m)
    expect(shell).toMatch(/lazy\(\(\) => import\('\.\.\/help\/HelpHost\.jsx'\)\)/)
    const core = readFileSync(join(SRC, 'components/help/helpCore.js'), 'utf8')
    expect(core).not.toMatch(/import .*(pageTours|guides|news|progressSync|i18n\/help)/)
  })
})

describe('primera visita: "¿Primera vez en X?"', () => {
  beforeEach(() => _resetBackStack())
  it('se ofrece en una pantalla con recorrido no vista, fuera del demo y sin nada abierto', () => {
    expect(shouldOfferTour({ page: 'budgets', seen: [] })).toBe(true)
    expect(shouldOfferTour({ page: 'budgets', seen: ['budgets'] })).toBe(false)
    expect(shouldOfferTour({ page: 'budgets', seen: [], isDemo: true })).toBe(false)
    expect(shouldOfferTour({ page: 'budgets', seen: [], busy: true })).toBe(false)
    expect(shouldOfferTour({ page: 'help', seen: [] })).toBe(false)
  })
  it('isUiBusy: una hoja registrada en el botón atrás, un diálogo modal o una primera entrada guiada', () => {
    const doc = (sel) => ({ querySelector: (q) => (q === sel ? {} : null) })
    expect(isUiBusy(doc('none'))).toBe(false)
    expect(isUiBusy(doc('[role="dialog"][aria-modal="true"]'))).toBe(true)
    expect(isUiBusy(doc('[data-empty-guided]'))).toBe(true)
    const off = pushBackDismiss(() => {})
    expect(isUiBusy(doc('none'))).toBe(true)
    off()
    expect(isUiBusy(doc('none'))).toBe(false)
  })
})

describe('progreso local', () => {
  it('parseList tolera basura y descarta ids con otro formato', () => {
    expect(parseList('no-json')).toEqual([])
    expect(parseList('{"a":1}')).toEqual([])
    expect(parseList('["dashboard","dashboard","Mal Id",3,"n2611help"]')).toEqual(['dashboard', 'n2611help'])
  })
  it('addToList suma sin repetir, marca pendiente y avisa', () => {
    const st = memStorage()
    expect(markSeen('budgets', st)).toBe(true)
    expect(markSeen('budgets', st)).toBe(false)
    expect(readSeen(st)).toEqual(['budgets'])
    expect(st.getItem(HELP_DIRTY_KEY)).toBe('1')
    addToList(NEWS_READ_KEY, ['n2611help', 'n2411home'], st)
    expect(readList(NEWS_READ_KEY, st)).toEqual(['n2611help', 'n2411home'])
  })
  it('conserva el "visto" que ya existía en fos_tours_seen (R08)', () => {
    const st = memStorage({ [TOURS_SEEN_KEY]: '["dashboard"]' })
    expect(readSeen(st)).toEqual(['dashboard'])
  })
})

describe('progreso en la cuenta (progressSync)', () => {
  it('cleanIds y mergeProgress: unión, sin repetir, y qué falta en cada lado', () => {
    expect(cleanIds(['b', 'a', 'a', 'X', ''])).toEqual(['a', 'b'])
    expect(cleanIds(Array.from({ length: 300 }, (_, i) => `p${i}`))).toHaveLength(200)
    const m = mergeProgress({ tours: ['dashboard'], news: [] }, { tours: ['goals'], news: ['n2611help'] })
    expect(m).toEqual({ tours: ['dashboard', 'goals'], news: ['n2611help'], localChanged: true, needsSave: true })
    expect(mergeProgress({ tours: ['a'], news: [] }, { tours: ['a'], news: [] })).toMatchObject({ localChanged: false, needsSave: false })
    expect(mergeProgress({ tours: [], news: [] }, { tours: ['a'], news: [] })).toMatchObject({ localChanged: true, needsSave: false })
  })

  it('rpcRequest: RPC de la cuenta con keepalive (sobrevive a cerrar la página)', () => {
    const r = rpcRequest({ url: 'https://x.supabase.co/', anonKey: 'anon', token: 'tok', tours: ['b', 'a'], news: [] })
    expect(r.url).toBe('https://x.supabase.co/rest/v1/rpc/merge_help_progress')
    expect(r.init.keepalive).toBe(true)
    expect(r.init.method).toBe('POST')
    expect(r.init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(r.init.body)).toEqual({ p_tours: ['a', 'b'], p_news: [] })
  })

  describe('startHelpSync', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    const makeWin = () => {
      const handlers = {}
      const docHandlers = {}
      return {
        navigator: { onLine: true },
        document: { visibilityState: 'visible', addEventListener: (e, f) => { docHandlers[e] = f }, removeEventListener: () => {} },
        addEventListener: (e, f) => { handlers[e] = f },
        removeEventListener: () => {},
        fire: (e) => handlers[e]?.(),
        fireDoc: (e) => docHandlers[e]?.(),
      }
    }
    const makeClient = (row, error = null) => ({
      auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) },
      from: () => ({ select: () => ({ maybeSingle: async () => ({ data: row, error }) }) }),
    })
    const okFetch = (reply) => vi.fn(async () => ({ ok: true, json: async () => reply }))

    it('trae lo de la cuenta, lo suma a lo local y manda lo que la cuenta no tiene', async () => {
      const storage = memStorage({ [TOURS_SEEN_KEY]: '["dashboard"]' })
      const fetchImpl = okFetch({ tours_seen: ['dashboard', 'goals'], news_read: ['n2611help'] })
      const sync = startHelpSync({ client: makeClient({ tours_seen: ['goals'], news_read: ['n2611help'] }), storage, fetchImpl, win: makeWin(), url: 'https://x', anonKey: 'k' })
      await sync.ready
      expect(readList(TOURS_SEEN_KEY, storage)).toEqual(['dashboard', 'goals'])
      expect(readList(NEWS_READ_KEY, storage)).toEqual(['n2611help'])
      await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 10)
      await sync.inFlight
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      const [, init] = fetchImpl.mock.calls[0]
      expect(init.keepalive).toBe(true)
      expect(JSON.parse(init.body).p_tours).toEqual(['dashboard', 'goals'])
      expect(storage.getItem(HELP_DIRTY_KEY)).toBe(null)
      sync.stop()
    })

    it('si la cuenta ya tiene todo, no manda nada', async () => {
      const storage = memStorage({ [TOURS_SEEN_KEY]: '["goals"]' })
      const fetchImpl = okFetch({})
      const sync = startHelpSync({ client: makeClient({ tours_seen: ['goals'], news_read: [] }), storage, fetchImpl, win: makeWin(), url: 'https://x', anonKey: 'k' })
      await sync.ready
      await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 2)
      expect(fetchImpl).not.toHaveBeenCalled()
      sync.stop()
    })

    it('un cambio local se agrupa y, si la página se oculta antes, se manda en ese momento', async () => {
      const storage = memStorage()
      const win = makeWin()
      const fetchImpl = okFetch({ tours_seen: ['budgets'], news_read: [] })
      const sync = startHelpSync({ client: makeClient(null), storage, fetchImpl, win, url: 'https://x', anonKey: 'k' })
      await sync.ready
      markSeen('budgets', storage)
      win.fire('fos:help-progress')
      win.document.visibilityState = 'hidden'
      win.fireDoc('visibilitychange')
      await sync.inFlight
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      expect(fetchImpl.mock.calls[0][1].keepalive).toBe(true)
      await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 2)
      expect(fetchImpl).toHaveBeenCalledTimes(1) // el temporizador ya no manda de nuevo
      sync.stop()
    })

    it('sin red o con error queda pendiente y se manda al volver la red', async () => {
      const storage = memStorage({ [TOURS_SEEN_KEY]: '["budgets"]', [HELP_DIRTY_KEY]: '1' })
      const win = makeWin()
      win.navigator.onLine = false
      const fetchImpl = okFetch({ tours_seen: ['budgets'], news_read: [] })
      const sync = startHelpSync({ client: makeClient(null), storage, fetchImpl, win, url: 'https://x', anonKey: 'k' })
      await sync.ready
      await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 10)
      expect(fetchImpl).not.toHaveBeenCalled()
      expect(storage.getItem(HELP_DIRTY_KEY)).toBe('1')
      win.navigator.onLine = true
      win.fire('online')
      await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 10)
      await sync.inFlight
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      expect(storage.getItem(HELP_DIRTY_KEY)).toBe(null)
      sync.stop()
    })

    it('una respuesta con error deja la marca de pendiente', async () => {
      const storage = memStorage({ [TOURS_SEEN_KEY]: '["budgets"]', [HELP_DIRTY_KEY]: '1' })
      const fetchImpl = vi.fn(async () => ({ ok: false, json: async () => ({}) }))
      const sync = startHelpSync({ client: makeClient(null), storage, fetchImpl, win: makeWin(), url: 'https://x', anonKey: 'k' })
      await sync.ready
      await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 10)
      await sync.inFlight
      expect(fetchImpl).toHaveBeenCalledTimes(1)
      expect(storage.getItem(HELP_DIRTY_KEY)).toBe('1')
      sync.stop()
    })

    it('sin sesión no lee ni escribe la cuenta', async () => {
      const storage = memStorage({ [TOURS_SEEN_KEY]: '["budgets"]', [HELP_DIRTY_KEY]: '1' })
      const fetchImpl = okFetch({})
      const from = vi.fn()
      const client = { auth: { getSession: async () => ({ data: { session: null } }) }, from }
      const sync = startHelpSync({ client, storage, fetchImpl, win: makeWin(), url: 'https://x', anonKey: 'k' })
      await sync.ready
      await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS * 2)
      expect(from).not.toHaveBeenCalled()
      expect(fetchImpl).not.toHaveBeenCalled()
      sync.stop()
    })
  })

  it('el demo nunca arranca la sincronización (useHelp)', () => {
    const src = readFileSync(join(SRC, 'components/help/useHelp.js'), 'utf8')
    expect(src).toMatch(/if \(isDemo\) \{ markHelpSyncReady\(\); return \}/)
  })
})

describe('buscador del centro de ayuda', () => {
  const t = (k) => es[k] ?? k
  it('normalize quita tildes y mayúsculas', () => {
    expect(normalize('  Depósito  ÚNICO ')).toBe('deposito unico')
  })
  it('encuentra por nombre, por palabras clave y sin tildes', () => {
    expect(searchGuides(GUIDE_ORDER, 'metas', t)[0]).toBe('goals')
    expect(searchGuides(GUIDE_ORDER, 'respaldo', t)[0]).toBe('settings')
    expect(searchGuides(GUIDE_ORDER, 'cartola', t)).toContain('import')
    expect(searchGuides(GUIDE_ORDER, 'suscripcion', t)[0]).toBe('subscriptions')
  })
  it('todas las palabras tienen que aparecer; sin resultados devuelve vacío', () => {
    expect(searchGuides(GUIDE_ORDER, 'tarjeta préstamo', t)).toEqual(['debts'])
    expect(searchGuides(GUIDE_ORDER, 'zzzz', t)).toEqual([])
    expect(searchGuides(GUIDE_ORDER, '', t)).toEqual(GUIDE_ORDER)
  })
  it('funciona en los otros idiomas', () => {
    expect(searchGuides(GUIDE_ORDER, normalize(de['nav.goals']), (k) => de[k] ?? k)[0]).toBe('goals')
    expect(searchGuides(GUIDE_ORDER, normalize(en['nav.budgets']), (k) => en[k] ?? k)[0]).toBe('budgets')
  })
  it('visibleGuides: herramientas del país e Inversiones solo si el menú las muestra', () => {
    expect(visibleGuides('AR', {})).toContain('country')
    expect(visibleGuides('XX', {})).not.toContain('country')
    expect(visibleGuides('CL', { modules: { investments: false } })).not.toContain('investments')
  })
  it('el centro de ayuda está en todas las rutas de la app (App y demo)', () => {
    for (const f of ['App.jsx', 'demo/DemoShell.jsx']) {
      expect(readFileSync(join(SRC, f), 'utf8'), f).toMatch(/case 'help':\s+return <HelpCenter/)
    }
    expect(relative(SRC, join(SRC, 'pages/Help/index.jsx'))).toBe('pages/Help/index.jsx')
  })
})

describe('paridad de los textos de la ayuda (sección src/i18n/help/)', () => {
  it('los 4 idiomas tienen las mismas claves y las mismas variables {x}, sin exclamaciones', async () => {
    const [hes, hen, hpt, hde] = await Promise.all(['es', 'en', 'pt', 'de'].map(l => import(`../../i18n/help/strings.${l}.js`).then(m => m.default)))
    const keys = Object.keys(hes).sort()
    const vars = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',')
    for (const d of [hen, hpt, hde]) {
      expect(Object.keys(d).sort()).toEqual(keys)
      for (const k of keys) {
        expect(vars(d[k]), k).toBe(vars(hes[k]))
        expect(String(d[k]), k).not.toMatch(/[¡!]/)
      }
    }
    for (const k of keys) expect(String(hes[k]), k).not.toMatch(/[¡!]/)
  })
})

describe('política de privacidad (app)', () => {
  it('declara el progreso de la ayuda en los 4 idiomas, sin datos financieros y con borrado al eliminar la cuenta', () => {
    const src = readFileSync(join(SRC, 'pages/legal/privacyContent.jsx'), 'utf8')
    for (const label of ['Progreso de la ayuda:', 'Help progress:', 'Progresso da ajuda:', 'Fortschritt der Hilfe:']) expect(src).toContain(label)
    for (const s of ['sin datos financieros', 'no financial data', 'sem dados financeiros', 'keine Finanzdaten']) expect(src).toContain(s)
  })
})

describe('cuentas de antes de la ayuda: sin "¿Primera vez…?" (decisión del 26-nov)', () => {
  it('isPreReleaseAccount: creada antes del cierre del día del despliegue', async () => {
    const { isPreReleaseAccount, HELP_RELEASE_AT } = await import('./helpCore.js')
    expect(HELP_RELEASE_AT).toBe('2026-11-27T03:00:00Z')
    expect(isPreReleaseAccount('2026-10-01T10:00:00Z')).toBe(true)
    expect(isPreReleaseAccount('2026-11-26T20:00:00-03:00')).toBe(true)
    expect(isPreReleaseAccount('2026-11-28T09:00:00Z')).toBe(false)
    expect(isPreReleaseAccount(null)).toBe(false)
    expect(isPreReleaseAccount('basura')).toBe(false)
  })

  it('initHelpDevice: con datos de antes en el dispositivo, todos los recorridos vistos; una sola vez', async () => {
    const { initHelpDevice, HELP_INIT_KEY } = await import('./helpCore.js')
    const old = memStorage({ fos_release_seen: '2026-11-18' })
    expect(initHelpDevice(old)).toBe(true)
    expect([...readSeen(old)].sort()).toEqual([...TOUR_PAGES].sort())
    expect(old.getItem(HELP_INIT_KEY)).toBe('1')
    expect(readList(NEWS_READ_KEY, old)).toEqual([]) // las novedades siguen sin leer
    const oldTour = memStorage({ [TOURS_SEEN_KEY]: '["dashboard"]' })
    expect(initHelpDevice(oldTour)).toBe(true)
    expect(readSeen(oldTour)).toHaveLength(TOUR_PAGES.length)
  })

  it('initHelpDevice: cuenta o dispositivo nuevo conserva la pregunta, y no se repite el chequeo', async () => {
    const { initHelpDevice } = await import('./helpCore.js')
    const fresh = memStorage()
    expect(initHelpDevice(fresh)).toBe(false)
    expect(readSeen(fresh)).toEqual([])
    expect(shouldOfferTour({ page: 'movements', seen: readSeen(fresh) })).toBe(true)
    // La hoja de Novedades marca su clave después: no convierte a la cuenta en "vieja".
    fresh.setItem('fos_release_seen', '2026-11-18')
    expect(initHelpDevice(fresh)).toBe(false)
    expect(readSeen(fresh)).toEqual([])
  })

  it('helpSyncReady: false si la cuenta no respondió a tiempo (no se pregunta esa vez)', async () => {
    const { helpSyncReady, markHelpSyncReady, _resetHelpSync } = await import('./helpCore.js')
    _resetHelpSync()
    expect(await helpSyncReady(10)).toBe(false)
    markHelpSyncReady()
    expect(await helpSyncReady(10)).toBe(true)
  })

  describe('progressSync con el usuario de la sesión', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())
    const win = () => ({ navigator: { onLine: true }, document: { addEventListener() {}, removeEventListener() {} }, addEventListener() {}, removeEventListener() {} })
    const client = (createdAt) => ({
      auth: { getSession: async () => ({ data: { session: { access_token: 'tok', user: { id: 'u', created_at: createdAt } } } }) },
      from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    })
    it('cuenta creada antes del lanzamiento: todo visto en este dispositivo y se guarda en la cuenta', async () => {
      const storage = memStorage()
      const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({}) }))
      const sync = startHelpSync({ client: client('2026-09-12T12:00:00Z'), storage, fetchImpl, win: win(), url: 'https://x', anonKey: 'k' })
      await sync.ready
      expect(readSeen(storage)).toHaveLength(TOUR_PAGES.length)
      expect(readList(NEWS_READ_KEY, storage)).toEqual([])
      await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS + 10)
      await sync.inFlight
      expect(JSON.parse(fetchImpl.mock.calls[0][1].body).p_tours).toHaveLength(TOUR_PAGES.length)
      sync.stop()
    })
    it('cuenta nueva: nada marcado, la primera visita pregunta', async () => {
      const storage = memStorage()
      const sync = startHelpSync({ client: client('2026-12-01T12:00:00Z'), storage, fetchImpl: vi.fn(), win: win(), url: 'https://x', anonKey: 'k' })
      await sync.ready
      expect(readSeen(storage)).toEqual([])
      sync.stop()
    })
  })
})

describe('el "?" en la cabecera del Inicio del teléfono', () => {
  it('InicioScene muestra el botón de ayuda que abre el panel del Inicio, oculto en escritorio', () => {
    const src = readFileSync(join(SRC, 'pages/Dashboard/lupa/InicioScene.jsx'), 'utf8')
    expect(src).toMatch(/<HelpButton id="fos-help-btn-home"[^\n]*openHelp\('dashboard'\)/)
    const css = readFileSync(join(SRC, 'pages/Dashboard/lupa/scene.module.css'), 'utf8')
    expect(css).toMatch(/\.helpBtn \{[^}]*width: 44px; height: 44px/)
    expect(css).toMatch(/@media \(min-width: 701px\) \{ \.helpBtn \{ display: none; \} \}/)
  })
})

describe('demo: el progreso no toca la cuenta real', () => {
  it('en el demo se guarda en sessionStorage y no en localStorage', async () => {
    const mk = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) } }
    const ls = mk(), ss = mk()
    vi.stubGlobal('localStorage', ls); vi.stubGlobal('sessionStorage', ss)
    const core = await import('./helpCore.js')
    core.setHelpDemo(true)
    try {
      core.markSeen('budgets')
      expect(ls.getItem(core.TOURS_SEEN_KEY)).toBeNull()
      expect(core.readSeen()).toContain('budgets')
    } finally { core.setHelpDemo(false) }
    expect(core.readSeen()).not.toContain('budgets')
    vi.unstubAllGlobals()
  })
})
