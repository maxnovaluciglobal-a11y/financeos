import { describe, it, expect } from 'vitest'
import { spokenToLine, parseSpoken, parseVoiceLine, germanNumber, speechLang } from './voiceEntry.js'

// Jueves 19-nov-2026
const TODAY = '2026-11-19'
const YDAY = '2026-11-18'
const CTX = {
  CL: { currency: 'CLP', lang: 'es', today: TODAY },
  CO: { currency: 'COP', lang: 'es', today: TODAY },
  AR: { currency: 'ARS', lang: 'es', today: TODAY },
  MX: { currency: 'MXN', lang: 'es', today: TODAY },
  VE: { currency: 'VES', lang: 'es', today: TODAY, rate: 40 },
  ES: { currency: 'EUR', lang: 'es', today: TODAY },
  US: { currency: 'USD', lang: 'en', today: TODAY, monthFirst: true },
  DE: { currency: 'EUR', lang: 'de', today: TODAY },
  BR: { currency: 'BRL', lang: 'pt', today: TODAY },
  PT: { currency: 'EUR', lang: 'pt', today: TODAY },
}

// [frase, país, esperado]. Las claves ausentes de `esperado` no se miran.
const CASES = [
  // Chile (CLP, sin decimales)
  ['almuerzo 8 mil', 'CL', { amount: 8000, description: 'Almuerzo', category: 'Alimentación', type: null }],
  ['almuerzo ocho mil', 'CL', { amount: 8000, description: 'Almuerzo' }],
  ['uber 4.500 ayer', 'CL', { amount: 4500, description: 'Uber', category: 'Transporte', date: YDAY }],
  ['pagué 25 lucas de luz', 'CL', { amount: 25000, description: 'Luz', category: 'Servicios', type: 'expense' }],
  ['50k supermercado', 'CL', { amount: 50000, description: 'Supermercado', category: 'Alimentación' }],
  ['café tres mil quinientos', 'CL', { amount: 3500, description: 'Café', category: 'Alimentación' }],
  ['una luca el pan', 'CL', { amount: 1000, description: 'Pan', category: 'Alimentación' }],
  ['bencina 30 lucas anteayer', 'CL', { amount: 30000, description: 'Bencina', category: 'Transporte', date: '2026-11-17' }],
  ['farmacia 12.990 el lunes', 'CL', { amount: 12990, category: 'Salud', date: '2026-11-16' }],
  ['arriendo 450 mil', 'CL', { amount: 450000, category: 'Vivienda' }],
  ['me pagaron el sueldo un millón doscientos mil', 'CL', { amount: 1200000, type: 'income', description: 'Sueldo' }],
  ['medio palo de arriendo', 'CL', { amount: 500000, description: 'Arriendo', category: 'Vivienda' }],
  ['un palo y medio el notebook', 'CL', { amount: 1500000, description: 'Notebook' }],
  ['netflix 7.990', 'CL', { amount: 7990, category: 'Entretención' }],
  ['hace tres días taxi 6 mil', 'CL', { amount: 6000, category: 'Transporte', date: '2026-11-16' }],
  ['anota un gasto de 15 mil en el gimnasio', 'CL', { amount: 15000, description: 'Gimnasio', category: 'Deporte', type: 'expense' }],
  ['gasté 20 lucas en bencina ayer', 'CL', { amount: 20000, description: 'Bencina', date: YDAY, type: 'expense' }],
  ['supermercado 45.990 pesos', 'CL', { amount: 45990 }],
  ['ingreso de 300 mil por freelance', 'CL', { amount: 300000, type: 'income', description: 'Freelance' }],
  ['Lider 12.500', 'CL', { amount: 12500, category: 'Alimentación' }],
  // Colombia (COP)
  ['almuerzo 25 mil', 'CO', { amount: 25000 }],
  ['taxi doce mil quinientos', 'CO', { amount: 12500, category: 'Transporte' }],
  ['mercado 150 mil', 'CO', { amount: 150000, category: 'Alimentación' }],
  ['pagué el internet 89.900', 'CO', { amount: 89900, description: 'Internet', category: 'Servicios' }],
  ['un palo el arriendo', 'CO', { amount: 1000000, category: 'Vivienda' }],
  // Argentina (ARS)
  ['nafta 30 lucas', 'AR', { amount: 30000, category: 'Transporte' }],
  ['café 2.500', 'AR', { amount: 2500 }],
  // México (MXN, punto decimal)
  ['tacos 150 pesos', 'MX', { amount: 150, description: 'Tacos' }],
  ['uber 85.50', 'MX', { amount: 85.5 }],
  ['comida doscientos cincuenta', 'MX', { amount: 250, category: 'Alimentación' }],
  // Venezuela (VES con tasa)
  ['harina 3 dólares', 'VE', { amount: 3, usd: true, description: 'Harina' }],
  ['pasaje 50 bolos', 'VE', { amount: 50, usd: false }],
  // España (EUR en español)
  ['café 3,50 euros', 'ES', { amount: 3.5, category: 'Alimentación' }],
  ['café tres euros con cincuenta', 'ES', { amount: 3.5, description: 'Café' }],
  ['cena treinta y dos euros', 'ES', { amount: 32, category: 'Alimentación' }],
  ['tres con cincuenta el café', 'ES', { amount: 3.5, description: 'Café' }],
  // Estados Unidos (USD, en)
  ['coffee 4.50', 'US', { amount: 4.5, category: 'Alimentación' }],
  ['lunch twelve dollars yesterday', 'US', { amount: 12, date: YDAY, category: 'Alimentación' }],
  ['spent fifty bucks on groceries', 'US', { amount: 50, description: 'Groceries', type: 'expense', category: 'Alimentación' }],
  ['uber twenty five dollars and forty cents', 'US', { amount: 25.4, category: 'Transporte' }],
  ['rent two thousand', 'US', { amount: 2000, category: 'Vivienda' }],
  ['got paid 3,200 salary', 'US', { amount: 3200, type: 'income', category: 'Salario' }],
  ['parking 12 three days ago', 'US', { amount: 12, date: '2026-11-16', category: 'Transporte' }],
  ['netflix 15.99 on monday', 'US', { amount: 15.99, category: 'Entretención', date: '2026-11-16' }],
  ['add an expense of a hundred for the gym', 'US', { amount: 100, description: 'Gym', type: 'expense' }],
  // Alemania (EUR, de)
  ['Kaffee 3,50 Euro', 'DE', { amount: 3.5, category: 'Alimentación' }],
  ['Mittagessen zwölf Euro gestern', 'DE', { amount: 12, date: YDAY, category: 'Alimentación' }],
  ['Tanken fünfundsechzig Euro', 'DE', { amount: 65, category: 'Transporte' }],
  ['Miete zwölfhundert', 'DE', { amount: 1200, category: 'Vivienda' }],
  ['ich habe 20 Euro für Pizza ausgegeben', 'DE', { amount: 20, description: 'Pizza', type: 'expense', category: 'Alimentación' }],
  ['Supermarkt drei Euro fünfzig', 'DE', { amount: 3.5, category: 'Alimentación' }],
  ['Apotheke 12 Komma 99', 'DE', { amount: 12.99, category: 'Salud' }],
  ['Gehalt 2.500 erhalten', 'DE', { amount: 2500, type: 'income', category: 'Salario' }],
  ['vor zwei Tagen Taxi 18 Euro', 'DE', { amount: 18, date: '2026-11-17', category: 'Transporte' }],
  ['ein Kaffee 4 Euro', 'DE', { amount: 4, description: 'Kaffee' }],
  // Brasil (BRL) y Portugal (EUR, pt)
  ['almoço 35 reais', 'BR', { amount: 35, category: 'Alimentación' }],
  ['uber vinte e cinco reais ontem', 'BR', { amount: 25, date: YDAY, category: 'Transporte' }],
  ['padaria doze reais e cinquenta', 'BR', { amount: 12.5, category: 'Alimentación' }],
  ['mercado 2 mil', 'BR', { amount: 2000 }],
  ['recebi 3 mil de salário', 'BR', { amount: 3000, type: 'income', category: 'Salario' }],
  ['luz 150 reais há três dias', 'BR', { amount: 150, date: '2026-11-16', category: 'Servicios' }],
  ['mil e quinhentos de aluguel', 'BR', { amount: 1500, description: 'Aluguel', category: 'Vivienda' }],
  ['café 1,20 euros', 'PT', { amount: 1.2 }],
]

