// src/pages/Import/fileParser.js
// Parser CSV — sin dependencias externas · 100% local · sin envío de datos

export const MAX_ROWS = 1000

// Errores con `code` para que la pantalla los muestre en el idioma del usuario
// ('imp.fileErr.<code>'); el mensaje en español queda como respaldo/log.
function importError(code, message, detail) {
  const e = new Error(message)
  e.code = code
  if (detail) e.detail = detail
  return e
}
export const SUPPORTED_TYPES = ['.csv', '.xlsx', '.xls', '.pdf']

export async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'xlsx' || ext === 'xls') {
    return parseXLSX(file)
  }
  if (ext === 'pdf') {
    return parsePDF(file)
  }
  if (ext !== 'csv') {
    throw importError('format', 'Formato no soportado. Se aceptan archivos .csv, .xlsx, .xls y .pdf')
  }
  const text = await readAsText(file)
  return parseCSV(text)
}

// ── PDF (beta) ────────────────────────────────────────────────────────────────
// Cartolas en PDF de texto. 100% local: pdfjs se carga bajo demanda (dynamic
// import) y el texto NUNCA sale del dispositivo. Reconstruimos líneas por
// coordenada Y y detectamos transacciones (una fecha + un monto por línea).
// Es heurístico y variable por banco → por eso el usuario SIEMPRE revisa antes
// de importar. Devuelve la misma forma {headers, rows} que el resto del pipeline.
const PDF_DATE_RE = /(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/
// Monto: separador de miles y/o decimal, con al menos 3 dígitos o un decimal.
const PDF_AMOUNT_RE = /-?\$?\s?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?-?|-?\$?\s?\d+[.,]\d{2}-?/g

async function extractPdfLines(file) {
  const pdfjs = await import('pdfjs-dist')
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  } catch { /* algunos bundlers resuelven el worker solo */ }
  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise
  const lines = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    // Agrupar items por Y (misma línea), luego ordenar por X y unir.
    const byRow = new Map()
    for (const it of content.items) {
      if (!it.str || !it.str.trim()) continue
      const y = Math.round(it.transform[5])
      const x = it.transform[4]
      if (!byRow.has(y)) byRow.set(y, [])
      byRow.get(y).push({ x, s: it.str })
    }
    const ys = [...byRow.keys()].sort((a, b) => b - a) // arriba→abajo
    for (const y of ys) {
      const text = byRow.get(y).sort((a, b) => a.x - b.x).map(o => o.s).join(' ').replace(/\s+/g, ' ').trim()
      if (text) lines.push(text)
    }
  }
  return lines
}

function parsePdfLinesToRows(lines) {
  const rows = []
  let idx = 0
  for (const line of lines) {
    const dm = line.match(PDF_DATE_RE)
    if (!dm) continue
    const amounts = line.match(PDF_AMOUNT_RE)
    if (!amounts || amounts.length === 0) continue
    // Layout típico de cartola: "fecha  descripción  IMPORTE  SALDO". Cuando hay
    // ≥2 montos, el último es el saldo corrido → el importe del movimiento es el
    // penúltimo. Con un solo monto, ese es el importe. (El usuario revisa igual.)
    const amountStr = amounts.length >= 2 ? amounts[amounts.length - 2] : amounts[amounts.length - 1]
    // Descripción = lo que queda entre la fecha y el monto, sin números sueltos.
    let desc = line
      .replace(dm[0], ' ')
      .replace(amountStr, ' ')
    // quitar montos intermedios (saldos) de la descripción
    desc = desc.replace(PDF_AMOUNT_RE, ' ').replace(/\s+/g, ' ').trim()
    if (!desc) desc = 'Movimiento'
    rows.push({ _rowIndex: idx++, fecha: dm[0], descripcion: desc, monto: amountStr })
  }
  return rows
}

async function parsePDF(file) {
  const lines = await extractPdfLines(file)
  const rows = parsePdfLinesToRows(lines)
  if (rows.length === 0) {
    throw importError('pdfEmpty', 'No se detectaron movimientos en el PDF. Puede ser un PDF escaneado (imagen) o un formato no reconocido. Prueba con el CSV o el Excel del banco.')
  }
  return {
    headers: ['fecha', 'descripcion', 'monto'],
    rows: rows.slice(0, MAX_ROWS),
    totalLines: rows.length,
    sourceType: 'pdf',
  }
}

