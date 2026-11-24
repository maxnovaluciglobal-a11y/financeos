// src/pages/Investments/oportunidades/queue.js — "Ver oportunidades" desde
// Resumen o desde Aportes: abre Planificar › Oportunidades, opcionalmente con
// un monto en US$ para "Repartir mi capital". En memoria, se lee una sola vez
// (como investNav.queuePlanAporte; sin tickers en el dispositivo).
let queued = null

export function queueOpp({ usd = null, focus = null } = {}) {
  const v = Math.round(Number(usd) * 100) / 100
  queued = { sub: 'oportunidades', usd: v > 0 ? v : null, focus: focus === 'split' ? 'split' : null }
}

export function takeOppQueue() {
  const q = queued
  queued = null
  return q
}
