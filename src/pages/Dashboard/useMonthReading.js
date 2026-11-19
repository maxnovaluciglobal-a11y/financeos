// src/pages/Dashboard/useMonthReading.js — une la lógica pura de
// utils/monthReading.js con la app: tasas de cada período (VE), límites
// efectivos, idioma y "ocultar montos".
import { useCallback, useMemo } from 'react'
import { useT } from '../../i18n/useT.js'
import { useMoney } from '../../components/Money.jsx'
import { useRefHistory } from '../../hooks/useRefHistory.js'
import { rateOnOrBefore } from '../../utils/refHistory.js'
import { effectiveBudgetLimits } from '../../utils/budgets.js'
import { monthReading, renderReading } from '../../utils/monthReading.js'
import { catName, fmtMoney, fmtMoneyFor, fmtPct } from '../../utils/index.js'
import { budgetRows, deltaRateDates, monthName } from './dashboardModel.js'

// Convierte una línea de monthReading en texto, con los montos enmascarados.
export function useReadingText(sym) {
  const { t, lang } = useT()
  const { m } = useMoney()
  return useCallback((l) => renderReading(l, {
    t,
    fmt: {
      money: (n) => m(fmtMoney(n, sym)),
      usd: (n) => m(fmtMoneyFor(n, 'USD', lang)),
      pct: (r) => fmtPct(r, { decimals: 0 }),
      cat: (c) => catName(c, lang),
      month: (ym) => monthName(ym, lang),
    },
  }), [t, m, sym, lang])
}

export function useMonthReading({ kpis, expenses, budgets, pending, activeMonth, settings, sym }) {
  const text = useReadingText(sym)
  const hist = useRefHistory(settings || {})
  const reading = useMemo(() => {
    const monthExpenses = (expenses || []).filter(e => e?.date?.startsWith(activeMonth))
    const rows = budgetRows({ budgets, monthExpenses, limits: effectiveBudgetLimits({ budgets, expenses, activeMonth, settings }) })
    const { curDate, prevDate } = deltaRateDates({ activeMonth, cutDay: kpis.prevCutDay ?? null })
    const cur = hist ? rateOnOrBefore(hist, curDate) : null
    const prev = hist ? rateOnOrBefore(hist, prevDate) : null
    return monthReading({
      activeMonth, totals: kpis, expenses, rows, pending, country: settings?.country,
      rates: cur && prev ? { cur, prev } : null,
    })
  }, [kpis, expenses, budgets, pending, activeMonth, settings, hist])
  return { reading, text }
}