describe('parseSpoken · frases dictadas (≥40, 4 idiomas, 10 países)', () => {
  it('hay al menos 40 casos', () => expect(CASES.length).toBeGreaterThanOrEqual(40))
  for (const [phrase, country, want] of CASES) {
    it(`${country} · "${phrase}"`, () => {
      const r = parseSpoken(phrase, CTX[country])
      expect(r.status, `línea: ${spokenToLine(phrase, CTX[country])}`).toBe('ok')
      for (const [k, v] of Object.entries(want)) expect(r[k], `${k} (línea: ${spokenToLine(phrase, CTX[country])})`).toEqual(v)
    })
  }
})

describe('parseSpoken · no adivina', () => {
  it('punto decimal en MXN: 4.500 pregunta', () => {
    const r = parseSpoken('uber 4.500 ayer', CTX.MX)
    expect(r.status).toBe('ambiguous')
    expect(r.options.map(o => o.value)).toEqual([4500, 4.5])
  })
  it('sin monto: noAmount, con la descripción', () => {
    const r = parseSpoken('almuerzo con Ana', CTX.CL)
    expect(r.status).toBe('noAmount')
  })
  it('vacío', () => expect(parseSpoken('', CTX.CL).status).toBe('empty'))
  it('centavos en una moneda sin decimales: no se lee', () => {
    expect(parseSpoken('café tres con cincuenta', CTX.CL).status).toBe('unreadable')
  })
  it('dólares sin tasa: pide tasa', () => {
    expect(parseSpoken('harina 3 dólares', CTX.CL).status).toBe('needsRate')
  })
  it('euros en una cuenta en pesos: aviso, nunca como moneda local', () => {
    expect(parseSpoken('café 3,50 euros', CTX.CL).status).toBe('foreign')
  })
})