// Convierte un valor de celda de exceljs a texto plano, mismo criterio que
// XLSX.utils.sheet_to_json({raw:false, dateNF:'yyyy-mm-dd'}) tenía antes:
// fechas como yyyy-mm-dd, celdas vacías como '', fórmulas resueltas a su
// resultado, texto enriquecido aplanado a string simple.
function excelCellToString(value) {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map(rt => rt.text).join('')
    if ('result' in value) return excelCellToString(value.result)
    if ('text' in value) return String(value.text)
    return ''
  }
  return String(value)
}

// Misma heurística de siempre, separada de la lectura del archivo para poder
// testearla en Node sin FileReader: algunos bancos meten filas vacías o de
// título antes del header real, así que se busca la primera fila con ≥3
// celdas no vacías en vez de asumir que el header está en la fila 0.
export function rowsFromMatrix(jsonRows, sourceType, sheetName) {
  if (!jsonRows || jsonRows.length < 2) {
    throw importError('xlsxEmpty', 'El archivo Excel no contiene filas válidas.')
  }
  let headerRowIdx = 0
  for (let i = 0; i < Math.min(10, jsonRows.length); i++) {
    const row = jsonRows[i]
    const nonEmpty = row.filter(c => c && String(c).trim())
    if (nonEmpty.length >= 3) { headerRowIdx = i; break }
  }
  const headers = jsonRows[headerRowIdx]
    .map(h => String(h || '').trim())
    .filter(h => h)
  const dataRows = []
  for (let i = headerRowIdx + 1; i < jsonRows.length; i++) {
    const cells = jsonRows[i]
    if (!cells || cells.every(c => !c || !String(c).trim())) continue
    const row = { _rowIndex: i }
    headers.forEach((h, idx) => { row[h] = String(cells[idx] || '').trim() })
    dataRows.push(row)
  }
  return {
    headers,
    rows: dataRows.slice(0, MAX_ROWS),
    totalLines: dataRows.length,
    sourceType,
    sheetName,
  }
}

// Lee un ArrayBuffer .xlsx/.xls con exceljs y lo reduce a la misma matriz
// header:1 que producía XLSX.utils.sheet_to_json, para reusar rowsFromMatrix
// sin cambiar el resto del pipeline. Separada de parseXLSX (que depende de
// FileReader, solo disponible en el navegador) para poder testearla en Node.
export async function parseWorkbookBuffer(arrayBuffer) {
  // Carga bajo demanda (dynamic import) — mismo criterio que pdfjs-dist en
  // extractPdfLines(): un CSV no necesita esta librería en absoluto, así que
  // no debería bajar en el chunk de Import solo por abrir la página.
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(arrayBuffer)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) throw importError('xlsxNoSheet', 'El archivo Excel no contiene hojas.')
  const jsonRows = []
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    jsonRows.push(row.values.slice(1).map(excelCellToString))
  })
  return rowsFromMatrix(jsonRows, 'xlsx', worksheet.name)
}

async function parseXLSX(file) {
  let buffer
  try {
    buffer = await file.arrayBuffer()
  } catch {
    throw importError('xlsxRead', 'No se pudo leer el archivo Excel')
  }
  try {
    return await parseWorkbookBuffer(buffer)
  } catch (err) {
    if (err.code) throw err
    throw importError('xlsxParse', 'Error al leer el Excel: ' + err.message, err.message)
  }
}

function readAsText(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = e => {
      try {
        const buf = e.target.result
        const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf)
        // Si el decode UTF-8 metió caracteres de reemplazo, el archivo probablemente
        // es ISO-8859-1 (típico en exports de Comdirect y bancos EU tradicionales).
        if (utf8.includes('�')) {
          res(new TextDecoder('iso-8859-1').decode(buf))
        } else {
          res(utf8)
        }
      } catch (err) {
        rej(importError('decode', 'No se pudo decodificar el archivo'))
      }
    }
    r.onerror = () => rej(importError('read', 'No se pudo leer el archivo'))
    r.readAsArrayBuffer(file)
  })
}

