// src/hooks/useRefHistory.js — B5: historia de la tasa para la variación en US$.
// Prioridad: la foto mensual guardada en settings.monthlyRefRates ({ 'YYYY-MM':
// tasa }) — la usa la demo, con sus tasas por mes — y si no, el histórico
// diario de ve.dolarapi.com (utils/refHistory.js). Solo Venezuela (W5).
import { useEffect, useMemo, useState } from 'react'
import { HIST_COUNTRIES, histFuente, historyFromMonthly, loadHistory } from '../utils/refHistory.js'

export function useRefHistory(settings = {}) {
  const country = String(settings.country || '').toUpperCase()
  const enabled = HIST_COUNTRIES.includes(country) && String(settings.currency || '').toUpperCase() === 'VES'
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
