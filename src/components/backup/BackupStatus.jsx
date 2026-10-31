// src/components/backup/BackupStatus.jsx
// Lo chico del respaldo que se ve fuera de Ajustes: el estado en la barra (Shell),
// el aviso del Inicio y la validación que usa la pantalla de bloqueo para
// restaurar. V4: separado de BackupManager.jsx para que esa pantalla, que solo
// abre Ajustes › Datos, no vaya en el JS inicial.
import { useState } from 'react'
import { History, Download, X } from 'lucide-react'
import rs from './BackupReminder.module.css'
import SignalIcon from '../icons/SignalIcon.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { dateLocale } from '../../utils/index.js'
import { useT } from '../../i18n/useT.js'
import { translate } from '../../i18n/translate.js'

// "hace N días" con .one/.many (mismo precedente que projects.totalNet.*)
export const plural = (t, base, n, vars) => t(`${base}.${n === 1 ? 'one' : 'many'}`, { n, ...vars })
// ── HELPERS ───────────────────────────────────────────────────────────────────
export function daysSince(isoDate, now = Date.now()) {
  if (!isoDate) return null
  return Math.floor((now - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24))
}

export function formatDate(isoDate) {
  if (!isoDate) return null
  return new Date(isoDate).toLocaleDateString(dateLocale(), {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// ── VALIDACIÓN DEL ARCHIVO JSON ───────────────────────────────────────────────
// `t` opcional: sin él, los mensajes salen en español (uso fuera de React).
export function validateBackupFile(data, t = (k, v) => translate('es', k, v)) {
  const errors = []

  // Debe ser un objeto
  if (!data || typeof data !== 'object' || Array.isArray(data))
    return { valid: false, errors: [t('backup.err.format')] }

  // Debe tener al menos una colección conocida
  const knownKeys = ['incomes', 'expenses', 'budgets', 'debts', 'goals']
  const hasKnownKey = knownKeys.some(k => k in data)
  if (!hasKnownKey)
    errors.push(t('backup.err.notBackup'))

  // Las colecciones deben ser arrays
  knownKeys.forEach(k => {
    if (k in data && !Array.isArray(data[k]))
      errors.push(t('backup.err.section', { k }))
  })

  // Detectar si es archivo demo — tiene IDs que empiezan con "demo-"
  const allIds = [
    ...(data.incomes  || []).map(r => r.id),
    ...(data.expenses || []).map(r => r.id),
  ]
  const isDemoBackup = allIds.some(id => String(id).startsWith('demo-'))
  if (isDemoBackup)
    errors.push(t('backup.err.demo'))

  // Verificar versión si existe
  if (data._meta?.version && !data._meta.version.startsWith('1.'))
    errors.push(t('backup.err.version'))

  return { valid: errors.length === 0, errors, isDemoBackup }
}

// ── BACKUP STATUS BADGE ───────────────────────────────────────────────────────
export function BackupStatusBadge({ compact = false }) {
  const { settings } = useApp()
  const { t } = useT()
  const lastBackup = settings.lastBackupAt
  const days = daysSince(lastBackup)

  if (!lastBackup) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: compact ? '4px 10px' : '10px 12px',
        background: 'var(--amb-bg)', borderRadius: compact ? 'var(--rs)' : 8,
        border: 0,
        fontSize: 11, color: 'var(--amb)',
        fontFamily: 'var(--sans)',
      }}>
        <SignalIcon kind="alert" size={13} />
        <span>{compact ? t('backup.badge.none') : t('backup.badge.noneLong')}</span>
      </div>
    )
  }

  if (days > 30) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: compact ? '4px 10px' : '10px 12px',
        background: 'var(--red-bg)', borderRadius: compact ? 'var(--rs)' : 8,
        border: 0,
        fontSize: 11, color: 'var(--red)',
        fontFamily: 'var(--sans)',
      }}>
        <SignalIcon kind="alert" size={13} />
        <span>{compact ? t('backup.badge.daysShort', { n: days }) : t('backup.badge.oldLong', { n: days })}</span>
      </div>
    )
  }

  if (days > 14) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: compact ? '4px 10px' : '10px 12px',
        background: 'var(--amb-bg)', borderRadius: compact ? 'var(--rs)' : 8,
        border: 0,
        fontSize: 11, color: 'var(--amb)',
        fontFamily: 'var(--sans)',
      }}>
        <SignalIcon kind="attention" size={13} />
        <span>{compact ? t('backup.badge.daysShort', { n: days }) : t('backup.badge.staleLong', { n: days })}</span>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: compact ? '4px 10px' : '10px 12px',
      background: 'var(--pos-bg)', borderRadius: compact ? 'var(--rs)' : 8,
      border: 0,
      fontSize: 11, color: 'var(--pos)',
      fontFamily: 'var(--sans)',
    }}>
      <span>✓</span>
      <span>{compact ? t('backup.badge.ok') : t('backup.badge.okLong', { date: formatDate(lastBackup) })}</span>
    </div>
  )
}

