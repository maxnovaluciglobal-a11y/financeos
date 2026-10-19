import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { guardPushRequest } from './requestGuard.ts'

describe('guardPushRequest (send-push)', () => {
  it('OPTIONS (preflight, pasa el gateway sin clave) no ejecuta el envío', () => {
    expect(guardPushRequest('OPTIONS', null, 's3cret')).toEqual({ status: 204, error: '' })
  })
  it('solo POST', () => {
    expect(guardPushRequest('GET', 's3cret', 's3cret')?.status).toBe(405)
  })
  it('sin el secreto del cron o con uno errado: 401', () => {
    expect(guardPushRequest('POST', null, 's3cret')?.status).toBe(401)
    expect(guardPushRequest('POST', 'otro', 's3cret')?.status).toBe(401)
    expect(guardPushRequest('POST', 's3cret', undefined)?.status).toBe(401)
  })
  it('POST con el secreto: pasa', () => {
    expect(guardPushRequest('POST', 's3cret', 's3cret')).toBeNull()
  })
  it('index.ts aplica la guarda antes de leer licencias', () => {
    const src = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
    const guard = src.indexOf('guardPushRequest(')
    const work = src.indexOf('licenses?select=')
    expect(guard).toBeGreaterThan(0)
    expect(guard).toBeLessThan(work)
  })
})
