// src/utils/recurring.js — motor de movimientos fijos (reglas recurrentes).
//
// Lógica PURA, sin React ni IndexedDB (tests en recurring.test.js). Decisiones
// de Walter (DECISIONES.md, 08-oct-2026):
//   1. Las ocurrencias quedan "previstas" hasta que el usuario las confirma (o
//      la regla tiene autoConfirm). Nunca se guardan pendientes en
//      incomes/expenses: se CALCULAN desde la regla.
//   2. "Te queda" es solo lo real; lo previsto va aparte (pendingTotals).
//   3. Suscripciones y cuotas de Deudas son reglas del mismo sistema
//      (source 'subscription' | 'debt', sourceId = id del registro original).
//
// Forma de una regla (store 'recurring', migración v4):
//   { id, kind: 'income'|'expense', source: 'manual'|'subscription'|'debt',
//     sourceId?, description, category, method?, amountMode: 'fixed'|'last'|'average',
//     amounts: [{ from: 'YYYY-MM', amount }],
//     schedule: { freq: 'monthly'|'semimonthly'|'biweekly'|'weekly'|'yearly',
//                 day?: 1..31|'last', anchorDate: 'YYYY-MM-DD' },
//     startDate: 'YYYY-MM-DD', endDate?: 'YYYY-MM-DD', autoConfirm, paused,
//     skipped: ['YYYY-MM-DD'], inv?, project?, createdAt }
// Un registro real confirmado lleva `recurringId` + `occurrenceDate`.
//
// FECHAS: todo en hora LOCAL. Las fechas son strings 'YYYY-MM-DD' y la
// aritmética se hace con new Date(y, m-1, d) (nunca toISOString ni Date.parse
// de un 'YYYY-MM-DD', que lo interpreta en UTC y corre un día en LatAm).

export const FREQS = ['monthly', 'semimonthly', 'biweekly', 'weekly', 'yearly']
export const AMOUNT_MODES = ['fixed', 'last', 'average']

// Tolerancias para reconocer como "ya registrada" una ocurrencia que el usuario
// cargó a mano (sin pasar por el fijo): ±7,5 % de monto (Actual Budget usa la
// misma banda para montos aproximados) y ±3 días de fecha.
export const MATCH_AMOUNT_TOLERANCE = 0.075
export const MATCH_DAYS = 3

const pad = (n) => String(n).padStart(2, '0')

// ── Fechas locales ───────────────────────────────────────────────────────────
export function parseYMD(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').slice(0, 10))
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return { y, m: mo, d }
}
export const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`
export const daysInMonth = (y, m) => new Date(y, m, 0).getDate()
export const monthOf = (dateStr) => String(dateStr || '').slice(0, 7)
// 'YYYY-MM-DD' → Date a medianoche LOCAL (new Date('YYYY-MM-DD') la toma en UTC
// y en LatAm muestra el día anterior).
export const toLocal = (s) => { const p = parseYMD(s); return p ? new Date(p.y, p.m - 1, p.d) : null }
const fromLocal = (dt) => ymd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())

export function addDays(dateStr, n) {
  const dt = toLocal(dateStr)
  if (!dt) return null
  dt.setDate(dt.getDate() + n)
  return fromLocal(dt)
}

// Días entre dos fechas (b − a). Math.round absorbe la hora que mueve el
// cambio de horario de verano.
export function diffDays(a, b) {
  const da = toLocal(a), db = toLocal(b)
  if (!da || !db) return NaN
  return Math.round((db - da) / 86400000)
}

export function addMonthsYM(ym, n) {
  const [y, m] = String(ym).split('-').map(Number)
  const idx = y * 12 + (m - 1) + n
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`
}

export function monthBounds(ym) {
  const [y, m] = String(ym).split('-').map(Number)
  return { y, m, first: ymd(y, m, 1), last: ymd(y, m, daysInMonth(y, m)), dim: daysInMonth(y, m) }
}

// Día de la regla dentro de un mes: el 31 (o el 29/30) cae en el último día
// cuando el mes es más corto; 'last' es siempre el último día.
function clampDay(day, y, m) {
  const dim = daysInMonth(y, m)
  if (day === 'last') return dim
  const n = Number(day) || 1
  return Math.min(Math.max(1, n), dim)
}

