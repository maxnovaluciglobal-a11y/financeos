// src/pages/Dashboard/NetWorthCard.jsx — Patrimonio neto en el Inicio (M5, pieza 6).
// Sale del módulo propio de Patrimonio (utils/netWorth.js, el mismo cálculo de
// la página y de Reportes). Con el módulo Inversiones encendido suma aparte la
// estimación de Invest. Se oculta si no hay activos que mostrar. La variación
// compara lo registrado en la app (sin Invest) contra el último valor de un
// mes anterior, guardado una vez por mes en este dispositivo
// (fos_networth_history): el patrimonio es un stock a hoy y no se puede
// reconstruir hacia atrás desde los movimientos.
import { useEffect, useMemo, useState } from 'react'
import Money, { useMoney } from '../../components/Money.jsx'
import { IconAhorro } from '../../components/icons/Icons.jsx'
import { useT } from '../../i18n/useT.js'
import { fmtMoney, currentMonth } from '../../utils/index.js'
import { calcNetWorth } from '../../utils/netWorth.js'
import { withInvest } from '../../utils/investNetWorth.js'
import { useInvestPortfolio } from '../../hooks/useInvestPortfolio.js'
import { useApp } from '../../context/AppContext.jsx'
import { lastValueBefore, monthDelta, upsertMonthly } from './dashboardModel.js'
import DeltaLine from './DeltaLine.jsx'
import InvestLine from '../NetWorth/InvestLine.jsx'
import s from './Home.module.css'

const NW_KEY = 'fos_networth_history'

export default function NetWorthCard({ goals, debts, receivables: receivablesProp, incomes, expenses, settings, sym, setPage }) {
  const { t } = useT()
  const { m } = useMoney()
  // "Por cobrar" (D2) es un activo: sale del contexto para no tocar el Inicio.
  const ctxReceivables = useApp()?.receivables
  const receivables = receivablesProp ?? ctxReceivables
  const base = useMemo(() => calcNetWorth({ goals, debts, receivables, incomes, expenses, settings }),
    [goals, debts, receivables, incomes, expenses, settings])
  const { inv } = useInvestPortfolio()
  const nw = useMemo(() => withInvest(base, inv), [base, inv])
  const month = currentMonth()
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(NW_KEY) || '[]') } catch { return [] }
  })

  const show = nw.totalActivos > 0 || !!inv
  // El historial guarda solo lo registrado: una estimación que depende del
  // mercado (y de si cargó) no debe aparecer como variación del mes.
  const baseValue = Math.round(base.netWorth)
  const value = Math.round(nw.netWorth)

  useEffect(() => {
    // El demo no escribe historial: sus datos ficticios no deben quedar en el equipo.
    if (!show || settings?.isDemo) return
    setHistory(prev => {
      if (prev.some(e => e.m === month && e.v === baseValue)) return prev
      const next = upsertMonthly(prev, month, baseValue)
      try { localStorage.setItem(NW_KEY, JSON.stringify(next)) } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ }
      return next
    })
  }, [show, baseValue, month, settings?.isDemo])

  if (!show) return null

  const prev = lastValueBefore(history, month, { monthOf: e => e?.m, valueOf: e => Number(e?.v) })
  const delta = prev && Number.isFinite(prev.v) ? monthDelta(baseValue, prev.v) : null

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
          {delta && <DeltaLine delta={delta} prevMonth={prev.m} sym={sym} />}
          <div className={s.nwSplit}>
            {t('networth.formula', { a: m(fmtMoney(nw.totalActivos, sym)), p: m(fmtMoney(nw.totalPasivos, sym)) })}
          </div>
          {inv && <InvestLine inv={inv} sym={sym} />}
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
