import { describe, it, expect } from 'vitest'
import {
  parseIntake, parseIntakeAmount, cleanText, hasIntake, stripIntakeParams, stashIntake, takeIntake,
  captureIntake, intakeFormValues, isIosSafariTab, INTAKE_KEY, INTAKE_TTL_MS, MAX_MERCHANT,
} from './autoEntry.js'

const TODAY = '2026-11-19'
const q = (o) => '?' + new URLSearchParams(o).toString()

function memStorage() {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }
}

describe('parseIntake: contrato de la URL', () => {
  it('el ejemplo del contrato', () => {
    const r = parseIntake('?add=gasto&monto=12500&comercio=Lider&moneda=CLP&fuente=applepay', { today: TODAY })
    expect(r).toEqual({ type: 'expense', amount: 12500, amountStatus: 'ok', amountText: '12500', merchant: 'Lider', currency: 'CLP', source: 'applepay', date: null })
  })
  it('sin add no hay alta; add desconocido tampoco', () => {
    expect(parseIntake('?monto=10', { today: TODAY })).toBeNull()
    expect(parseIntake('?add=borrar&monto=10', { today: TODAY })).toBeNull()
    expect(parseIntake('', { today: TODAY })).toBeNull()
  })
  it('acepta ingreso y los alias en inglés', () => {
    expect(parseIntake('?add=ingreso&monto=5', { today: TODAY }).type).toBe('income')
    expect(parseIntake('?add=income', { today: TODAY }).type).toBe('income')
    expect(parseIntake('?add=EXPENSE', { today: TODAY }).type).toBe('expense')
  })
  it('fuente desconocida queda "otra"', () => {
    expect(parseIntake('?add=gasto&fuente=<script>', { today: TODAY }).source).toBe('otra')
    expect(parseIntake('?add=gasto', { today: TODAY }).source).toBe('otra')
  })
  it('fecha: válida y no futura; si no, null', () => {
    expect(parseIntake('?add=gasto&fecha=2026-11-18', { today: TODAY }).date).toBe('2026-11-18')
    expect(parseIntake('?add=gasto&fecha=2026-11-20', { today: TODAY }).date).toBeNull()
    expect(parseIntake('?add=gasto&fecha=2026-02-30', { today: TODAY }).date).toBeNull()
    expect(parseIntake('?add=gasto&fecha=ayer', { today: TODAY }).date).toBeNull()
  })
  it('moneda: solo un código de 3 letras', () => {
    expect(parseIntake('?add=gasto&monto=5&moneda=eur', { today: TODAY }).currency).toBe('EUR')
    expect(parseIntake('?add=gasto&monto=5&moneda=EURO', { today: TODAY }).currency).toBeNull()
    expect(parseIntake('?add=gasto&monto=5&moneda=E1R', { today: TODAY }).currency).toBeNull()
  })
  it('el código de moneda del parámetro manda sobre el símbolo del monto', () => {
    expect(parseIntake(q({ add: 'gasto', monto: '€5', moneda: 'USD' }), { today: TODAY }).currency).toBe('USD')
  })
})

describe('parseIntakeAmount: el monto como lo escribe el Atajo', () => {
  const cases = [
    ['12500', 'CLP', 12500, null],
    ['$12.500', 'CLP', 12500, null],
    ['$12.500,00', 'CLP', 12500, null],
    ['$12,500.00', 'CLP', 12500, null],
    ['CLP 12.500', 'CLP', 12500, 'CLP'],
    ['12,50 €', 'EUR', 12.5, 'EUR'],
    ['€12.50', 'EUR', 12.5, 'EUR'],
    ['US$ 5.99', 'CLP', 5.99, 'USD'],
    ['R$ 30,90', 'BRL', 30.9, 'BRL'],
    ['S/ 15.50', 'PEN', 15.5, 'PEN'],
    ['Bs. 1.234,56', 'VES', 1234.56, 'VES'],
    ['45.000', 'COP', 45000, null],
    ['1 234,56 €', 'EUR', 1234.56, 'EUR'],
    ['+20', 'CLP', 20, null],
  ]
  for (const [raw, fb, amount, currency] of cases) {
    it(`"${raw}" → ${amount}`, () => {
      const r = parseIntakeAmount(raw, { fallbackCurrency: fb })
      expect(r.status).toBe('ok')
      expect(r.amount).toBe(amount)
      expect(r.currency).toBe(currency)
    })
  }
  it('negativo: rechazado (devoluciones no se cargan por URL)', () => {
    for (const raw of ['-500', '−500', '$-500', '(500)', '500-', 'CLP-500']) expect(parseIntakeAmount(raw).status, raw).toBe('negative')
  })
  it('vacío, cero, NaN, texto o enorme: sin monto', () => {
    expect(parseIntakeAmount('').status).toBe('missing')
    expect(parseIntakeAmount(null).status).toBe('missing')
    expect(parseIntakeAmount('0').status).toBe('unreadable')
    expect(parseIntakeAmount('NaN').status).toBe('unreadable')
    expect(parseIntakeAmount('Infinity').status).toBe('unreadable')
    expect(parseIntakeAmount('1e5').status).toBe('unreadable')
    expect(parseIntakeAmount('doce').status).toBe('unreadable')
    expect(parseIntakeAmount('999999999999999').status).toBe('unreadable')
    expect(parseIntakeAmount('12.').status).toBe('unreadable')
  })
  it('dos lecturas posibles (punto decimal): no se adivina', () => {
    const r = parseIntakeAmount('4.500', { fallbackCurrency: 'MXN' })
    expect(r.status).toBe('ambiguous')
    expect(r.amount).toBeNull()
    expect(r.options).toEqual([4500, 4.5])
  })
  it('el texto del monto tiene tope de largo', () => {
    expect(parseIntakeAmount('1'.repeat(200)).text.length).toBeLessThanOrEqual(40)
  })
})