function ruleDay(rule) {
  const s = rule?.schedule || {}
  if (s.day === 'last') return 'last'
  if (Number(s.day) >= 1) return Number(s.day)
  const a = parseYMD(s.anchorDate || rule?.startDate)
  return a ? a.d : 1
}

// ── Calendario ───────────────────────────────────────────────────────────────
// Fechas en que la regla ocurre dentro del mes 'YYYY-MM' (solo el calendario:
// respeta inicio/fin, NO pausa ni omitidas — eso lo resuelve monthPlan).
export function occurrencesInMonth(rule, ym) {
  if (!rule || !rule.schedule) return []
  const { y, m, first, last, dim } = monthBounds(ym)
  if (!y || !m) return []
  const s = rule.schedule
  const anchor = s.anchorDate || rule.startDate
  let dates = []

  switch (s.freq) {
    case 'monthly': {
      // interval: cada N meses (trimestral = 3), contado desde el mes del ancla.
      const every = Math.max(1, Number(s.interval) || 1)
      const a = parseYMD(anchor)
      if (every > 1 && a && ((y * 12 + m) - (a.y * 12 + a.m)) % every !== 0) break
      dates = [ymd(y, m, clampDay(ruleDay(rule), y, m))]
      break
    }
    case 'semimonthly':
      // Quincena: el 15 y el último día del mes (sueldo quincenal típico en LatAm).
      dates = [ymd(y, m, 15), ymd(y, m, dim)]
      break
    case 'yearly': {
      const a = parseYMD(anchor)
      const month = Number(s.month) || (a ? a.m : 1)
      if (month === m) dates = [ymd(y, m, clampDay(ruleDay(rule), y, m))]
      break
    }
    case 'biweekly':
    case 'weekly': {
      const step = s.freq === 'weekly' ? 7 : 14
      if (!parseYMD(anchor)) break
      // Primer k con anchor + k·step >= primer día del mes (k puede ser negativo
      // si el ancla es posterior; el filtro de inicio de abajo lo descarta).
      const k0 = Math.ceil(diffDays(anchor, first) / step)
      for (let k = k0; ; k++) {
        const dt = addDays(anchor, k * step)
        if (dt > last) break
        if (dt >= first) dates.push(dt)
      }
      break
    }
    default:
      return []
  }

  const start = rule.startDate || null
  const end = rule.endDate || null
  return dates.filter(d => (!start || d >= start) && (!end || d <= end)).sort()
}

// Siguiente ocurrencia >= fromDate (para "Próximos pagos"). Busca hasta 14 meses.
export function nextOccurrenceOf(rule, fromDate) {
  const startYm = monthOf(fromDate)
  for (let i = 0; i < 14; i++) {
    const hit = occurrencesInMonth(rule, addMonthsYM(startYm, i)).find(d => d >= fromDate)
    if (hit) return hit
  }
  return null
}

// Equivalente mensual (para proyección y totales): quincenal 2×, cada 14 días
// 26/12, semanal 52/12, anual 1/12.
export const FREQ_PER_MONTH = { monthly: 1, semimonthly: 2, biweekly: 26 / 12, weekly: 52 / 12, yearly: 1 / 12 }
export function monthlyEquivalent(rule, ym) {
  const s = rule?.schedule || {}
  const every = s.freq === 'monthly' ? Math.max(1, Number(s.interval) || 1) : 1
  return amountAt(rule, ym) * (FREQ_PER_MONTH[s.freq] ?? 1) / every
}

// ── Montos ───────────────────────────────────────────────────────────────────
// Monto vigente en el mes `ym`: la última entrada de `amounts` con from <= ym
// ("desde ahora" agrega una entrada nueva; el pasado no cambia). Si el mes es
// anterior a todas, la primera.
export function amountAt(rule, ym) {
  const list = (Array.isArray(rule?.amounts) ? rule.amounts : [])
    .filter(a => a && Number.isFinite(Number(a.amount)))
    .slice()
    .sort((a, b) => String(a.from).localeCompare(String(b.from)))
  if (!list.length) return 0
  let hit = list[0]
  for (const a of list) if (String(a.from) <= ym) hit = a
  return Number(hit.amount) || 0
}

