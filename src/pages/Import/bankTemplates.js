// src/pages/Import/bankTemplates.js
// Templates de bancos (CL, MX, CO, DE, US) — detección automática de formato
// v1.4 — sin dependencias externas · 100% local

/**
 * Cada template define:
 * - name: nombre del banco
 * - flag: emoji bandera/logo
 * - delimiter: separador del CSV
 * - fingerprint: keywords únicas en headers para detectar el banco
 * - mapping: mapeo de columnas
 * - config: modo (debit_credit o single) y signo
 * - dateFormat: hint para el parser
 * - skipRows: filas a saltar al inicio (algunos bancos tienen headers en fila 2+)
 */

export const BANK_TEMPLATES = [
  {
    id: 'bancoestado',
    name: 'BancoEstado',
    flag: '🏦',
    country: 'CL',
    delimiter: ';',
    fingerprint: ['fecha', 'descripcion', 'debito', 'credito', 'saldo'],
    mapping: {
      date:        'Fecha',
      description: 'Descripcion',
      debit:       'Debito',
      credit:      'Credito',
    },
    config: { mode: 'debit_credit', negativeIsExpense: false },
    hint: 'Cartola BancoEstado — separador punto y coma',
  },
  {
    id: 'bancochile',
    name: 'Banco Chile',
    flag: '🏦',
    country: 'CL',
    delimiter: ';',
    fingerprint: ['fecha', 'glosa', 'cargo', 'abono', 'saldo'],
    mapping: {
      date:        'Fecha',
      description: 'Glosa',
      debit:       'Cargo',
      credit:      'Abono',
    },
    config: { mode: 'debit_credit', negativeIsExpense: false },
    hint: 'Cartola Banco de Chile — separador punto y coma',
  },
  {
    id: 'santander',
    name: 'Santander Chile',
    flag: '🏦',
    country: 'CL',
    delimiter: ';',
    fingerprint: ['fecha', 'descripcion', 'débito', 'crédito', 'saldo'],
    mapping: {
      date:        'Fecha',
      description: 'Descripcion',
      debit:       'Débito',
      credit:      'Crédito',
    },
    config: { mode: 'debit_credit', negativeIsExpense: false },
    hint: 'Cartola Santander Chile — separador punto y coma',
  },
  {
    id: 'bci',
    name: 'BCI',
    flag: '🏦',
    country: 'CL',
    delimiter: ',',
    fingerprint: ['fecha', 'descripción', 'cargo', 'abono', 'saldo'],
    mapping: {
      date:        'Fecha',
      description: 'Descripción',
      debit:       'Cargo',
      credit:      'Abono',
    },
    config: { mode: 'debit_credit', negativeIsExpense: false },
    hint: 'Cartola BCI — separador coma',
  },
  {
    id: 'scotiabank',
    name: 'Scotiabank Chile',
    flag: '🏦',
    country: 'CL',
    delimiter: ';',
    fingerprint: ['fecha', 'detalle', 'débito', 'crédito', 'saldo'],
    mapping: {
      date:        'Fecha',
      description: 'Detalle',
      debit:       'Débito',
      credit:      'Crédito',
    },
    config: { mode: 'debit_credit', negativeIsExpense: false },
    hint: 'Cartola Scotiabank Chile — separador punto y coma',
  },
  {
    id: 'falabella',
    name: 'Banco Falabella',
    flag: '🏦',
    country: 'CL',
    delimiter: ',',
    fingerprint: ['fecha', 'descripcion', 'monto', 'tipo'],
    mapping: {
      date:        'Fecha',
      description: 'Descripcion',
      amount:      'Monto',
    },
    config: { mode: 'single', negativeIsExpense: true },
    hint: 'Cartola Falabella — separador coma · monto negativo = cargo',
  },
  {
    id: 'itau',
    name: 'Itaú Chile',
    flag: '🏦',
    country: 'CL',
    delimiter: ';',
    fingerprint: ['fecha', 'descripcion', 'monto', 'saldo'],
    mapping: {
      date:        'Fecha',
      description: 'Descripcion',
      amount:      'Monto',
    },
    config: { mode: 'single', negativeIsExpense: true },
    hint: 'Cartola Itaú Chile — separador punto y coma',
  },
  {
    id: 'mach',
    name: 'MACH / Tenpo',
    flag: '📱',
    country: 'CL',
    delimiter: ',',
    fingerprint: ['date', 'description', 'amount', 'type'],
    mapping: {
      date:        'date',
      description: 'description',
      amount:      'amount',
    },
    config: { mode: 'single', negativeIsExpense: true },
    hint: 'Export MACH o Tenpo — formato inglés',
  },
  {
    id: 'mercadopago_cl',
    name: 'MercadoPago',
    flag: '💳',
    country: 'CL',
    delimiter: ',',
    fingerprint: ['fecha', 'detalle', 'monto', 'estado'],
    mapping: {
      date:        'Fecha',
      description: 'Detalle',
      amount:      'Monto',
    },
    config: { mode: 'single', negativeIsExpense: true },
    hint: 'Reporte MercadoPago Chile',
  },

  // ── MÉXICO ────────────────────────────────────────────────────────────────────
  {
    id: 'bbva_mx',
    name: 'BBVA México',
    flag: '🇲🇽',
    country: 'MX',
    delimiter: ',',
    fingerprint: ['fecha', 'concepto', 'cargo', 'abono', 'saldo'],
    mapping: {
      date:        'Fecha',
      description: 'Concepto',
      debit:       'Cargo',
      credit:      'Abono',
    },
    config: { mode: 'debit_credit', negativeIsExpense: false },
    hint: 'Estado de cuenta BBVA México — separador coma',
  },
  {
    id: 'banamex',
    name: 'Citibanamex',
    flag: '🇲🇽',
    country: 'MX',
    delimiter: ',',
    fingerprint: ['fecha', 'descripcion', 'retiro', 'deposito', 'saldo'],
    mapping: {
      date:        'Fecha',
      description: 'Descripcion',
      debit:       'Retiro',
      credit:      'Deposito',
    },
    config: { mode: 'debit_credit', negativeIsExpense: false },
    hint: 'Estado de cuenta Citibanamex — separador coma',
  },
  {
    id: 'banorte',
    name: 'Banorte',
    flag: '🇲🇽',
    country: 'MX',
    delimiter: ',',
    fingerprint: ['fecha', 'descripcion', 'cargo', 'abono', 'saldo'],
    mapping: {
      date:        'Fecha',
      description: 'Descripcion',
      debit:       'Cargo',
      credit:      'Abono',
    },
    config: { mode: 'debit_credit', negativeIsExpense: false },
    hint: 'Estado de cuenta Banorte — separador coma',
  },
  {
    id: 'santander_mx',
    name: 'Santander México',
    flag: '🇲🇽',
    country: 'MX',
    delimiter: ';',
    fingerprint: ['fecha', 'concepto', 'movimiento', 'monto', 'saldo'],
    mapping: {
      date:        'Fecha',
      description: 'Concepto',
      amount:      'Monto',
    },
    config: { mode: 'single', negativeIsExpense: true },
    hint: 'Estado de cuenta Santander México — separador punto y coma',
  },
  {
    id: 'mercadopago_mx',
    name: 'MercadoPago MX',
    flag: '🇲🇽',
    country: 'MX',
    delimiter: ',',
    fingerprint: ['fecha', 'operacion', 'monto', 'tipo', 'estado'],
    mapping: {
      date:        'Fecha',
      description: 'Operacion',
      amount:      'Monto',
    },
    config: { mode: 'single', negativeIsExpense: true },
    hint: 'Reporte MercadoPago México',
  },

  // ── COLOMBIA ─────────────────────────────────────────────────────────────────
  {
    id: 'bancolombia',
    name: 'Bancolombia',
    flag: '🇨🇴',
    country: 'CO',
    delimiter: ';',
    fingerprint: ['fecha', 'descripcion', 'debito', 'credito', 'saldo'],
    mapping: {
      date:        'Fecha',
      description: 'Descripcion',
      debit:       'Debito',
      credit:      'Credito',
    },
    config: { mode: 'debit_credit', negativeIsExpense: false },
    hint: 'Extracto Bancolombia — separador punto y coma',
  },
  {
    id: 'bbva_co',
    name: 'BBVA Colombia',
    flag: '🇨🇴',
    country: 'CO',
    delimiter: ',',
    fingerprint: ['fecha', 'concepto', 'valor_debito', 'valor_credito', 'saldo'],
    mapping: {
      date:        'Fecha',
      description: 'Concepto',
      debit:       'Valor_Debito',
      credit:      'Valor_Credito',
    },
    config: { mode: 'debit_credit', negativeIsExpense: false },
    hint: 'Extracto BBVA Colombia — separador coma',
  },
  {
    id: 'davivienda',
    name: 'Davivienda',
    flag: '🇨🇴',
    country: 'CO',
    delimiter: ';',
    fingerprint: ['fecha', 'descripcion', 'valor', 'tipo_movimiento', 'saldo'],
    mapping: {
      date:        'Fecha',
      description: 'Descripcion',
      amount:      'Valor',
    },
    config: { mode: 'single', negativeIsExpense: true },
    hint: 'Extracto Davivienda — separador punto y coma · débito negativo',
  },
  {
    id: 'nequi',
    name: 'Nequi',
    flag: '🇨🇴',
    country: 'CO',
    delimiter: ',',
    fingerprint: ['fecha', 'descripcion', 'valor', 'estado', 'tipo'],
    mapping: {
      date:        'Fecha',
      description: 'Descripcion',
      amount:      'Valor',
    },
    config: { mode: 'single', negativeIsExpense: true },
    hint: 'Extracto Nequi — separador coma',
  },

  // ── ALEMANIA / DACH ─────────────────────────────────────────────────────────
  // Formato numérico DE: decimal coma, miles punto (1.234,56)
  // Fechas DE: DD.MM.YYYY
  {
    id: 'n26',
    name: 'N26',
    flag: '🇩🇪',
    country: 'DE',
    delimiter: ',',
    fingerprint: ['booking date', 'payment reference', 'amount', 'account name'],
    mapping: {
      date:        'Booking Date',
      description: 'Payment Reference',
      amount:      'Amount (EUR)',
    },
    config: { mode: 'single', negativeIsExpense: true },
    dateFormat: 'YYYY-MM-DD',
    hint: 'N26 Export — separador coma, decimal punto (formato inglés)',
  },
  {
    id: 'dkb',
    name: 'DKB Deutsche Kreditbank',
    flag: '🇩🇪',
    country: 'DE',
    delimiter: ';',
    fingerprint: ['buchungsdatum', 'wertstellung', 'verwendungszweck', 'betrag'],
    mapping: {
      date:        'Buchungsdatum',
      description: 'Verwendungszweck',
      amount:      'Betrag (€)',
    },
    config: { mode: 'single', negativeIsExpense: true, numberFormat: 'de' },
    dateFormat: 'DD.MM.YYYY',
    hint: 'DKB Umsätze — separador punto y coma, formato numérico alemán',
  },
  {
    id: 'sparkasse',
    name: 'Sparkasse',
    flag: '🇩🇪',
    country: 'DE',
    delimiter: ';',
    fingerprint: ['auftragskonto', 'buchungstag', 'verwendungszweck', 'betrag'],
    mapping: {
      date:        'Buchungstag',
      description: 'Verwendungszweck',
      amount:      'Betrag',
    },
    config: { mode: 'single', negativeIsExpense: true, numberFormat: 'de' },
    dateFormat: 'DD.MM.YY',
    hint: 'Sparkasse Umsätze (CSV-CAMT) — separador punto y coma',
  },
  {
    id: 'ing-de',
    name: 'ING Deutschland',
    flag: '🇩🇪',
    country: 'DE',
    delimiter: ';',
    fingerprint: ['buchung', 'valuta', 'auftraggeber', 'buchungstext', 'betrag'],
    mapping: {
      date:        'Buchung',
      description: 'Verwendungszweck',
      amount:      'Betrag',
    },
    config: { mode: 'single', negativeIsExpense: true, numberFormat: 'de' },
    dateFormat: 'DD.MM.YYYY',
    hint: 'ING Umsätze — separador punto y coma, formato alemán',
  },
  {
    id: 'comdirect',
    name: 'Comdirect',
    flag: '🇩🇪',
    country: 'DE',
    delimiter: ';',
    fingerprint: ['buchungstag', 'wertstellung', 'vorgang', 'umsatz'],
    mapping: {
      date:        'Buchungstag',
      description: 'Buchungstext',
      amount:      'Umsatz',
    },
    config: { mode: 'single', negativeIsExpense: true, numberFormat: 'de' },
    dateFormat: 'DD.MM.YYYY',
    hint: 'Comdirect Umsätze — ojo: encoding ISO-8859-1',
  },

  // ── ESTADOS UNIDOS ─────────────────────────────────────────────────────────
  // Ningún banco de EEUU publica una especificación oficial de su CSV. Estas
  // tres plantillas salen de documentación pública de terceros que coincide
  // entre sí (consultada 08-oct-2026):
  //   - https://bankxlsx.com/credit-card-csv-export-columns (Chase tarjeta y
  //     cuenta, Capital One tarjeta: columnas, signo y formato de fecha)
  //   - https://capyparse.com/blog/chase-credit-card-statement-to-csv (Chase
  //     tarjeta: 7 columnas, compras en negativo, MM/DD/YYYY)
  //   - https://fynnap.com/guides/chase-csv-export (Chase tarjeta y cuenta)
  // Si un banco cambia sus encabezados, la huella deja de coincidir y el
  // archivo cae a la detección genérica de columnas (detectColumns), que ya
  // reconoce Date/Description/Amount: el peor caso es "sin plantilla", no un
  // mapeo equivocado. Fuera a propósito: Bank of America (el CSV de cuenta
  // trae un bloque de resumen antes de los encabezados, que parseCSV no
  // salta), Wells Fargo (CSV sin fila de encabezados) y American Express
  // (cargos en POSITIVO, necesita un modo de signo que hoy no existe).
  {
    id: 'chase_card',
    name: 'Chase (credit card)',
    flag: '🇺🇸',
    country: 'US',
    delimiter: ',',
    fingerprint: ['transaction date', 'post date', 'description', 'category', 'type', 'amount'],
    mapping: {
      date:        'Transaction Date',
      description: 'Description',
      amount:      'Amount',
    },
    config: { mode: 'single', negativeIsExpense: true },
    dateFormat: 'MM/DD/YYYY',
    hint: 'Chase credit card — purchases negative, payments positive',
  },
  {
    id: 'chase_checking',
    name: 'Chase (checking)',
    flag: '🇺🇸',
    country: 'US',
    delimiter: ',',
    fingerprint: ['details', 'posting date', 'description', 'amount', 'type', 'balance'],
    mapping: {
      date:        'Posting Date',
      description: 'Description',
      amount:      'Amount',
    },
    config: { mode: 'single', negativeIsExpense: true },
    dateFormat: 'MM/DD/YYYY',
    hint: 'Chase checking — one signed Amount column, debits negative',
  },
  {
    id: 'capitalone_card',
    name: 'Capital One (credit card)',
    flag: '🇺🇸',
    country: 'US',
    delimiter: ',',
    fingerprint: ['transaction date', 'posted date', 'card no', 'description', 'debit', 'credit'],
    mapping: {
      date:        'Transaction Date',
      description: 'Description',
      debit:       'Debit',
      credit:      'Credit',
    },
    config: { mode: 'debit_credit', negativeIsExpense: false },
    dateFormat: 'YYYY-MM-DD',
    hint: 'Capital One credit card — Debit (charges) and Credit (payments) columns, both positive',
  },
]

