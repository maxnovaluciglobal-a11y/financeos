// src/i18n/glossary.js — glosario único de moyiq (F-1 hilo del dinero,
// 20-nov-2026; benchmark/05-coherencia-360.md §4).
//
// Una palabra por concepto y en los cuatro idiomas, para que gasto, ahorro,
// inversión, patrimonio y metas se lean como una sola historia. No se importa
// desde la app (no pesa en el JS): es la fuente que consultan los textos
// nuevos y la que vigila `glossary.test.js`:
//  · `keys`: claves de los diccionarios que DEBEN usar el término canónico.
//  · RETIRED: sinónimos retirados que NO pueden aparecer en los diccionarios.
// Reglas de escritura: tono neutro con "tú" (nunca voseo), sin jerga sin
// explicar; la palabra técnica va con su explicación la primera vez.

/**
 * @typedef {{ es: string, en: string, pt: string, de: string, def: string,
 *   keys?: string[], cognate?: boolean }} Term
 * `cognate`: el término es igual en portugués y en español a propósito.
 */

/** @type {Record<string, Term>} */
export const GLOSSARY = {
  // ── El mes ────────────────────────────────────────────────────────────────
  ingresos: { es: 'Ingresos', en: 'Income', pt: 'Receitas', de: 'Einnahmen', def: 'Dinero que entró este mes', keys: ['mov.kpi.income'] },
  gastos: { es: 'Gastos', en: 'Expenses', pt: 'Despesas', de: 'Ausgaben', def: 'Dinero que salió por consumo o pagos', keys: ['mov.kpi.totalOut'] },
  teQueda: { es: 'Te queda este mes', en: 'Left this month', pt: 'Sobra este mês', de: 'Diesen Monat übrig', def: 'Ingresos − gastos − apartado (solo lo registrado; utils/monthLeft.js)', keys: ['home.kpi.left'] },
  teFalta: { es: 'Te falta este mes', en: 'Short this month', pt: 'Falta este mês', de: 'Diesen Monat im Minus', def: 'Lo mismo que "Te queda", cuando da negativo', keys: ['home.kpi.short'] },
  apartar: { es: 'Apartar', en: 'Set aside', pt: 'Reservar', de: 'Zurücklegen', def: 'Mover dinero de lo que te queda a una meta o a Para invertir. No es un gasto', keys: ['qa.setAside'] },
  apartado: { es: 'Apartado', en: 'Set aside', pt: 'Reservado', de: 'Zurückgelegt', def: 'Lo que apartaste este mes', keys: ['qa.savedSetAside'] },
  paraInvertir: { es: 'Para invertir', en: 'To invest', pt: 'Para investir', de: 'Zum Investieren', def: 'Lo que apartaste para Inversiones y todavía no compró nada', keys: ['qa.setAside.invest'] },
  ritmo: { es: 'Ritmo del mes', en: "this month's pace", pt: 'Ritmo do mês', de: 'Monatstempo', def: 'Cómo vas comparado con un gasto parejo durante el mes', keys: ['home.lupa.pace.even'] },
  tasaAhorro: { es: 'Tasa de ahorro', en: 'Savings rate', pt: 'Taxa de poupança', de: 'Sparquote', def: 'Lo que no gastaste (incluye lo apartado) ÷ ingresos', keys: ['dash.kpi.savingRate'] },
  // ── Metas y patrimonio ────────────────────────────────────────────────────
  metas: { es: 'Metas', en: 'Goals', pt: 'Metas', de: 'Ziele', def: 'Algo para lo que juntas dinero, con monto y fecha', keys: ['nav.goals', 'goals.title'], cognate: true },
  ahorrado: { es: 'ahorrado', en: 'saved', pt: 'poupado', de: 'gespart', def: 'Lo que llevas en una meta', keys: ['goals.kpi.saved'] },
  patrimonioNeto: { es: 'Patrimonio neto', en: 'Net worth', pt: 'Patrimônio líquido', de: 'Nettovermögen', def: 'Lo que tienes menos lo que debes', keys: ['networth.title'] },
  // ── Inversiones ───────────────────────────────────────────────────────────
  inversiones: { es: 'Inversiones', en: 'Investments', pt: 'Investimentos', de: 'Investments', def: 'La sección de moyiq donde ves lo que invertiste', keys: ['nav.investments'] },
  resumen: { es: 'Resumen', en: 'Summary', pt: 'Resumo', de: 'Übersicht', def: 'Primera pestaña de Inversiones (reemplaza a "Hoy" como nombre de pestaña)' },
  portafolio: { es: 'Portafolio', en: 'Portfolio', pt: 'Carteira', de: 'Portfolio', def: 'Todo lo que tienes invertido', keys: ['invest.hub.tab.portafolio'] },
  siguiendo: { es: 'Siguiendo', en: 'Following', pt: 'Seguindo', de: 'Beobachtet', def: 'Los activos que sigues sin tenerlos (reemplaza a "Lista")' },
  planificar: { es: 'Planificar', en: 'Plan', pt: 'Planejar', de: 'Planen', def: 'Aporte mensual y cómo repartirlo', keys: ['invest.hub.tab.planificar'] },
  mercado: { es: 'Mercado', en: 'Market', pt: 'Mercado', de: 'Markt', def: 'Cómo está el mercado hoy, en general', keys: ['invest.hub.tab.mercado'], cognate: true },
  aporte: { es: 'Aporte', en: 'Contribution', pt: 'Aporte', de: 'Einzahlung', def: 'Dinero que mandas a Inversiones', cognate: true },
  pusiste: { es: 'Pusiste', en: 'You put in', pt: 'Você colocou', de: 'Eingezahlt', def: 'Todo el dinero que pusiste en el portafolio, menos lo que sacaste' },
  mercadoSumo: { es: 'El mercado sumó', en: 'The market added', pt: 'O mercado somou', de: 'Der Markt brachte', def: 'Lo que cambió el valor por los precios, aparte de lo que pusiste (puede ser negativo: "El mercado restó")' },
  posicion: { es: 'Posición', en: 'Holding', pt: 'Posição', de: 'Position', def: 'Lo que tienes de un activo (por ejemplo, 3 unidades de VOO)' },
  simbolo: { es: 'Símbolo', en: 'Symbol', pt: 'Símbolo', de: 'Kürzel', def: 'El código del activo (AAPL, VOO)', cognate: true },
  invertido: { es: 'Invertido', en: 'Invested', pt: 'Investido', de: 'Investiert', def: 'Lo que pagaste en total por una posición' },
  precioPromedio: { es: 'Precio promedio', en: 'Average price', pt: 'Preço médio', de: 'Durchschnittspreis', def: 'Invertido ÷ unidades' },
  resultado: { es: 'Resultado', en: 'Return', pt: 'Resultado', de: 'Ergebnis', def: 'Valor − invertido: ganancia si es positivo, pérdida si es negativo', cognate: true },
  estimacion: { es: 'Estimación', en: 'Estimate', pt: 'Estimativa', de: 'Schätzung', def: 'Cifra calculada con precios con retraso; puede diferir de tu bróker', keys: ['panorama.grid.inv.est'] },
}