export function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return { headers: [], rows: [], totalLines: 0 }
  const delimiter = detectDelimiter(lines[0])
  const headers = splitLine(lines[0], delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''))
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cells = splitLine(line, delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''))
    if (cells.length >= 2) {
      const row = { _rowIndex: i }
      headers.forEach((h, idx) => { row[h] = cells[idx] || '' })
      rows.push(row)
    }
  }
  return { headers, rows: rows.slice(0, MAX_ROWS), totalLines: lines.length - 1 }
}

function detectDelimiter(line) {
  const counts = { ',': 0, ';': 0, '\t': 0, '|': 0 }
  for (const ch of line) if (counts[ch] !== undefined) counts[ch]++
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

function splitLine(line, delimiter) {
  const result = []
  let current = '', inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"' || ch === "'") { inQuotes = !inQuotes; continue }
    if (ch === delimiter && !inQuotes) { result.push(current); current = ''; continue }
    current += ch
  }
  result.push(current)
  return result
}

export function detectColumns(headers) {
  const lower = headers.map(h => h.toLowerCase())
  const find = (kw) => { const i = lower.findIndex(h => kw.some(k => h.includes(k))); return i >= 0 ? headers[i] : null }
  return {
    // + pt/de ('data', 'datum', 'descrição', 'beschreibung', 'betrag'): el CSV
    // que exporta la app en portugués o alemán tiene que volver a importarse.
    date:        find(['fecha', 'date', 'día', 'dia', 'fec', 'datum', 'data']),
    description: find(['descripcion', 'descripción', 'concepto', 'detalle', 'desc', 'glosa', 'nombre', 'beschreibung', 'verwendungszweck']),
    amount:      find(['monto', 'importe', 'amount', 'valor', 'total', 'suma', 'betrag']),
    debit:       find(['debito', 'débito', 'cargo', 'egreso', 'debit', 'retiro']),
    credit:      find(['credito', 'crédito', 'abono', 'ingreso', 'credit', 'deposito']),
    category:    find(['categoria', 'categoría', 'category', 'kategorie', 'tipo', 'rubro']),
    account:     find(['cuenta', 'account', 'tarjeta', 'card']),
  }
}

// ── Fechas DD/MM vs MM/DD ────────────────────────────────────────────────────
// Antes se asumía siempre DD/MM: un CSV de un banco de EEUU ("03/15/2026")
// quedaba con mes 15. El orden se decide UNA vez por archivo, mirando todas
// las filas (detectDateOrder) y se aplica igual a todas (normalizeDate).
const NUM_DATE_RE = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})(?!\d)/

// 'DMY' | 'MDY'. Evidencia del archivo primero (un campo > 12 no puede ser
// mes); si todo es ambiguo, el formato que declara la plantilla del banco
// (bankTemplates.dateFormat) y si no hay, la región del usuario: US → MDY,
// cualquier otra → DMY (comportamiento histórico).
export function detectDateOrder(values, { templateFormat, locale } = {}) {
  let firstOver12 = false, secondOver12 = false
  for (const v of values || []) {
    const m = String(v ?? '').trim().match(NUM_DATE_RE)
    if (!m) continue
    if (Number(m[1]) > 12) firstOver12 = true
    if (Number(m[2]) > 12) secondOver12 = true
  }
  if (firstOver12 && !secondOver12) return 'DMY'
  if (secondOver12 && !firstOver12) return 'MDY'
  const tf = String(templateFormat || '').toUpperCase()
  if (/^MM[\/.\-]DD/.test(tf)) return 'MDY'
  if (/^DD[\/.\-]MM/.test(tf)) return 'DMY'
  const region = String(locale || '').split(/[-_]/)[1]?.toUpperCase()
  return region === 'US' ? 'MDY' : 'DMY'
}

