// src/pages/Budgets/BudgetSplit.jsx — R8a (ola C; patrón de rial "Ahorro / Gastos /
// Libre"), 30-oct-2026. Cómo se reparte el ingreso del mes: presupuestado,
// ahorro objetivo y sin asignar, en una barra de tres tramos con leyenda (ícono
// de color + palabra + monto). Reemplaza el recuadro "Ingreso sin asignar": el
// dato sigue, ahora junto con el ahorro. Debajo, lo gastado en categorías sin
// presupuesto (el "gasto libre" de rial). Montos con "ocultar montos" (T13).
import { useState } from 'react'
import Money from '../../components/Money.jsx'
import { useT } from '../../i18n/useT.js'
import { fmtMoney, fmtPct } from '../../utils/index.js'
import { budgetSplit, clampSavingsPct, SAVINGS_PCT_MAX } from '../../utils/budgets.js'
import s from './budgets.module.css'

const SEG = [
  { key: 'budgeted', color: 'var(--chart-expense)' },
  { key: 'savings',  color: 'var(--chart-income)' },
  { key: 'free',     color: 'var(--th)' },
]

export default function BudgetSplit({ income, budgeted, savingsPct = 0, unbudgeted = 0, sym, onSavingsPct }) {
  const { t } = useT()
  const [draft, setDraft] = useState(String(savingsPct || ''))
  const split = budgetSplit({ income, budgeted, savingsPct })
  if (!(split.income > 0)) return null
  const commit = () => { const v = clampSavingsPct(draft); setDraft(v ? String(v) : ''); if (v !== (Number(savingsPct) || 0)) onSavingsPct?.(v) }
  return (
    <section className={s.split} aria-labelledby="bud-split-title" data-tour="bud-split">
      <div className={s.splitHead}>
        <h2 id="bud-split-title" className={s.sectionTitle}>{t('budgets.split.title')}</h2>
        <label className={s.splitPct}>
          <span>{t('budgets.split.savingsLabel')}</span>
          <input type="text" inputMode="numeric" value={draft} placeholder="0" aria-label={t('budgets.split.savingsAria', { max: SAVINGS_PCT_MAX })}
            onChange={e => setDraft(e.target.value.replace(/[^\d,.]/g, '').slice(0, 4))}
            onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }} />
          <span aria-hidden="true">%</span>
        </label>
      </div>
      <div className={s.splitBar} role="img" aria-label={t('budgets.split.aria', {
        b: fmtPct(split.share.budgeted, { decimals: 0 }), s: fmtPct(split.share.savings, { decimals: 0 }), f: fmtPct(split.share.free, { decimals: 0 }) })}>
        {SEG.map(g => split.share[g.key] > 0 && (
          <span key={g.key} style={{ flexGrow: split.share[g.key], background: g.color }} />
        ))}
      </div>
      <ul className={s.splitLegend}>
        {SEG.map(g => (
          <li key={g.key}>
            <span className={s.splitDot} style={{ background: g.color }} aria-hidden="true" />
            <span className={s.splitLbl}>{t(`budgets.split.${g.key}`)}</span>
            <span className="num"><Money>{fmtMoney(split[g.key], sym)}</Money></span>
          </li>
        ))}
      </ul>
      {split.over > 0 && <p className={s.splitOver}>{t('budgets.split.over')} <Money>{fmtMoney(split.over, sym)}</Money></p>}
      {split.free > 0 && <p className={s.splitHint}>{t('budgets.unassigned.hint')}</p>}
      {unbudgeted > 0 && <p className={s.splitHint}>{t('budgets.split.unbudgeted')} <Money>{fmtMoney(unbudgeted, sym)}</Money></p>}
    </section>
  )
}
