import { describe, it, expect } from 'vitest'
import { compare, verdict, parseDefaultAcl } from './aclCheck.mjs'

const matrix = {
  extras: { service_role: 'arwdDxtXU' },
  tables: { 'public.t': { authenticated: 'r', service_role: 'arwd', rls: true } },
  sequences: {},
  functions: { 'public.f(text)': { anon: 'X', authenticated: '', service_role: 'X' } },
}
const good = () => ({
  tables: { 'public.t': { rls: true, anon: '', authenticated: 'r', service_role: 'arwdDxt' } },
  sequences: {},
  functions: { 'public.f(text)': { public_execute: false, anon: 'X', authenticated: '', service_role: 'X' } },
  default_acls: [],
})

describe('aclCheck compare', () => {
  it('passes when the catalog matches the matrix', () => {
    const r = compare(good(), matrix)
    expect(verdict(r)).toBe(0)
    expect(r.sobrantes).toEqual([])
  })
  it('flags a missing privilege (faltante) and fails', () => {
    const c = good()
    c.tables['public.t'].service_role = 'ar'
    const r = compare(c, matrix)
    expect(r.faltantes).toHaveLength(2)
    expect(verdict(r)).toBe(1)
  })
  it('flags extra privileges for anon/authenticated as sobrantes (warning unless strict)', () => {
    const c = good()
    c.tables['public.t'].authenticated = 'rd'
    const r = compare(c, matrix)
    expect(r.sobrantes).toHaveLength(1)
    expect(verdict(r)).toBe(0)
    expect(verdict(r, { strict: true })).toBe(1)
  })
  it('flags an object the matrix does not know (sin clasificar) and fails', () => {
    const c = good()
    c.tables['public.new_table'] = { rls: true, anon: '', authenticated: '', service_role: '' }
    const r = compare(c, matrix)
    expect(r.sinClasificar).toEqual(['tabla public.new_table'])
    expect(verdict(r)).toBe(1)
  })
  it('flags a matrix row without an object (obsoleto) as a warning', () => {
    const c = good()
    delete c.functions['public.f(text)']
    const r = compare(c, matrix)
    expect(r.obsoletos).toHaveLength(1)
    expect(verdict(r)).toBe(0)
  })
  it('flags a function executable by PUBLIC', () => {
    const c = good()
    c.functions['public.f(text)'].public_execute = true
    expect(compare(c, matrix).sobrantes[0]).toMatch(/PUBLIC/)
  })
  it('flags a table that lost row level security and fails', () => {
    const c = good()
    c.tables['public.t'].rls = false
    const r = compare(c, matrix)
    expect(r.rls).toHaveLength(1)
    expect(verdict(r)).toBe(1)
  })
  it('flags postgres default privileges that give anon access, but not supabase_admin ones', () => {
    const c = good()
    c.default_acls = [
      { owner: 'supabase_admin', schema: 'public', object: 'r', acl: '{anon=arwd/supabase_admin}' },
      { owner: 'postgres', schema: 'public', object: 'r', acl: '{postgres=arwd/postgres,anon=r/postgres}' },
    ]
    const r = compare(c, matrix)
    expect(r.defaults).toHaveLength(1)
    expect(verdict(r)).toBe(1)
  })
  it('parses default ACL text', () => {
    expect(parseDefaultAcl('{postgres=X/postgres,service_role=X/postgres}')).toEqual([
      { grantee: 'postgres', privs: 'X' },
      { grantee: 'service_role', privs: 'X' },
    ])
  })
  it('fails closed on empty or malformed input', () => {
    expect(() => compare({}, matrix)).toThrow()
    expect(() => compare(good(), null)).toThrow()
  })
})
