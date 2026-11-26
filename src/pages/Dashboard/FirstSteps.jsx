// src/pages/Dashboard/FirstSteps.jsx — "Primeros pasos · n de 5" (R06; tarjeta
// con progreso desde el 24-nov-2026).
// Una tarjeta arriba del contenido del Inicio, solo en una cuenta nueva (sus
// primeros 30 días; nunca en el demo ni en una cuenta que ya existía): barra
// fina de progreso y los 5 pasos en filas de un toque. El progreso sale de los
// datos reales (firstSteps.js); la tarjeta desaparece al completar los pasos
// y no vuelve aunque uno quede pendiente. "Ocultar" vale en este dispositivo.
// Un solo acento: el paso pendiente siguiente lleva su explicación y el botón
// principal; los demás son filas; los hechos, un check.
import { Suspense, useEffect, useRef, useState } from 'react'
import { Check, ChevronRight, X } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { openQuickAdd } from '../../components/quickAddBus.js'
import { isSyncEnabled, syncAvailable } from '../../core/sync.js'
import { pushSupported, isPushEnabled } from '../../core/push.js'
import { pushOfferable } from '../../core/pushAsk.js'
import { requestPushPermission } from '../../core/pushPrimer.js'
import { localAlertsSupported, requestLocalAlerts } from '../../core/localAlerts/primer.js'
import { isNativeApp } from '../../native/platform.js'
import { hasProEntitlement } from '../../utils/licenseValidator.js'
import { currentMonth } from '../../utils/index.js'
import { focusAfter } from '../../utils/focusAfter.js'
import { firstStepsProgress, firstStepsVisible, nextFirstStepsState, readFirstStepsState, FIRST_STEPS_HIDDEN_KEY, FIRST_STEPS_STATE_KEY } from './firstSteps.js'
import { GuideStringsGate } from '../../i18n/guide/index.js'
import s from './firstStepsCard.module.css'

const readHidden = () => { try { return localStorage.getItem(FIRST_STEPS_HIDDEN_KEY) === '1' } catch { return false } }
const readState = () => { try { return readFirstStepsState(localStorage.getItem(FIRST_STEPS_STATE_KEY)) } catch { return readFirstStepsState(null) } }

// El mismo cálculo para la tarjeta y para el Inicio (que apaga avisos
// repetidos mientras la tarjeta se ve).
export function useFirstSteps() {
  const ctx = useApp() || {}
  const settings = ctx.settings || {}
  const [hidden, setHidden] = useState(readHidden)
  const [stored, setStored] = useState(readState)
  const [pushTick, setPushTick] = useState(0)
  // App de tienda con el plugin de avisos locales: el quinto paso los activa
  // (hoja de ejemplos en modo local, core/localAlerts/). El permiso del
  // teléfono se consulta aparte ('loading' mientras tanto: el paso se ofrece).
  const local = localAlertsSupported() && !settings.isDemo
  const [localPerm, setLocalPerm] = useState('loading')
  useEffect(() => {
    if (!local) return undefined
    let alive = true
    import('../../core/localAlerts/native.js').then(n => n.localPermission())
      .then(p => { if (alive) setLocalPerm(p) }, () => { if (alive) setLocalPerm('unsupported') })
    return () => { alive = false }
  }, [local, pushTick])
  // Con el permiso bloqueado (navegador o teléfono) el paso de avisos no se
  // puede cumplir: el quinto pasa a ser el respaldo.
  const blocked = typeof Notification !== 'undefined' && Notification.permission === 'denied'
  const localOffered = local && localPerm !== 'denied' && localPerm !== 'unsupported'
  const webOffered = pushOfferable({ supported: pushSupported() && !blocked, hasLicense: hasProEntitlement(), isDemo: !!settings.isDemo, native: isNativeApp() })
  const pushOffered = webOffered || localOffered
  const alertsOn = webOffered ? isPushEnabled() : localOffered && localPerm === 'granted'
  const data = { incomes: ctx.incomes, expenses: ctx.expenses, budgets: ctx.budgets, recurring: ctx.recurring, lastBackupAt: settings.lastBackupAt }
  const progress = firstStepsProgress({
    ...data, activeMonth: settings.activeMonth || currentMonth(),
    syncOn: isSyncEnabled() && syncAvailable(),
    pushOffered, pushOn: pushOffered && alertsOn,
  })
  // Mientras los datos cargan no se decide nada (una cuenta vieja parecería nueva).
  const state = ctx.loading ? stored : nextFirstStepsState(stored, data, progress)
  useEffect(() => {
    if (state.since === stored.since && state.done === stored.done) return
    try { localStorage.setItem(FIRST_STEPS_STATE_KEY, JSON.stringify(state)) } catch { /* sin almacenamiento: se recalcula de los datos */ }
    setStored(state)
  }, [state.since, state.done]) // eslint-disable-line react-hooks/exhaustive-deps
  const visible = !ctx.loading && firstStepsVisible(progress, { isDemo: !!settings.isDemo, hidden, state })
  const hide = () => { try { localStorage.setItem(FIRST_STEPS_HIDDEN_KEY, '1') } catch { /* almacenamiento no disponible: se oculta en esta sesión */ } setHidden(true) }
  return { ctx, settings, progress, visible, hide, pushTick, localAlerts: localOffered, refreshPush: () => setPushTick(n => n + 1) }
}