// "Desde ahora": nuevo monto a partir de `fromYm` (reemplaza una entrada del
// mismo mes; las de meses anteriores quedan intactas).
export function withAmountFrom(rule, fromYm, amount) {
  const amounts = (Array.isArray(rule?.amounts) ? rule.amounts : []).filter(a => a && a.from !== fromYm && a.from < fromYm)
  amounts.push({ from: fromYm, amount: Number(amount) || 0 })
  return { ...rule, amounts }
}

// Registros reales confirmados de una regla, ordenados por fecha de ocurrencia.
export function confirmedRecordsOf(rule, records) {
  return (Array.isArray(records) ? records : [])
    .filter(r => r && r.recurringId === rule.id)
    .sort((a, b) => String(a.occurrenceDate || a.date).localeCompare(String(b.occurrenceDate || b.date)))
}

// Monto esperado de una ocurrencia según el modo de la regla:
//   fixed   → el vigente en ese mes
//   last    → el del último registro confirmado anterior a la fecha
//   average → promedio de los últimos 3 confirmados anteriores
// Sin historial, last/average caen al vigente.
export function expectedAmount(rule, date, records) {
  const ym = monthOf(date)
  const base = amountAt(rule, ym)
  const mode = rule?.amountMode || 'fixed'
  if (mode === 'fixed') return base
  const prev = confirmedRecordsOf(rule, records)
    .filter(r => String(r.occurrenceDate || r.date) < date)
    .map(r => Number(r.amount) || 0)
  if (!prev.length) return base
  if (mode === 'last') return prev[prev.length - 1]
  const last3 = prev.slice(-3)
  return Math.round((last3.reduce((s, x) => s + x, 0) / last3.length) * 100) / 100
}

// ── Coincidencia con registros cargados a mano ───────────────────────────────
// Normaliza un texto (minúsculas, sin acentos ni espacios extra) — misma regla
// que QuickAddForm usa para aprender comercio→categoría.
export const ruleKey = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

// Palabras que no distinguen un movimiento de otro: dominios/razones sociales,
// conectores, "pago", y los meses (es/en/pt/de) — "Arriendo octubre" es el
// mismo arriendo; "Netflix gift" NO es Netflix.
const NOISE = new Set(('com www net org inc sa spa ltda llc gmbh ag co the de del la el los las y and und e do da ' +
  'pago payment zahlung pagamento cuota rate parcela ' +
  'enero febrero marzo abril mayo junio julio agosto septiembre setiembre octubre noviembre diciembre ' +
  'january february march april may june july august september october november december ' +
  'janeiro fevereiro marco maio junho julho setembro outubro novembro dezembro ' +
  'januar februar marz juni juli oktober dezember ene feb mar abr jun jul ago sep sept oct nov dic jan apr aug dec').split(' '))

export function descTokens(s) {
  return [...new Set(ruleKey(s).replace(/[^a-z0-9]+/g, ' ').split(' ')
    .filter(t => t.length > 1 && !NOISE.has(t) && !/^\d+$/.test(t)))]
}

// 'same' = mismas palabras significativas; 'similar' = Jaccard >= 2/3.
export function descSimilarity(a, b) {
  const ta = descTokens(a), tb = descTokens(b)
  if (!ta.length || !tb.length) return 'none'
  const inter = ta.filter(t => tb.includes(t)).length
  if (inter === ta.length && inter === tb.length) return 'same'
  return inter / (ta.length + tb.length - inter) >= 2 / 3 ? 'similar' : 'none'
}

export function amountClose(expected, actual, tol = MATCH_AMOUNT_TOLERANCE) {
  const e = Number(expected) || 0, a = Number(actual) || 0
  if (e <= 0) return a <= 0
  return Math.abs(a - e) / e <= tol
}