describe('cleanText: saneado del comercio', () => {
  it('quita etiquetas HTML y caracteres peligrosos', () => {
    expect(cleanText('<img src=x onerror=alert(1)>Lider', 60)).toBe('Lider')
    expect(cleanText('<script>alert("x")</script>Jumbo', 60)).toBe('alert(x) Jumbo')
    expect(cleanText('Café "Haití" `x`', 60)).toBe('Café Haití x')
  })
  it('quita control y bidi (U+202E invierte el texto)', () => {
    expect(cleanText('Lider‮redil', 60)).toBe('Lider redil')
    expect(cleanText('a\u0000b\nc\td', 60)).toBe('a b c d')
    expect(cleanText('Uber​ Eats', 60)).toBe('Uber Eats')
  })
  it('colapsa espacios y corta en el máximo sin partir un emoji', () => {
    expect(cleanText('  Santa    Isabel  ', 60)).toBe('Santa Isabel')
    expect(cleanText('x'.repeat(500), MAX_MERCHANT)).toHaveLength(MAX_MERCHANT)
    const s = cleanText('a'.repeat(59) + '😀😀', MAX_MERCHANT)
    expect(Array.from(s)).toHaveLength(60)
    expect(s.endsWith('😀')).toBe(true)
  })
  it('null y números', () => {
    expect(cleanText(null, 10)).toBe('')
    expect(cleanText(123, 10)).toBe('123')
  })
  it('un comercio con HTML llega limpio a la intake', () => {
    expect(parseIntake(q({ add: 'gasto', comercio: '<b>Lider</b> Express' }), { today: TODAY }).merchant).toBe('Lider Express')
  })
})

describe('limpieza de la URL', () => {
  it('hasIntake', () => {
    expect(hasIntake('?add=gasto')).toBe(true)
    expect(hasIntake('?demo=true')).toBe(false)
  })
  it('stripIntakeParams deja el resto (demo, persona) y el hash', () => {
    expect(stripIntakeParams('https://app.moyiq.app/app/?demo=true&add=gasto&monto=1&comercio=x&moneda=CLP&fuente=applepay&fecha=2026-11-01#a'))
      .toBe('/app/?demo=true#a')
    expect(stripIntakeParams('https://app.moyiq.app/app/?add=gasto&monto=1')).toBe('/app/')
  })
})

describe('stash / take: una vez y con caducidad', () => {
  const intake = parseIntake('?add=gasto&monto=12500&comercio=Lider', { today: TODAY })
  it('se lee una sola vez', () => {
    const st = memStorage()
    stashIntake(intake, st, 1000)
    expect(takeIntake(st, 2000)).toMatchObject({ type: 'expense', amount: 12500, merchant: 'Lider' })
    expect(takeIntake(st, 2000)).toBeNull()
  })
  it('caduca a los 15 minutos', () => {
    const st = memStorage()
    stashIntake(intake, st, 0)
    expect(takeIntake(st, INTAKE_TTL_MS + 1)).toBeNull()
  })
  it('lo guardado se vuelve a sanear (el almacenamiento no es de fiar)', () => {
    const st = memStorage()
    st.setItem(INTAKE_KEY, JSON.stringify({ type: 'expense', amount: -5, merchant: '<b>x</b>', currency: 'clp', source: 'evil', date: 'x', at: 10 }))
    expect(takeIntake(st, 20)).toEqual({ type: 'expense', amount: null, amountStatus: 'missing', amountText: '', merchant: 'x', currency: null, source: 'otra', date: null })
  })
  it('JSON roto o tipo inválido: null', () => {
    const st = memStorage()
    st.setItem(INTAKE_KEY, '{nope'); expect(takeIntake(st, 1)).toBeNull()
    st.setItem(INTAKE_KEY, JSON.stringify({ type: 'delete', at: 1 })); expect(takeIntake(st, 2)).toBeNull()
  })
  it('sin almacenamiento no explota', () => {
    expect(takeIntake(null)).toBeNull()
    expect(() => stashIntake(intake, null)).not.toThrow()
  })
})

