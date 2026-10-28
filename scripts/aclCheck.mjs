#!/usr/bin/env node
// Compares an ACL catalog snapshot (supabase/tests/acl_catalog.sql) with the expected
// matrix (supabase/tests/acl-esperada.json). Read-only: it only reads two JSON files.
//
//   node scripts/aclCheck.mjs --catalog acl.json --matrix supabase/tests/acl-esperada.json
//
// Exit 1 when there are faltantes (a required privilege is missing), sin clasificar (an
// object the matrix does not know), defaults (default privileges of `postgres` that hand out
// access to anon/authenticated) or rls (a table that lost row level security).
// sobrantes (more than the matrix allows) and obsoletos are warnings until the tightening
// migration is approved; pass --strict to make sobrantes fail too.
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROLES = ['anon', 'authenticated', 'service_role']
const set = (s) => new Set((s || '').split(''))

export function parseDefaultAcl(text) {
  // "{postgres=rwU/postgres,service_role=rwU/postgres}"
  return String(text || '')
    .replace(/^\{|\}$/g, '')
    .split(',')
    .filter(Boolean)
    .map((e) => {
      const [grantee, rest = ''] = e.split('=')
      return { grantee: grantee || 'PUBLIC', privs: rest.split('/')[0] }
    })
}

function diffObject(name, got, want, extras, out, label) {
  for (const role of ROLES) {
    const have = set(got[role])
    const need = set(want[role])
    const tolerated = set(extras[role])
    for (const p of need) if (!have.has(p)) out.faltantes.push(`${label} ${name} ${role}: falta '${p}'`)
    for (const p of have) if (!need.has(p) && !tolerated.has(p)) out.sobrantes.push(`${label} ${name} ${role}: sobra '${p}'`)
  }
}

export function compare(catalog, matrix, { ignore = [] } = {}) {
  const out = { faltantes: [], sobrantes: [], sinClasificar: [], obsoletos: [], defaults: [], rls: [] }
  if (!catalog || typeof catalog !== 'object' || !catalog.tables || !matrix || !matrix.tables) {
    throw new Error('catalog or matrix is not in the expected shape')
  }
  const extras = matrix.extras || {}
  // replay_only: legacy overloads that exist only when the migrations are replayed (production dropped
  // them by hand): known drift, not an unclassified object.
  const skip = new Set([...ignore, ...(matrix.replay_only || [])])
  const groups = [
    ['tables', 'tabla'],
    ['sequences', 'secuencia'],
    ['functions', 'función'],
  ]
  for (const [key, label] of groups) {
    const got = catalog[key] || {}
    const want = matrix[key] || {}
    for (const name of Object.keys(got)) {
      if (skip.has(name)) continue
      if (!want[name]) out.sinClasificar.push(`${label} ${name}`)
    }
    for (const name of Object.keys(want)) {
      if (skip.has(name)) continue
      if (!got[name]) {
        out.obsoletos.push(`${label} ${name}`)
        continue
      }
      diffObject(name, got[name], want[name], extras, out, label)
      if (key === 'tables' && want[name].rls && !got[name].rls) out.rls.push(`tabla ${name}: sin row level security`)
      if (key === 'functions' && got[name].public_execute && !want[name].public_execute) {
        out.sobrantes.push(`función ${name} PUBLIC: ejecutable por cualquier rol (falta revoke ... from public)`)
      }
    }
  }
  for (const d of catalog.default_acls || []) {
    if (d.owner !== 'postgres') continue // supabase_admin defaults are platform-managed
    for (const e of parseDefaultAcl(d.acl)) {
      if (e.grantee === 'anon' || e.grantee === 'authenticated' || e.grantee === 'PUBLIC') {
        out.defaults.push(`default privileges de postgres (${d.object}, ${d.schema}): ${e.grantee}=${e.privs}`)
      }
    }
  }
  return out
}

export function verdict(out, { strict = false } = {}) {
  const fail = out.faltantes.length + out.sinClasificar.length + out.defaults.length + out.rls.length
  return fail > 0 || (strict && out.sobrantes.length > 0) ? 1 : 0
}

function readJson(path) {
  const raw = fs.readFileSync(path, 'utf8')
  const data = JSON.parse(raw)
  // `supabase db query -o json` wraps rows; psql -A -t gives the document directly.
  return data && data.rows && data.rows[0] && data.rows[0].acl ? data.rows[0].acl : data
}

function main() {
  const args = process.argv.slice(2)
  const arg = (n) => {
    const i = args.indexOf(n)
    return i >= 0 ? args[i + 1] : undefined
  }
  const catalogPath = arg('--catalog')
  const matrixPath = arg('--matrix')
  if (!catalogPath || !matrixPath) {
    console.error('usage: aclCheck.mjs --catalog <json> --matrix <json> [--strict]')
    process.exit(2)
  }
  let out
  try {
    out = compare(readJson(catalogPath), readJson(matrixPath))
  } catch (e) {
    console.error(`aclCheck: cannot compare (${e.message})`)
    process.exit(2)
  }
  for (const [k, v] of Object.entries(out)) {
    console.log(`${k}: ${v.length}`)
    for (const line of v) console.log(`  - ${line}`)
  }
  process.exit(verdict(out, { strict: args.includes('--strict') }))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
