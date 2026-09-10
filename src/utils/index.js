// src/utils/index.js

import { translations } from '../i18n/translations.js'

export const uid = () => Math.random().toString(36).slice(2, 10)

export const today = () => new Date().toISOString().slice(0, 10)

// Locale de formato de miles, seteado una vez desde AppContext según la moneda
// del usuario (default es-CL = separador punto, comportamiento histórico).
// Evita que un cliente en USA/México/Portugal vea el separador chileno.
let _moneyLocale = 'es-CL'
const CURRENCY_LOCALE = {
  CLP: 'es-CL', COP: 'es-CO', ARS: 'es-AR', PEN: 'es-PE', VES: 'es-VE',
  MXN: 'es-MX', USD: 'en-US', EUR: 'pt-PT', BRL: 'pt-BR',
}
export function setMoneyLocale(currency) {
  _moneyLocale = CURRENCY_LOCALE[currency] || 'es-CL'
}
// Locale activo, para los toLocaleString sueltos que no pasan por fmtMoney.
export const moneyLocale = () => _moneyLocale

// ── Locale de FECHAS ─────────────────────────────────────────────────────────
// Ojo: las fechas NO siguen a la moneda sino al IDIOMA de la interfaz. Un usuario
// en inglés con cuenta en USD debe ver "Sep 2028", no "sept 2028". Por eso este
// locale es independiente de _moneyLocale.
let _dateLocale = 'es-CL'
const LANG_DATE_LOCALE = { es: 'es-CL', en: 'en-US', pt: 'pt-BR' }
export function setDateLocale(language) {
  _dateLocale = LANG_DATE_LOCALE[language] || 'es-CL'
}
export const dateLocale = () => _dateLocale

export const fmtMoney = (n, symbol = '$') => {
  const abs = Math.abs(Math.round(n || 0))
  return symbol + abs.toLocaleString(_moneyLocale)
}

// Número SIN símbolo, con el mismo locale que el dinero. Usar SIEMPRE en vez de
// toLocaleString('es-CL') hardcodeado: si no, un usuario en US/BR/PT ve
// separadores chilenos aunque su moneda sea otra.
export const fmtNum = (n, maxFrac = 0) =>
  (Number(n) || 0).toLocaleString(_moneyLocale, { maximumFractionDigits: maxFrac })

export const fmtPct = (n) => (Math.round((n || 0) * 1000) / 10).toFixed(1) + '%'

