// src/utils/netWorth.js
// Cálculo único de Patrimonio neto (stock, a HOY — no depende del mes activo).
// Usado por la página Patrimonio y por el resumen en Reportes/PDF para que
// nunca diverjan.
//   Activos = ahorro en Metas + valor declarado de propiedades
//           + flujo neto positivo de propiedades SIN valor declarado
//           + "Por cobrar" (saldo pendiente de lo que me deben, D2)
//   Pasivos = saldos de Deudas + flujo neto negativo de propiedades sin valor
// (las propiedades con valor declarado entran por valor, no por flujo — sin doble conteo)
// `debts` puede venir mezclado (la store entera) o ya separado; `receivables`
// es opcional. Un mismo registro nunca se cuenta dos veces (se une por id).
import { splitDebts } from './debtDirection.js'

function byId(...lists) {
  const seen = new Map()
  let n = 0
  for (const list of lists) for (const d of list || []) { if (d) seen.set(d.id ?? `_${n++}`, d) }
  return [...seen.values()]
}

export function calcNetWorth({ goals, debts, receivables, incomes, expenses, settings }) {
  const { owe, owed } = splitDebts(byId(debts, receivables))
  const savedInGoals = (goals || []).reduce((s, g) => s + (Number(g.saved) || 0), 0)
  const pendingDebt  = owe.reduce((s, d) => s + (Number(d.balance) || 0), 0)
  const receivablesPending = owed.reduce((s, d) => s + Math.max(0, Number(d.balance) || 0), 0)

  const propertyValues = settings?.propertyValues || {}
  const propsValueTotal = Object.values(propertyValues).reduce((s, v) => s + (Number(v) || 0), 0)
  const valuedNames = new Set(
    Object.keys(propertyValues).filter(k => Number(propertyValues[k]) > 0).map(k => k.trim().toLowerCase())
  )

  const map = {}
  const push = (r, kind) => {
    const key = (r?.project || '').trim()
    if (!key) return
    if (valuedNames.has(key.toLowerCase())) return
    const amt = Number(r.amount) || 0
    map[key] = (map[key] || 0) + (kind === 'inc' ? amt : -amt)
  }
  ;(incomes || []).forEach(r => push(r, 'inc'))
  ;(expenses || []).forEach(r => push(r, 'exp'))
  const propertiesNet = Object.values(map).reduce((s, n) => s + n, 0)

  const totalActivos = savedInGoals + propsValueTotal + Math.max(0, propertiesNet) + receivablesPending
  const totalPasivos = pendingDebt + Math.max(0, -propertiesNet)
  return {
    savedInGoals, propsValueTotal, propertiesNet, pendingDebt, receivablesPending,
    totalActivos, totalPasivos,
    netWorth: totalActivos - totalPasivos,
    hasData: (goals?.length || 0) > 0 || owe.length > 0 || owed.length > 0 || propertiesNet !== 0 || propsValueTotal > 0,
  }
}
