import { describe, it, expect } from 'vitest'
import { parseQuickLine, readNumber, lineFormPatch } from './quickLine.js'
import { getCategoriesExpense, getCategoriesIncome } from './index.js'

// Viernes 30-oct-2026.
const TODAY = '2026-10-30'
const base = { today: TODAY, lang: 'es', defaultType: 'expense', rules: {},
  allowedFor: (t) => (t === 'expense' ? getCategoriesExpense({}) : getCategoriesIncome({})) }
const ve = { ...base, currency: 'VES', country: 'VE', rate: 40 }
const ar = { ...base, currency: 'ARS', country: 'AR', rate: 1400 }
const cl = { ...base, currency: 'CLP', country: 'CL' }
const co = { ...base, currency: 'COP', country: 'CO' }
const mx = { ...base, currency: 'MXN', country: 'MX' }
const us = { ...base, currency: 'USD', country: 'US', lang: 'en', monthFirst: true }
const de = { ...base, currency: 'EUR', country: 'DE', lang: 'de' }
const br = { ...base, currency: 'BRL', country: 'BR', lang: 'pt' }

describe('parseQuickLine · tabla de montos', () => {
  it.each([
    // texto, contexto, monto, descripción
    ['pan 1200', cl, 1200, 'Pan'],
    ['super 45.000', cl, 45000, 'Super'],
    ['super 45.000', ve, 45000, 'Super'],
    ['super 45,000', cl, 45000, 'Super'],
    ['super 45.000', co, 45000, 'Super'],
    ['netflix 9.99', us, 9.99, 'Netflix'],
    ['netflix 9,99', ve, 9.99, 'Netflix'],
    ['arroz 1.200,50', ve, 1200.5, 'Arroz'],
    ['arroz 1,200.50', mx, 1200.5, 'Arroz'],
    ['arroz 1,200.50', ve, 1200.5, 'Arroz'],
    ['alquiler 12.345.678,90', ve, 12345678.9, 'Alquiler'],
    ['alquiler 12.345.678', ve, 12345678, 'Alquiler'],
    ['carro 1.234.567.890,12', ve, 1234567890.12, 'Carro'],
    ['alquiler 1234567,89', ve, 1234567.89, 'Alquiler'],
    ['taxi 12k', cl, 12000, 'Taxi'],
    ['taxi 12K', ar, 12000, 'Taxi'],
    ['taxi 1,5k', ar, 1500, 'Taxi'],
    ['taxi 1.5k', cl, 1500, 'Taxi'],
    ['taxi 12 mil', ar, 12000, 'Taxi'],
    ['taxi 12mil', ar, 12000, 'Taxi'],
    ['taxi 2 mil 500', ar, 2500, 'Taxi'],
    ['taxi mil', ar, 1000, 'Taxi'],
    ['taxi mil 500', ar, 1500, 'Taxi'],
    ['auto 2 millones', ar, 2000000, 'Auto'],
    ['moto 3 palos', co, 3000000, 'Moto'],
    ['cena 5 lucas', ar, 5000, 'Cena'],
    ['pan 1200.', cl, 1200, 'Pan'],
    ['pan de 1200', cl, 1200, 'Pan'],
    ['1200 pan', cl, 1200, 'Pan'],
    ['pan 0,50', ve, 0.5, 'Pan'],
    ['pan 0,500', ve, 0.5, 'Pan'],
    ['pan 1200 pesos', ar, 1200, 'Pan'],
    ['pan bs 1200', ve, 1200, 'Pan'],
    ['pan 1.234', mx, 1234, 'Pan'],
  ])('%s', (text, ctx, amount, description) => {
    const r = parseQuickLine(text, ctx)
    expect(r.status).toBe('ok')
    expect(r.amount).toBe(amount)
    expect(r.description).toBe(description)
    expect(r.usd).toBe(false)
  })
})

