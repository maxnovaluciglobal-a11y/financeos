// Static reader for the GRANT / REVOKE / CREATE statements in the SQL files. It is a
// deliberately small parser (plain statements, no PL/pgSQL evaluation): the migrations
// write their grants flat on purpose so this and the tests can read them.
//
// Used by supabase/tests/grants-explicitos.test.js and by the one-off analysis scripts.

const ROLES = ['anon', 'authenticated', 'service_role']

// Remove -- line comments and /* */ blocks, keeping string literals intact enough for
// our purpose (the migrations never put "--" inside a string that matters here).
export function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, '')
}

export function statements(sql) {
  return stripComments(sql)
    .split(';')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

const qualify = (name) => {
  const clean = name.replace(/"/g, '').toLowerCase()
  return clean.includes('.') ? clean : `public.${clean}`
}

export function createdTables(sql) {
  const out = []
  for (const s of statements(sql)) {
    const m = /\bcreate (?:unlogged )?table (?:if not exists )?([\w."]+)/i.exec(s)
    if (m) out.push(qualify(m[1]))
  }
  return out
}

export function createdViews(sql) {
  const out = []
  for (const s of statements(sql)) {
    const m = /\bcreate (?:or replace )?(?:materialized )?view ([\w."]+)/i.exec(s)
    if (m) out.push(qualify(m[1]))
  }
  return out
}

export function createdFunctions(sql) {
  const out = []
  for (const s of statements(sql)) {
    const m = /\bcreate (?:or replace )?function ([\w."]+)\s*\(/i.exec(s)
    if (m) out.push(qualify(m[1]))
  }
  return out
}

// Splits "a, b(text, int), c" at top-level commas (function signatures contain commas).
function splitTopLevel(list) {
  const parts = []
  let depth = 0
  let cur = ''
  for (const ch of list) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

const PRIV_WORDS = ['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger', 'usage', 'execute', 'all']

// Returns [{ type, names, privs, roles, columnLevel }]. `names` are qualified, lowercase,
// and for functions carry no argument list (name-level matching).
export function grants(sql) {
  const out = []
  for (const s of statements(sql)) {
    const m = /\bgrant (.+?) on (?:(table|sequence|function|schema) )?(.+?) to (.+)$/i.exec(s)
    if (!m) continue
    const privText = m[1]
    const type = (m[2] || 'table').toLowerCase()
    const columnLevel = /\(\s*[\w", ]+\)/.test(privText)
    const privs = privText
      .replace(/\([^)]*\)/g, '')
      .split(',')
      .map((p) => p.trim().toLowerCase())
      .filter((p) => PRIV_WORDS.includes(p))
    const roles = m[4]
      .replace(/ with grant option$/i, '')
      .split(',')
      .map((r) => r.trim().toLowerCase())
    const names = splitTopLevel(m[3]).map((n) => qualify(n.replace(/\(.*$/, '').trim()))
    out.push({ type, names, privs, roles, columnLevel })
  }
  return out
}

export function revokes(sql) {
  const out = []
  for (const s of statements(sql)) {
    const m = /\brevoke (.+?) on (?:(table|sequence|function|schema) )?(.+?) from (.+)$/i.exec(s)
    if (!m) continue
    out.push({
      type: (m[2] || 'table').toLowerCase(),
      names: splitTopLevel(m[3]).map((n) => qualify(n.replace(/\(.*$/, '').trim())),
      roles: m[4].split(',').map((r) => r.trim().toLowerCase()),
    })
  }
  return out
}

// Map of "schema.name" -> Set of roles that receive a table-level privilege in this SQL.
// A column-level grant ("grant update (a) on t to r") does NOT count.
export function tableGrantRoles(sql) {
  const map = new Map()
  for (const g of grants(sql)) {
    if (g.type !== 'table' || g.columnLevel) continue
    for (const n of g.names) {
      const set = map.get(n) || new Set()
      g.roles.forEach((r) => set.add(r))
      map.set(n, set)
    }
  }
  return map
}

// Map of "schema.name" -> Set of roles that receive EXECUTE through a GRANT in this SQL
// (name-level: overloads share an entry). A REVOKE never counts as a grant.
export function functionGrantRoles(sql) {
  const map = new Map()
  for (const g of grants(sql)) {
    if (g.type !== 'function') continue
    for (const n of g.names) {
      const set = map.get(n) || new Set()
      g.roles.forEach((r) => set.add(r))
      map.set(n, set)
    }
  }
  return map
}

export { ROLES }