describe('spokenToLine', () => {
  const es = { lang: 'es', today: TODAY }
  it('números con palabras', () => {
    expect(spokenToLine('veintiún mil', es)).toBe('21000')
    expect(spokenToLine('dos mil veintiséis', es)).toBe('2026')
    expect(spokenToLine('ciento veinte mil', es)).toBe('120000')
    expect(spokenToLine('noventa y nueve', es)).toBe('99')
  })
  it('un/una/a/ein solo son número delante de escala, multiplicador o moneda', () => {
    expect(spokenToLine('un café', es)).toBe('un café')
    expect(spokenToLine('una luca', es)).toBe('1 luca')
    expect(spokenToLine('a coffee', { lang: 'en', today: TODAY })).toBe('a coffee')
    expect(spokenToLine('ein Kaffee', { lang: 'de', today: TODAY })).toBe('ein Kaffee')
  })
  it('"8 mil" escrito con cifra se deja para quickLine', () => {
    expect(spokenToLine('almuerzo 8 mil', es)).toBe('almuerzo 8 mil')
  })
  it('fecha relativa con año (no cae en el futuro en enero)', () => {
    expect(spokenToLine('hace 3 días taxi', { lang: 'es', today: '2026-01-02' })).toBe('30/12/2025 taxi')
    expect(spokenToLine('taxi 3 days ago', { lang: 'en', today: '2026-01-02', monthFirst: true })).toBe('taxi 12/30/2025')
  })
  it('jerga: bucks, bolos', () => {
    expect(spokenToLine('fifty bucks', { lang: 'en', today: TODAY })).toBe('50 dollars')
    expect(spokenToLine('50 bolos', es)).toBe('50 bs')
  })
  it('puntuación del reconocimiento', () => {
    expect(spokenToLine('Almuerzo, ocho mil.', es)).toBe('Almuerzo 8000')
  })
})

describe('germanNumber', () => {
  it('compuestos', () => {
    expect(germanNumber('fünfundzwanzig')).toBe(25)
    expect(germanNumber('zweitausenddreihundert')).toBe(2300)
    expect(germanNumber('hundertfünfzig')).toBe(150)
    expect(germanNumber('dreißig')).toBe(30)
    expect(germanNumber('einundzwanzig')).toBe(21)
  })
  it('palabras que no son números', () => {
    for (const w of ['Grundsteuer', 'Bund', 'und', 'Hundefutter', 'Kaffee']) expect(germanNumber(w), w).toBeNull()
  })
})

describe('parseVoiceLine', () => {
  it('la regla aprendida de la persona manda', () => {
    const r = parseVoiceLine('pagué 5000 en el chino', { ...CTX.CL, rules: { chino: 'Alimentación' } })
    expect(r.description).toBe('Chino')
    expect(r.category).toBe('Alimentación')
  })
})

describe('speechLang', () => {
  it('idioma de la app + país', () => {
    expect(speechLang('es', 'CL')).toBe('es-CL')
    expect(speechLang('es', 'DE')).toBe('es-ES')
    expect(speechLang('en', 'US')).toBe('en-US')
    expect(speechLang('en', 'CL')).toBe('en-US')
    expect(speechLang('pt', 'PT')).toBe('pt-PT')
    expect(speechLang('pt', 'BR')).toBe('pt-BR')
    expect(speechLang('de', 'AT')).toBe('de-AT')
    expect(speechLang('de', 'DE')).toBe('de-DE')
  })
})
