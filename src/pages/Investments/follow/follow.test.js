// Siguiendo (F4): textos en 4 idiomas, piezas pintadas con el demo (vista
// esencial y completa) y que el demo sea coherente con la ficha.
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import es from './strings.es.js'
import en from './strings.en.js'
import pt from './strings.pt.js'
import de from './strings.de.js'
import { es as appEs } from '../../../i18n/withSections.js'
import { interpolate, translate } from '../../../i18n/translate.js'
import { ALERT_CONDITIONS, alertStatus } from '../../../utils/investAlerts.js'
import { COMPARE_PERIODS, COMPARE_SUGGESTIONS, DISCOVER_LISTS, TREND_FILTERS, followRow } from '../../../utils/investFollow.js'
import { FOLLOW_TABS } from '../../../utils/investNav.js'
import { DEMO_WATCH, demoAlerts, demoFollowHistory, demoFollowQuotes } from '../../../demo/demoInvestFollow.js'
import { sampleQuote } from '../../../demo/demoInvestAsset.js'
import ListPane from './ListPane.jsx'
import { PushOffer, alertLineText } from './AlertParts.jsx'
import { compareFromList } from './Follow.jsx'
import { compareChart } from './ComparePane.jsx'
import { __resetDemoFollow, demoAlertList, demoSaveAlert } from './useFollowData.js'
import { alertErrorKey, hasLiveSubscription, pushResultText, pushState } from './shared.js'

