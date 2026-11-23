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
import { es as appEs } from '../../../i18n/es.js'
import { interpolate, translate } from '../../../i18n/translate.js'
import { ALERT_CONDITIONS, alertStatus } from '../../../utils/investAlerts.js'
import { COMPARE_PERIODS, COMPARE_SUGGESTIONS, DISCOVER_LISTS, TREND_FILTERS, followRow } from '../../../utils/investFollow.js'
import { FOLLOW_TABS } from '../../../utils/investNav.js'
import { DEMO_WATCH, demoAlerts, demoFollowHistory, demoFollowQuotes } from '../../../demo/demoInvestFollow.js'
import { sampleQuote } from '../../../demo/demoInvestAsset.js'
import ListPane from './ListPane.jsx'
import AlertsPane, { PushOffer } from './AlertsPane.jsx'
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
    const same = new Set(['fl.tab.alertas', 'fl.tab.comparar', 'fl.row.alertOne', 'fl.row.alertMany', 'fl.col.macd', 'fl.col.vol', 'fl.col.range',
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
  it('Mi lista esencial: precio y día, sin RSI ni MACD; completa: las lecturas', () => {
    const ess = text(renderToStaticMarkup(h(ListPane, { t, d: data(), full: false, demo: true, onOpen: noop, onAlert: noop, onSay: noop, onErr: noop })))
    expect(ess).toContain('SPY')
    expect(ess).toContain(t('fl.list.intro'))
    expect(ess).not.toMatch(/RSI|MACD/)
    const full = text(renderToStaticMarkup(h(ListPane, { t, d: data(), full: true, demo: true, onOpen: noop, onAlert: noop, onSay: noop, onErr: noop })))
    for (const k of ['fl.col.trend', 'fl.col.rsi', 'fl.col.macd', 'fl.col.vol', 'fl.col.range']) expect(full).toContain(t(k))
    expect(full).toContain(t('fl.filter.label') ? t('fl.trend.all') : '')
  })
  it('Mi lista vacía y sin sesión lo dicen con calma', () => {
    const empty = text(renderToStaticMarkup(h(ListPane, { t, d: data({ watch: { phase: 'ready', list: [], error: null } }), full: false, onOpen: noop, onAlert: noop, onSay: noop, onErr: noop })))
    expect(empty).toContain(t('fl.list.empty.title'))
    const anon = text(renderToStaticMarkup(h(ListPane, { t, d: data({ watch: { phase: 'error', list: [], error: 'session_required' } }), full: false, onOpen: noop, onAlert: noop, onSay: noop, onErr: noop })))
    expect(anon).toContain(t('fl.list.session'))
  })
  it('Alertas: resumen, condiciones en palabras, lo que falta y el aviso de push', () => {
    const push = { state: 'off', busy: false, error: null, enable: noop }
    const html = text(renderToStaticMarkup(h(AlertsPane, { t, d: data(), demo: true, push, onNew: noop, onEdit: noop, onSay: noop, onErr: noop })))
    expect(html).toContain(t('fl.al.sum.active'))
    expect(html).toContain('Sube a')
    expect(html).toContain('Baja a')
    expect(html).toContain('Falta')
    expect(html).toContain(t('fl.push.enable'))
    // En el demo no se ofrece importar.
    expect(html).not.toContain(t('fl.imp.pick'))
    const missing = text(renderToStaticMarkup(h(AlertsPane, { t, d: data({ alerts: { phase: 'error', list: [], error: 'table_missing' } }), demo: false, push, onNew: noop, onEdit: noop, onSay: noop, onErr: noop })))
    expect(missing).toContain(t('fl.al.missing'))
    expect(missing).not.toContain(t('fl.al.new'))
  })
  it('Alertas sin cotización: la moneda sale del sufijo y nunca se supone US$', () => {
    const push = { state: 'off', busy: false, error: null, enable: noop }
    const list = [
      { id: 'x1', symbol: 'PETR4.SA', condition: 'above', threshold: 38, active: true, last_triggered_at: null, created_at: '2026-11-20T00:00:00Z' },
      { id: 'x2', symbol: 'ABC.ZZ', condition: 'below', threshold: 12.5, active: true, last_triggered_at: null, created_at: '2026-11-20T00:00:00Z' },
    ]
    const html = text(renderToStaticMarkup(h(AlertsPane, { t, d: data({ alerts: { phase: 'ready', list, error: null }, quotes: {}, quotesFailed: true }), demo: false, push, onNew: noop, onEdit: noop, onSay: noop, onErr: noop })))
    expect(html).toMatch(/PETR4\.SA · Sube a BRL\s?38/)
    expect(html).toMatch(/ABC\.ZZ · Baja a 12[,.]50/)
    expect(html).not.toContain('US$')
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
