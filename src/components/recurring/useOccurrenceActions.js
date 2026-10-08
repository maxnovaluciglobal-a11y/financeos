// src/components/recurring/useOccurrenceActions.js — confirmar / omitir
// ocurrencias desde cualquier pantalla (hoja del mes, página Fijos, Movimientos),
// con un mensaje para la región aria-live de quien lo use.
import { useState, useCallback } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { monthOf } from '../../utils/recurring.js'

export function useOccurrenceActions() {
  const ctx = useApp()
  const { t } = useT()
  const [live, setLive] = useState('')

  const confirm = useCallback(async (occ, { amount, fromNow } = {}) => {
    let rule = occ.rule
    // "Desde ahora": el monto nuevo queda en el historial de la regla a partir
    // del mes de esta ocurrencia; sin la casilla es "solo este mes".
    if (fromNow && amount > 0) rule = (await ctx.setRuleAmountFrom?.(rule, monthOf(occ.date), amount)) || rule
    await ctx.confirmOccurrences?.([{ rule, date: occ.date, amount }])
    setLive(t('rec.live.confirmed', { name: rule.description }))
  }, [ctx, t])

  const confirmMany = useCallback(async (occs) => {
    if (!occs?.length) return
    await ctx.confirmOccurrences?.(occs.map(o => ({ rule: o.rule, date: o.date })))
    setLive(t(occs.length === 1 ? 'rec.live.allOne' : 'rec.live.all', { n: occs.length }))
  }, [ctx, t])

  const skip = useCallback(async (occ) => {
    await ctx.skipOccurrence?.(occ.rule, occ.date, true)
    setLive(t('rec.live.skipped', { name: occ.rule.description }))
  }, [ctx, t])

  const unskip = useCallback(async (occ) => {
    await ctx.skipOccurrence?.(occ.rule, occ.date, false)
    setLive(t('rec.live.unskipped', { name: occ.rule.description }))
  }, [ctx, t])

  return { confirm, confirmMany, skip, unskip, live }
}
