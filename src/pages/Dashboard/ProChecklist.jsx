// src/pages/Dashboard/ProChecklist.jsx — "Tres cosas para probar en Pro" (PRD-4).
// Mismo patrón que FirstSteps: una fila compacta con el progreso que abre una
// hoja con los pasos. Son los pasos de los correos de la prueba (días 1, 3 y
// 10, send-trial-activation-email); cada uno se marca al abrir su pantalla
// (App.jsx → markPageVisited). Solo con Pro, fuera del demo y durante los
// primeros 14 días; se puede ocultar.
import { useState, useEffect } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { usePlan } from '../../hooks/usePlan.js'
import Sheet from '../../components/ui/Sheet.jsx'
import { PRO_STEPS, readChecklist, startChecklist, dismissChecklist, isChecklistVisible } from '../../utils/proChecklist.js'
import s from './Home.module.css'

export default function ProChecklist({ setPage }) {
  const ctx = useApp() || {}
  const { t } = useT()
  const { isPro } = usePlan()
  const isDemo = !!ctx.settings?.isDemo
  const [state, setState] = useState(() => readChecklist())
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (isPro && !isDemo) setState(startChecklist())
  }, [isPro, isDemo])

  if (!isPro || isDemo || !setPage || !isChecklistVisible(state)) return null

  const done = PRO_STEPS.filter(st => state.done[st.id]).length
  const nextId = PRO_STEPS.find(st => !state.done[st.id])?.id
  function go(page) { setOpen(false); setPage(page) }
  function hide() { setState(dismissChecklist()); setOpen(false) }

  return (
    <>
      <button type="button" className={`${s.card} ${s.steps}`} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className={s.stepsBar} aria-hidden="true">
          {PRO_STEPS.map(st => <span key={st.id} className={state.done[st.id] ? s.stepsSegOn : s.stepsSeg} />)}
        </span>
        <span className={s.stepsText}>{t('proTrial.title')}</span>
        <span className={`num ${s.stepsCount}`}>{t('proTrial.progress', { n: done })}</span>
        <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" className={s.stepsChevron} />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} ariaLabel={t('proTrial.title')}>
        <h2 className={s.sheetTitle}>{t('proTrial.title')}</h2>
        <p className={s.sheetSub}>{t('proTrial.sub')}</p>
        <ol className={s.stepList} aria-label={t('proTrial.listLabel')}>
          {PRO_STEPS.map((st, i) => {
            const isDone = !!state.done[st.id]
            return (
              <li key={st.id} className={s.stepItem}>
                <span className={isDone ? s.stepMarkDone : s.stepMark} aria-hidden="true">
                  {isDone ? <Check size={14} strokeWidth={2.4} /> : i + 1}
                </span>
                <div className={s.stepBody}>
                  <div className={s.stepTitle}>{t(st.labelKey)}</div>
                  {isDone
                    ? <div className={s.stepDone}>{t('proTrial.done')}</div>
                    : (
                      <div className={s.stepActions}>
                        <button type="button" className={st.id === nextId ? 'fos-btn-primary' : 'fos-btn-secondary'}
                          style={{ width: 'auto' }} onClick={() => go(st.page)}>
                          {t('proTrial.go')}
                        </button>
                      </div>
                    )}
                </div>
              </li>
            )
          })}
        </ol>
        <button type="button" className="fos-link" onClick={hide}>{t('proTrial.hide')}</button>
      </Sheet>
    </>
  )
}
