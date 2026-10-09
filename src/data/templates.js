// src/data/templates.js
// Plantillas por perfil — FinanceOS Fase 7
// Cada plantilla configura: categorías, presupuestos sugeridos, metas tipo y alertas
// NUNCA borra transacciones reales sin confirmación explícita del usuario
//
// i18n (oct-2026): los textos que se MUESTRAN (descripción, "ideal para", notas
// de presupuesto, metas, alertas, métricas, consejo del asesor) son claves
// 'tpl.<id>.*' de src/i18n/{es,en,pt,de}.js; acá solo queda la clave. Las
// categorías SÍ son valores en español que se guardan tal cual en los datos
// del usuario (como en CATS_EXPENSE): su etiqueta se traduce con catLabel()
// vía 'cat.<valor>'. Usar siempre el valor canónico de CATS_EXPENSE
// ("Entretención", nunca "Entretenimiento": ver utils/categoryAliases.js). `name` sigue en español porque se guarda como
// settings.activeTemplateName (referencia); la UI muestra 'tpl.<id>.name'.

export const TEMPLATES = [
  {
    id: 'personal',
    color: '#356E57',
    name: 'Persona natural',
    tagline: 'tpl.personal.tagline',
    description: 'tpl.personal.description',
    bestFor: ['tpl.personal.bestFor.0', 'tpl.personal.bestFor.1', 'tpl.personal.bestFor.2'],
    categoriesIncome: ['Salario', 'Bono', 'Freelance', 'Inversión', 'Otro'],
    categoriesExpense: ['Vivienda', 'Alimentación', 'Transporte', 'Salud', 'Entretención', 'Servicios', 'Ropa', 'Otro'],
    suggestedBudgets: [
      { category: 'Vivienda', pct: 30, note: 'tpl.personal.budgetNote.0' },
      { category: 'Alimentación', pct: 15, note: 'tpl.personal.budgetNote.1' },
      { category: 'Transporte', pct: 10, note: 'tpl.personal.budgetNote.2' },
      { category: 'Entretención', pct: 10, note: 'tpl.personal.budgetNote.3' },
      { category: 'Salud', pct: 5, note: 'tpl.personal.budgetNote.4' },
    ],
    suggestedGoals: [
      { name: 'tpl.personal.goal.0.name', note: 'tpl.personal.goal.0.note', priority: 'Alta' },
      { name: 'tpl.personal.goal.1.name', note: 'tpl.personal.goal.1.note', priority: 'Alta' },
    ],
    alerts: ['tpl.personal.alert.0', 'tpl.personal.alert.1', 'tpl.personal.alert.2'],
    keyMetrics: ['tpl.personal.metric.0', 'tpl.personal.metric.1', 'tpl.personal.metric.2'],
    advisorTip: 'tpl.personal.advisorTip',
  },

  {
    id: 'pareja',
    color: '#5B7A99',
    name: 'Pareja o familia',
    tagline: 'tpl.pareja.tagline',
    description: 'tpl.pareja.description',
    bestFor: ['tpl.pareja.bestFor.0', 'tpl.pareja.bestFor.1', 'tpl.pareja.bestFor.2'],
    categoriesIncome: ['Salario cónyuge 1', 'Salario cónyuge 2', 'Arriendo', 'Bono', 'Freelance', 'Otro'],
    categoriesExpense: ['Vivienda', 'Alimentación', 'Transporte', 'Educación hijos', 'Salud', 'Entretención', 'Servicios', 'Ropa', 'Mascotas', 'Otro'],
    suggestedBudgets: [
      { category: 'Vivienda', pct: 28, note: 'tpl.pareja.budgetNote.0' },
      { category: 'Alimentación', pct: 18, note: 'tpl.pareja.budgetNote.1' },
      { category: 'Educación hijos', pct: 12, note: 'tpl.pareja.budgetNote.2' },
      { category: 'Transporte', pct: 10, note: 'tpl.pareja.budgetNote.3' },
      { category: 'Entretención', pct: 8, note: 'tpl.pareja.budgetNote.4' },
    ],
    suggestedGoals: [
      { name: 'tpl.pareja.goal.0.name', note: 'tpl.pareja.goal.0.note', priority: 'Alta' },
      { name: 'tpl.pareja.goal.1.name', note: 'tpl.pareja.goal.1.note', priority: 'Media' },
      { name: 'tpl.pareja.goal.2.name', note: 'tpl.pareja.goal.2.note', priority: 'Alta' },
    ],
    alerts: ['tpl.pareja.alert.0', 'tpl.pareja.alert.1', 'tpl.pareja.alert.2'],
    keyMetrics: ['tpl.pareja.metric.0', 'tpl.pareja.metric.1', 'tpl.pareja.metric.2'],
    advisorTip: 'tpl.pareja.advisorTip',
  },

  {
    id: 'freelancer',
    color: '#8B7A55',
    name: 'Freelancer',
    tagline: 'tpl.freelancer.tagline',
    description: 'tpl.freelancer.description',
    bestFor: ['tpl.freelancer.bestFor.0', 'tpl.freelancer.bestFor.1', 'tpl.freelancer.bestFor.2', 'tpl.freelancer.bestFor.3'],
    categoriesIncome: ['Proyecto cliente A', 'Proyecto cliente B', 'Retainer mensual', 'Consultoría', 'Plataforma digital', 'Bono', 'Otro'],
    categoriesExpense: ['Vivienda', 'Alimentación', 'Transporte', 'Tecnología', 'Marketing propio', 'Educación / Cursos', 'Salud', 'Servicios', 'Provisión impuestos', 'Entretención', 'Otro'],
    suggestedBudgets: [
      { category: 'Provisión impuestos', pct: 15, note: 'tpl.freelancer.budgetNote.0' },
      { category: 'Tecnología', pct: 8, note: 'tpl.freelancer.budgetNote.1' },
      { category: 'Educación / Cursos', pct: 5, note: 'tpl.freelancer.budgetNote.2' },
      { category: 'Vivienda', pct: 25, note: 'tpl.freelancer.budgetNote.3' },
      { category: 'Marketing propio', pct: 3, note: 'tpl.freelancer.budgetNote.4' },
    ],
    suggestedGoals: [
      { name: 'tpl.freelancer.goal.0.name', note: 'tpl.freelancer.goal.0.note', priority: 'Alta' },
      { name: 'tpl.freelancer.goal.1.name', note: 'tpl.freelancer.goal.1.note', priority: 'Alta' },
      { name: 'tpl.freelancer.goal.2.name', note: 'tpl.freelancer.goal.2.note', priority: 'Media' },
    ],
    alerts: ['tpl.freelancer.alert.0', 'tpl.freelancer.alert.1', 'tpl.freelancer.alert.2'],
    keyMetrics: ['tpl.freelancer.metric.0', 'tpl.freelancer.metric.1', 'tpl.freelancer.metric.2'],
    advisorTip: 'tpl.freelancer.advisorTip',
  },

  {
    id: 'pyme',
    color: '#B8863B',
    name: 'Pyme o negocio pequeño',
    tagline: 'tpl.pyme.tagline',
    description: 'tpl.pyme.description',
    bestFor: ['tpl.pyme.bestFor.0', 'tpl.pyme.bestFor.1', 'tpl.pyme.bestFor.2'],
    categoriesIncome: ['Sueldo del dueño', 'Utilidad del negocio', 'Ventas directas', 'Servicios profesionales', 'Inversión', 'Otro'],
    categoriesExpense: ['Vivienda personal', 'Alimentación', 'Transporte personal', 'Gastos operativos negocio', 'Proveedores', 'Salud', 'Servicios personales', 'Tecnología negocio', 'Impuestos negocio', 'Otro'],
    suggestedBudgets: [
      { category: 'Gastos operativos negocio', pct: 20, note: 'tpl.pyme.budgetNote.0' },
      { category: 'Impuestos negocio', pct: 12, note: 'tpl.pyme.budgetNote.1' },
      { category: 'Vivienda personal', pct: 25, note: 'tpl.pyme.budgetNote.2' },
      { category: 'Tecnología negocio', pct: 5, note: 'tpl.pyme.budgetNote.3' },
    ],
    suggestedGoals: [
      { name: 'tpl.pyme.goal.0.name', note: 'tpl.pyme.goal.0.note', priority: 'Alta' },
      { name: 'tpl.pyme.goal.1.name', note: 'tpl.pyme.goal.1.note', priority: 'Alta' },
      { name: 'tpl.pyme.goal.2.name', note: 'tpl.pyme.goal.2.note', priority: 'Media' },
    ],
    alerts: ['tpl.pyme.alert.0', 'tpl.pyme.alert.1', 'tpl.pyme.alert.2'],
    keyMetrics: ['tpl.pyme.metric.0', 'tpl.pyme.metric.1', 'tpl.pyme.metric.2'],
    advisorTip: 'tpl.pyme.advisorTip',
  },

  {
    id: 'deudas',
    color: '#A23E2E',
    name: 'Cliente con deuda',
    tagline: 'tpl.deudas.tagline',
    description: 'tpl.deudas.description',
    bestFor: ['tpl.deudas.bestFor.0', 'tpl.deudas.bestFor.1', 'tpl.deudas.bestFor.2'],
    categoriesIncome: ['Salario', 'Ingreso extra', 'Freelance', 'Bono', 'Otro'],
    categoriesExpense: ['Vivienda', 'Alimentación', 'Transporte', 'Servicios básicos', 'Pago tarjeta crédito', 'Pago crédito consumo', 'Pago crédito hipotecario', 'Salud', 'Otro'],
    suggestedBudgets: [
      { category: 'Pago tarjeta crédito', pct: 15, note: 'tpl.deudas.budgetNote.0' },
      { category: 'Pago crédito consumo', pct: 10, note: 'tpl.deudas.budgetNote.1' },
      { category: 'Vivienda', pct: 28, note: 'tpl.deudas.budgetNote.2' },
      { category: 'Alimentación', pct: 15, note: 'tpl.deudas.budgetNote.3' },
      { category: 'Servicios básicos', pct: 8, note: 'tpl.deudas.budgetNote.4' },
    ],
    suggestedGoals: [
      { name: 'tpl.deudas.goal.0.name', note: 'tpl.deudas.goal.0.note', priority: 'Alta' },
      { name: 'tpl.deudas.goal.1.name', note: 'tpl.deudas.goal.1.note', priority: 'Alta' },
      { name: 'tpl.deudas.goal.2.name', note: 'tpl.deudas.goal.2.note', priority: 'Media' },
    ],
    alerts: ['tpl.deudas.alert.0', 'tpl.deudas.alert.1', 'tpl.deudas.alert.2'],
    keyMetrics: ['tpl.deudas.metric.0', 'tpl.deudas.metric.1', 'tpl.deudas.metric.2', 'tpl.deudas.metric.3'],
    advisorTip: 'tpl.deudas.advisorTip',
  },

  {
    id: 'ahorro',
    color: '#356E57',
    name: 'Cliente con meta de ahorro',
    tagline: 'tpl.ahorro.tagline',
    description: 'tpl.ahorro.description',
    bestFor: ['tpl.ahorro.bestFor.0', 'tpl.ahorro.bestFor.1', 'tpl.ahorro.bestFor.2'],
    categoriesIncome: ['Salario', 'Bono', 'Ingreso extra', 'Inversión', 'Otro'],
    categoriesExpense: ['Vivienda', 'Alimentación', 'Transporte', 'Salud', 'Servicios', 'Entretención', 'Ahorro meta principal', 'Otro'],
    suggestedBudgets: [
      { category: 'Ahorro meta principal', pct: 25, note: 'tpl.ahorro.budgetNote.0' },
      { category: 'Vivienda', pct: 28, note: 'tpl.ahorro.budgetNote.1' },
      { category: 'Alimentación', pct: 15, note: 'tpl.ahorro.budgetNote.2' },
      { category: 'Entretención', pct: 8, note: 'tpl.ahorro.budgetNote.3' },
    ],
    suggestedGoals: [
      { name: 'tpl.ahorro.goal.0.name', note: 'tpl.ahorro.goal.0.note', priority: 'Alta' },
      { name: 'tpl.ahorro.goal.1.name', note: 'tpl.ahorro.goal.1.note', priority: 'Alta' },
    ],
    alerts: ['tpl.ahorro.alert.0', 'tpl.ahorro.alert.1', 'tpl.ahorro.alert.2'],
    keyMetrics: ['tpl.ahorro.metric.0', 'tpl.ahorro.metric.1', 'tpl.ahorro.metric.2'],
    advisorTip: 'tpl.ahorro.advisorTip',
  },

  {
    id: 'educador',
    color: '#8B7A55',
    name: 'Educador financiero',
    tagline: 'tpl.educador.tagline',
    description: 'tpl.educador.description',
    bestFor: ['tpl.educador.bestFor.0', 'tpl.educador.bestFor.1', 'tpl.educador.bestFor.2'],
    categoriesIncome: ['Sueldo mensual', 'Ingreso extra', 'Emprendimiento', 'Ayuda familiar', 'Otro'],
    categoriesExpense: ['Arriendo o vivienda', 'Comida', 'Transporte', 'Servicios (luz/agua/internet)', 'Salud', 'Educación', 'Ocio y entretenimiento', 'Ropa', 'Otro'],
    suggestedBudgets: [
      { category: 'Arriendo o vivienda', pct: 30, note: 'tpl.educador.budgetNote.0' },
      { category: 'Comida', pct: 20, note: 'tpl.educador.budgetNote.1' },
      { category: 'Transporte', pct: 10, note: 'tpl.educador.budgetNote.2' },
      { category: 'Servicios (luz/agua/internet)', pct: 8, note: 'tpl.educador.budgetNote.3' },
      { category: 'Ocio y entretenimiento', pct: 10, note: 'tpl.educador.budgetNote.4' },
    ],
    suggestedGoals: [
      { name: 'tpl.educador.goal.0.name', note: 'tpl.educador.goal.0.note', priority: 'Alta' },
      { name: 'tpl.educador.goal.1.name', note: 'tpl.educador.goal.1.note', priority: 'Media' },
    ],
    alerts: ['tpl.educador.alert.0', 'tpl.educador.alert.1', 'tpl.educador.alert.2'],
    keyMetrics: ['tpl.educador.metric.0', 'tpl.educador.metric.1', 'tpl.educador.metric.2'],
    advisorTip: 'tpl.educador.advisorTip',
  },
]

