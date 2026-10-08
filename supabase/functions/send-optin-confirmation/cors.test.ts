import { describe, it, expect } from 'vitest'
import { corsHeaders, ALLOWED_ORIGINS, FALLBACK_ORIGIN } from './cors.ts'

describe('CORS de send-optin-confirmation', () => {
  it('permite los encabezados que mandan la app y supabase-js', () => {
    const allowed = corsHeaders(ALLOWED_ORIGINS[0])['Access-Control-Allow-Headers'].split(',').map((h) => h.trim().toLowerCase())
    for (const h of ['authorization', 'apikey', 'content-type', 'x-client-info']) expect(allowed).toContain(h)
  })
  it('refleja solo orígenes de la lista; cualquier otro recibe el de respaldo', () => {
    for (const o of ALLOWED_ORIGINS) expect(corsHeaders(o)['Access-Control-Allow-Origin']).toBe(o)
    expect(corsHeaders('https://evil.example')['Access-Control-Allow-Origin']).toBe(FALLBACK_ORIGIN)
    expect(corsHeaders(null)['Access-Control-Allow-Origin']).toBe(FALLBACK_ORIGIN)
    expect(corsHeaders(null)['Vary']).toBe('Origin')
  })
})
