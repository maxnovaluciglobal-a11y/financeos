// src/context/visibilitySync.js — orden al volver a la app (V-ENG-FN1).
// Primero baja lo de otros dispositivos y después corre el mantenimiento de
// fijos: si el mantenimiento fuera primero, sus confirmaciones automáticas
// marcarían un cambio local nuevo y lo local le ganaría a un remoto más nuevo.
// Sin sync que correr (apagado o dentro de la espera), solo el mantenimiento.
export async function runOnVisible({ shouldSync, runSync, runMaintenance }) {
  if (shouldSync) {
    try { await runSync() } catch { /* runSync registra sus propios errores */ }
  }
  return runMaintenance()
}