// ¿Cuánto se parece este registro sin vínculo a la ocurrencia (rule, date)?
//   2 (fuerte) — mismas palabras significativas a ±3 días, con cualquier monto
//                (el sueldo que llegó recortado sigue siendo ESE sueldo)
//   1 (débil)  — descripción parecida (Jaccard >= 2/3) y monto ±7,5 %, en el
//                mismo mes o a ±3 días
//   0          — no. La categoría sola NUNCA alcanza: un gasto cualquiera de la
//                misma categoría no puede dar por pagado un fijo.
export function matchStrength(rule, date, expected, record) {
  if (!record || record.recurringId) return 0
  const rDate = String(record.date || '')
  const days = Math.abs(diffDays(date, rDate))
  const sim = descSimilarity(rule.description, record.description ?? record.source)
  if (sim === 'none') return 0
  if (sim === 'same' && days <= MATCH_DAYS) return 2
  if (!amountClose(expected, record.amount)) return 0
  return (monthOf(rDate) === monthOf(date) || days <= MATCH_DAYS) ? 1 : 0
}
export const recordMatchesOccurrence = (rule, date, expected, record) => matchStrength(rule, date, expected, record) > 0

// Registro que cubre la ocurrencia, o null. Si hay más de un candidato del
// mejor nivel, es ambiguo: queda prevista para que el usuario confirme a mano.
function uniqueMatch(occ, records, used) {
  const strong = [], weak = []
  for (const r of records || []) {
    if (!r || used.has(r.id)) continue
    const st = matchStrength(occ.rule, occ.date, occ.expected, r)
    if (st === 2) strong.push(r); else if (st === 1) weak.push(r)
  }
  if (strong.length) return strong.length === 1 ? strong[0] : null
  return weak.length === 1 ? weak[0] : null
}