describe('parseQuickLine · trampas: lo que no es monto', () => {
  it.each([
    ['7eleven', cl],
    ['mp3', cl],
    ['pan', cl],
    ['8pm', cl],
    ['8:30', cl],
    ['20%', cl],
    ['2x1', cl],
    ['2 kg', cl],
    ['pan 0', cl],
    ['ref 00123456', cl],
    ['ayer', cl],
  ])('%s no da monto', (text, ctx) => {
    const r = parseQuickLine(text, ctx)
    expect(r.status).toBe('noAmount')
    expect(r.amount).toBeNull()
  })

  it.each([
    ['7eleven 12', cl, 12, '7eleven'],
    ['7-eleven 3.500', cl, 3500, '7-eleven'],
    ['forever21 500', cl, 500, 'Forever21'],
    ['pizza 2x1 8000', cl, 8000, 'Pizza 2x1'],
    ['taxi 8pm 1200', cl, 1200, 'Taxi 8pm'],
    ['gym 24/7 5000', cl, 5000, 'Gym 24/7'],
    ['arroz 2 kg 3000', cl, 3000, 'Arroz 2 kg'],
    ['agua 500ml 900', cl, 900, 'Agua 500ml'],
    ['mil sabores 500', cl, 500, 'Mil sabores'],
    ['descuento 20% 900', cl, 900, 'Descuento 20%'],
  ])('%s', (text, ctx, amount, description) => {
    const r = parseQuickLine(text, ctx)
    expect(r.status).toBe('ok')
    expect(r.amount).toBe(amount)
    expect(r.description).toBe(description)
  })

  it('una cantidad con marca de moneda en el otro número no pregunta', () => {
    expect(parseQuickLine('2 cafes $1500', cl)).toMatchObject({ status: 'ok', amount: 1500, description: '2 cafes' })
  })
})

describe('parseQuickLine · ambiguo: pregunta, no adivina', () => {
  it('coma decimal con 3 cifras en VES: 45.500 o 45,50', () => {
    const r = parseQuickLine('super 45,500', ve)
    expect(r.status).toBe('ambiguous')
    expect(r.amount).toBeNull()
    expect(r.options.map(o => o.value)).toEqual([45500, 45.5])
  })
  it('punto decimal en MXN: 45.000 son 45 mil o 45', () => {
    expect(parseQuickLine('super 45.000', mx).options.map(o => o.value)).toEqual([45000, 45])
  })
  it('dos cifras sin marca: las dos son opciones y la otra vuelve a la descripción', () => {
    const r = parseQuickLine('2 cafes 1500', cl)
    expect(r.status).toBe('ambiguous')
    expect(r.options.map(o => o.value)).toEqual([2, 1500])
    expect(r.description).toBe('Cafes')
    expect(parseQuickLine('2 cafes 1500', { ...cl, choice: 1 })).toMatchObject({ status: 'ok', amount: 1500, description: '2 cafes' })
  })
  it('elegir una lectura de separador resuelve el monto', () => {
    expect(parseQuickLine('super 45,500', { ...ve, choice: 1 })).toMatchObject({ status: 'ok', amount: 45.5 })
  })
  it.each([['pan 1.2345', cl], ['pan 8,50', cl], ['pan 1,2,3', ve], ['pan 1.234,567', ve], ['pan 1234.567', ve]])('%s no se entiende', (text, ctx) => {
    expect(parseQuickLine(text, ctx).status).toBe('unreadable')
  })
})

describe('parseQuickLine · moneda', () => {
  it.each([
    ['almuerzo 12 usd', ve, 12],
    ['almuerzo 12usd', ve, 12],
    ['almuerzo us$12', ve, 12],
    ['almuerzo u$s 12', ar, 12],
    ['almuerzo $12', ve, 12],
    ['almuerzo 12$', ve, 12],
    ['almuerzo 12 dólares', ve, 12],
    ['usd 12,50 almuerzo', ve, 12.5],
    ['sueldo 1,500 usd', ve, 1500],
  ])('%s va en US$', (text, ctx, amount) => {
    const r = parseQuickLine(text, ctx)
    expect(r).toMatchObject({ status: 'ok', usd: true, amount, code: 'USD' })
  })

  it('"$" es la moneda local donde ese es su símbolo', () => {
    expect(parseQuickLine('pan $1200', ar)).toMatchObject({ usd: false, amount: 1200 })
    expect(parseQuickLine('pan $1200', { ...co, rate: 4000, showDual: true })).toMatchObject({ usd: false, amount: 1200 })
  })
  it('en la cuenta en US$ no hay nada que convertir', () => {
    expect(parseQuickLine('lunch 12 usd', us)).toMatchObject({ status: 'ok', usd: false, amount: 12 })
  })
  it('sin tasa no se inventa: pide tasa', () => {
    expect(parseQuickLine('almuerzo 12 usd', { ...ve, rate: 0 })).toMatchObject({ status: 'needsRate', amount: null })
  })
  it('otra moneda sin conversión queda como aviso, nunca como moneda local', () => {
    expect(parseQuickLine('hotel 80 eur', ve)).toMatchObject({ status: 'foreign', amount: null, code: 'EUR' })
  })
  it('la moneda activa escrita con su código no cambia nada', () => {
    expect(parseQuickLine('pan 3 eur', de)).toMatchObject({ status: 'ok', amount: 3, usd: false })
    expect(parseQuickLine('pan R$ 12,50', br)).toMatchObject({ status: 'ok', amount: 12.5 })
  })
})

