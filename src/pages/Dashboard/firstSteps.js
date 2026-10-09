// src/pages/Dashboard/firstSteps.js — "Primeros pasos n/3" del Inicio (R06).
// El progreso sale de los datos reales, nunca de un flag guardado: si alguien
// borra su único presupuesto, el paso vuelve a quedar pendiente.
//   1. movement — al menos un ingreso o gasto (registrado a mano o importado)
//   2. budget   — al menos un presupuesto
//   3. backup   — un respaldo descargado (settings.lastBackupAt) o el sync
//                 cifrado activo
export const FIRST_STEP_IDS = ['movement', 'budget', 'backup']

export function firstStepsProgress({ incomes = [], expenses = [], budgets = [], lastBackupAt = null, syncOn = false } = {}) {
  const has = (a) => Array.isArray(a) && a.length > 0
  const doneById = {
    movement: has(incomes) || has(expenses),
    budget: has(budgets),
    backup: !!lastBackupAt || !!syncOn,
  }
  const steps = FIRST_STEP_IDS.map(id => ({ id, done: doneById[id] }))
  const done = steps.filter(s => s.done).length
  return {
    steps,
    done,
    total: steps.length,
    complete: done === steps.length,
    // El primer paso pendiente es el que lleva el botón principal (Latón).
    nextId: steps.find(s => !s.done)?.id || null,
  }
}