/**
 * Detecta el template del banco según los headers del CSV
 * @param {string[]} headers — headers del CSV ya parseados
 * @returns {object|null} — template detectado o null
 */
export function detectBankTemplate(headers) {
  if (!headers || headers.length === 0) return null

  const lower = headers.map(h =>
    (h || '').toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // quitar tildes para comparar
  )

  // Gana la plantilla con MÁS coincidencias (antes, la primera con ≥3): una
  // huella genérica como la de MACH (date/description/amount/type) se comía
  // los CSV de Chase, que tienen esas cuatro y además otras dos propias.
  // Empate → la que aparece primero en la lista (orden histórico).
  let best = null, bestCount = 0
  for (const template of BANK_TEMPLATES) {
    const fp = template.fingerprint
    const matches = fp.filter(keyword =>
      lower.some(h => h.includes(keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))
    )
    // Requiere al menos 3 de los keywords del fingerprint
    if (matches.length >= Math.min(3, fp.length) && matches.length > bestCount) {
      best = template
      bestCount = matches.length
    }
  }

  return best
}

/**
 * Aplica el template al mapping de columnas detectado
 * Usa los headers reales del CSV para mapear
 * @param {object} template
 * @param {string[]} headers
 * @returns {object} mapping listo para usar en validateRows
 */
export function applyTemplate(template, headers) {
  const lower = headers.map(h =>
    (h || '').toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  )

  const resolved = {}
  for (const [field, colName] of Object.entries(template.mapping)) {
    const targetLower = colName.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const idx = lower.findIndex(h => h === targetLower || h.includes(targetLower))
    resolved[field] = idx >= 0 ? headers[idx] : null
  }

  return resolved
}
