import { describe, it, expect } from 'vitest'
import setup, { findProdTarget } from './guardProduccion.js'

describe('guardProduccion', () => {
  it('lets a clean environment through', () => {
    expect(findProdTarget({ PATH: '/bin', SUPABASE_URL: 'http://127.0.0.1:54321' })).toBeNull()
  })
  it('stops SUPABASE_URL pointing at the production project', () => {
    expect(findProdTarget({ SUPABASE_URL: 'https://nelwgbcddwiaimzbcuas.supabase.co' })).toEqual({ variable: 'SUPABASE_URL', marker: 'nelwgbcddwiaimzbcuas' })
  })
  it('stops a DATABASE_URL on the pooler host', () => {
    expect(findProdTarget({ DATABASE_URL: 'postgres://u:p@aws-0-us-east-2.pooler.supabase.com:6543/postgres' })?.marker).toBe('pooler.supabase.com')
  })
  it('stops any PG* variable', () => {
    expect(findProdTarget({ PGHOST: 'db.nelwgbcddwiaimzbcuas.supabase.co' })?.variable).toBe('PGHOST')
  })
  it('ignores unrelated variables that happen to mention it', () => {
    expect(findProdTarget({ NOTES: 'nelwgbcddwiaimzbcuas' })).toBeNull()
  })
  it('the setup function throws with a clear message', () => {
    const old = process.env.SUPABASE_URL
    process.env.SUPABASE_URL = 'https://nelwgbcddwiaimzbcuas.supabase.co'
    try {
      expect(() => setup()).toThrow(/points at production/)
    } finally {
      if (old === undefined) delete process.env.SUPABASE_URL
      else process.env.SUPABASE_URL = old
    }
  })
})