describe('parseQuickLine · tipo', () => {
  it.each([
    ['cobré 500000 sueldo', cl, 'income', 'Sueldo'],
    ['cobre 500000 sueldo', cl, 'income', 'Sueldo'],
    ['sueldo 500000', cl, 'income', 'Sueldo'],
    ['me pagaron 900 freelance', ar, 'income', 'Freelance'],
    ['recibi 300 de ana', ar, 'income', 'Ana'],
    ['+500 regalo', ar, 'income', 'Regalo'],
    ['got paid 3000', us, 'income', ''],
    ['recebi 500', br, 'income', ''],
    ['gehalt 3000', de, 'income', 'Gehalt'],
    ['pagué sueldo 200', ar, 'expense', 'Sueldo'],
    ['pago luz 500', ar, 'expense', 'Luz'],
    ['-500 ropa', ar, 'expense', 'Ropa'],
    ['paid rent 900', us, 'expense', 'Rent'],
    ['gekauft brot 3', de, 'expense', 'Brot'],
  ])('%s', (text, ctx, type, description) => {
    expect(parseQuickLine(text, ctx)).toMatchObject({ status: 'ok', type, description })
  })
  it('sin palabra clave no decide (queda el tipo del formulario)', () => {
    expect(parseQuickLine('pan 1200', cl).type).toBeNull()
  })
  it('trampas: el metal, y "cobro" en medio de la línea', () => {
    expect(parseQuickLine('cable de cobre 300', cl).type).toBeNull()
    expect(parseQuickLine('cable de cobre 300', cl).description).toBe('Cable de cobre')
  })
})

describe('parseQuickLine · fecha (hoy es viernes 30-oct-2026)', () => {
  it.each([
    ['uber 8,50 ayer', ve, '2026-10-29'],
    ['uber 8,50 hoy', ve, '2026-10-30'],
    ['uber 8,50 anteayer', ve, '2026-10-28'],
    ['uber 8,50 antes de ayer', ve, '2026-10-28'],
    ['uber 8,50 el lunes', ve, '2026-10-26'],
    ['uber 8,50 miércoles', ve, '2026-10-28'],
    ['uber 8,50 viernes', ve, '2026-10-23'],
    ['uber 8,50 15/10', ve, '2026-10-15'],
    ['uber 8,50 15-10-2026', ve, '2026-10-15'],
    ['uber 8,50 1/2', ve, '2026-02-01'],
    ['uber 8.50 yesterday', us, '2026-10-29'],
    ['uber 8.50 on monday', us, '2026-10-26'],
    ['uber 8.50 10/15', us, '2026-10-15'],
    ['uber 8,50 ontem', br, '2026-10-29'],
    ['uber 8,50 segunda', br, '2026-10-26'],
    ['uber 8,50 gestern', de, '2026-10-29'],
    ['uber 8,50 am montag', de, '2026-10-26'],
    ['uber 8,50 15.10.', de, '2026-10-15'],
  ])('%s', (text, ctx, date) => {
    const r = parseQuickLine(text, ctx)
    expect(r.date).toBe(date)
    expect(r.description).toBe('Uber')
  })
  it('una fecha futura se ignora, como en Pegar SMS', () => {
    expect(parseQuickLine('regalo 500 31/12', cl)).toMatchObject({ date: null, amount: 500, description: 'Regalo' })
  })
  it('un día que no existe no es fecha ni monto', () => {
    expect(parseQuickLine('pan 31/02', cl).date).toBeNull()
  })
  it('trampas: nombres que parecen días', () => {
    expect(parseQuickLine('santo domingo 500', cl)).toMatchObject({ date: null, description: 'Santo domingo' })
    expect(parseQuickLine('black friday 200', us)).toMatchObject({ date: null, description: 'Black friday' })
    expect(parseQuickLine('segunda mano 500', cl)).toMatchObject({ date: null, description: 'Segunda mano' })
    expect(parseQuickLine('segunda mão 500', br)).toMatchObject({ date: null })
  })
})

