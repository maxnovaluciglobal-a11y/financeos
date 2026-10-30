// src/hooks/useLensRate.js — la tasa de la lente (US$ o €, rial #20).
// `usd` es la tasa en US$ ya resuelta (resolveRefRate). Con la lente en euros
// se consulta Fixer (mismo loader y caché de 6 h que el resto de la app, host
// propio /api/fixer) y se relee la caché; sin red queda en US$ con
// `wanted: 'EUR'` (utils/refRate.js → resolveLensRate).
import { useEffect, useMemo, useState } from 'react'
import { lensCurrency, resolveLensRate } from '../utils/refRate.js'
import { loadFixerRates } from '../utils/tasaFixer.js'
import { logRejection } from '../utils/errorLog.js'

const readLocal = (k) => { try { return localStorage.getItem(k) } catch { return null } }

export function useLensRate(settings = {}, usd = null, active = true) {
  const [tick, setTick] = useState(0)
  const want = lensCurrency(settings)
  const country = settings.country, currency = settings.currency
  const rate = useMemo(() => (active && usd ? resolveLensRate({ country, currency, refCurrency: want }, readLocal, usd) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick: releer la caché tras la consulta
    [active, usd, want, country, currency, tick])
  useEffect(() => {
    if (!active || want !== 'EUR') return
    let alive = true
    // loadFixerRates no rechaza (sin red devuelve su respaldo, que resolveLensRate descarta).
    loadFixerRates().then(() => { if (alive) setTick(n => n + 1) }).catch(logRejection('lens.fixer'))
    return () => { alive = false }
  }, [active, want])
  return rate
}
