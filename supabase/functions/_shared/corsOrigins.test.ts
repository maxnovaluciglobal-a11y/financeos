// C-24 (auditoría 360): financeospro.com redirige a moyiq.app desde sep-2026 y
// ya no debe figurar en el CORS de ninguna Edge Function. Solo orígenes HTTPS de
// moyiq.app (y sus subdominios) o localhost de desarrollo.
import { describe, it, expect } from 'vitest'
import * as cancellation from '../send-cancellation-confirmation/cors.ts'
import * as diagnostico from '../send-nurture-diagnostico-email/cors.ts'
import * as invest from '../send-nurture-invest-email/cors.ts'
import * as starter from '../send-nurture-starter-email/cors.ts'
import * as optin from '../send-optin-confirmation/cors.ts'
import * as report from '../send-report-email/cors.ts'

const ALL = { cancellation, diagnostico, invest, starter, optin, report }
const VALID = /^(https:\/\/([a-z0-9-]+\.)*moyiq\.app|http:\/\/localhost:\d+)$/

describe('orígenes CORS de las Edge Functions', () => {
  for (const [name, mod] of Object.entries(ALL)) {
    it(`${name}: sin financeospro.com y solo moyiq.app o localhost`, () => {
      for (const o of mod.ALLOWED_ORIGINS) {
        expect(o).not.toMatch(/financeospro/)
        expect(o).toMatch(VALID)
      }
      expect(mod.corsHeaders('https://financeospro.com')['Access-Control-Allow-Origin']).toBe(mod.FALLBACK_ORIGIN)
      expect(mod.corsHeaders('https://app.financeospro.com')['Access-Control-Allow-Origin']).toBe(mod.FALLBACK_ORIGIN)
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
