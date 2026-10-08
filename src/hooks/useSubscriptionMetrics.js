// src/hooks/useSubscriptionMetrics.js
// Hook compartido para métricas de suscripciones
// Usado por: Dashboard, Reportes, Modo Asesor, Reporte PDF
// Sin backend · Sin duplicar gastos · 100% local

import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { dbGetAll } from '../core/db/index.js'
import { currentMonth } from '../utils/index.js'

// ── CÁLCULOS DE FRECUENCIA ──────────────────────────────────────────────────
export function toMonthly(amount, frequency) {
  const a = parseFloat(amount) || 0
  switch (frequency) {
    case 'weekly':     return a * 4.33
    case 'monthly':    return a
    case 'quarterly':  return a / 3
    case 'annual':     return a / 12
    default:           return a
  }
}

export function toAnnual(amount, frequency) {
  const a = parseFloat(amount) || 0
  switch (frequency) {
    case 'weekly':     return a * 52
    case 'monthly':    return a * 12
    case 'quarterly':  return a * 4
    case 'annual':     return a
    default:           return a * 12
  }
}

// ── ESTADO ORIENTATIVO ──────────────────────────────────────────────────────
export function subStatus(pct) {
  if (pct <= 0)    return { label: 'Sin ingreso de referencia', color: 'var(--th)' }
  if (pct < 0.03)  return { label: 'Bajo',     color: 'var(--grn)' }
  if (pct < 0.07)  return { label: 'Moderado', color: 'var(--amb)' }
  return               { label: 'Alto',     color: 'var(--red)' }
}

// ── DETECCIÓN DE DUPLICADOS Y SUGERENCIAS ──────────────────────────────────
export function generateAlerts(activeSubs, monthlyIncome) {
  const alerts = []
  const byCat  = {}

  activeSubs.forEach(s => {
    byCat[s.category] = (byCat[s.category] || [])
    byCat[s.category].push(s)
  })

  // Más de 2 streaming
  if ((byCat['Streaming'] || []).length >= 2) {
    alerts.push({ type: 'duplicate', msg: `Tienes ${byCat['Streaming'].length} suscripciones en Streaming. Revisa si todas se usan regularmente.` })
  }
  // Más de 1 música
  if ((byCat['Música'] || []).length > 1) {
    alerts.push({ type: 'duplicate', msg: `Hay ${byCat['Música'].length} servicios de música activos. Evalúa si ambos son necesarios.` })
  }
  // Más de 1 almacenamiento
  if ((byCat['Almacenamiento'] || []).length > 1) {
    alerts.push({ type: 'duplicate', msg: `Hay ${byCat['Almacenamiento'].length} servicios de almacenamiento. Considera consolidarlos.` })
  }
  // Sin fecha de próximo pago
  const sinFecha = activeSubs.filter(s => !s.nextPaymentDate)
  if (sinFecha.length > 0) {
    alerts.push({ type: 'info', msg: `${sinFecha.length} suscripción${sinFecha.length > 1 ? 'es' : ''} sin fecha de próximo pago registrada.` })
  }
  // % sobre ingresos alto
  if (monthlyIncome > 0) {
    const monthly = activeSubs.reduce((s, sub) => s + toMonthly(sub.amount, sub.frequency), 0)
    const pct     = monthly / monthlyIncome
    if (pct > 0.07) {
      alerts.push({ type: 'income', msg: `Tus suscripciones representan el ${(pct * 100).toFixed(1)}% de tus ingresos mensuales. Puede ser útil revisar.` })
    }
  }

  return alerts
}

// ── HOOK PRINCIPAL ──────────────────────────────────────────────────────────
export default function useSubscriptionMetrics() {
  const { settings, incomes, subscriptions: ctxSubs } = useApp()
  const isDemo = !!settings.isDemo

  const [dbSubs,  setDbSubs]  = useState([])
  const [loading, setLoading] = useState(!isDemo)

  // Modo demo: usar contexto. Modo real: IndexedDB
  const subs = isDemo ? (ctxSubs || []) : dbSubs

  useEffect(() => {
    if (isDemo) return
    dbGetAll('subscriptions').then(d => {
      setDbSubs(d || [])
      setLoading(false)
    })
  }, [isDemo])

  // Ingreso del mes activo
  const activeMonth   = settings.activeMonth || currentMonth()
  const monthlyIncome = useMemo(() => {
    if (!Array.isArray(incomes)) return 0
    return incomes
      .filter(r => r.date?.startsWith(activeMonth))
      .reduce((s, r) => s + (r.amount || 0), 0)
  }, [incomes, activeMonth])

  const activeSubs = useMemo(() => subs.filter(s => s.status === 'active'), [subs])

  const monthly = useMemo(
    () => activeSubs.reduce((s, sub) => s + toMonthly(sub.amount, sub.frequency), 0),
    [activeSubs]
  )
  const annual = useMemo(
    () => activeSubs.reduce((s, sub) => s + toAnnual(sub.amount, sub.frequency), 0),
    [activeSubs]
  )

  const pct     = monthlyIncome > 0 ? monthly / monthlyIncome : 0
  const status  = subStatus(pct)
  const alerts  = useMemo(() => generateAlerts(activeSubs, monthlyIncome), [activeSubs, monthlyIncome])

  const mostExpensive = useMemo(() =>
    activeSubs.reduce((max, s) => {
      const m = toMonthly(s.amount, s.frequency)
      return m > (max ? toMonthly(max.amount, max.frequency) : 0) ? s : max
    }, null),
    [activeSubs]
  )

  const nextPayment = useMemo(() => {
    const withDates = activeSubs
      .filter(s => s.nextPaymentDate)
      .sort((a, b) => a.nextPaymentDate.localeCompare(b.nextPaymentDate))
    return withDates[0] || null
  }, [activeSubs])

  // Agrupado por categoría para reportes
  const byCategory = useMemo(() => {
    const m = {}
    activeSubs.forEach(s => {
      const cat = s.category || 'Otros'
      if (!m[cat]) m[cat] = { count: 0, monthly: 0, annual: 0 }
      m[cat].count++
      m[cat].monthly += toMonthly(s.amount, s.frequency)
      m[cat].annual  += toAnnual(s.amount, s.frequency)
    })
    return Object.entries(m).sort((a, b) => b[1].monthly - a[1].monthly)
  }, [activeSubs])

  return {
    subs, activeSubs, loading,
    monthly, annual, pct, status,
    alerts, mostExpensive, nextPayment,
    byCategory, monthlyIncome, activeMonth,
    count: activeSubs.length,
  }
}