// ── Plan del mes ─────────────────────────────────────────────────────────────
// Para cada regla y cada ocurrencia del mes:
//   confirmed — hay un registro con recurringId + occurrenceDate (o uno cargado a
//               mano que coincide: `matched`, se cuenta como real y NO como previsto)
//   skipped   — el usuario la omitió
//   pending   — prevista, todavía no ocurrió/no se confirmó
// Reglas pausadas: sus ocurrencias sin confirmar no aparecen. `records` =
// { incomes, expenses }. Devuelve la lista ordenada por fecha.
export function monthPlan(rules, ym, { incomes = [], expenses = [], today = null } = {}) {
  const out = []
  const linked = new Map()
  for (const r of [...(incomes || []), ...(expenses || [])]) {
    if (r && r.recurringId && r.occurrenceDate) linked.set(`${r.recurringId}|${r.occurrenceDate}`, r)
  }
  const used = new Set()
  const pendingCandidates = []

  for (const rule of Array.isArray(rules) ? rules : []) {
    if (!rule || !rule.id) continue
    const records = rule.kind === 'income' ? incomes : expenses
    for (const date of occurrencesInMonth(rule, ym)) {
      const expected = expectedAmount(rule, date, records)
      const rec = linked.get(`${rule.id}|${date}`)
      const base = { key: `${rule.id}|${date}`, rule, ruleId: rule.id, kind: rule.kind, date, expected, due: today ? date <= today : false }
      if (rec) { out.push({ ...base, status: 'confirmed', record: rec, amount: Number(rec.amount) || 0 }); continue }
      if (Array.isArray(rule.skipped) && rule.skipped.includes(date)) { out.push({ ...base, status: 'skipped', amount: 0 }); continue }
      pendingCandidates.push({ ...base, records })
    }
  }

  // Registros a mano que ya cubren una ocurrencia: se consume cada uno una sola
  // vez, en orden de fecha; ante dos candidatos igual de buenos, no se elige.
  pendingCandidates.sort((a, b) => a.date.localeCompare(b.date))
  for (const c of pendingCandidates) {
    const { records, ...occ } = c
    const hit = uniqueMatch(occ, records, used)
    if (hit) {
      used.add(hit.id)
      out.push({ ...occ, status: 'confirmed', matched: true, record: hit, amount: Number(hit.amount) || 0 })
    } else if (!occ.rule.paused) {
      out.push({ ...occ, status: 'pending', amount: occ.expected })
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || String(a.rule.description).localeCompare(String(b.rule.description)))
}

// Totales de lo previsto pendiente. `personalOnly` excluye las reglas de
// inversión/propiedades (inv), igual que el panorama personal del Inicio.
export function pendingTotals(plan, { personalOnly = true, until = null } = {}) {
  let income = 0, expense = 0, count = 0
  for (const o of plan || []) {
    if (o.status !== 'pending') continue
    if (personalOnly && o.rule?.inv) continue
    if (until && o.date > until) continue
    if (o.kind === 'income') income += Number(o.amount) || 0
    else expense += Number(o.amount) || 0
    count++
  }
  return { income: round2(income), expense: round2(expense), count }
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// Equivalente mensual de las reglas vigentes (Proyección). Cada regla cuenta
// UNA vez, con su monto vigente — nunca la suma de su historial.
export function recurringMonthlyTotals(rules, { today, personalOnly = true } = {}) {
  const ym = monthOf(today)
  const incomeRules = [], expenseRules = []
  for (const r of rules || []) {
    if (!isActiveRule(r, today) || (personalOnly && r.inv)) continue
    const row = { rule: r, amount: amountAt(r, ym), monthly: round2(monthlyEquivalent(r, ym)) }
    ;(r.kind === 'income' ? incomeRules : expenseRules).push(row)
  }
  const sum = (a) => round2(a.reduce((s, x) => s + x.monthly, 0))
  return { income: sum(incomeRules), expense: sum(expenseRules), incomeRules, expenseRules }
}

// Reglas vigentes (no pausadas ni terminadas a la fecha `today`).
export function isActiveRule(rule, today) {
  if (!rule || rule.paused) return false
  if (rule.endDate && today && rule.endDate < today) return false
  return true
}

// ── Confirmar ────────────────────────────────────────────────────────────────
// Etiqueta histórica `recurrence` del registro (CSV, vistas viejas).
const LEGACY_RECURRENCE = { monthly: 'Mensual', semimonthly: 'Quincenal', biweekly: 'Quincenal', weekly: 'Semanal' }

// Id determinista: confirmar dos veces la misma ocurrencia (doble toque, dos
// pestañas, StrictMode) pisa el mismo registro en vez de duplicarlo.
export const occurrenceRecordId = (ruleId, date) => `rc-${ruleId}-${date}`

// Registro real (ingreso o gasto) para una ocurrencia confirmada. La fecha del
// registro es la de la ocurrencia, salvo que se confirme por adelantado (pagué
// el arriendo el 25 aunque vence el 30): ahí es hoy.
export function buildConfirmedRecord(rule, date, { amount, today, createdAt } = {}) {
  const amt = Number(amount ?? amountAt(rule, monthOf(date))) || 0
  const recDate = today && date > today ? today : date
  const common = {
    id: occurrenceRecordId(rule.id, date),
    amount: amt,
    date: recDate,
    category: rule.category,
    notes: '',
    recurringId: rule.id,
    occurrenceDate: date,
    createdAt: createdAt || new Date().toISOString(),
  }
  const rec = LEGACY_RECURRENCE[rule.schedule?.freq]
  if (rec) common.recurrence = rec
  if (rule.inv) common.inv = true
  if (rule.project) common.project = rule.project
  if (rule.kind === 'income') return { ...common, source: rule.description }
  return { ...common, description: rule.description, method: rule.method || '', type: rule.type || 'Necesidad', subcategory: '' }
}

// Ocurrencias de reglas con autoConfirm que ya pasaron y siguen pendientes,
// desde el inicio de la regla (máximo `monthsBack` meses atrás) hasta hoy.
export function dueAutoConfirmations(rules, { incomes = [], expenses = [], today, monthsBack = 12 } = {}) {
  if (!today) return []
  const auto = (rules || []).filter(r => r && r.autoConfirm && !r.paused)
  if (!auto.length) return []
  const curYm = monthOf(today)
  const out = []
  for (let i = monthsBack; i >= 0; i--) {
    const ym = addMonthsYM(curYm, -i)
    for (const o of monthPlan(auto, ym, { incomes, expenses, today })) {
      if (o.status === 'pending' && o.date <= today) out.push(o)
    }
  }
  return out
}

// ── Borrar un registro confirmado ────────────────────────────────────────────
// Borrar el registro de una ocurrencia la marca como OMITIDA en su regla: si
// no, el registro automático la volvería a crear en la próxima apertura (y en
// una cuota de deuda, volvería a bajar el saldo). Deshacer el borrado la
// reabre. El saldo de la deuda NO se restaura al borrar el gasto: es lo mismo
// que pasa hoy al borrar un pago registrado con "Registrar pago" en Deudas.
// Devuelve la regla actualizada, o null si no hay nada que cambiar.
export function ruleAfterLinkedRecord(rules, record, { deleted }) {
  if (!record?.recurringId || !record.occurrenceDate) return null
  const rule = (rules || []).find(r => r && r.id === record.recurringId)
  if (!rule) return null
  const skipped = new Set(rule.skipped || [])
  if (deleted === skipped.has(record.occurrenceDate)) return null
  if (deleted) skipped.add(record.occurrenceDate); else skipped.delete(record.occurrenceDate)
  return { ...rule, skipped: [...skipped].sort() }
}

// ── Nueva regla a partir de un movimiento ────────────────────────────────────
// "Se repite cada mes" en QuickAdd / Ingresos: la regla nace con este registro
// como su primera ocurrencia confirmada.
export function ruleFromRecord(record, { kind, freq = 'monthly', id, createdAt } = {}) {
  const p = parseYMD(record.date)
  const lastDay = p && p.d === daysInMonth(p.y, p.m) && p.d >= 28
  return {
    id,
    kind,
    source: 'manual',
    description: String((kind === 'income' ? record.source : record.description) || '').trim(),
    category: record.category,
    method: kind === 'expense' ? (record.method || '') : undefined,
    amountMode: 'fixed',
    amounts: [{ from: monthOf(record.date), amount: Number(record.amount) || 0 }],
    schedule: { freq, day: lastDay && freq === 'monthly' ? 'last' : (p ? p.d : 1), anchorDate: record.date },
    startDate: record.date,
    autoConfirm: false,
    paused: false,
    skipped: [],
    ...(record.inv ? { inv: true } : {}),
    ...(record.project ? { project: record.project } : {}),
    createdAt: createdAt || new Date().toISOString(),
  }
}

// ── Detección: "¿Lo marcamos como fijo?" ─────────────────────────────────────
// El mismo comercio (ruleKey de la descripción) en al menos 2 de los 3 meses
// anteriores, con montos a ±15 % y días del mes a ±5 entre sí, y sin regla que
// ya lo cubra. Devuelve la frecuencia sugerida (mensual) o null.
export function detectRecurring(record, records, rules, { kind = 'expense' } = {}) {
  const key = ruleKey(kind === 'income' ? record?.source : record?.description)
  if (!key || key.length < 3 || record?.recurringId) return null
  if ((rules || []).some(r => r && r.kind === kind && ruleKey(r.description) === key && !r.endDate)) return null
  const ym = monthOf(record.date)
  const prevMonths = [1, 2, 3].map(i => addMonthsYM(ym, -i))
  const hits = []
  for (const pm of prevMonths) {
    const r = (records || []).find(x => x && x.id !== record.id && monthOf(x.date) === pm &&
      ruleKey(kind === 'income' ? x.source : x.description) === key)
    if (r) hits.push(r)
  }
  if (hits.length < 2) return null
  const all = [...hits, record]
  const amounts = all.map(r => Number(r.amount) || 0)
  const min = Math.min(...amounts), max = Math.max(...amounts)
  if (min <= 0 || (max - min) / max > 0.15) return null
  const days = all.map(r => parseYMD(r.date)?.d || 0)
  if (Math.max(...days) - Math.min(...days) > 5) return null
  return { freq: 'monthly', months: hits.length }
}

// Ocurrencia pendiente del mes que un movimiento recién cargado cubre (para
// vincularlo y no contar dos veces). Solo si hay exactamente una candidata.
export function findPendingMatch(record, plan, kind) {
  const scored = (plan || []).filter(o => o.status === 'pending' && o.kind === kind)
    .map(o => ({ o, st: matchStrength(o.rule, o.date, o.expected, record) })).filter(x => x.st > 0)
  const best = Math.max(0, ...scored.map(x => x.st))
  const top = scored.filter(x => x.st === best)
  return top.length === 1 ? top[0].o : null
}
