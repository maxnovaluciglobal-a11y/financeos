// src/pages/Dashboard/SetAsideBlock.jsx — lo apartado este mes, dentro del
// detalle de "Te queda" (F-1 hilo del dinero). Explica por qué "Te queda" es
// ingresos − gastos − apartado, deja quitar un apartado y abre "Apartar".
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import Money, { useMoney } from '../../components/Money.jsx'
import { openQuickAdd } from '../../components/quickAddBus.js'
import { currentMonth, fmtMoney } from '../../utils/index.js'
import { monthSetAsides } from '../../utils/setAside.js'
import s from './Home.module.css'

export default function SetAsideBlock({ sym, onClose }) {
  const { t } = useT()
  const { m } = useMoney()
  const app = useApp() || {}
  const month = app.settings?.activeMonth || currentMonth()
  const sa = monthSetAsides(app.setAsides, month)
  if (!app.addSetAside) return null
  const destLabel = (r) => (r.dest === 'invest' ? t('qa.setAside.invest') : (r.description || t('qa.setAside.goal')))
  return (
    <div className={s.detailBlock}>
      {sa.count > 0 && (
        <>
          <div className={s.asideHead}>
            <span>{t('home.setAside.title')}</span>
            <span className="num"><Money>{fmtMoney(sa.total, sym)}</Money></span>
          </div>
          <div className={s.asideSplit}>
            {t('home.setAside.split', { goals: m(fmtMoney(sa.goals, sym)), invest: m(fmtMoney(sa.invest, sym)) })}
          </div>
          <ul className={s.asideList}>
            {sa.items.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map(r => (
              <li key={r.id} className={s.asideRow}>
                <span className={s.asideName}>{destLabel(r)}</span>
                <span className="num"><Money>{fmtMoney(r.amount, sym)}</Money></span>
                {app.delSetAside && (
                  <button type="button" className="fos-link" onClick={() => app.delSetAside(r.id)}
                    aria-label={t('home.setAside.removeAria', { dest: destLabel(r), v: m(fmtMoney(r.amount, sym)) })}>
                    {t('home.setAside.remove')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className={s.detailLegend} style={{ margin: sa.count > 0 ? '8px 0 0' : 0 }}>{t('home.setAside.explain')}</p>
      <button type="button" className={s.detailLink} onClick={() => { onClose?.(); openQuickAdd('setAside') }}>
        {t('home.setAside.cta')}
      </button>
    </div>
  )
}