export function normalizeDate(str, order = 'DMY') {
  if (!str) return null
  const s = String(str).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(NUM_DATE_RE)
  if (!m) return null
  const [a, b] = [Number(m[1]), Number(m[2])]
  const [day, month] = order === 'MDY' ? [b, a] : [a, b]
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const year = m[3].length === 2 ? (Number(m[3]) > 50 ? `19${m[3]}` : `20${m[3]}`) : m[3]
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function normalizeAmount(str) {
  if (!str && str !== 0) return null
  const s = String(str).trim()
  if (!s) return null
  let clean = s.replace(/[^\d,.\-]/g, '')
  const commaDecimal = /^\-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(clean) || /^\-?\d+(,\d{1,2})$/.test(clean)
  if (commaDecimal) clean = clean.replace(/\./g, '').replace(',', '.')
  else clean = clean.replace(/,/g, '')
  const n = parseFloat(clean)
  return isNaN(n) ? null : n
}

export function detectTransactionType(row, mapping, config) {
  const { mode, negativeIsExpense } = config
  if (mode === 'debit_credit') {
    const d = normalizeAmount(row[mapping.debit])
    const c = normalizeAmount(row[mapping.credit])
    if (d && Math.abs(d) > 0) return 'expense'
    if (c && Math.abs(c) > 0) return 'income'
    return 'expense'
  }
  const amount = normalizeAmount(row[mapping.amount])
  if (amount === null) return null
  return negativeIsExpense ? (amount < 0 ? 'expense' : 'income') : (amount > 0 ? 'income' : 'expense')
}

export function getAmount(row, mapping, config) {
  if (config.mode === 'debit_credit') {
    const d = normalizeAmount(row[mapping.debit])
    const c = normalizeAmount(row[mapping.credit])
    if (d && Math.abs(d) > 0) return Math.abs(d)
    if (c && Math.abs(c) > 0) return Math.abs(c)
    return 0
  }
  const a = normalizeAmount(row[mapping.amount])
  return a !== null ? Math.abs(a) : 0
}

// config.dateOrder fuerza el orden; si no, se detecta con todas las filas
// (config.dateFormat = el de la plantilla del banco, config.locale = la región
// del usuario, ej. 'en-US'). errors son códigos ('date' | 'amount' |
// 'description'): la pantalla de importación los traduce.
export function validateRows(rows, mapping, config = {}) {
  const order = config.dateOrder || detectDateOrder(rows.map(r => r[mapping.date]), { templateFormat: config.dateFormat, locale: config.locale })
  return rows.map(row => {
    const date = normalizeDate(row[mapping.date], order)
    const amount = getAmount(row, mapping, config)
    const type = detectTransactionType(row, mapping, config)
    const description = (row[mapping.description] || '').trim()
    const errors = []
    if (!date) errors.push('date')
    if (!amount || amount === 0) errors.push('amount')
    if (!description) errors.push('description')
    return { _rowIndex: row._rowIndex, date: date || '', description, amount, type, category: row[mapping.category] || '', account: row[mapping.account] || '', originalDescription: description, status: errors.length > 0 ? 'error' : 'valid', errors }
  })
}

// Días entre dos fechas ISO (yyyy-mm-dd), en valor absoluto. Devuelve Infinity
// si alguna no parsea, para que nunca cuente como "cercano" por error.
function daysApart(a, b) {
  const ta = Date.parse(a + 'T00:00:00'), tb = Date.parse(b + 'T00:00:00')
  if (isNaN(ta) || isNaN(tb)) return Infinity
  return Math.abs(ta - tb) / 86400000
}

export function detectDuplicates(validatedRows, existingRecords) {
  // Índice exacto (fecha|descripción|monto) + índice por monto → fechas, para
  // detectar POSIBLES duplicados aunque la descripción difiera (cartola vs
  // registro manual): mismo monto y fecha ±2 días. Sirve para "limpiar el mes".
  const existingKeys = new Set()
  const byAmount = new Map() // monto(centavos) → [fechas ISO]
  for (const r of existingRecords) {
    const cents = Math.round((r.amount || 0) * 100)
    existingKeys.add(`${r.date}|${(r.description || r.concept || '').toLowerCase().trim()}|${cents}`)
    if (!byAmount.has(cents)) byAmount.set(cents, [])
    byAmount.get(cents).push(r.date)
  }
  const batchKeys = new Set()
  return validatedRows.map(row => {
    if (row.status === 'error') return row
    const cents = Math.round(row.amount * 100)
    const key = `${row.date}|${row.description.toLowerCase().trim()}|${cents}`
    const isDuplicateExternal = existingKeys.has(key)
    const isDuplicateBatch = batchKeys.has(key)
    batchKeys.add(key)
    // Posible duplicado: mismo monto y fecha ±2 días (descripción distinta).
    let isProbableDuplicate = false
    if (!isDuplicateExternal && byAmount.has(cents)) {
      isProbableDuplicate = byAmount.get(cents).some(d => daysApart(d, row.date) <= 2)
    }
    const isDup = isDuplicateExternal || isDuplicateBatch || isProbableDuplicate
    return { ...row, status: isDup ? 'duplicate' : 'valid', isDuplicateExternal, isDuplicateBatch, isProbableDuplicate }
  })
}

// ── Auto-sugerencia de categoría ─────────────────────────────────────────────
// Heurística local, sin IA de servidor: busca en los movimientos YA categorizados
// por el propio usuario si hay una descripción con la misma "palabra
// significativa" (normalmente el nombre del comercio, ej. "COMPRA WALMART 1234"
// -> "WALMART") y sugiere la categoría más frecuente que ese comercio tuvo.
// Nunca sugiere 'Importado' (no es una categoría real, es el fallback de cuando
// no hay sugerencia) ni categorías vacías.
function normalizeForMatch(desc) {
  return String(desc || '')
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita tildes
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Prefijos genéricos de cartola bancaria (ES/EN/PT) que NO identifican al
// comercio — sin filtrarlos, "COMPRA CAFE X" y "COMPRA DESCONOCIDA Y" matchean
// entre sí por la palabra "COMPRA" y la sugerencia sale mal.
const GENERIC_WORDS = new Set([
  'COMPRA', 'PAGO', 'PAG', 'RETIRO', 'DEPOSITO', 'TRANSFERENCIA', 'TRANSF',
  'ABONO', 'CARGO', 'DEBITO', 'CREDITO', 'COBRO', 'GIRO', 'COMISION',
  'NACIONAL', 'INTERNACIONAL', 'TARJETA', 'TC',
  'PURCHASE', 'PAYMENT', 'WITHDRAWAL', 'DEPOSIT', 'TRANSFER', 'CHARGE', 'FEE',
])

function significantToken(desc) {
  const words = normalizeForMatch(desc).split(' ')
    .filter(w => w.length >= 3 && !/^\d+$/.test(w) && !GENERIC_WORDS.has(w))
  return words[0] || null
}

export function suggestCategory(description, existingRecords) {
  const token = significantToken(description)
  if (!token) return null
  const counts = {}
  for (const r of existingRecords || []) {
    if (!r.category || r.category === 'Importado') continue
    const rToken = significantToken(r.originalDescription || r.description || r.concept)
    if (rToken === token) counts[r.category] = (counts[r.category] || 0) + 1
  }
  const entries = Object.entries(counts)
  if (entries.length === 0) return null
  entries.sort((a, b) => b[1] - a[1])
  return entries[0][0]
}

export function createImportBatch(fileName, rows) {
  const imported = rows.filter(r => r._include && r.status === 'valid')
  return {
    id: `batch_${Date.now()}`,
    fileName,
    importedAt: new Date().toISOString(),
    totalRows: rows.length,
    importedRows: imported.length,
    skippedRows: rows.filter(r => !r._include || r.status === 'error').length,
    duplicateRows: rows.filter(r => r.status === 'duplicate').length,
    totalIncome: imported.filter(r => r.type === 'income').reduce((s,r) => s+r.amount, 0),
    totalExpense: imported.filter(r => r.type === 'expense').reduce((s,r) => s+r.amount, 0),
  }
}

export function buildTransactions(rows, batchId, importedAt) {
  const incomes = [], expenses = []
  const now = importedAt || new Date().toISOString()
  rows.forEach(row => {
    if (!row._include || row.status !== 'valid') return
    const base = { date: row.date, description: row.description, concept: row.description, amount: row.amount, category: row.category || 'Importado', account: row.account || '', notes: '', source: 'csv', importBatchId: batchId, importedAt: now, originalDescription: row.originalDescription }
    if (row.type === 'income') incomes.push(base)
    else expenses.push(base)
  })
  return { incomes, expenses }
}
