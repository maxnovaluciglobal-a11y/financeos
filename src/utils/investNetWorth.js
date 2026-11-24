// src/utils/investNetWorth.js — de la cifra de Invest (US$) a la moneda de la
// persona y a Patrimonio neto, lógica pura.
//
// La línea "Inversiones" es una estimación con fecha y va aparte de Metas: no
// toca `calcNetWorth`. Toda pantalla que muestra el patrimonio (Patrimonio,
// Panorama, Inicio, Reportes, Modo Asesor y sus PDF) suma esa línea con
// `withInvest` vía hooks/useNetWorth.js: una sola cifra (QA 23-nov-2026). Pero `withInvest` SÍ suma el portafolio al mismo total que el
// "Ahorrado" de las metas, y nada impide que una meta (p. ej. "Roth IRA")
// registre a mano dinero que ya está en Inversiones: ese dinero se contaría dos
// veces (I-17, benchmark/05-coherencia-360). Hasta que existan las metas
// vinculadas (fase F9), `portfolioInNetWorth` decide cuándo avisarlo en Metas
// y en Patrimonio.
import { currencySymbol, dateLocale, fmtAmount } from './index.js'
import { refEligible, savedRate, cachedRate } from './refRate.js'
import { isSetAside, uniqueSetAsides } from './setAside.js'

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

// I-17: ¿el portafolio entra al patrimonio? Solo con módulo encendido, acceso y
// tasa con fecha (`inv.amount`; useInvestPortfolio da `inv` null si no). Sin
// tasa la línea va aparte en US$ y no suma: no hay doble conteo que avisar.
export function portfolioInNetWorth(inv) {
  // Un portafolio vacío (valor 0) no suma nada: no hay doble conteo que avisar.
  return inv != null && inv.amount != null && Number.isFinite(Number(inv.amount)) && Number(inv.amount) > 0
}

// Patrimonio: la nota de una línea va solo si además hay ahorro en metas.
export function netWorthOverlapNote(nw, inv) {
  return portfolioInNetWorth(inv) && (Number(nw?.savedInGoals) || 0) > 0
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

// Aportes del mes: lo apartado "Para invertir" desde la hoja "+" (F-1,
// utils/setAside.js) y, como antes, los egresos marcados como inversión.
// `r.inv` también marca el flujo de una propiedad (arriendo, dividendo de
// hipoteca, ver utils/personal.js): eso lleva `project` y no es un aporte al
// portafolio; un ingreso tampoco. `setAsides` es opcional (la app los separa de
// `expenses` al leer); si vienen mezclados en `expenses` también cuentan, y si
// el mismo apartado llega en las dos listas cuenta una sola vez.
export function monthContributions(expenses, month, setAsides = []) {
  const inMonth = (r) => typeof r?.date === 'string' && r.date.startsWith(month)
  const legacy = (r) => r?.inv && !isSetAside(r) && !String(r.project || '').trim()
  const toInvest = uniqueSetAsides(setAsides, expenses).filter(r => r.dest === 'invest' && inMonth(r))
  const legacyList = (expenses || []).filter(r => legacy(r) && inMonth(r))
  const list = [...legacyList, ...toInvest]
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

// US$ con los separadores de la moneda de la persona: "US$1.526,32" junto a
// "$1.450.000" no se confunde, "US$1,526.32" sí. El "$" pelado queda para quien
// lleva sus cuentas en dólares: al lado de pesos, se lee como pesos.
export function fmtUsd(n, currency) {
  const sym = currency === 'USD' ? currencySymbol('USD') : 'US$'
  return sym + fmtAmount(Math.abs(Number(n) || 0), 2)
}
