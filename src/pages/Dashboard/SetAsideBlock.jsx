// src/pages/Dashboard/SetAsideBlock.jsx — lo apartado este mes, dentro del
// detalle de "Te queda" (F-1 hilo del dinero). Explica por qué "Te queda" es
// ingresos − gastos − apartado, deja quitar un apartado y abre "Apartar".
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import Money, { useMoney } from '../../components/Money.jsx'
import { openQuickAdd } from '../../components/quickAddBus.js'
import { currentMonth, fmtMoney } from '../../utils/index.js'
import { monthSetAsides } from '../../utils/setAside.js'
import { logRejection } from '../../utils/errorLog.js'
import s from './Home.module.css'

export default function SetAsideBlock({ sym, onClose }) {
  const { t } = useT()
  const { m } = useMoney()
  const app = useApp() || {}
  const month = app.settings?.activeMonth || currentMonth()
  const sa = monthSetAsides(app.setAsides, month)
  const items = sa.items.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))
  // Foco después de "Quitar": la fila siguiente (o la anterior) o, si no queda
  // ninguna, "Apartar dinero". El botón quitado desaparece del DOM.
  const removeRefs = useRef(new Map())
  const ctaRef = useRef(null)
  const [focusId, setFocusId] = useState(null)
  useEffect(() => {
    if (focusId == null) return
    const el = (focusId !== 'cta' && removeRefs.current.get(focusId)) || ctaRef.current
    el?.focus?.()
    setFocusId(null)
  }, [focusId, items.length])
  if (!app.addSetAside) return null
  const destLabel = (r) => (r.dest === 'invest' ? t('qa.setAside.invest') : (r.description || t('qa.setAside.goal')))
  // Quitar con Deshacer (como deleteWithUndo en el resto de la app): si era a
  // una meta, también le baja el Ahorrado; Deshacer lo vuelve a apartar.
  async function remove(r) {
    const i = items.findIndex(x => x.id === r.id)
    const neighbor = items[i + 1] || items[i - 1] || null
    try { await app.delSetAside(r.id) } catch { return }
    setFocusId(neighbor ? neighbor.id : 'cta')
    const v = fmtMoney(r.amount, sym)
    app.showToast?.(t('home.setAside.removed', { v: m(v), dest: destLabel(r) }), 'ok', {
      label: t('common.undo'),
      onAction: () => {
        Promise.resolve(app.addSetAside({ amount: r.amount, date: r.date, dest: r.dest, goalId: r.goalId ?? null, description: r.description || '', method: r.method || '' }))
          .catch(logRejection('SetAsideBlock:undoRemove'))
      },
    })
  }
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
            {items.map(r => (
              <li key={r.id} className={s.asideRow}>
                <span className={s.asideName}>{destLabel(r)}</span>
                <span className="num"><Money>{fmtMoney(r.amount, sym)}</Money></span>
                {app.delSetAside && (
                  <button type="button" className="fos-link" onClick={() => remove(r)}
                    ref={el => { if (el) removeRefs.current.set(r.id, el); else removeRefs.current.delete(r.id) }}
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
      <button type="button" ref={ctaRef} className={s.detailLink} onClick={() => { onClose?.(); openQuickAdd('setAside') }}>
        {t('home.setAside.cta')}
      </button>
    </div>
  )
}