// `steps`: lo que devuelve useFirstSteps() en el Inicio (un solo cálculo).
// Los textos son de la sección diferida src/i18n/guide: en otro idioma la
// tarjeta aparece cuando llegan (sin suspender el resto del Inicio).
export default function FirstSteps(props) {
  if (!props.steps?.visible || !props.setPage) return null
  return <Suspense fallback={null}><GuideStringsGate><FirstStepsCard {...props} /></GuideStringsGate></Suspense>
}

function FirstStepsCard({ setPage, steps }) {
  const { t } = useT()
  const [busy, setBusy] = useState(null)
  const { ctx, settings, progress, hide, refreshPush, localAlerts } = steps

  async function backupNow() {
    setBusy('backup')
    try {
      if (await ctx.exportData?.() === 'cancelled') return
      await ctx.updateSettings?.({ ...settings, lastBackupAt: new Date().toISOString() })
    } catch {
      // Si la descarga falla, el respaldo completo (con restaurar) vive en Ajustes.
      setPage('settings')
    } finally { setBusy(null) }
  }
  async function alertsNow() {
    setBusy('alerts')
    try {
      // App de tienda: avisos locales (Host.jsx abre la hoja en modo local).
      const r = localAlerts ? await requestLocalAlerts({ source: 'steps' }) : await requestPushPermission({ source: 'steps' })
      if (r?.ok) ctx.showToast?.(t('pushAsk.enabled'))
      else if (r?.error === 'permission_denied') ctx.showToast?.(t(localAlerts ? 'steps.alerts.localDenied' : 'settings.push.permissionDenied'), 'error')
      else if (r?.error && r.error !== 'dismissed') ctx.showToast?.(t('settings.push.genericError'), 'error')
    } finally { setBusy(null); refreshPush?.() }
  }

  const RUN = {
    income: () => openQuickAdd('income'),
    expense: () => openQuickAdd('expense'),
    fixed: () => setPage('recurring'),
    budget: () => setPage('budgets'),
    alerts: alertsNow,
    backup: backupNow,
  }
  const pct = Math.round((progress.done / progress.total) * 100)
  // Ocultar saca la tarjeta: el foco pasa al título de la sección siguiente.
  const cardRef = useRef(null)
  function hideCard() {
    const el = cardRef.current
    focusAfter(el)
    hide()
  }

  return (
    <section className={s.card} ref={cardRef} aria-labelledby="first-steps-title" data-tour="first-steps-card">
      <div className={s.head}>
        <h2 id="first-steps-title" className={s.title}>
          {t('steps.title')}<span className={s.dot} aria-hidden="true"> · </span>
          {/* Sin región en vivo: cada paso hecho ya lo anuncia su toast. */}
          <span className={`num ${s.count}`}>{t('steps.count', { n: progress.done, total: progress.total })}</span>
        </h2>
        <button type="button" className={s.hide} onClick={hideCard} aria-label={t('steps.hide')}>
          <X size={18} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
      <div className={s.bar} role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}
        aria-valuetext={t('steps.count', { n: progress.done, total: progress.total })} aria-label={t('steps.title')}>
        <span className={s.fill} style={{ width: `${pct}%` }} />
      </div>

      <ol className={s.list}>
        {progress.steps.map((st, i) => {
          const next = st.id === progress.nextId
          const label = t(`steps.${st.id}.title`)
          if (st.done) {
            return (
              <li key={st.id} className={`${s.row} ${s.rowDone}`}>
                <span className={s.markDone} aria-hidden="true"><Check size={14} strokeWidth={2.4} /></span>
                <span className={s.rowText}><span className="sr-only">{t('steps.done')}: </span>{label}</span>
              </li>
            )
          }
          if (next) {
            return (
              <li key={st.id} className={`${s.row} ${s.rowNext}`}>
                <span className={s.markNext} aria-hidden="true">{i + 1}</span>
                <div className={s.nextBody}>
                  <span className={s.rowText}>{label}</span>
                  <span className={s.desc}>{t(st.id === 'alerts' && localAlerts ? 'steps.alerts.localDesc' : `steps.${st.id}.desc`)}</span>
                  {/* aria-disabled: el botón conserva el foco mientras espera. */}
                  <button type="button" className={`fos-btn-primary ${s.cta}`} onClick={busy ? undefined : RUN[st.id]}
                    aria-disabled={busy === st.id || undefined} aria-busy={busy === st.id || undefined}>
                    {t(`steps.${st.id}.cta`)}
                  </button>
                </div>
              </li>
            )
          }
          return (
            <li key={st.id} className={s.row}>
              <button type="button" className={s.rowBtn} onClick={RUN[st.id]} disabled={busy === st.id}>
                <span className={s.mark} aria-hidden="true">{i + 1}</span>
                <span className={s.rowText}>{label}</span>
                <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" className={s.chev} />
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
