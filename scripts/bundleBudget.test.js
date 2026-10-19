import { describe, it, expect } from 'vitest'
import { initialScripts, checkBudget, MAX_INITIAL_GZIP } from './bundleBudget.js'

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
})
