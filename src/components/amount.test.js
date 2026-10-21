// <Amount> (investigación UI oct-2026, UI-M2): una sola fuente de formato,
// signo U+2212, símbolo y centavos atenuados en la cifra protagonista y
// respeto de "ocultar montos" (T13).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../i18n/useT.js', () => {
  const useT = () => ({ t: (k) => (k === 'money.hidden' ? 'Monto oculto' : k), lang: 'es' })
  return { useT, useTFor: useT }
})
const { default: Amount } = await import('./Amount.jsx')
const { AppContext } = await import('../context/AppContext.jsx')
const { fmtMoneyParts, fmtSignedMoney, setMoneyLocale, MINUS } = await import('../utils/index.js')

const text = (html) => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')

describe('fmtMoneyParts', () => {
  afterEach(() => setMoneyLocale('CLP', 'es'))
  it('concatenadas dan lo mismo que fmtSignedMoney', () => {
    for (const [cur, lang, sym, n] of [['CLP', 'es', '$', -1234567], ['USD', 'en', '$', 1250.5], ['EUR', 'de', '€', -42.5], ['COP', 'es', '$', 0]]) {
      setMoneyLocale(cur, lang)
      const p = fmtMoneyParts(n, sym)
      expect(p.sign + p.pre + p.int + p.frac + p.post).toBe(fmtSignedMoney(n, sym))
    }
  })
  it('separa los centavos con su separador y el euro va detrás', () => {
    setMoneyLocale('EUR', 'de')
    expect(fmtMoneyParts(1234.5, '€')).toEqual({ sign: '', pre: '', int: '1.234', frac: ',50', post: ' €' })
    setMoneyLocale('USD', 'en')
    expect(fmtMoneyParts(-1234.5, '$')).toEqual({ sign: MINUS, pre: '$', int: '1,234', frac: '.50', post: '' })
  })
  it('"+" solo con plus; cero sin signo', () => {
    expect(fmtMoneyParts(2500, '$', { plus: true }).sign).toBe('+')
    expect(fmtMoneyParts(0, '$', { plus: true }).sign).toBe('')
  })
})

describe('<Amount>', () => {
  afterEach(() => setMoneyLocale('CLP', 'es'))
  it('negativo con U+2212, nunca guion', () => {
    const html = renderToStaticMarkup(h(Amount, { value: -2500, sym: '$' }))
    expect(text(html)).toBe(`${MINUS}$2.500`)
    expect(html).not.toContain('-$')
    expect(html).toContain('class="num amount"')
  })
  it('hero: símbolo y centavos en spans atenuables', () => {
    setMoneyLocale('USD', 'en')
    const html = renderToStaticMarkup(h(Amount, { value: 1250.5, sym: '$', hero: true, plus: true }))
    expect(html).toContain('amount-hero')
    expect(html).toContain('<span class="amount-sym">$</span>')
    expect(html).toContain('<span class="amount-frac">.50</span>')
    expect(text(html)).toBe('+$1,250.50')
  })
  it('con "ocultar montos" el número no llega al DOM', () => {
    const html = renderToStaticMarkup(h(AppContext.Provider, { value: { settings: { hideAmounts: true } } }, h(Amount, { value: 987654, sym: '$' })))
    expect(html).not.toMatch(/987/)
    expect(html).toContain('Monto oculto')
  })
})
