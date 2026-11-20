import { describe, it, expect } from 'vitest'
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
