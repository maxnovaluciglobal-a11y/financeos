import { describe, it, expect } from 'vitest'
import { initialScripts, checkBudget, staticImports, staticLangImports, MAX_INITIAL_GZIP } from './bundleBudget.js'

const html = (extra = '') => `<script type="module" crossorigin src="/app/assets/index-A.js"></script>
<link rel="modulepreload" crossorigin href="/app/assets/vendor-B.js">${extra}`

describe('presupuesto de carga inicial (C-32)', () => {
  it('lee la entrada y los modulepreload', () => {
    expect(initialScripts(html())).toEqual(['assets/index-A.js', 'assets/vendor-B.js'])
  })
  it('falla si se precarga el PDF o los gráficos (el caso de ING-1)', () => {
    const r = checkBudget(html('<link rel="modulepreload" crossorigin href="/app/assets/pdf-C.js"><link rel="modulepreload" crossorigin href="/app/assets/charts-D.js">'), () => 1000)
    expect(r.errors[0]).toMatch(/pdf-C\.js, assets\/charts-D\.js/)
  })
  it('falla si el JS inicial pasa del tope y pasa por debajo', () => {
    expect(checkBudget(html(), () => MAX_INITIAL_GZIP).errors).toHaveLength(1)
    expect(checkBudget(html(), () => 100 * 1024).errors).toEqual([])
  })
  it('cuenta los imports estáticos de la entrada (sin modulepreload) y tolera ?dpl', () => {
    expect(staticImports('import{r as h}from"./vendor-X.js";import"./charts-Y.js";const a=import("./lazy-Z.js")')).toEqual(['vendor-X.js', 'charts-Y.js'])
    const h = '<script type="module" crossorigin src="/app/assets/index-A.js?dpl=dpl_1"></script>'
    const r = checkBudget(h, () => 10, (f) => f === 'assets/index-A.js' ? 'import"./charts-Y.js"' : '')
    expect(r.files).toEqual(['assets/index-A.js', 'assets/charts-Y.js'])
    expect(r.errors[0]).toMatch(/charts-Y/)
  })
  it('detecta un diccionario importado estáticamente, no el import() de langCache (V4)', () => {
    const chunks = {
      'index-A.js': 'const a=()=>import("./en-Aa1.js")',
      'goals-B.js': 'import{e as x}from"./en-Aa1.js";import"./pt-Bb_2.js";import"./Dashboard-C.js"',
      'en-Aa1.js': 'export const en={}',
    }
    expect(staticLangImports(Object.keys(chunks), f => chunks[f])).toEqual(['goals-B.js -> en-Aa1.js', 'goals-B.js -> pt-Bb_2.js'])
  })
})

// ENG-N8 (19-nov-2026): CI built without Supabase, so supabase-js was tree-shaken out and the budget
// measured ~215 kB while production weighed ~252 of 256 kB. The CI build must see the same code.
describe('CI mide el bundle como producción (ENG-N8)', () => {
  it('el paso npm run build de test.yml define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY', async () => {
    const fs = await import('fs')
    const yml = fs.readFileSync(new URL('../.github/workflows/test.yml', import.meta.url), 'utf8')
    const step = yml.slice(yml.indexOf('- run: npm run build'), yml.indexOf('- run: npm run build') + 300)
    expect(step).toMatch(/VITE_SUPABASE_URL: https:\/\//)
    expect(step).toMatch(/VITE_SUPABASE_ANON_KEY: \S+/)
  })
})