/**
 * Sinónimos retirados (§4, columna "Reemplaza a"). `scope`: solo en claves
 * que empiezan con alguno de esos prefijos (el término es válido en otro
 * contexto, p. ej. "ingreso neto" en la regla 50/30/20 de Reportes).
 * @type {Array<{ lang: 'es'|'en'|'pt'|'de', re: RegExp, use: string, scope?: string[] }>}
 */
export const RETIRED = [
  // Te queda (I-16)
  { lang: 'es', re: /disponible este mes para ahorrar/i, use: 'Te queda este mes' },
  { lang: 'en', re: /available to save this month/i, use: 'Left this month' },
  { lang: 'pt', re: /dispon[ií]vel este m[eê]s para poupar/i, use: 'Sobra este mês' },
  { lang: 'de', re: /verfügbar zum Sparen/i, use: 'Diesen Monat übrig' },
  { lang: 'es', re: /est[aá]s en rojo/i, use: 'Te falta este mes' },
  { lang: 'en', re: /in the red/i, use: 'Short this month' },
  { lang: 'pt', re: /no vermelho/i, use: 'Falta este mês' },
  // Apartar
  { lang: 'es', re: /asignar a (tus )?metas/i, use: 'Apartar' },
  { lang: 'en', re: /assign(ing)? to goals/i, use: 'Set aside' },
  { lang: 'de', re: /Zielen zuweisen/i, use: 'Zurücklegen' },
  { lang: 'es', re: /ingreso neto/i, use: 'Ingresos', scope: ['goals.'] },
  { lang: 'en', re: /net income/i, use: 'Income', scope: ['goals.'] },
  { lang: 'pt', re: /receita l[ií]quida/i, use: 'Receitas', scope: ['goals.'] },
  { lang: 'de', re: /Nettoeinkommen/i, use: 'Einnahmen', scope: ['goals.'] },
  // Ritmo del mes (I-22: la palabra; la referencia la decide Walter)
  { lang: 'es', re: /ritmo ideal|por detr[aá]s del ritmo/i, use: 'Ritmo del mes' },
  { lang: 'en', re: /ideal pace/i, use: "this month's pace" },
  { lang: 'pt', re: /ritmo ideal/i, use: 'Ritmo do mês' },
  { lang: 'de', re: /idealen? Tempo/i, use: 'Monatstempo' },
  // Metas (I-11)
  { lang: 'es', re: /metas de ahorro/i, use: 'Metas' },
  { lang: 'en', re: /savings goals/i, use: 'Goals' },
  { lang: 'pt', re: /metas de poupan[cç]a/i, use: 'Metas' },
  { lang: 'de', re: /Sparziele/, use: 'Ziele' },
  // Patrimonio neto (I-10)
  { lang: 'es', re: /ahorraste y generaste/i, use: 'Lo que tienes menos lo que debes' },
  { lang: 'en', re: /saved and earned/i, use: 'What you own minus what you owe' },
  { lang: 'pt', re: /poupou e gerou/i, use: 'O que você tem menos o que deve' },
  { lang: 'de', re: /erspart und erwirtschaftet/i, use: 'Was Sie besitzen minus Ihre Schulden' },
  // Inversiones (I-6, I-8, I-9): un solo nombre y las palabras del portafolio
  { lang: 'es', re: /\bInvest\b/, use: 'Inversiones' },
  { lang: 'en', re: /\bin Invest\b/, use: 'Investments' },
  { lang: 'pt', re: /\bno Invest\b/, use: 'Investimentos' },
  { lang: 'de', re: /\bin Invest\b/, use: 'Investments' },
  { lang: 'es', re: /\bcartera\b/i, use: 'Portafolio' },
  { lang: 'es', re: /\bholdings?\b/i, use: 'Posición' },
  { lang: 'es', re: /costo promedio/i, use: 'Precio promedio' },
  { lang: 'es', re: /\bal costo\b|costo de compra/i, use: 'Invertido / "Sin precio, a lo invertido"' },
  { lang: 'es', re: /ganancia o p[eé]rdida|ganancia total|^En total$/i, use: 'Resultado' },
  { lang: 'es', re: /efectivo disponible/i, use: 'Para invertir' },
]

/**
 * Claves que todavía usan un sinónimo retirado y que corrige el trabajo de la
 * vista de Inversiones (otra rama, en paralelo con F-1). Es un trinquete: el
 * test falla si aparece uno nuevo y también si una de estas ya no lo usa
 * (entonces se borra de la lista). Formato: 'lang:clave'.
 */
export const PENDING_INVEST_VIEW = new Set([
  'es:invest.port.manage', 'en:invest.port.manage', 'pt:invest.port.manage', 'de:invest.port.manage',
  'es:invest.port.empty', 'en:invest.port.empty', 'pt:invest.port.empty', 'de:invest.port.empty',
  'es:invest.port.atCost', 'es:invest.state.cost', 'es:invest.card.costNote',
  'es:invest.detail.avgCost', 'es:invest.detail.pl', 'es:invest.card.total', 'es:invest.gate.point1',
])

/** Término canónico en un idioma (cae al español). */
export function term(id, lang = 'es') {
  const t = GLOSSARY[id]
  return t ? (t[lang] || t.es) : id
}