// ── BACKUP REMINDER BANNER ────────────────────────────────────────────────────
// A diferencia de BackupStatusBadge (pasivo, solo se ve si el usuario mira el nav
// o entra a Ajustes), esto se muestra en el Dashboard cuando el respaldo está
// viejo — con un botón que dispara la misma exportación de un clic, sin tener
// que navegar a Ajustes. Sigue siendo un recordatorio, no un respaldo silencioso
// real: un navegador no puede escribir un archivo en disco sin que el usuario lo
// vea, así que esto es lo más automático que se puede hacer sin salir del modelo
// local-only.
// M5 (oct-2026): franja de la primera vista del Inicio, con tokens (Latón/Navy),
// ícono + texto y cierre por sesión (sessionStorage): vuelve a aparecer en la
// próxima visita mientras el respaldo siga viejo. Mismos umbrales de siempre:
// sin respaldo, o más de 14 días.
const REMINDER_DISMISS_KEY = 'fos_backup_reminder_dismissed'
export const BACKUP_STALE_DAYS = 14

// A8 (30-oct-2026): la misma regla la usa el Inicio para no avisar el
// respaldo dos veces (este aviso con días + la tarjeta "Respaldo recomendado").
export function isBackupStale({ settings = {}, hasRealData = false, now = Date.now() } = {}) {
  if (settings?.isDemo || !hasRealData) return false
  const last = settings.lastBackupAt
  if (last === null || last === undefined) return true
  return daysSince(last, now) > BACKUP_STALE_DAYS
}

// `suppress`: el Inicio lo apaga mientras "Primeros pasos" ya pide el primer
// respaldo (un solo aviso a la vez, R7/A8).
export function BackupReminderBanner({ suppress = false } = {}) {
  const { settings, updateSettings, exportData, incomes, expenses, debts, goals } = useApp()
  const { t } = useT()
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(REMINDER_DISMISS_KEY) === '1' } catch { return false }
  })
  const [exporting, setExporting] = useState(false)
  const lastBackup = settings.lastBackupAt
  const days = daysSince(lastBackup)
  const hasRealData = incomes.length > 0 || expenses.length > 0 || debts.length > 0 || goals.length > 0

  // Datos ficticios de demo no necesitan respaldo — nunca mostrar acá.
  const stale = isBackupStale({ settings, hasRealData })
  if (!stale || dismissed || suppress) return null

  function dismiss() {
    try { sessionStorage.setItem(REMINDER_DISMISS_KEY, '1') } catch { /* modo privado: solo en memoria */ }
    setDismissed(true)
  }

  async function handleBackupNow() {
    setExporting(true)
    try {
      await exportData()
      await updateSettings({ ...settings, lastBackupAt: new Date().toISOString() })
      setDismissed(true)
    } catch { /* el botón vuelve a habilitarse solo, sin mensaje extra acá */ }
    finally { setExporting(false) }
  }

  return (
    <div className={rs.strip} role="region" aria-label={t('backup.reminder.aria')}>
      <div className={rs.msg}>
        <History size={18} strokeWidth={1.7} aria-hidden="true" />
        <span>
          {!lastBackup ? t('backup.reminder.none') : plural(t, 'backup.reminder.old', days)}{' '}
          <span className={rs.local}>{t('backup.reminder.local')}</span>
        </span>
      </div>
      <div className={rs.actions}>
        <button type="button" className={rs.cta} onClick={handleBackupNow} disabled={exporting} aria-busy={exporting}>
          <Download size={16} strokeWidth={1.9} aria-hidden="true" />
          {exporting ? t('backup.reminder.creating') : t('backup.reminder.cta')}
        </button>
        <button type="button" className={rs.close} onClick={dismiss} aria-label={t('backup.reminder.dismiss')}>
          <X size={18} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
