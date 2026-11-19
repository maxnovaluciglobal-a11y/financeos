// C-24 (auditoría 360): el dominio anterior de FinanceOS no debe figurar en el
// CORS de ninguna Edge Function (desconectado el 20-oct-2026; el nombre se arma
// por partes para que `git grep` del dominio dé 0 en el repo). Solo orígenes HTTPS de
// moyiq.app (y sus subdominios). SEC-N10: localhost ya no va en las listas de producción;
// el desarrollo lo agrega con DEV_ORIGINS. INV-N13: invest-handoff acepta además la app
// nativa (capacitor://localhost, https://localhost).
import { describe, it, expect } from 'vitest'
import * as cancellation from '../send-cancellation-confirmation/cors.ts'
import * as diagnostico from '../send-nurture-diagnostico-email/cors.ts'
import * as invest from '../send-nurture-invest-email/cors.ts'
import * as starter from '../send-nurture-starter-email/cors.ts'
import * as optin from '../send-optin-confirmation/cors.ts'
import * as report from '../send-report-email/cors.ts'
import * as deleteAccount from '../delete-account/cors.ts'
import * as feedback from '../send-feedback/cors.ts'
import * as leadSubmit from '../lead-submit/cors.ts'
import * as investHandoff from '../invest-handoff/cors.ts'
import { makeCorsHeaders, parseDevOrigins, withDevOrigins } from './cors.ts'

const LEGACY = 'financeos' + 'pro'

const ALL = { cancellation, diagnostico, invest, starter, optin, report, deleteAccount, feedback, leadSubmit, investHandoff }
const VALID = /^https:\/\/([a-z0-9-]+\.)*moyiq\.app$/
const NATIVE = ['capacitor://localhost', 'https://localhost']

describe('orígenes CORS de las Edge Functions', () => {
  for (const [name, mod] of Object.entries(ALL)) {
    it(`${name}: sin el dominio anterior, sin localhost de desarrollo y solo moyiq.app`, () => {
      for (const o of mod.ALLOWED_ORIGINS) {
        expect(o).not.toContain(LEGACY)
        if (name === 'investHandoff' && NATIVE.includes(o)) continue
        expect(o).toMatch(VALID)
      }
      expect(mod.corsHeaders('http://localhost:5173')['Access-Control-Allow-Origin']).toBe(mod.FALLBACK_ORIGIN)
      expect(mod.corsHeaders('http://localhost:4323')['Access-Control-Allow-Origin']).toBe(mod.FALLBACK_ORIGIN)
      expect(mod.corsHeaders(`https://${LEGACY}.com`)['Access-Control-Allow-Origin']).toBe(mod.FALLBACK_ORIGIN)
      expect(mod.corsHeaders(`https://app.${LEGACY}.com`)['Access-Control-Allow-Origin']).toBe(mod.FALLBACK_ORIGIN)
      expect(mod.FALLBACK_ORIGIN).toMatch(/moyiq\.app$/)
    })
  }
  it('conserva los orígenes de producción que usan la app y la landing', () => {
    expect(starter.ALLOWED_ORIGINS).toEqual(expect.arrayContaining(['https://moyiq.app', 'https://www.moyiq.app', 'https://app.moyiq.app']))
    expect(optin.ALLOWED_ORIGINS).toEqual(expect.arrayContaining(['https://app.moyiq.app', 'https://demo.moyiq.app', 'https://moyiq.app']))
    expect(report.ALLOWED_ORIGINS).toEqual(expect.arrayContaining(['https://app.moyiq.app', 'https://demo.moyiq.app']))
    expect(invest.ALLOWED_ORIGINS).toContain('https://invest.moyiq.app')
  })
})

describe('SEC-N10: orígenes de desarrollo por DEV_ORIGINS', () => {
  it('sin la variable no hay ninguno (producción)', () => {
    expect(parseDevOrigins(undefined)).toEqual([])
    expect(parseDevOrigins('')).toEqual([])
  })
  it('lee una lista separada por coma', () => {
    expect(parseDevOrigins('http://localhost:5173, http://localhost:4323,http://127.0.0.1:5173'))
      .toEqual(['http://localhost:5173', 'http://localhost:4323', 'http://127.0.0.1:5173'])
  })
  it('un valor mal puesto no abre el CORS a otro dominio', () => {
    expect(parseDevOrigins('https://evil.example,http://localhost.evil.example,*,http://localhost:5173/x'))
      .toEqual([])
  })
  it('makeCorsHeaders suma los de desarrollo solo si vienen', () => {
    const dev = makeCorsHeaders(['https://app.moyiq.app'], 'https://app.moyiq.app', [], ['http://localhost:5173'])
    expect(dev('http://localhost:5173')['Access-Control-Allow-Origin']).toBe('http://localhost:5173')
    const prod = makeCorsHeaders(['https://app.moyiq.app'], 'https://app.moyiq.app', [], [])
    expect(prod('http://localhost:5173')['Access-Control-Allow-Origin']).toBe('https://app.moyiq.app')
    expect(withDevOrigins(['a'], ['http://localhost:1']).has('http://localhost:1')).toBe(true)
  })
  it('ningún cors.ts de función vuelve a escribir localhost a mano', async () => {
    const { readdirSync, readFileSync, existsSync } = await import('node:fs')
    const root = new URL('..', import.meta.url)
    for (const dir of readdirSync(root)) {
      const f = new URL(`./${dir}/cors.ts`, root)
      if (dir === '_shared' || !existsSync(f)) continue
      expect(readFileSync(f, 'utf8'), dir).not.toMatch(/http:\/\/localhost/)
    }
  })
})

describe('INV-N13: invest-handoff acepta la app nativa', () => {
  it('capacitor://localhost y https://localhost reciben su propio origen', () => {
    for (const o of NATIVE) {
      expect(investHandoff.isAllowedOrigin(o)).toBe(true)
      expect(investHandoff.corsHeaders(o)['Access-Control-Allow-Origin']).toBe(o)
    }
    expect(investHandoff.isAllowedOrigin('capacitor://evil')).toBe(false)
    expect(investHandoff.isAllowedOrigin('http://localhost')).toBe(false)
  })
})