describe('captureIntake (arranque)', () => {
  it('guarda el alta y limpia la URL', () => {
    const st = memStorage()
    const calls = []
    const history = { state: { a: 1 }, replaceState: (s, _t, url) => calls.push([s, url]) }
    const location = { search: '?demo=true&add=gasto&monto=8000&comercio=Copec', href: 'https://app.moyiq.app/app/?demo=true&add=gasto&monto=8000&comercio=Copec' }
    const r = captureIntake({ location, history, storage: st, now: 5 })
    expect(r.merchant).toBe('Copec')
    expect(calls).toEqual([[{ a: 1 }, '/app/?demo=true']])
    expect(takeIntake(st, 6).amount).toBe(8000)
  })
  it('un add inválido igual se limpia, pero no se guarda nada', () => {
    const st = memStorage()
    const calls = []
    captureIntake({ location: { search: '?add=x', href: 'https://a.b/app/?add=x' }, history: { replaceState: (...a) => calls.push(a) }, storage: st })
    expect(calls).toHaveLength(1)
    expect(st._m.size).toBe(0)
  })
  it('sin add no toca nada', () => {
    const calls = []
    expect(captureIntake({ location: { search: '?open=import', href: 'https://a.b/app/?open=import' }, history: { replaceState: (...a) => calls.push(a) }, storage: memStorage() })).toBeNull()
    expect(calls).toHaveLength(0)
  })
})

describe('intakeFormValues', () => {
  const base = { type: 'expense', amount: 12500, amountStatus: 'ok', merchant: 'Lider', currency: 'CLP', date: null }
  it('misma moneda o sin moneda: el monto va directo', () => {
    expect(intakeFormValues(base, { currency: 'CLP' })).toMatchObject({ amount: 12500, usd: false, note: null, desc: 'Lider' })
    expect(intakeFormValues({ ...base, currency: null }, { currency: 'COP' })).toMatchObject({ amount: 12500, note: null })
  })
  it('US$ con tasa guardada: en modo US$; sin tasa: aviso y sin monto', () => {
    expect(intakeFormValues({ ...base, currency: 'USD', amount: 5 }, { currency: 'VES', rate: 40 })).toMatchObject({ amount: 5, usd: true, note: null })
    expect(intakeFormValues({ ...base, currency: 'USD', amount: 5 }, { currency: 'VES', rate: 0 })).toMatchObject({ amount: null, note: 'foreign', code: 'USD' })
  })
  it('otra moneda: no se convierte, se avisa', () => {
    expect(intakeFormValues({ ...base, currency: 'EUR' }, { currency: 'CLP' })).toMatchObject({ amount: null, note: 'foreign', code: 'EUR' })
  })
  it('sin monto: el motivo', () => {
    expect(intakeFormValues({ ...base, amount: null, amountStatus: 'negative' }, { currency: 'CLP' }).note).toBe('negative')
    expect(intakeFormValues({ ...base, amount: null, amountStatus: 'missing' }, { currency: 'CLP' }).note).toBe('missing')
  })
})

describe('isIosSafariTab', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  it('Safari en iPhone: sí; la app instalada: no', () => {
    expect(isIosSafariTab({ userAgent: iphone, standalone: false })).toBe(true)
    expect(isIosSafariTab({ userAgent: iphone, standalone: true })).toBe(false)
    expect(isIosSafariTab({ userAgent: iphone }, true)).toBe(false)
  })
  it('iPad que se presenta como Mac', () => {
    expect(isIosSafariTab({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 })).toBe(true)
    expect(isIosSafariTab({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 0 })).toBe(false)
  })
  it('Android: no', () => {
    expect(isIosSafariTab({ userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile' })).toBe(false)
  })
})
