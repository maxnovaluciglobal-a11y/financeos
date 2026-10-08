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
    const n = runPush(lang, { title: 'MOY IQ', body: 'respaldo', i18n: { key: 'trialExpiring', days: 3 } })
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

  it('ningún texto usa voseo ni exclamaciones', () => {
    expect(SRC).not.toMatch(/Tenés|[¡!]'/)
  })
})
