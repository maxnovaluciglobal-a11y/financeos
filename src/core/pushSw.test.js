// public/push-sw.js arma el texto del recordatorio en el idioma del navegador
// (el servidor no sabe el idioma: manda i18n + un body de respaldo en español).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const SRC = readFileSync(new URL('../../public/push-sw.js', import.meta.url), 'utf8')

function runPush(language, payload) {
  const listeners = {}
  let shown = null
  const self = {
    navigator: { language },
    addEventListener: (n, f) => { listeners[n] = f },
    registration: { showNotification: (title, opts) => { shown = { title, ...opts } } },
    clients: {},
  }
  new Function('self', SRC)(self)
  listeners.push({ data: payload === null ? null : { json: () => payload }, waitUntil: () => {} })
  return shown
}

describe('push-sw.js', () => {
  it.each([
    ['es-CL', 'Tu prueba vence en 3 días.'],
    ['en-US', 'Your trial ends in 3 days.'],
    ['pt-BR', 'Seu teste termina em 3 dias.'],
    ['de-DE', 'Ihre Testphase endet in 3 Tagen.'],
  ])('%s: recordatorio de prueba', (lang, start) => {
    const n = runPush(lang, { title: 'moyiq', body: 'respaldo', i18n: { key: 'trialExpiring', days: 3 } })
    expect(n.body.startsWith(start)).toBe(true)
  })

  it('singular con 1 día', () => {
    expect(runPush('en-US', { i18n: { key: 'trialExpiring', days: 1 } }).body).toMatch(/in 1 day\./)
  })

  it('sin payload: aviso genérico sin voseo', () => {
    expect(runPush('es-AR', null).body).toBe('Tienes una notificación nueva.')
    expect(runPush('fr-FR', null).body).toBe('Tienes una notificación nueva.')
  })

  it('un payload sin i18n se muestra tal cual', () => {
    expect(runPush('en-US', { body: 'Texto propio' }).body).toBe('Texto propio')
  })

  it.each([
    ['es-CL', 'Alerta de precio · AAPL', 'AAPL subió a 251,5. Tu nivel: 250.'],
    ['en-US', 'Price alert · AAPL', 'AAPL rose to 251.5. Your level: 250.'],
    ['pt-BR', 'Alerta de preço · AAPL', 'AAPL subiu para 251,5. Seu nível: 250.'],
    ['de-DE', 'Preisalarm · AAPL', 'AAPL ist auf 251,5 gestiegen. Ihr Niveau: 250.'],
  ])('%s: alerta de precio (invest-alerts-check)', (lang, title, body) => {
    const n = runPush(lang, { title: 'moyiq', body: 'respaldo', i18n: { key: 'priceAlert', t: 'AAPL', cond: 'above', level: 250, price: 251.5, pct: 1, ccy: 'USD' }, tag: 'invest-alert-x', url: '/app/?open=invest-siguiendo' })
    expect(n.title).toBe(title)
    expect(n.body).toBe(body)
    expect(n.tag).toBe('invest-alert-x')
    expect(n.data.url).toBe('/app/?open=invest-siguiendo')
  })

  it('alerta en otra moneda y por movimiento del día', () => {
    expect(runPush('es-CL', { i18n: { key: 'priceAlert', t: 'SQM-B.SN', cond: 'below', level: 40000, price: 39950, ccy: 'CLP' } }).body).toBe('SQM-B.SN bajó a 39.950 CLP. Tu nivel: 40.000 CLP.')
    expect(runPush('en-US', { i18n: { key: 'priceAlert', t: 'NVDA', cond: 'pct_move', level: 5, price: 180, pct: -6.2 } }).body).toBe('NVDA moved -6.2% today. Your alert: 5% or more.')
    // Una alerta incompleta queda con el texto de respaldo.
    expect(runPush('en-US', { body: 'respaldo', i18n: { key: 'priceAlert', cond: 'above' } }).body).toBe('respaldo')
  })

  it('ningún texto usa voseo ni exclamaciones', () => {
    expect(SRC).not.toMatch(/Tenés|[¡!]'/)
  })
})

describe('push-sw.js: tocar el aviso', () => {
  async function click(url, windows, { navigate = true, answer } = {}) {
    const listeners = {}
    const opened = []
    const navigated = []
    const messages = []
    const clients = windows.map(u => {
      const c = { url: u, focused: false, focus: async () => { c.focused = true; return c } }
      if (navigate) c.navigate = async (to) => { navigated.push(to); return c }
      // answer: la app contesta { ok } por el MessageChannel; undefined = app sin listener.
      if (answer !== undefined) c.postMessage = (msg, [port]) => { messages.push(msg); if (answer !== null) port.postMessage({ ok: answer }) }
      return c
    })
    const self = {
      location: { origin: 'https://app.moyiq.app' },
      navigator: { language: 'es' },
      addEventListener: (n, f) => { listeners[n] = f },
      registration: {},
      clients: { matchAll: async () => clients, openWindow: async (u) => { opened.push(u) } },
    }
    new Function('self', SRC)(self)
    let p
    listeners.notificationclick({ notification: { close: () => {}, data: { url } }, waitUntil: (x) => { p = x } })
    await p
    return { opened, navigated, clients, messages }
  }
  it('con la app abierta, la enfoca y la lleva al destino del aviso', async () => {
    const r = await click('/app/?open=invest-alertas', ['https://app.moyiq.app/app/'])
    expect(r.clients[0].focused).toBe(true)
    expect(r.navigated).toEqual(['https://app.moyiq.app/app/?open=invest-alertas'])
    expect(r.opened).toEqual([])
  })
  it('un aviso sin destino propio solo enfoca; sin app abierta, abre una ventana', async () => {
    const r = await click('/app/', ['https://app.moyiq.app/app/?x=1'])
    expect(r.navigated).toEqual([])
    expect(r.clients[0].focused).toBe(true)
    const r2 = await click('/app/?open=invest-alertas', [])
    expect(r2.opened).toEqual(['/app/?open=invest-alertas'])
  })
  it('con la app que escucha, va al destino por mensaje y NO recarga (aunque la URL ya sea la del aviso)', async () => {
    const r = await click('/app/?open=invest-alertas', ['https://app.moyiq.app/app/?open=invest-alertas'], { answer: true })
    expect(r.messages).toEqual([{ type: 'moyiq-open', open: 'invest-alertas' }])
    expect(r.navigated).toEqual([])
    expect(r.clients[0].focused).toBe(true)
  })
  it('la URL de la ventana ya es la del aviso y la app no contesta: igual navega', async () => {
    const r = await click('/app/?open=invest-alertas', ['https://app.moyiq.app/app/?open=invest-alertas'], { answer: false })
    expect(r.navigated).toEqual(['https://app.moyiq.app/app/?open=invest-alertas'])
    const r2 = await click('/app/?open=invest-alertas', ['https://app.moyiq.app/app/?open=invest-alertas'])
    expect(r2.navigated).toEqual(['https://app.moyiq.app/app/?open=invest-alertas'])
  })
  it('sin navigate (navegador viejo) igual enfoca', async () => {
    const r = await click('/app/?open=invest-alertas', ['https://app.moyiq.app/app/'], { navigate: false })
    expect(r.clients[0].focused).toBe(true)
  })
})
