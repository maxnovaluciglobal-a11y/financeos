// src/utils/investNetWorth.js — de la cifra de Invest (US$) a la moneda de la
// persona y a Patrimonio neto, lógica pura.
//
// La línea "Inversiones" es una estimación con fecha y va aparte de Metas: no
// toca `calcNetWorth`, así Reportes y el PDF siguen con lo que la persona
// registró y una meta de ahorro nunca se mezcla con el portafolio.
import { dateLocale } from './index.js'
import { refEligible, savedRate, cachedRate } from './refRate.js'

const valid = (n) => Number.isFinite(Number(n)) && Number(n) > 0

// Unidades de la moneda de la persona por 1 US$, siempre con fecha. Mismo orden
// que el resto de la app (R12): la tasa de referencia de quien la usa y, si no,
// la del mercado que trajo Invest o la última consultada. Una tasa guardada sin
// fecha o los DEFAULT_USD_RATES fijos no cuentan: sin fecha no hay estimación.
export function resolveUserRate(settings = {}, fx = null, read = () => null) {
  const cur = String(settings.currency || '').toUpperCase()
  if (!cur) return null
  if (cur === 'USD') return { rate: 1, at: null, source: 'usd' }
  if (refEligible(settings)) {
    const saved = savedRate(settings)
    if (saved?.at) return saved
    const cached = cachedRate(settings, read)
    if (cached) return cached
  }
  if (valid(fx?.rates?.[cur])) return { rate: Number(fx.rates[cur]), at: fx.at || null, source: 'market' }
  return cachedRate(settings, read)
}

// null si no hay nada que sumar. `amount: null` = sin tasa: se muestra aparte
// en US$ y NO entra al total.
export function investValueForUser(snapshot, settings, read) {
  if (!snapshot || !Number.isFinite(snapshot.valueUsd)) return null
  const rate = resolveUserRate(settings, snapshot.fx, read)
  return {
    usd: snapshot.valueUsd,
    amount: rate ? snapshot.valueUsd * rate.rate : null,
    rate,
    at: snapshot.pricesAt || snapshot.at,
    status: snapshot.status,
  }
}

export function withInvest(nw, inv) {
  const add = inv?.amount != null ? inv.amount : 0
  return {
    ...nw,
    investments: inv || null,
    investInTotal: inv?.amount != null,
    totalActivos: nw.totalActivos + add,
    netWorth: nw.netWorth + add,
    hasData: nw.hasData || !!inv,
  }
}

// Aportes del mes: egresos marcados como inversión. `r.inv` también marca el
// flujo de una propiedad (arriendo, dividendo de hipoteca, ver utils/personal.js):
// eso lleva `project` y no es un aporte al portafolio; un ingreso tampoco.
export function monthContributions(expenses, month) {
  const list = (expenses || []).filter(r => r?.inv && !String(r.project || '').trim() && r.date?.startsWith(month))
  return { count: list.length, sum: list.reduce((s, r) => s + (Number(r.amount) || 0), 0) }
}

// Lo que viaja a Invest al revisar los aportes: la suma y nada más. `usd` va si
// hay tasa con fecha; si no, Invest no inventa una conversión.
export function aporteHandoff({ count, sum }, settings, rate) {
  if (!(count > 0) || !(sum > 0)) return null
  const ccy = String(settings?.currency || '').toUpperCase() || null
  const usd = rate ? Math.round((sum / rate.rate) * 100) / 100 : null
  return { amount: Math.round(sum * 100) / 100, ccy, n: count, usd }
}

// "30 oct, 14:32" en el idioma de la interfaz: toda cifra de Invest lleva su fecha.
export function fmtInvestAt(ms) {
  try { return new Date(ms).toLocaleString(dateLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}