// ── Plantilla de arranque del onboarding ──────────────────────────────────
// Se elige por PERSONA, no por país (feedback de Walter, 09-oct-2026). Antes
// EC/PE/CO/VE arrancaban con 'freelancer' por la tasa de autoempleo del país,
// y un asalariado de Bogotá veía "Marketing propio" y "Provisión impuestos" en
// su primer gasto. Ahora todos arrancan con 'personal' y solo quien responde
// "Sí" a "¿Trabajas por tu cuenta?" recibe 'freelancer'.
export function templateIdForProfile({ selfEmployed = false } = {}) {
  return selfEmployed ? 'freelancer' : 'personal'
}

// Ajustes que escribe el onboarding. Con "Sí", las categorías son las de la
// plantilla personal MÁS las propias de freelancer (unión, personales primero):
// Alimentación, Ropa, etc. siguen ahí y además aparecen Marketing propio,
// Provisión impuestos… Presupuestos sugeridos, alertas y consejo son los de
// freelancer. Las canónicas (CATS_EXPENSE) siempre siguen disponibles aparte.
export function profileTemplateSettings({ selfEmployed = false } = {}) {
  const personal = TEMPLATES.find(t => t.id === 'personal')
  const tpl = TEMPLATES.find(t => t.id === templateIdForProfile({ selfEmployed })) || personal
  const union = (a, b) => [...new Set([...(a || []), ...(b || [])])]
  const merge = tpl.id !== personal.id
  return {
    activeTemplateId: tpl.id,
    activeTemplateName: tpl.name,
    categoriesIncome: merge ? union(personal.categoriesIncome, tpl.categoriesIncome) : [...tpl.categoriesIncome],
    categoriesExpense: merge ? union(personal.categoriesExpense, tpl.categoriesExpense) : [...tpl.categoriesExpense],
    templateSuggestedBudgets: tpl.suggestedBudgets,
    templateAdvisorTip: tpl.advisorTip,
    templateAlerts: tpl.alerts,
  }
}

export default TEMPLATES
