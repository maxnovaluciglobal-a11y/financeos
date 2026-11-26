import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { searchMatches, POPULAR } from './tickerSearch.js'

const groups = [
  { key: 'portfolio', items: [{ t: 'AAPL' }, { t: 'SQM-B.SN' }] },
  { key: 'watch', items: [{ t: 'aapl' }, { t: 'NVDA' }] },
  { key: 'popular', items: POPULAR },
]

describe('searchMatches (gsMatches de Invest)', () => {
  it('sin texto: lo de la persona (portafolio y lista), sin repetir', () => {
    expect(searchMatches('', groups).map(x => [x.t, x.group])).toEqual([['AAPL', 'portfolio'], ['SQM-B.SN', 'portfolio'], ['NVDA', 'watch']])
  })
  it('prefijo del ticker antes que contiene y antes que el nombre', () => {
    const r = searchMatches('me', groups).map(x => x.t)
    expect(r.slice(0, 2).sort()).toEqual(['MELI', 'META'])
    expect(searchMatches('sq', groups)[0].t).toBe('SQM-B.SN')
    expect(searchMatches('apple', groups)[0]).toMatchObject({ t: 'AAPL', group: 'portfolio', name: 'Apple' })
    expect(searchMatches('alphabet', groups)[0].t).toBe('GOOGL')
  })
  it('cualquier ticker válido escrito se puede abrir aunque no esté en la lista', () => {
    const r = searchMatches('ggal.ba', groups)
    expect(r.at(-1)).toEqual({ t: 'GGAL.BA', name: null, group: 'typed', open: true })
    expect(searchMatches('AAPL', groups).filter(x => x.open)).toHaveLength(0)
    expect(searchMatches('no válido', groups).some(x => x.open)).toBe(false)
  })
  it('hasta 7 resultados más la opción de abrir', () => {
    expect(searchMatches('a', groups).filter(x => !x.open).length).toBeLessThanOrEqual(7)
  })
  it('ignora tildes y mayúsculas en el nombre', () => {
    expect(searchMatches('BÍTCOIN', groups)[0].t).toBe('BTC-USD')
  })
})

// Encabezado de una fila (26-nov-2026, propuesta 3): interruptor + lupa, sin
// "Ayuda" en la fila (el "?" de arriba es la ayuda de la pantalla) y con el
// aviso educativo y la ayuda de Inversiones al pie.
describe('encabezado de Inversiones', () => {
  const hub = fs.readFileSync(new URL('./InvestHub.jsx', import.meta.url), 'utf8')
  const row = hub.slice(hub.indexOf('className={s.toolRow}'), hub.indexOf('role="tabpanel"'))
  it('una fila: interruptor compacto y lupa que despliega el buscador', () => {
    expect(row).toContain('<ViewToggle view={view} onChange={setView} compact />')
    expect(row).toMatch(/className=\{s\.searchBtn\}[\s\S]*aria-label=\{t\('invest\.search\.label'\)\}[\s\S]*aria-expanded=\{search\}[\s\S]*aria-controls="invest-search"/)
    // El buscador solo se monta al abrirlo, con el foco en el campo, y al cerrarlo el foco vuelve a la lupa.
    expect(row).toMatch(/\{search && <TickerSearch[\s\S]*?focusOnMount onClose=\{closeSearch\}/)
    expect(hub).toMatch(/closeSearch = useCallback\(\(\) => \{ setSearch\(false\); searchBtn\.current\?\.focus\(\) \}/)
    // Ni "Ayuda" ni el aviso educativo en la fila de arriba.
    expect(row).not.toContain('helpBtn')
    expect(row).not.toContain('<EduNotice')
  })
  it('al pie: el aviso educativo (salvo Resumen, que trae el suyo) y la ayuda de Inversiones', () => {
    const foot = hub.slice(hub.indexOf('className={s.foot}'))
    expect(hub.indexOf('className={s.foot}')).toBeGreaterThan(hub.indexOf('role="tabpanel"'))
    expect(foot).toContain("{tab !== 'resumen' && <EduNotice />}")
    expect(foot).toMatch(/onClick=\{\(\) => setHelp\(true\)\} aria-haspopup="dialog"/)
  })
  it('la lupa mide 44 px', () => {
    const css = fs.readFileSync(new URL('./hub.module.css', import.meta.url), 'utf8')
    expect(css).toMatch(/\.searchBtn \{[^}]*width: 44px; height: 44px;[^}]*border-radius: 50%/)
  })
})
