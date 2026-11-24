// src/utils/subscriptionNext.js — próxima fecha de cobro de una suscripción
// (QA pre-tiendas 23-nov-2026, I13). `nextPaymentDate` es la fecha que se
// cargó una vez; con el tiempo queda en el pasado (Netflix "próximo pago
// 5-nov" el 23-nov, ya cobrado). Se corre según la frecuencia hasta hoy o
// después, en hora local, sin tocar el dato guardado.
const STEP = { weekly: { d: 7 }, monthly: { m: 1 }, quarterly: { m: 3 }, annual: { m: 12 }, anual: { m: 12 } }

/** @param {string} iso 'AAAA-MM-DD' @param {string} freq @param {string} today 'AAAA-MM-DD' */
export function nextPaymentOn(iso, freq, today) {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return ''
  const step = STEP[freq] || STEP.monthly
  const fmt = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  let k = 0, cur = new Date(y, m - 1, d)
  while (fmt(cur) < today && k < 1200) {
    k++
    if (step.d) cur = new Date(y, m - 1, d + step.d * k)
    else {
      // Mismo día del mes; si no existe (31 en abril), el último día del mes.
      const target = new Date(y, m - 1 + step.m * k, 1)
      const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
      cur = new Date(target.getFullYear(), target.getMonth(), Math.min(d, last))
    }
  }
  return fmt(cur)
}
