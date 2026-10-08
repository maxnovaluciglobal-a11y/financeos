// src/pages/Dashboard/NetWorthCard.jsx — Patrimonio neto en el Inicio (M5, pieza 6).
// Sale del módulo propio de Patrimonio (utils/netWorth.js, el mismo cálculo de
// la página y de Reportes) — no de Invest, que está en pausa. Se oculta si no
// hay activos registrados. La variación compara contra el último valor de un
// mes anterior, guardado una vez por mes en este dispositivo
// (fos_networth_history): el patrimonio es un stock a hoy y no se puede
// reconstruir hacia atrás desde los movimientos.
import { useEffect, useMemo, useState } from 'react'
import Money, { useMoney } from '../../components/Money.jsx'
import { IconAhorro } from '../../components/icons/Icons.jsx'
import { useT } from '../../i18n/useT.js'
import { fmtMoney, currentMonth } from '../../utils/index.js'
import { calcNetWorth } from '../../utils/netWorth.js'
import { lastValueBefore, monthDelta, upsertMonthly } from './dashboardModel.js'
import DeltaLine from './DeltaLine.jsx'
import s from './Home.module.css'

const NW_KEY = 'fos_networth_history'

export default function NetWorthCard({ goals, debts, incomes, expenses, settings, sym, setPage }) {
  const { t } = useT()
  const { m } = useMoney()
  const nw = useMemo(() => calcNetWorth({ goals, debts, incomes, expenses, settings }),
    [goals, debts, incomes, expenses, settings])
  const month = currentMonth()
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(NW_KEY) || '[]') } catch { return [] }
  })

  const show = nw.totalActivos > 0
  const value = Math.round(nw.netWorth)

  useEffect(() => {
    // El demo no escribe historial: sus datos ficticios no deben quedar en el equipo.
    if (!show || settings?.isDemo) return
    setHistory(prev => {
      if (prev.some(e => e.m === month && e.v === value)) return prev
      const next = upsertMonthly(prev, month, value)
      try { localStorage.setItem(NW_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [show, value, month, settings?.isDemo])

  if (!show) return null

  const prev = lastValueBefore(history, month, { monthOf: e => e?.m, valueOf: e => Number(e?.v) })
  const delta = prev && Number.isFinite(prev.v) ? monthDelta(value, prev.v) : null

  return (
    <section className={`${s.card} rise`} aria-labelledby="home-nw-title">
      <div className={s.nw}>
        <div className={s.nwBody}>
          <h2 id="home-nw-title" className={s.scoreLabel} style={{ margin: 0 }}>
            <IconAhorro size={14} />{t('networth.title')}
          </h2>
          <div className={`num ${s.nwValue}`} style={{ color: value < 0 ? 'var(--neg)' : 'var(--tx)' }}>
            <span style={{ whiteSpace: 'nowrap' }}>{value < 0 ? '−' : ''}<Money>{fmtMoney(Math.abs(value), sym)}</Money></span>
          </div>
          {delta && <DeltaLine delta={delta} prevMonth={prev.m} />}
          <div className={s.nwSplit}>
            {t('networth.formula', { a: m(fmtMoney(nw.totalActivos, sym)), p: m(fmtMoney(nw.totalPasivos, sym)) })}
          </div>
        </div>
        {setPage && (
          <button type="button" className={s.btnSecondary} onClick={() => setPage('networth')}>
            {t('home.nw.view')} →
          </button>
        )}
      </div>
    </section>
  )
}
