// Fechas DD/MM vs MM/DD (bug: un CSV de banco de EEUU "03/15/2026" se leía
// como día 3, mes 15 → fecha inválida). El orden se decide POR ARCHIVO:
// cualquier primer campo > 12 → DD/MM; cualquier segundo campo > 12 → MM/DD;
// si todo es ambiguo, manda el formato declarado por la plantilla del banco y
// después la región del usuario (US → MM/DD, el resto → DD/MM).
import { describe, it, expect } from 'vitest'
import { detectDateOrder, normalizeDate, validateRows, detectColumns } from './fileParser.js'
import { detectBankTemplate, BANK_TEMPLATES } from './bankTemplates.js'

describe('detectDateOrder', () => {
  it('un primer campo > 12 en cualquier fila → DMY', () => {
    expect(detectDateOrder(['03/04/2026', '25/04/2026'])).toBe('DMY')
  })
  it('un segundo campo > 12 en cualquier fila → MDY', () => {
    expect(detectDateOrder(['03/04/2026', '04/25/2026'])).toBe('MDY')
  })
  it('lo decide la fila que desambigua aunque esté al final', () => {
    const vals = Array.from({ length: 40 }, () => '01/02/2026').concat('12/31/2026')
    expect(detectDateOrder(vals)).toBe('MDY')
  })
  it('ambiguo + plantilla del banco declarada', () => {
    expect(detectDateOrder(['03/04/2026'], { templateFormat: 'MM/DD/YYYY' })).toBe('MDY')
    expect(detectDateOrder(['03.04.2026'], { templateFormat: 'DD.MM.YYYY' })).toBe('DMY')
  })
  it('ambiguo sin plantilla: la región del usuario', () => {
    expect(detectDateOrder(['03/04/2026'], { locale: 'en-US' })).toBe('MDY')
    expect(detectDateOrder(['03/04/2026'], { locale: 'es-US' })).toBe('MDY')
    expect(detectDateOrder(['03/04/2026'], { locale: 'en-GB' })).toBe('DMY')
    expect(detectDateOrder(['03/04/2026'], { locale: 'es-CL' })).toBe('DMY')
    expect(detectDateOrder(['03/04/2026'])).toBe('DMY')
  })
  it('la evidencia del archivo le gana a la plantilla y a la región', () => {
    expect(detectDateOrder(['13/04/2026'], { templateFormat: 'MM/DD/YYYY', locale: 'en-US' })).toBe('DMY')
    expect(detectDateOrder(['04/13/2026'], { templateFormat: 'DD.MM.YYYY', locale: 'es-CL' })).toBe('MDY')
  })
  it('ignora ISO y celdas vacías', () => {
    expect(detectDateOrder(['2026-04-13', '', null, '05/20/2026'])).toBe('MDY')
  })
})

describe('normalizeDate con orden', () => {
  it('MDY (EEUU)', () => {
    expect(normalizeDate('03/15/2026', 'MDY')).toBe('2026-03-15')
    expect(normalizeDate('3/5/26', 'MDY')).toBe('2026-03-05')
  })
  it('DMY (por defecto, como siempre)', () => {
    expect(normalizeDate('15/03/2026')).toBe('2026-03-15')
    expect(normalizeDate('15.03.2026', 'DMY')).toBe('2026-03-15')
    expect(normalizeDate('05-03-26', 'DMY')).toBe('2026-03-05')
  })
  it('ISO no depende del orden', () => {
    expect(normalizeDate('2026-03-15', 'MDY')).toBe('2026-03-15')
  })
  it('una fecha imposible para el orden elegido no se inventa', () => {
    expect(normalizeDate('03/15/2026', 'DMY')).toBeNull()
    expect(normalizeDate('15/03/2026', 'MDY')).toBeNull()
  })
})

describe('validateRows detecta el orden por archivo', () => {
  const mapping = { date: 'Date', description: 'Description', amount: 'Amount' }
  const cfg = { mode: 'single', negativeIsExpense: true }
  it('CSV de EEUU: todas las filas quedan en MDY, incluidas las ambiguas', () => {
    const rows = [
      { _rowIndex: 1, Date: '03/04/2026', Description: 'COFFEE', Amount: '-4.50' },
      { _rowIndex: 2, Date: '03/15/2026', Description: 'GROCERY', Amount: '-82.10' },
    ]
    const out = validateRows(rows, mapping, cfg)
    expect(out.map(r => r.date)).toEqual(['2026-03-04', '2026-03-15'])
    expect(out.every(r => r.status === 'valid')).toBe(true)
  })
  it('archivo ambiguo con región US del usuario', () => {
    const rows = [{ _rowIndex: 1, Date: '03/04/2026', Description: 'X', Amount: '-1' }]
    expect(validateRows(rows, mapping, { ...cfg, locale: 'en-US' })[0].date).toBe('2026-03-04')
    expect(validateRows(rows, mapping, { ...cfg, locale: 'es-CL' })[0].date).toBe('2026-04-03')
  })
  it('errores por fila como códigos (la UI los traduce)', () => {
    const rows = [{ _rowIndex: 1, Date: 'ayer', Description: '', Amount: 'x' }]
    expect(validateRows(rows, mapping, cfg)[0].errors).toEqual(['date', 'amount', 'description'])
  })
})

describe('plantillas de EEUU', () => {
  it('Chase tarjeta se detecta como Chase y no como MACH (mejor coincidencia gana)', () => {
    const t = detectBankTemplate(['Transaction Date', 'Post Date', 'Description', 'Category', 'Type', 'Amount', 'Memo'])
    expect(t?.id).toBe('chase_card')
  })
  it('Chase cuenta corriente', () => {
    expect(detectBankTemplate(['Details', 'Posting Date', 'Description', 'Amount', 'Type', 'Balance', 'Check or Slip #'])?.id).toBe('chase_checking')
  })
  it('Capital One tarjeta', () => {
    expect(detectBankTemplate(['Transaction Date', 'Posted Date', 'Card No.', 'Description', 'Category', 'Debit', 'Credit'])?.id).toBe('capitalone_card')
  })
  it('un export MACH sigue detectándose como MACH', () => {
    expect(detectBankTemplate(['date', 'description', 'amount', 'type'])?.id).toBe('mach')
  })
  it('las plantillas de EEUU declaran MM/DD/YYYY o ISO', () => {
    for (const t of BANK_TEMPLATES.filter(b => b.country === 'US')) expect(['MM/DD/YYYY', 'YYYY-MM-DD']).toContain(t.dateFormat)
  })
})

describe('detectColumns reconoce el CSV que exporta la app en en/pt/de', () => {
  it.each([
    [['Type', 'Date', 'Description', 'Category', 'Amount', 'Method', 'Recurrence', 'Notes']],
    [['Tipo', 'Data', 'Descrição', 'Categoria', 'Valor', 'Método', 'Recorrência', 'Notas']],
    [['Typ', 'Datum', 'Beschreibung', 'Kategorie', 'Betrag', 'Zahlungsart', 'Wiederholung', 'Notizen']],
  ])('%j', (headers) => {
    const m = detectColumns(headers)
    expect(m.date).toBe(headers[1]); expect(m.description).toBe(headers[2]); expect(m.amount).toBe(headers[4])
  })
})
