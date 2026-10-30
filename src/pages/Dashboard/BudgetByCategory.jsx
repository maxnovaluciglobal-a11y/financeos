// src/pages/Dashboard/BudgetByCategory.jsx — "¿en qué me estoy pasando?" (M5, pieza 2).
// Gastado / límite por categoría, ordenado por riesgo. Estado con ícono +
// palabra además del color: En rango (check) · Atención (!) desde el 85 % ·
// Excedido (✕) sobre el 100 %. Mismo vocabulario de íconos que ScoreState.
import { useMemo } from 'react'
import { Minus } from 'lucide-react'
import Money from '../../components/Money.jsx'
import { ScoreStateIcon } from '../../components/ScoreState.jsx'
import { useT } from '../../i18n/useT.js'
import { fmtMoney, catName } from '../../utils/index.js'
import { effectiveBudgetLimits } from '../../utils/budgets.js'
import { budgetRows } from './dashboardModel.js'
import s from './Home.module.css'

const STATE = {
  ok:   { level: 'ok',        color: 'var(--pos)',  key: 'budgets.cat.ok' },
  near: { level: 'attention', color: 'var(--warn)', key: 'budgets.cat.warn' },
  over: { level: 'risk',      color: 'var(--neg)',  key: 'budgets.cat.over' },
  // H19 (ola A6): presupuesto sin gasto en el mes, sin check verde.
  idle: { level: 'idle',      color: 'var(--th)',   key: 'budgets.cat.idle' },
}

// Poda P1: el Inicio muestra las 3 categorías más en riesgo (budgetRows ya
// las ordena por riesgo); el detalle completo vive en Presupuestos.
export default function BudgetByCategory({ budgets, expenses, monthExpenses, activeMonth, settings, sym, setPage, maxRows = 3, short = false }) {
  const { t, lang } = useT()
  const rows = useMemo(() => budgetRows({
    budgets, monthExpenses,
    limits: effectiveBudgetLimits({ budgets, expenses, activeMonth, settings }),
  }), [budgets, expenses, monthExpenses, activeMonth, settings])

  const shown = rows.slice(0, maxRows)
  const hiddenCount = rows.length - shown.length

  return (
    <section className={`${s.card} rise`} aria-labelledby="home-budget-title">
      <div className={s.cardHead}>
        <h2 id="home-budget-title" className={s.cardTitle}>{t('home.budget.title')}</h2>
        {rows.length > 0 && <span className={s.cardHint}>{t(short ? 'home.budget.hintRisk' : 'home.budget.hint')}</span>}
      </div>

      {rows.length === 0 ? (
        <>
          <p className={s.empty}>{t('home.budget.empty')}</p>
          {setPage && <button type="button" className={s.btnSecondary} onClick={() => setPage('budgets')}>{t('home.budget.create')}</button>}
        </>
      ) : (
        <>
          <ul className={s.rows}>
            {shown.map(r => {
              const st = STATE[r.spent > 0 ? r.state : 'idle']
              const fill = r.limit > 0 ? Math.min(r.spent / r.limit, 1) : 1
              return (
                <li key={r.id} className={s.row}>
                  <div className={s.budgetTop}>
                    <span className={s.budgetCat}>{catName(r.category, lang)}</span>
                    {/* Inicio (short): nombre, barra y estado; los montos están en Presupuestos. */}
                    {!short && (
                      <span className={s.budgetAmt}>
                        <b><Money>{fmtMoney(r.spent, sym)}</Money></b> / <Money>{fmtMoney(r.limit, sym)}</Money>
                      </span>
                    )}
                  </div>
                  <div className={s.budgetBottom}>
                    <div className={s.bar} aria-hidden="true">
                      <div className={s.barFill} style={{ transform: `scaleX(${fill})`, background: st.color }} />
                    </div>
                    <span className={s.state} style={{ color: st.color }}>
                      {st.level === 'idle' ? <Minus size={14} strokeWidth={1.7} color={st.color} aria-hidden="true" style={{ flexShrink: 0 }} /> : <ScoreStateIcon level={st.level} size={14} color={st.color} />}
                      {t(st.key)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
          {hiddenCount > 0 && !short && <div className={s.more}>{t(`home.budget.more.${hiddenCount === 1 ? 'one' : 'many'}`, { n: hiddenCount })}</div>}
          {setPage && (
            <div className={s.footLinks}>
              <button type="button" className={s.cardLink} onClick={() => setPage('budgets')}>{t('home.budget.viewAll')} →</button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