const L = { es, en, pt, de }
const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort()
const DIR = dirname(fileURLToPath(import.meta.url))
const t = (k, v) => (k in es ? interpolate(es[k], v) : translate('es', k, v))
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('textos de Siguiendo', () => {
  for (const lang of ['en', 'pt', 'de']) {
    it(`${lang}: mismas claves y variables que el español`, () => {
      expect(Object.keys(L[lang]).sort()).toEqual(Object.keys(es).sort())
      expect(Object.keys(es).filter(k => vars(es[k]).join() !== vars(L[lang][k]).join())).toEqual([])
    })
  }
  it('español neutro, alemán con "Sie", sin exclamaciones ni emoji', () => {
    const vos = /\b(tenés|podés|querés|sabés|elegí|tocá|mirá|buscá|agregá|escribí|probá|hacé|usá|guardá|revisá|activá|creá|vos)\b/i
    expect(Object.entries(es).filter(([, v]) => vos.test(v)).map(([k]) => k)).toEqual([])
    for (const d of Object.values(L)) expect(Object.entries(d).filter(([, v]) => /[¡!]|\p{Extended_Pictographic}/u.test(v)).map(([k]) => k)).toEqual([])
    expect(Object.entries(de).filter(([, v]) => /\b(du|dein|deine|deinen|dich|dir)\b/i.test(v)).map(([k]) => k)).toEqual([])
  })
  it('portugués propio (salvo palabras iguales)', () => {
    const same = new Set(['fl.bar.follow', 'fl.bar.compare', 'fl.row.alertOne', 'fl.row.alertMany', 'fl.col.macd', 'fl.col.vol', 'fl.col.range',
      'fl.col.alert', 'fl.al.sum.reachedSub', 'fl.al.edit', 'fl.sheet.cancel', 'fl.sheet.asset', 'fl.disc.lists', 'fl.disc.list.dividends', 'fl.disc.list.chile',
      'fl.disc.list.mexico', 'fl.disc.filters', 'fl.disc.meta', 'fl.cmp.chartSummary', 'fl.cmp.c.pair', 'fl.sugg.pct', 'fl.rsi.mid', 'fl.disc.follow', 'fl.sheet.level',
      'fl.list.addBtn', 'fl.cmp.period', 'fl.al.sum.assets', 'fl.sheet.edit', 'fl.disc.trend', 'fl.col.trend', 'fl.col.asset', 'fl.sheet.existing', 'fl.cmp.c.corr', 'fl.disc.failed',
      'fl.trend.all', 'fl.cell.calc', 'fl.al.pause', 'fl.disc.list.brasil', 'fl.disc.followT', 'fl.disc.csv', 'fl.cmp.p.3M', 'fl.cmp.p.6M', 'fl.cmp.c.sharpe'])
    expect(Object.keys(es).filter(k => !same.has(k) && pt[k] === es[k])).toEqual([])
  })
  it('sin consejos de compra o venta; aviso de datos en Comparar', () => {
    const banned = /deber[ií]as|te sugerimos|compra ahora|vende ya|should buy|you should|sollten Sie kaufen|voc[eê] deveria/i
    for (const d of Object.values(L)) expect(Object.entries(d).filter(([, v]) => banned.test(v)).map(([k]) => k)).toEqual([])
    expect(es['fl.cmp.past']).toMatch(/no asegura/)
    expect(es['fl.disc.intro']).toMatch(/No son recomendaciones/)
  })
  it('familias dinámicas completas', () => {
    const need = [
      ...FOLLOW_TABS.map(k => `fl.tab.${k}`),
      ...TREND_FILTERS.map(k => `fl.trend.${k}`),
      ...ALERT_CONDITIONS.flatMap(c => [`fl.al.cond.${c}`, `fl.sheet.cond.${c}`]),
      ...['above', 'below'].map(c => `fl.sheet.hint.${c}`),
      ...['cost', 'low52', 'high52', 'down10', 'up10', 'pct'].map(k => `fl.sugg.${k}`),
      ...DISCOVER_LISTS.flatMap(l => [`fl.disc.list.${l.id}`, `fl.disc.desc.${l.id}`]),
      ...COMPARE_PERIODS.map(p => `fl.cmp.p.${p.key}`),
      ...COMPARE_SUGGESTIONS.map(x => `fl.cmp.s.${x.id}`),
      ...['low', 'mid', 'high'].map(k => `fl.cmp.move.${k}`),
      ...['same', 'similar', 'independent', 'opposite', 'na'].map(k => `fl.cmp.r.${k}`),
      ...['empty', 'invalid', 'dup', 'max', 'min'].map(k => `fl.cmp.err.${k}`),
      ...['symbol_required', 'symbol_invalid', 'condition_invalid', 'threshold_invalid', 'pct_invalid'].map(k => `fl.err.${k}`),
      ...['duplicate', 'limit', 'demo', 'session_required', 'timeout', 'table_missing', 'otro'].map(c => alertErrorKey(c)[0]),
    ]
    expect(need.filter(k => !(k in es))).toEqual([])
  })
  it('cada t(\'…\') literal de Siguiendo existe (aquí o en la app)', () => {
    const code = readdirSync(DIR).filter(f => f.endsWith('.jsx')).map(f => readFileSync(join(DIR, f), 'utf8')).join('\n')
    const used = [...new Set([...code.matchAll(/\bt\(\s*'([^'$`]+)'/g)].map(m => m[1]))]
    expect(used.length).toBeGreaterThan(80)
    expect(used.filter(k => !(k in es) && !(k in appEs))).toEqual([])
  })
  it('los textos de Siguiendo no están en el diccionario principal', () => {
    expect(Object.keys(appEs).filter(k => k.startsWith('fl.'))).toEqual([])
  })
})

describe('demo de Siguiendo: coherente con la ficha', () => {
  beforeEach(() => __resetDemoFollow())
  it('lista, precios y alertas de ejemplo', () => {
    expect(DEMO_WATCH).toEqual(['SPY', 'QQQ', 'NVDA'])
    const q = demoFollowQuotes(DEMO_WATCH)
    for (const tk of DEMO_WATCH) expect(q[tk].price).toBe(sampleQuote(tk).price)
    const al = demoAlerts(Date.parse('2026-11-23T12:00:00Z'))
    expect(al.map(a => a.condition)).toEqual(['above', 'below', 'pct_move'])
    // Las de precio no se cumplen hoy (5 % lejos); la del día ya avisó hace 2 días.
    expect(alertStatus(al[0], q[al[0].symbol]).reached).toBe(false)
    expect(alertStatus(al[1], q[al[1].symbol]).reached).toBe(false)
    expect(alertStatus(al[2], q[al[2].symbol], Date.parse('2026-11-23T12:00:00Z')).notifiedRecently).toBe(false)
    const row = followRow('SPY', q.SPY, demoFollowHistory('SPY'))
    expect(row.scored).toBe(true)
    expect(demoFollowHistory('SPY', '5y').length).toBeGreaterThan(demoFollowHistory('SPY', '1y').length)
  })
  it('crear una alerta en el demo se ve también en la ficha (misma memoria)', () => {
    expect(demoAlertList()).toHaveLength(3)
    expect(demoSaveAlert(null, { symbol: 'aapl', condition: 'above', threshold: 1 }).ok).toBe(true)
    expect(demoSaveAlert(null, { symbol: 'AAPL', condition: 'above', threshold: 1 })).toEqual({ ok: false, error: 'duplicate' })
    expect(demoAlertList().map(a => a.symbol)).toContain('AAPL')
  })
})

describe('piezas de Siguiendo', () => {
  const data = (patch = {}) => {
    const quotes = demoFollowQuotes(DEMO_WATCH)
    return {
      watch: { phase: 'ready', list: DEMO_WATCH, error: null },
      alerts: { phase: 'ready', list: demoAlerts(), error: null },
      quotes, quotesFailed: false,
      hist: Object.fromEntries(DEMO_WATCH.map(tk => [tk, demoFollowHistory(tk)])),
      follow: async () => ({ ok: true }), unfollow: async () => ({ ok: true }), refollow: async () => ({ ok: true }), reload: () => {},
      saveAlert: async () => ({ ok: true }), deleteAlert: async () => ({ ok: true }), setAlertActive: async () => ({ ok: true }), importAlerts: async () => ({ ok: true }),
      ...patch,
    }
  }
  const noop = () => {}
  const push = { state: 'off', busy: false, error: null, enable: noop }
  const list = (patch = {}, props = {}) => text(renderToStaticMarkup(h(ListPane, { t, d: data(patch), full: false, demo: true, push, onOpen: noop, onAlert: noop, onNewAlert: noop, onCompare: noop, onSay: noop, onErr: noop, ...props })))
  it('Mi lista esencial: precio y día, sin RSI ni MACD; completa: las lecturas', () => {
    const ess = list()
    expect(ess).toContain('SPY')
    expect(ess).not.toMatch(/RSI|MACD/)
    const full = list({}, { full: true })
    for (const k of ['fl.col.trend', 'fl.col.rsi', 'fl.col.macd', 'fl.col.vol', 'fl.col.range']) expect(full).toContain(t(k))
    expect(full).toContain(t('fl.filter.label') ? t('fl.trend.all') : '')
  })
  it('Mi lista vacía y sin sesión lo dicen con calma', () => {
    const empty = list({ watch: { phase: 'ready', list: [], error: null } })
    expect(empty).toContain(t('fl.list.empty.title'))
    // Sin activos, el campo para seguir uno queda abierto.
    expect(empty).toContain(t('fl.list.addLabel'))
    const anon = list({ watch: { phase: 'error', list: [], error: 'session_required' } })
    expect(anon).toContain(t('fl.list.session'))
  })
  it('Mi lista: arriba "+ Seguir", "Nueva alerta" y "Comparar"; el campo de seguir se abre con el botón', () => {
    const html = list()
    for (const k of ['fl.bar.follow', 'fl.al.new', 'fl.bar.compare']) expect(html).toContain(t(k))
    expect(html).not.toContain(t('fl.list.addLabel'))
    const raw = renderToStaticMarkup(h(ListPane, { t, d: data(), full: false, demo: true, push, onOpen: noop, onAlert: noop, onNewAlert: noop, onCompare: noop, onSay: noop, onErr: noop }))
    expect(raw).toMatch(/aria-expanded="false"/)
    // Cada fila que abre la ficha es un botón con nombre.
    expect(raw).toContain(`aria-label="${t('fl.row.open', { t: 'SPY' })}"`)
    // La campana con alerta edita; el nombre lo dice.
    expect(raw).toContain(`aria-label="${t('fl.row.alertSee', { t: 'SPY', n: 1 })}"`)
  })
  it('Mi lista: cada activo con su alerta debajo, el resumen en una línea y los avisos', () => {
    const html = list()
    // SPY: baja a US$484,45, a 5 % del precio.
    expect(html).toMatch(/Alerta: baja a US\$\s?484,45 · falta 5,0\s?%/)
    expect(html).toMatch(/Alerta: sube a US\$/)
    expect(html).toMatch(/Alerta: se mueve 3,0\s?% en el día · avisada el/)
    expect(html).toContain(t('fl.sum.line', { active: 3, reached: 0, assets: 3 }))
    expect(html).toContain(t('fl.push.title'))
    expect(html).toContain(t('fl.push.enable'))
    // En el demo no se ofrece importar.
    expect(html).not.toContain(t('fl.imp.pick'))
    // Sin la vieja sub-pestaña: nada de párrafos largos arriba.
    expect(html).not.toContain(t('fl.list.intro'))
  })
  it('Mi lista sin alertas lo dice en una línea; sin la tabla de alertas no ofrece crearlas', () => {
    expect(list({ alerts: { phase: 'ready', list: [], error: null } })).toContain(t('fl.sum.none'))
    const raw = renderToStaticMarkup(h(ListPane, { t, d: data({ alerts: { phase: 'error', list: [], error: 'table_missing' } }), full: false, demo: false, push, onOpen: noop, onAlert: noop, onNewAlert: noop, onCompare: noop, onSay: noop, onErr: noop }))
    expect(text(raw)).toContain(t('fl.al.missing'))
    expect(raw).toMatch(new RegExp(`<button[^>]*disabled[^>]*>${t('fl.al.new')}</button>`))
  })
  it('dos alertas del mismo activo: "2 alertas"; en pausa y cumplida se dicen', () => {
    const q = { price: 100, currency: 'USD', changePct: 0.01 }
    const a = (id, condition, threshold, active = true) => ({ id, symbol: 'SPY', condition, threshold, active, lastTriggeredAt: null })
    expect(alertLineText(t, [a('1', 'above', 120), a('2', 'below', 80)], q)).toMatchObject({ lead: t('fl.row.alertMany', { n: 2 }), rest: '' })
    expect(alertLineText(t, [a('1', 'above', 90), a('2', 'below', 80)], q).rest).toBe(t('fl.row.reachedN', { n: 1 }))
    expect(alertLineText(t, [a('1', 'above', 120, false)], q).rest).toMatch(new RegExp(`${t('fl.row.paused')}$`))
    expect(alertLineText(t, [a('1', 'above', 90)], q)).toMatchObject({ reached: true })
    expect(alertLineText(t, [], q)).toBeNull()
  })
  it('alertas de activos que no sigues: siguen a la vista; sin cotización la moneda sale del sufijo y nunca se supone US$', () => {
    const al = [
      { id: 'x1', symbol: 'PETR4.SA', condition: 'above', threshold: 38, active: true, last_triggered_at: null, created_at: '2026-11-20T00:00:00Z' },
      { id: 'x2', symbol: 'ABC.ZZ', condition: 'below', threshold: 12.5, active: true, last_triggered_at: null, created_at: '2026-11-20T00:00:00Z' },
    ]
    const html = list({ watch: { phase: 'ready', list: [], error: null }, alerts: { phase: 'ready', list: al, error: null }, quotes: {}, quotesFailed: true }, { demo: false })
    expect(html).toContain(t('fl.orph.title'))
    expect(html).toMatch(/PETR4\.SA Alerta: sube a BRL\s?38/)
    expect(html).toMatch(/ABC\.ZZ Alerta: baja a 12[,.]50/)
    expect(html).not.toContain('US$')
    // Con cuenta (fuera del demo) se ofrece traer las alertas de la versión anterior.
    expect(html).toContain(t('fl.imp.title'))
  })
  it('Comparar desde Mi lista: los activos de la lista (hasta 4), o la comparación de siempre', () => {
    expect(compareFromList(['SPY', 'QQQ', 'NVDA'])).toEqual(['SPY', 'QQQ', 'NVDA'])
    expect(compareFromList(['A', 'B', 'C', 'D', 'E'])).toEqual(['A', 'B', 'C', 'D'])
    expect(compareFromList(['SPY']).length).toBeGreaterThanOrEqual(2)
  })
  it('el estado de push sigue el flujo de Ajustes (licencia, navegador, demo)', () => {
    expect(pushState({ demo: true })).toBe('demo')
    expect(pushState({ supported: false, hasKey: true, on: false })).toBe('unsupported')
    expect(pushState({ supported: true, hasKey: false, on: false })).toBe('noLicense')
    expect(pushState({ supported: true, hasKey: true, on: true, permission: 'granted' })).toBe('on')
    expect(pushState({ supported: true, hasKey: true, on: false, permission: 'granted' })).toBe('off')
    // Permiso revocado en el navegador: vuelve a ofrecerse "Activar avisos".
    expect(pushState({ supported: true, hasKey: true, on: true, permission: 'denied' })).toBe('off')
    expect(pushState({ supported: true, hasKey: true, on: true, permission: 'default' })).toBe('off')
    const on = text(renderToStaticMarkup(h(PushOffer, { t, push: { state: 'on', enable: noop } })))
    expect(on).toContain(t('fl.push.title'))
    expect(on).toContain(t('fl.push.on'))
  })
  it('la suscripción borrada en el servidor o en el navegador apaga el estado', async () => {
    const sw = (sub) => ({ ready: Promise.resolve({ pushManager: { getSubscription: async () => sub } }) })
    expect(await hasLiveSubscription({ sw: sw({ endpoint: 'x' }) })).toBe(true)
    expect(await hasLiveSubscription({ sw: sw(null) })).toBe(false)
    expect(await hasLiveSubscription({ sw: null })).toBeNull()
    expect(await hasLiveSubscription({ sw: { ready: new Promise(() => {}) }, timeoutMs: 5 })).toBeNull()
  })
  it('el resultado de activar avisos siempre se cuenta (también el error)', () => {
    expect(pushResultText({ ok: true }, t)).toEqual([t('fl.push.ok'), 'ok'])
    expect(pushResultText({ ok: false, error: 'permission_denied' }, t)[0]).toBe(t('settings.push.permissionDenied'))
    expect(pushResultText({ ok: false, error: 'failed' }, t)).toEqual([t('settings.push.genericError'), 'error'])
    expect(pushResultText({ ok: false, error: 'no_license' }, t)[0]).toBe(t('fl.push.noLicense'))
    expect(pushResultText({ ok: false, error: 'unsupported' }, t)[0]).toBe(t('fl.push.unsupported'))
  })
  it('el gráfico de Comparar parte de 0 % y comparte el eje de fechas', () => {
    const c = compareChart({ A: [{ ts: 0, pct: 0 }, { ts: 10, pct: 0.2 }], B: [{ ts: 5, pct: 0 }, { ts: 10, pct: -0.1 }] }, 100, 100, 0)
    expect(c.paths.A.startsWith('M0.0,')).toBe(true)
    expect(c.paths.B.startsWith('M50.0,')).toBe(true)
    expect(c.lo).toBe(-0.1)
    expect(c.hi).toBe(0.2)
    expect(compareChart({})).toBeNull()
  })
})

describe('privacidad de Siguiendo', () => {
  it('en el dispositivo solo la sub-pestaña (nunca tickers ni alertas)', () => {
    const files = readdirSync(DIR).filter(f => /\.jsx?$/.test(f) && !f.includes('.test.') && !f.startsWith('strings.'))
    for (const f of files) {
      const code = readFileSync(join(DIR, f), 'utf8')
      if (f === 'shared.js') { expect(code).toMatch(/safeStorage/); continue }
      expect(code, f).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/)
    }
  })
})
