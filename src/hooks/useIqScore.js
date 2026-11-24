// src/hooks/useIqScore.js — el IQ Score del mes activo, UNA sola cuenta para
// Inicio, Panorama, Diagnóstico y Modo Asesor (pantalla y PDF).
//
// QA pre-tiendas (23-nov-2026, I4): el mismo mes daba 80 en Inicio y Panorama
// (IQ Score), 70 en Modo Asesor (promedio del semáforo) y 44 en Diagnóstico
// ("puntaje de hábitos", 100 − señales). Ahora las cuatro pantallas muestran
// este número, con las mismas entradas que tenía el Inicio: movimientos
// personales (sin `inv`), fijos pendientes del plan del mes y estado del sync.
import { useMemo } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useT } from '../i18n/useT.js'
import { calcFinancialScore } from '../utils/financialScore.js'
import { monthLeft } from '../utils/monthLeft.js'
import { monthPlan, pendingTotals } from '../utils/recurring.js'
import { isSyncEnabled, syncAvailable, syncMeta, lastSyncTime } from '../core/sync.js'
import { currentMonth, localDateStr } from '../utils/index.js'

/** Entradas puras del IQ Score (exportado para las pruebas de paridad). */
export function iqScoreInputs({ incomes: incAll, expenses: expAll, setAsides, debts, goals, rules, activeMonth, today }) {
  const incomes = (incAll || []).filter(r => !r?.inv)
  const expenses = (expAll || []).filter(r => !r?.inv)
  const plan = monthPlan(rules || [], activeMonth, { incomes: incAll || [], expenses: expAll || [], today })
  const pending = pendingTotals(plan)
  const m = monthLeft({ incomes, expenses, setAsides, month: activeMonth, plan, today })
  return { incomes, expenses, debts: debts || [], goals: goals || [], activeMonth, pending, savingRate: m.savingRate, hasData: m.incCount > 0 || m.expCount > 0 }
}

export function useIqScore() {
  const ctx = useApp() || {}
  const { t } = useT()
  const activeMonth = ctx.settings?.activeMonth || currentMonth()
  const today = localDateStr()
  return useMemo(() => {
    const p = iqScoreInputs({ incomes: ctx.incomes, expenses: ctx.expenses, setAsides: ctx.setAsides, debts: ctx.debts, goals: ctx.goals, rules: ctx.recurring, activeMonth, today })
    if (!p.hasData) return null
    const meta = syncMeta()
    return calcFinancialScore({
      savingRate: p.savingRate, expenses: p.expenses, debts: p.debts, goals: p.goals, incomes: p.incomes, activeMonth,
      syncEnabled: isSyncEnabled() && syncAvailable(), lastSyncAt: lastSyncTime(meta), pending: p.pending,
    }, t)
  }, [ctx.incomes, ctx.expenses, ctx.setAsides, ctx.debts, ctx.goals, ctx.recurring, activeMonth, today, t])
}
