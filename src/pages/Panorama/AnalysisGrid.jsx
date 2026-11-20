// src/pages/Panorama/AnalysisGrid.jsx — "Tus análisis" (20-nov-2026, pedido de
// Walter): cada análisis completo a un toque y a la vista, con su cifra clave.
// Antes vivían como filas al pie de Panorama, debajo de ~5 pantallas de
// tarjetas (UX-N11 de la auditoría 360): quien no bajaba no los encontraba.
import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import Money from '../../components/Money.jsx'
import { NAV_ICONS } from '../../components/icons/Icons.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { useInvestPortfolio } from '../../hooks/useInvestPortfolio.js'
import { ALL_ITEMS, PANORAMA_PAGES, showProChip } from '../../components/layout/navConfig.js'
import { getLicensePlan } from '../../utils/licenseValidator.js'
import { moduleOn } from '../../utils/modules.js'
import { calcNetWorth } from '../../utils/netWorth.js'
import { fmtInvestAt, withInvest } from '../../utils/investNetWorth.js'
import { projectEndOfMonth } from '../../utils/projection.js'
import { fmtMoneyParts } from '../../utils/index.js'
import s from './analysisGrid.module.css'

// Cifra corta para el tile: sin decimales, así "+Bs.11.632.385" cabe en una línea.
const whole = (n, sym) => { const p = fmtMoneyParts(Math.round(Math.abs(n)), sym); return `${p.pre || ''}${p.int}${p.post || ''}` }
const signed = (n, sym) => `${n < 0 ? '−' : n > 0 ? '+' : ''}${whole(n, sym)}`

export default function AnalysisGrid({ d, setPage }) {
  const { t } = useT()
  const app = useApp() || {}
  const { settings, sym, activeMonth, kpis, todoItems, subMonthly } = d
  const plan = getLicensePlan()
  const { inv } = useInvestPortfolio()
  const investOn = moduleOn(settings, 'investments')

  const nw = useMemo(() => withInvest(calcNetWorth({
    goals: d.goals, debts: d.debts, receivables: app.receivables, incomes: d.ctx.incomes, expenses: d.ctx.expenses, settings,
  }), inv), [d.goals, d.debts, app.receivables, d.ctx.incomes, d.ctx.expenses, settings, inv])

  const hasMonth = kpis.totalInc > 0 || kpis.totalExp > 0
  const proj = useMemo(() => (hasMonth ? projectEndOfMonth({ incomes: d.incomes, expenses: d.expenses, activeMonth, pending: d.pendingSum }) : null),
    [hasMonth, d.incomes, d.expenses, activeMonth, d.pendingSum])

  // Cifra clave y tono de cada análisis. tone: 'pos' | 'neg' | 'muted'.
  const figure = {
    coach: todoItems.length > 0
      ? { text: t(todoItems.length === 1 ? 'panorama.grid.signals.one' : 'panorama.grid.signals.many', { n: todoItems.length }), tone: 'warn' }
      : { text: t('panorama.grid.signals.none'), tone: 'pos' },
    cashflow: proj
      ? { text: signed(Math.round(proj.projBal), sym), tone: proj.projBal < 0 ? 'neg' : 'pos', hint: t('panorama.grid.proj.hint') }
      : { text: t('panorama.grid.noData'), tone: 'muted' },
    networth: (nw.totalActivos > 0 || nw.totalPasivos > 0 || inv)
      ? { text: signed(Math.round(nw.netWorth), sym), tone: nw.netWorth < 0 ? 'neg' : 'pos', hint: t('panorama.grid.nw.hint') }
      : { text: t('panorama.grid.noData'), tone: 'muted' },
    reports: { text: t('panorama.grid.reports.hint'), tone: 'muted' },
    subscriptions: subMonthly > 0
      ? { text: t('dash.kpi.perMonth', { v: whole(subMonthly, sym) }), tone: 'muted', money: true }
      : { text: t('panorama.grid.subs.none'), tone: 'muted' },
    // I-14 y una moneda por pantalla: el valor es una estimación con fecha; sin
    // tipo de cambio va en US$ y se dice que no suma al patrimonio del lado.
    investments: inv?.usd != null
      ? { text: inv.amount != null ? whole(inv.amount, sym) : `US$${whole(inv.usd, '')}`, tone: 'muted', money: true,
          hint: inv.amount != null ? t('panorama.grid.inv.est', { at: fmtInvestAt(inv.at) }) : t('panorama.grid.inv.noRate') }
      : { text: t('panorama.grid.inv.open'), tone: 'muted' },
  }

  const ids = [...PANORAMA_PAGES, ...(investOn ? ['investments'] : [])]
  const items = ids.map(id => ALL_ITEMS.find(it => it.id === id)).filter(Boolean)

  return (
    <section aria-labelledby="pano-grid-title" data-tour="pano-detail">
      <h2 id="pano-grid-title" className={s.title}>{t('panorama.grid.title')}</h2>
      <div className={s.grid}>
        {items.map((it) => {
          const Ic = NAV_ICONS[it.id]
          const f = figure[it.id] || { text: '', tone: 'muted' }
          const money = f.money || f.tone === 'pos' || f.tone === 'neg'
          return (
            <button key={it.id} type="button" className={s.tile} onClick={() => setPage?.(it.id)} data-tour={it.id === 'investments' ? 'pano-invest' : undefined}>
              <span className={s.head}>
                <span className={s.icon} aria-hidden="true">{Ic ? <Ic size={18} /> : null}</span>
                {showProChip(it, plan) && <span className={s.pro}>PRO</span>}
                <ChevronRight size={16} strokeWidth={2} aria-hidden="true" className={s.chev} />
              </span>
              <span className={s.label}>{t(it.lb)}</span>
              <span className={`num ${s.figure}`} data-tone={f.tone}>{money ? <Money>{f.text}</Money> : f.text}</span>
              {f.hint && <span className={s.hint}>{f.hint}</span>}
            </button>
          )
        })}
      </div>
    </section>
  )
}
