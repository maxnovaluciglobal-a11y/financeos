// src/pages/Goals/firstGoal.js — primera meta guiada (pulido 09-oct-2026).
// "¿Para qué quieres ahorrar?" con 4 opciones comunes que prellenan el
// formulario de nueva meta (nombre, prioridad y, si se puede calcular, monto).
// Sin cambio de esquema: una meta sigue siendo { name, target, saved, ... }.
//
// El fondo de emergencia usa el nombre de gs.emergency.name para que
// isEmergencyGoalName() lo reconozca (IQ Score, Coach, Asesor) en los 4
// idiomas, y propone 3 meses de gastos (misma regla que la tarjeta de ajuste).
export const FIRST_GOAL_IDS = ['emergency', 'trip', 'purchase', 'education']

export function firstGoalPresets({ emergencyBase = 0, t = (k) => k } = {}) {
  const base = Number(emergencyBase) || 0
  return [
    { id: 'emergency', name: t('gs.emergency.name'), priority: 'Alta', target: base > 0 ? Math.round(base * 3) : null },
    { id: 'trip', name: t('goals.first.tripName'), priority: 'Media', target: null },
    { id: 'purchase', name: t('goals.first.purchaseName'), priority: 'Media', target: null },
    { id: 'education', name: t('gs.education.name'), priority: 'Media', target: null },
  ]
}
