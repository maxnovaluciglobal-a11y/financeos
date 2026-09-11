// src/utils/emergencyGoal.js
// Detección de "esta meta ES el fondo de emergencia" por nombre — no existe
// un campo de tipo dedicado en el modelo de metas. Fuente única para
// Coach (coachRules.js), Modo Asesor, Goals y el IQ Score (financialScore.js).
//
// Antes de esto había 4 copias divergentes del mismo regex. La de
// financialScore.js/coachRules.js matcheaba además la palabra suelta
// "fund"/"fondo"/"fundo" — con eso "Travel fund", "Car fund" o "College fund"
// contaban como fondo de emergencia. Alcanza con la raíz "emergenc*": toda
// frase real ("emergency fund", "fondo de emergencia", "fundo de emergência")
// ya la contiene, así que no hace falta matchear "fund"/"fondo" sueltos.
export function isEmergencyGoalName(name) {
  const n = (name || '').toLowerCase()
  return n.includes('emergencia') || n.includes('emergency') || n.includes('emergên')
}

export function findEmergencyGoal(goals) {
  return (Array.isArray(goals) ? goals : []).find(g => isEmergencyGoalName(g?.name))
}
