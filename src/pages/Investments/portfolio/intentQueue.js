// src/pages/Investments/portfolio/intentQueue.js — lo que Resumen pide abrir en
// Portafolio ("Registrar depósitos", "Importar", "Agregar"): se lee una sola
// vez al montar la pestaña. En memoria, sin tickers ni montos.
export const PORT_INTENTS = ['deposit', 'import', 'add']
let queued = null

export function queuePortIntent(intent) {
  queued = PORT_INTENTS.includes(intent) ? intent : null
}

export function takePortIntent() {
  const q = queued
  queued = null
  return q
}
