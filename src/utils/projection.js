// src/utils/projection.js
// Proyección de fin de mes — cálculo ÚNICO compartido por el Dashboard y la
// página Proyección (CashFlow) para que ambos muestren exactamente lo mismo.
//
// Ingreso: el salario NO es un flujo diario → no se extrapola por ritmo.
//   projInc = max(lo ya recibido, promedio de hasta 3 meses completos previos).
// Gasto: mezcla entre el ritmo diario actual y el promedio histórico,
//   ponderada por % del mes transcurrido (a inicio de mes pesa el histórico;
//   a fin de mes, el gasto real). Evita extrapolar cuotas mensuales pagadas
//   temprano como si fueran gasto diario.

export function projectEndOfMonth({ incomes, expenses, activeMonth }) {
  const now = new Date()
  const [y, mo] = activeMonth.split('-').map(Number)
  const daysInMonth = new Date(y, mo, 0).getDate()
  const today = (now.getFullYear() === y && now.getMonth() + 1 === mo) ? now.getDate() : daysInMonth
  const daysLeft = daysInMonth - today
  const pctElapsed = daysInMonth > 0 ? today / daysInMonth : 1

  const sumMonth = (arr, m) => (arr || []).filter(r => r?.date?.startsWith(m)).reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const curInc = sumMonth(incomes, activeMonth)
  const curExp = sumMonth(expenses, activeMonth)

  // Promedios de hasta 3 meses completos anteriores al mes en curso.
  // IMPORTANTE: cada promedio usa SOLO meses que tienen datos de ese tipo —
  // un mes con ingresos pero sin gastos registrados NO diluye el promedio de
  // gastos (típico al empezar a usar la app), y viceversa.
  // BUG FIX: antes esto usaba new Date().toISOString().slice(0,7) (mes en UTC),
  // mientras que `now`/`today` arriba se calculan en hora LOCAL. Para usuarios
  // al oeste de UTC (todo LATAM), cerca de medianoche UTC el mes en UTC ya
  // avanzó al mes siguiente mientras localmente todavía es el último día del
  // mes anterior — el mes activo (aún incompleto) se clasificaba como "mes
  // previo completo" en completeOrAll() y contaminaba el promedio histórico
  // con datos parciales. Se deriva del mismo `now` local para que ambos
  // cálculos coincidan siempre.
  const nowMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthsOf = (arr) => [...new Set((arr || []).map(r => r?.date?.slice(0, 7)).filter(Boolean))].sort()
  const completeOrAll = (ms) => { const prev = ms.filter(m => m < nowMonth); return (prev.length ? prev : ms).slice(-3) }
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0
  const incMonths = completeOrAll(monthsOf(incomes))
  const expMonths = completeOrAll(monthsOf(expenses))
  const avgInc = avg(incMonths.map(m => sumMonth(incomes, m)))
  const avgExp = avg(expMonths.map(m => sumMonth(expenses, m)))
  const avgExpMonths = expMonths.filter(m => m < nowMonth).length

  const dailyExp = today > 0 ? curExp / today : 0

  // Día típico (MEDIANA de los totales diarios del mes en curso, incluyendo días
  // en cero): robusto frente a cuentas grandes pagadas a inicio de mes (arriendo,
  // colegio, hipotecas). El promedio diario extrapolaba esas cuentas como si se
  // repitieran; la mediana representa un día normal (supermercado, transporte).
  const byDay = {}
  ;(expenses || []).forEach(r => {
    if (!r?.date?.startsWith(activeMonth)) return
    const d = Number(r.date.slice(8, 10))
    if (d >= 1 && d <= today) byDay[d] = (byDay[d] || 0) + (Number(r.amount) || 0)
  })
  const dailyTotals = []
  for (let d = 1; d <= today; d++) dailyTotals.push(byDay[d] || 0)
  dailyTotals.sort((a, b) => a - b)
  const mid = Math.floor(dailyTotals.length / 2)
  const medianDaily = dailyTotals.length === 0 ? 0
    : dailyTotals.length % 2 ? dailyTotals[mid]
    : (dailyTotals[mid - 1] + dailyTotals[mid]) / 2

  // Proyección de gasto = el MAYOR de:
  //  (a) lo ya gastado + día típico × días restantes  (mes con cuentas ya pagadas)
  //  (b) promedio histórico mensual                   (cuentas grandes aún pendientes)
  //  (c) lo ya gastado                                 (piso lógico)
  const paceTypical = curExp + medianDaily * daysLeft
  const projExp = Math.round(Math.max(curExp, avgExp, paceTypical))
  const projInc  = Math.max(curInc, avgInc || curInc)
  const projBal  = projInc - projExp

  return { today, daysInMonth, daysLeft, pctElapsed, dailyExp, medianDaily, curInc, curExp, avgInc, avgExp, avgExpMonths, projInc, projExp, projBal }
}
