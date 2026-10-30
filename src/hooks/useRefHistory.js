// src/hooks/useRefHistory.js — B5: historia de la tasa para la variación en US$.
// Prioridad: la foto mensual guardada en settings.monthlyRefRates ({ 'YYYY-MM':
// tasa }) — la usa la demo, con sus tasas por mes — y si no, el histórico
// diario de ve.dolarapi.com (utils/refHistory.js). Solo Venezuela (W5).
//
// useRateHistory: la historia en sí (Bs por 1 US$), la usan B5 y el historial
// del conversor (B2b). `active` = false no consulta nada (hoja cerrada).
// useRefHistory: la de B5, que es SOLO en US$: con la lente en euros
// (settings.refCurrency) devuelve null y el Inicio usa la variación en
// bolívares (A1), en vez de escribir con "€" una diferencia que es en dólares.
import { useEffect, useMemo, useState } from 'react'
import { HIST_COUNTRIES, histFuente, historyFromMonthly, loadHistory } from '../utils/refHistory.js'
import { lensCurrency } from '../utils/refRate.js'

export function useRateHistory(settings = {}, active = true) {
  const country = String(settings.country || '').toUpperCase()
  const enabled = !!active && HIST_COUNTRIES.includes(country) && String(settings.currency || '').toUpperCase() === 'VES'
  const monthly = settings.monthlyRefRates
  const fuente = histFuente(settings.usdRateSource)
  const fromSettings = useMemo(() => {
    if (!enabled || !monthly || typeof monthly !== 'object') return null
    const rows = historyFromMonthly(Object.fromEntries(Object.entries(monthly).map(([ym, v]) => [ym, { bcv: Number(v) }])))
    return rows.length ? rows : null
  }, [enabled, monthly])
  const [rows, setRows] = useState(null)
  useEffect(() => {
    if (!enabled || fromSettings) return
    let alive = true
    loadHistory(fuente).then(r => { if (alive) setRows(r) })
    return () => { alive = false }
  }, [enabled, fromSettings, fuente])
  return enabled ? (fromSettings || rows) : null
}

export function useRefHistory(settings = {}) {
  return useRateHistory(settings, lensCurrency(settings) === 'USD')
}
