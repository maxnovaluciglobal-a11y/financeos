// src/pages/Dashboard/FirstSteps.jsx — "Completa tus primeros pasos · n de 3" (R06).
// Reemplaza el bloque "Empieza aquí" (4 botones de 4 colores, solo con 0 datos)
// por una fila compacta que abre una hoja. El progreso sale de los datos reales
// (firstSteps.js) y la fila desaparece sola al completar los 3 pasos.
// Un solo acento: el paso pendiente siguiente lleva el botón Latón; el resto,
// botón secundario; los hechos, un check.
import { useState } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import Sheet from '../../components/ui/Sheet.jsx'
import { openQuickAdd } from '../../components/quickAddBus.js'
import { isSyncEnabled, syncAvailable } from '../../core/sync.js'
import { firstStepsProgress } from './firstSteps.js'
import s from './Home.module.css'

export default function FirstSteps({ setPage }) {
  const ctx = useApp() || {}
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const settings = ctx.settings || {}

  const progress = firstStepsProgress({
    incomes: ctx.incomes, expenses: ctx.expenses, budgets: ctx.budgets,
    lastBackupAt: settings.lastBackupAt,
    syncOn: isSyncEnabled() && syncAvailable(),
  })
  if (settings.isDemo || progress.complete || !setPage) return null

  function go(page) { setOpen(false); setPage(page) }

  async function backupNow() {
    setExporting(true)
    try {
      await ctx.exportData?.()
      await ctx.updateSettings?.({ ...settings, lastBackupAt: new Date().toISOString() })
    } catch {
      // Si la descarga falla, el respaldo completo (con restaurar) vive en Ajustes.
      go('settings')
    } finally { setExporting(false) }
  }

  const ACTIONS = {
    movement: { label: t('steps.movement.cta'), run: () => { setOpen(false); openQuickAdd('expense') },
                alt: { label: t('steps.movement.import'), run: () => go('import') } },
    budget:   { label: t('steps.budget.cta'), run: () => go('budgets') },
    backup:   { label: exporting ? t('backup.reminder.creating') : t('steps.backup.cta'), run: backupNow, busy: exporting },
  }

  return (
    <>
      <button type="button" className={`${s.card} ${s.steps}`} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className={s.stepsBar} aria-hidden="true">
          {progress.steps.map(st => <span key={st.id} className={st.done ? s.stepsSegOn : s.stepsSeg} />)}
        </span>
        <span className={s.stepsText}>{t('steps.row')}</span>
        <span className={`num ${s.stepsCount}`}>{t('steps.count', { n: progress.done, total: progress.total })}</span>
        <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" className={s.stepsChevron} />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} ariaLabel={t('steps.title')}>
        <h2 className={s.sheetTitle}>{t('steps.title')}</h2>
        <p className={s.sheetSub}>{t('steps.sub')}</p>
        <ol className={s.stepList}>
          {progress.steps.map((st, i) => {
            const a = ACTIONS[st.id]
            const primary = st.id === progress.nextId
            return (
              <li key={st.id} className={s.stepItem}>
                <span className={st.done ? s.stepMarkDone : s.stepMark} aria-hidden="true">
                  {st.done ? <Check size={14} strokeWidth={2.4} /> : i + 1}
                </span>
                <div className={s.stepBody}>
                  <div className={s.stepTitle}>
                    {t(`steps.${st.id}.title`)}
                  </div>
                  <div className={s.stepDesc}>{t(`steps.${st.id}.desc`)}</div>
                  {!st.done && (
                    <div className={s.stepActions}>
                      <button type="button" className={primary ? 'fos-btn-primary' : 'fos-btn-secondary'}
                        style={{ width: 'auto' }} onClick={a.run} disabled={a.busy} aria-busy={a.busy || undefined}>
                        {a.label}
                      </button>
                      {a.alt && <button type="button" className="fos-link" onClick={a.alt.run}>{a.alt.label}</button>}
                    </div>
                  )}
                  {st.done && <div className={s.stepDone}>{t('steps.done')}</div>}
                </div>
              </li>
            )
          })}
        </ol>
      </Sheet>
    </>
  )
}