export const fmtDate = (iso) => {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

// Paleta derivada de la familia de marca MOY IQ (navy/latón/verde/ceniza/info/
// warning/error + variantes) — cosmético (dots/badges de categoría), sin
// relación con datos financieros reales.
export const CAT_COLORS = {
  Vivienda: '#14213D',       // navy
  Alimentación: '#5FA98C',   // verde
  Transporte: '#B8863B',     // laton
  Salud: '#5B7A99',          // info
  Educación: '#8B7A55',      // ceniza
  Entretenimiento: '#A23E2E', // error
  Entretención: '#A23E2E',   // alias — algunos registros históricos usan esta grafía
  Servicios: '#356E57',      // verde-800
  Ropa: '#C97A3D',           // warning
  Otro: '#5F5236',           // categorías de INGRESO usan singular (ver CATS_INCOME)
  Otros: '#5F5236',          // categorías de GASTO usan plural (ver CATS_EXPENSE)
  Salario: '#14213D',        // navy
  Freelance: '#3E5A78',      // info-800
  Inversión: '#8A6329',      // laton-700
  Arriendo: '#B8863B',       // laton
  Bono: '#5FA98C',           // verde
  Tecnología: '#4A5875',     // navy-400
  Deporte: '#74C2A3',        // verde-dark
  Viajes: '#CC9A52',         // accent-dark
  Streaming: '#5B7A99',      // info
  Música: '#B8AC91',         // ceniza-300
  Software: '#4A5875',       // navy-400
  Gimnasio: '#356E57',       // verde-800
  Seguro: '#9C5419',         // warning-800
  Cloud: '#E3C592',          // laton-300
  Delivery: '#C97A3D',       // warning
  Suscripción: '#3E5A78',    // info-800
  Productividad: '#5FA98C',  // verde
}

// Emoji por categoría — hace el registro más ágil y amigable. Fallback: solo el nombre.
export const CAT_EMOJIS = {
  Vivienda: '🏠', Alimentación: '🛒', Transporte: '🚗', Salud: '⚕️', Educación: '📚',
  Entretenimiento: '🎬', Entretención: '🎬', Servicios: '💡', Ropa: '👕', Tecnología: '💻', Mascota: '🐾',
  Propiedad: '🏢', Inversión: '📈', Otro: '📦', Deporte: '🏃', Viajes: '✈️',
  Salario: '💼', Freelance: '🧑‍💻', Arriendo: '🔑', Bono: '🎁', Pensión: '🏦', 'Negocio propio': '🏪',
  Otros: '📦', Ahorro: '💰',
}
// Devuelve el emoji de la categoría (o '' si no tiene).
export const catEmoji = (c) => CAT_EMOJIS[c] || ''

// Traduce una categoría CANÓNICA (las de CATS_EXPENSE/CATS_INCOME + un puñado de
// alias conocidos) al idioma activo. Una categoría que no tiene entrada 'cat.*'
// en NINGÚN idioma es una categoría libre (agregada por una plantilla de perfil o
// escrita a mano por el usuario) — esas se muestran tal cual se guardaron, no hay
// forma de traducir texto arbitrario sin inventar contenido.
function translateOrRaw(prefix, value, lang) {
  const key = prefix + value
  const translated = translations[lang]?.[key] ?? translations.es?.[key]
  return translated ?? value ?? ''
}
// Devuelve "emoji nombre" (o solo el nombre si no hay emoji), traducido si `lang`
// se pasa. Para options, listas y etiquetas. `lang` es opcional para no romper
// callers que todavía no lo pasan (quedan en español, comportamiento previo).
export const catLabel = (c, lang) => { const e = CAT_EMOJIS[c]; const label = lang ? translateOrRaw('cat.', c, lang) : (c || ''); return e ? `${e} ${label}` : label }

// Categorías de SUSCRIPCIONES (distintas de las de gasto). Fallback: solo el nombre.
export const SUB_EMOJIS = {
  Streaming: '🎥', 'Música': '🎵', Software: '🧰', Gimnasio: '🏋️', Seguro: '🛡️',
  'Educación': '📚', Cloud: '☁️', Delivery: '🛵', 'Suscripción': '🔄', Productividad: '⚙️', Otros: '📦',
}
export const subEmoji = (c) => SUB_EMOJIS[c] || ''
export const subLabel = (c) => { const e = SUB_EMOJIS[c]; return e ? `${e} ${c}` : (c || '') }

// Prioridad de metas — semáforo visual (🔴 alta, 🟡 media, 🟢 baja).
export const PRIO_EMOJIS = { Alta: '🔴', Media: '🟡', Baja: '🟢' }
export const prioEmoji = (p) => PRIO_EMOJIS[p] || ''

// Tipos de deuda con emoji. Los valores se guardan en español (como la prioridad);
// el emoji es solo presentación. Fallback 💳 para deudas antiguas sin tipo.
export const DEBT_TYPES  = ['Tarjeta', 'Hipoteca', 'Auto', 'Crédito', 'Préstamo', 'Estudiantil', 'Otro']
export const DEBT_EMOJIS = { Tarjeta: '💳', Hipoteca: '🏠', Auto: '🚗', Crédito: '📄', Préstamo: '🤝', Estudiantil: '🎓', Otro: '💰' }
export const debtEmoji = (tp) => DEBT_EMOJIS[tp] || '💳'

export const CATS_INCOME  = ['Salario', 'Freelance', 'Inversión', 'Arriendo', 'Bono', 'Otro']
// Única fuente de verdad de categorías de gasto — la usan el formulario de gasto
// (Movements), el selector manual de presupuesto y el generador 50/30/20 (Budgets).
// Antes había 3 listas distintas y ligeramente distintas entre sí: un presupuesto
// creado en "Entretenimiento" nunca detectaba gasto real registrado en "Entretención".
export const CATS_EXPENSE = ['Alimentación', 'Vivienda', 'Transporte', 'Salud', 'Educación',
  'Ropa', 'Entretención', 'Servicios', 'Tecnología', 'Deporte', 'Viajes', 'Otros']

// Categorías EFECTIVAS = canónicas + las que haya agregado la plantilla de perfil
// activa (data/templates.js vía TemplateSelector/Onboarding, guardadas en
// settings.categoriesExpense/categoriesIncome). Sin plantilla aplicada, es
// exactamente CATS_EXPENSE/CATS_INCOME — no cambia el comportamiento por defecto.
// Antes esos campos de settings se guardaban pero ningún formulario los leía: una
// plantilla como "Pareja o familia" ofrecía "Educación hijos" en la vista previa,
// pero esa categoría nunca era seleccionable al registrar un gasto real, así que
// el presupuesto sugerido que la plantilla creaba quedaba en 0% gastado para siempre.
export function getCategoriesExpense(settings) {
  const extra = Array.isArray(settings?.categoriesExpense) ? settings.categoriesExpense : []
  return [...CATS_EXPENSE, ...extra.filter(c => c && !CATS_EXPENSE.includes(c))]
}
export function getCategoriesIncome(settings) {
  const extra = Array.isArray(settings?.categoriesIncome) ? settings.categoriesIncome : []
  return [...CATS_INCOME, ...extra.filter(c => c && !CATS_INCOME.includes(c))]
}

export const METHODS      = ['Débito', 'Crédito', 'Efectivo', 'Transferencia']
export const RECURRENCES  = ['Único', 'Mensual', 'Quincenal', 'Semanal']
// El VALOR guardado y comparado en código (r.recurrence !== 'Único', etc.) sigue
// siendo siempre uno de los 4 strings en español de RECURRENCES — solo la
// ETIQUETA que ve el usuario se traduce. Cambiar el valor guardado rompería
// datos ya existentes en IndexedDB de usuarios actuales.
export const recurrenceLabel = (r, lang) => (lang ? translateOrRaw('recurrence.', r, lang) : (r || ''))

// Seed data para demo
export const SEED_INCOMES = [
  { id: uid(), date: '2025-05-01', source: 'Salario empresa', amount: 3500000, category: 'Salario', recurrence: 'Mensual', notes: '' },
  { id: uid(), date: '2025-05-15', source: 'Freelance diseño', amount: 450000, category: 'Freelance', recurrence: 'Único', notes: '' },
  { id: uid(), date: '2025-05-22', source: 'Consultoría', amount: 250000, category: 'Freelance', recurrence: 'Único', notes: '' },
]

export const SEED_EXPENSES = [
  { id: uid(), date: '2025-05-01', description: 'Arriendo', amount: 480000, category: 'Vivienda', method: 'Transferencia', type: 'Necesidad', recurrence: 'Mensual', notes: '' },
  { id: uid(), date: '2025-05-03', description: 'Supermercado', amount: 185000, category: 'Alimentación', method: 'Débito', type: 'Necesidad', recurrence: 'Único', notes: '' },
  { id: uid(), date: '2025-05-04', description: 'Bencina', amount: 62000, category: 'Transporte', method: 'Débito', type: 'Necesidad', recurrence: 'Único', notes: '' },
  { id: uid(), date: '2025-05-05', description: 'Netflix', amount: 18000, category: 'Entretención', method: 'Crédito', type: 'Deseo', recurrence: 'Mensual', notes: '' },
  { id: uid(), date: '2025-05-06', description: 'Farmacia', amount: 35000, category: 'Salud', method: 'Débito', type: 'Necesidad', recurrence: 'Único', notes: '' },
]

export const SEED_BUDGETS = [
  { id: uid(), category: 'Vivienda', limit: 500000 },
  { id: uid(), category: 'Alimentación', limit: 300000 },
  { id: uid(), category: 'Transporte', limit: 80000 },
  { id: uid(), category: 'Entretención', limit: 60000 },
  { id: uid(), category: 'Salud', limit: 100000 },
]

export const SEED_DEBTS = [
  { id: uid(), creditor: 'Tarjeta Banco Estado', initial: 2000000, balance: 1200000, minPayment: 95000, dueDate: '2025-06-15', rate: 19.9 },
  { id: uid(), creditor: 'Crédito Santander', initial: 5000000, balance: 3600000, minPayment: 190000, dueDate: '2025-07-05', rate: 12.5 },
]

export const SEED_GOALS = [
  { id: uid(), name: 'Fondo de emergencia', target: 7200000, saved: 4200000, targetDate: '2025-12-31', priority: 'Alta', color: '#B8863B' },
  { id: uid(), name: 'Viaje a Europa', target: 5000000, saved: 1400000, targetDate: '2026-03-01', priority: 'Media', color: '#14213D' },
  { id: uid(), name: 'Pie departamento', target: 5800000, saved: 1200000, targetDate: '2027-06-01', priority: 'Alta', color: '#5B7A99' },
]
