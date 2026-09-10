// src/utils/goalSuggestions.js
import { translations } from '../i18n/translations.js'
// Sugerencias de metas financieras básicas — v1.4
// Basadas en principios financieros generales
// NO constituyen asesoría financiera certificada

/**
 * Definición de metas sugeridas
 * targetFn: función que calcula el objetivo según ingresos/gastos
 * contributionPct: % del ingreso neto mensual sugerido como aporte
 * priority: orden de importancia financiera
 */
export const GOAL_TEMPLATES = [
  {
    id: 'emergency_fund',
    emoji: '🛡️',
    name: 'gs.emergency.name',
    description: 'gs.emergency.desc',
    priority: 1,
    // 3 meses de gastos del mes (o 3x ingreso neto si no hay gastos registrados)
    // Decisión Walter 2026-07-10: 3 meses es suficiente como meta inicial (antes 6)
    targetFn: ({ ingresoNeto, gastoMensual }) => {
      const base = gastoMensual > 0 ? gastoMensual : ingresoNeto
      return Math.round(base * 3)
    },
    contributionPct: 0.10,
    color: '#14213D',
    goalPriority: 'Alta',
    hint: 'gs.emergency.hint',
  },
  {
    id: 'vacations',
    emoji: '✈️',
    name: 'gs.vacations.name',
    description: 'gs.vacations.desc',
    priority: 2,
    // Vacaciones anuales ≈ un mes de tu ritmo de vida (gasto mensual). Antes era
    // 1.5× ingreso, que inflaba el monto y daba horizontes de ~30 meses para una
    // meta que es anual. Fallback a ingreso si aún no hay gastos registrados.
    targetFn: ({ ingresoNeto, gastoMensual }) => {
      const base = gastoMensual > 0 ? gastoMensual : ingresoNeto
      return Math.round(base * 1)
    },
    contributionPct: 0.05,
    color: '#5B7A99',
    goalPriority: 'Media',
    hint: 'gs.vacations.hint',
  },
  {
    id: 'year_end',
    emoji: '🎄',
    name: 'gs.yearEnd.name',
    description: 'gs.yearEnd.desc',
    priority: 3,
    targetFn: ({ ingresoNeto, gastoMensual }) => {
      const base = gastoMensual > 0 ? gastoMensual : ingresoNeto
      return Math.round(base * 0.5)
    },
    contributionPct: 0.04,
    color: '#B8863B',
    goalPriority: 'Media',
    hint: 'gs.yearEnd.hint',
  },
  {
    id: 'education',
    emoji: '📚',
    name: 'gs.education.name',
    description: 'gs.education.desc',
    priority: 4,
    targetFn: ({ ingresoNeto }) => Math.round(ingresoNeto * 0.5),
    contributionPct: 0.03,
    color: '#8B7A55',
    goalPriority: 'Media',
    hint: 'gs.education.hint',
  },
  {
    id: 'opportunity_fund',
    emoji: '💡',
    name: 'gs.opportunity.name',
    description: 'gs.opportunity.desc',
    priority: 5,
    // Colchón de oportunidades = un mes de tu ritmo de vida (gasto mensual).
    // Antes era 2× ingreso, lo que lo hacía casi tan grande como el fondo de
    // emergencia pese a ser la meta de MENOR prioridad. Fallback a ingreso.
    targetFn: ({ ingresoNeto, gastoMensual }) => {
      const base = gastoMensual > 0 ? gastoMensual : ingresoNeto
      return Math.round(base * 1)
    },
    contributionPct: 0.03,
    color: '#356E57',
    goalPriority: 'Baja',
    hint: 'gs.opportunity.hint',
  },
]

/**
 * Genera sugerencias de metas según los datos del usuario
 * @param {object} params
 * @param {number} params.ingresoNeto - ingreso neto mensual
 * @param {number} params.gastoMensual - gasto mensual promedio
 * @param {Array}  params.existingGoals - metas ya existentes
 * @returns {Array} sugerencias con montos calculados
 */
function esFallback(key) { return translations.es?.[key] ?? key }

export function generateGoalSuggestions({ ingresoNeto, gastoMensual = 0, existingGoals = [] }, t) {
  const tr = t || esFallback
  if (!ingresoNeto || ingresoNeto <= 0) return []

  const existingNames = existingGoals.map(g =>
    (g.name || '').toLowerCase().trim()
  )

  return GOAL_TEMPLATES
    .map(template => {
      const target = template.targetFn({ ingresoNeto, gastoMensual })
      const monthlyContribution = Math.round(ingresoNeto * template.contributionPct)
      const monthsToGoal = monthlyContribution > 0
        ? Math.ceil(target / monthlyContribution)
        : null

      const displayName = tr(template.name)
      // Detectar si ya existe una meta similar (en cualquier idioma soportado)
      const localizedNames = ['es', 'en', 'pt']
        .map(l => (translations[l]?.[template.name] || '').toLowerCase())
        .filter(Boolean)
      const alreadyExists = existingNames.some(name =>
        name.includes(template.id.replace('_', ' ')) ||
        localizedNames.some(ln => ln && name.includes(ln.slice(0, 8)))
      )

      return {
        ...template,
        name: displayName,
        description: tr(template.description),
        hint: tr(template.hint),
        target,
        monthlyContribution,
        monthsToGoal,
        alreadyExists,
        selected: !alreadyExists, // preseleccionada si no existe
      }
    })
}

/**
 * Calcula el total de aportes mensuales sugeridos
 */
export function totalMonthlyContribution(suggestions) {
  return suggestions
    .filter(s => s.selected && !s.alreadyExists)
    .reduce((sum, s) => sum + s.monthlyContribution, 0)
}
// v1.4-1780717043
