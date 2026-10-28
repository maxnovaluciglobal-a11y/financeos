// vitest globalSetup: no test may run with a connection that points at production.
// Production project ref: nelwgbcddwiaimzbcuas (also matches its pooler host).
export const PROD_MARKERS = ['nelwgbcddwiaimzbcuas', 'pooler.supabase.com']
const VARS = ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'DATABASE_URL', 'PGHOST', 'PGDATABASE', 'PGSERVICE', 'SUPABASE_DB_URL']

export function findProdTarget(env = process.env) {
  for (const k of Object.keys(env)) {
    if (!(VARS.includes(k) || k.startsWith('PG'))) continue
    const v = String(env[k] ?? '')
    const hit = PROD_MARKERS.find((m) => v.includes(m))
    if (hit) return { variable: k, marker: hit }
  }
  return null
}

export default function setup() {
  const hit = findProdTarget()
  if (hit) {
    throw new Error(`Refusing to run tests: ${hit.variable} points at production (${hit.marker}). Unset it or use the local test database (scripts/test-db/).`)
  }
}
