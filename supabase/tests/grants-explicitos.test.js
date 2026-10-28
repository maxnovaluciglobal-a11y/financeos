// Static guard: every table / function the migrations create must have an EXPLICIT grant
// somewhere in the versioned SQL, and be listed in supabase/tests/acl-esperada.json.
// Why: from 2026-10-30 Supabase stops granting new `public` tables to anon / authenticated /
// service_role automatically, so an object without its own GRANT is born unreachable.
// Unlike a check on the newest migration only, this one watches ALL migrations (the older
// ones are what a restore into a new project replays).
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  createdTables,
  createdFunctions,
  grants,
  tableGrantRoles,
  functionGrantRoles,
  stripComments,
} from '../../scripts/lib/sqlAcl.js'

const root = path.resolve(__dirname, '../..')
const migDir = path.join(root, 'supabase/migrations')
const migFiles = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()
const read = (f) => fs.readFileSync(path.join(migDir, f), 'utf8')
const allMig = migFiles.map(read).join(';\n')
const matrix = JSON.parse(fs.readFileSync(path.join(root, 'supabase/tests/acl-esperada.json'), 'utf8'))
const FREEZE = '20261027120000_explicit_grants_freeze.sql'

describe('grant parser', () => {
  it('reads a table grant and ignores a missing one', () => {
    const g = tableGrantRoles('grant select on table public.a to authenticated; create table public.b (id int);')
    expect(g.get('public.a')).toEqual(new Set(['authenticated']))
    expect(g.has('public.b')).toBe(false)
  })
  it('reads multi-table lists, "grant all" and schema-less names', () => {
    const g = tableGrantRoles('grant all on public.a, public.b to service_role, authenticated; grant select on c to anon;')
    expect([...g.get('public.b')].sort()).toEqual(['authenticated', 'service_role'])
    expect(g.get('public.c')).toEqual(new Set(['anon']))
  })
  it('does not count a column-level grant as a table grant', () => {
    const g = tableGrantRoles('grant update (note) on public.a to authenticated;')
    expect(g.has('public.a')).toBe(false)
  })
  it('reads grants inside a DO block and function grants without argument lists', () => {
    const f = functionGrantRoles(
      "do $$ begin if to_regprocedure('public.f(text)') is not null then grant execute on function public.f(text) to service_role; end if; end $$;",
    )
    expect(f.get('public.f')).toEqual(new Set(['service_role']))
  })
  it('never counts a revoke as a grant', () => {
    expect(functionGrantRoles('revoke all on function public.f(text) from anon;').size).toBe(0)
  })
  it('finds created tables and functions', () => {
    expect(createdTables('create table if not exists private.x (a int); create table y (a int);')).toEqual(['private.x', 'public.y'])
    expect(createdFunctions('create or replace function public.f(a int) returns int as $$ select 1 $$;')).toEqual(['public.f'])
  })
})

describe('explicit grants in the migrations', () => {
  const tables = [...new Set(migFiles.flatMap((f) => createdTables(read(f))))]
  const granted = tableGrantRoles(allMig)

  it('has found the tables (guards against a parser that silently reads nothing)', () => {
    expect(tables.length).toBeGreaterThanOrEqual(38)
  })

  it('lists every created table in acl-esperada.json', () => {
    const missing = tables.filter((t) => !matrix.tables[t])
    expect(missing).toEqual([])
  })

  it('gives every public table with service_role privileges an explicit service_role grant', () => {
    const missing = tables.filter(
      (t) => matrix.tables[t] && matrix.tables[t].service_role && !(granted.get(t) || new Set()).has('service_role'),
    )
    expect(missing).toEqual([])
  })

  it('gives every table with authenticated privileges an explicit authenticated grant', () => {
    const missing = tables.filter(
      (t) => matrix.tables[t] && matrix.tables[t].authenticated && !(granted.get(t) || new Set()).has('authenticated'),
    )
    expect(missing).toEqual([])
  })

  it('gives every non-trigger function in the matrix an explicit EXECUTE for each role it needs', () => {
    const byName = functionGrantRoles(allMig)
    const problems = []
    for (const [sig, f] of Object.entries(matrix.functions)) {
      if (f.kind === 'trigger' || f.kind === 'private') continue
      const roles = byName.get(sig.replace(/\(.*$/, '')) || new Set()
      for (const r of ['anon', 'authenticated', 'service_role']) if (f[r] && !roles.has(r)) problems.push(`${sig} -> ${r}`)
    }
    expect(problems).toEqual([])
  })

  it('does not hand anon any new privilege without an "anon-ok" reason (from the freeze migration on)', () => {
    const bad = []
    for (const f of migFiles.filter((n) => n >= FREEZE)) {
      for (const chunk of read(f).split(';')) {
        const clean = stripComments(chunk)
        if (grants(clean + ';').some((g) => g.roles.includes('anon')) && !/anon-ok:/.test(chunk)) {
          bad.push(`${f}: ${clean.trim().slice(0, 80)}`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('keeps the freeze migration additive (no revoke, drop or alter)', () => {
    const sql = stripComments(read(FREEZE))
    expect(sql).not.toMatch(/\b(revoke|drop|alter|truncate|delete\s+from)\b/i)
  })
})

describe('acl-esperada.json', () => {
  it('has the sections and a sane shape', () => {
    expect(matrix.version).toBe(1)
    for (const k of ['tables', 'sequences', 'functions', 'extras']) expect(matrix[k]).toBeTruthy()
  })
  it('keeps keys sorted (stable diffs) and never gives anon anything on tables', () => {
    for (const k of ['tables', 'sequences', 'functions']) {
      const keys = Object.keys(matrix[k])
      expect(keys).toEqual([...keys].sort())
    }
    for (const [name, t] of Object.entries(matrix.tables)) expect([name, t.anon || '']).toEqual([name, ''])
  })
})