describe('parseQuickLine · categoría', () => {
  const rules = { 'farmatodo': 'Salud', 'panaderia lopez': 'Alimentación', 'jumbo': 'Alimentación', 'sueldo': 'Freelance' }
  it('la regla aprendida manda sobre la semilla', () => {
    expect(parseQuickLine('netflix 10', { ...cl, rules: { netflix: 'Servicios' } }).category).toBe('Servicios')
  })
  it('exacta, por prefijo y por palabra', () => {
    expect(parseQuickLine('farmatodo 10', { ...cl, rules }).category).toBe('Salud')
    expect(parseQuickLine('panaderia 10', { ...cl, rules }).category).toBe('Alimentación')
    expect(parseQuickLine('compras jumbo 10', { ...cl, rules }).category).toBe('Alimentación')
  })
  it('usa el comercio de "en <COMERCIO>" como Pegar SMS', () => {
    expect(parseQuickLine('algo en Farmatodo 10', { ...cl, rules }).category).toBe('Salud')
  })
  it('sin reglas, semillas del uso común en 4 idiomas', () => {
    expect(parseQuickLine('uber 8', cl).category).toBe('Transporte')
    expect(parseQuickLine('groceries 8', us).category).toBe('Alimentación')
    expect(parseQuickLine('padaria 8', br).category).toBe('Alimentación')
    expect(parseQuickLine('tanken 8', de).category).toBe('Transporte')
  })
  it('respeta las categorías del tipo', () => {
    expect(parseQuickLine('sueldo 500', cl).category).toBe('Salario')
    expect(parseQuickLine('sueldo 500', { ...cl, rules }).category).toBe('Freelance')
    expect(parseQuickLine('netflix 500', { ...cl, rules: { netflix: 'Salario' } }).category).toBe('Entretención')
  })
  it('sin coincidencia no inventa', () => {
    expect(parseQuickLine('zzz 10', cl).category).toBeNull()
  })
  it('la categoría aparece aunque el monto falte o sea ambiguo', () => {
    expect(parseQuickLine('uber', cl)).toMatchObject({ status: 'noAmount', category: 'Transporte' })
  })
})

describe('parseQuickLine · entradas raras', () => {
  it.each([[''], ['   '], [null], [undefined]])('%s está vacía', (t) => {
    expect(parseQuickLine(t, cl).status).toBe('empty')
  })
  it('sin contexto no revienta', () => {
    expect(parseQuickLine('pan 12').status).toBe('ok')
  })
})

describe('readNumber', () => {
  const v = { decimals: 2, locale: 'es-VE' }
  it('dígitos solos', () => expect(readNumber('1200', v)).toEqual({ value: 1200 }))
  it('agrupación inválida', () => expect(readNumber('1.20.5', v)).toEqual({ unreadable: true }))
  it('moneda sin decimales: 3 cifras tras el separador son miles', () => {
    expect(readNumber('45,000', { decimals: 0, locale: 'es-CL' })).toEqual({ value: 45000 })
  })
})

describe('lineFormPatch', () => {
  const defaults = { type: 'expense', date: TODAY }
  const empty = { type: 'expense', amount: '', desc: '', date: TODAY, usd: false, cat: 'Vivienda' }

  it('rellena lo vacío y recuerda lo que escribió', () => {
    const r = parseQuickLine('uber 8,50 ayer', ve)
    const { patch, filled } = lineFormPatch(r, empty, {}, defaults)
    expect(patch).toMatchObject({ amount: '8,5', desc: 'Uber', date: '2026-10-29', cat: 'Transporte' })
    expect(patch.type).toBeUndefined()
    expect(filled.amount).toBe('8,5')
  })
  it('borrar de la línea devuelve el campo a su valor inicial', () => {
    const first = lineFormPatch(parseQuickLine('uber 8,50 ayer', ve), empty, {}, defaults)
    const form = { ...empty, ...first.patch }
    const { patch } = lineFormPatch(parseQuickLine('uber', ve), form, first.filled, defaults)
    expect(patch.amount).toBe('')
    expect(patch.date).toBe(TODAY)
  })
  it('no pisa lo corregido a mano', () => {
    const first = lineFormPatch(parseQuickLine('uber 8,50', ve), empty, {}, defaults)
    const form = { ...empty, ...first.patch, amount: '99', desc: 'Taxi al aeropuerto' }
    const { patch, filled } = lineFormPatch(parseQuickLine('uber 9', ve), form, first.filled, defaults)
    expect(patch.amount).toBeUndefined()
    expect(patch.desc).toBeUndefined()
    expect(filled.amount).toBeUndefined()
  })
  it('no pisa una categoría elegida a mano ni un tipo cambiado a mano', () => {
    const form = { ...empty, type: 'income' }
    const { patch } = lineFormPatch(parseQuickLine('uber 8', cl), form, {}, defaults, { manualCat: true })
    expect(patch.type).toBeUndefined()
    expect(patch.cat).toBeUndefined()
  })
  it('US$: redondea con los decimales del dólar y enciende la moneda', () => {
    const { patch } = lineFormPatch(parseQuickLine('almuerzo 12,50 usd', ve), empty, {}, defaults, { decimals: 2 })
    expect(patch).toMatchObject({ amount: '12,5', usd: true })
  })
  it('moneda sin decimales', () => {
    expect(lineFormPatch(parseQuickLine('pan 1.200', cl), empty, {}, defaults, { decimals: 0 }).patch.amount).toBe('1200')
  })
})
