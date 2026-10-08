// src/components/backup/BackupManager.jsx
// Sistema de respaldo y restauración — FinanceOS Fase 6
// Principio: el usuario debe entender que sus datos viven en su dispositivo.
// FinanceOS no puede recuperar datos si no existe un respaldo previo.

import { useState, useRef, useEffect } from 'react'
import { Lock } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { CLOUD_ENABLED } from '../../core/supabase.js'
import { cloudPush, cloudPull, cloudStatus } from '../../core/cloudSync.js'

import { dateLocale } from '../../utils/index.js'
import { useT } from '../../i18n/useT.js'
import { translate } from '../../i18n/translate.js'

// "hace N días" con .one/.many (mismo precedente que projects.totalNet.*)
const plural = (t, base, n, vars) => t(`${base}.${n === 1 ? 'one' : 'many'}`, { n, ...vars })
// ── HELPERS ───────────────────────────────────────────────────────────────────
function daysSince(isoDate) {
  if (!isoDate) return null
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(isoDate) {
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

// ── MODAL DE CONFIRMACIÓN ─────────────────────────────────────────────────────
function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, danger = false }) {
  const { t } = useT()
  if (!isOpen) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,.45)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: 'var(--sur)', borderRadius: 12, padding: '24px 24px 20px',
        maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.2)',
        border: '0.5px solid var(--brd2)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)', marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--tm)', lineHeight: 1.7, marginBottom: 20, whiteSpace: 'pre-line' }}>{message}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            background: 'var(--sur2)', border: '0.5px solid var(--brd2)',
            borderRadius: 6, padding: '8px 16px', fontSize: 12,
            cursor: 'pointer', color: 'var(--tm)', fontFamily: 'var(--sans)',
          }}>{t('common.cancel')}</button>
          <button onClick={onConfirm} style={{
            background: danger ? 'var(--red)' : 'var(--laton)', color: danger ? '#fff' : 'var(--navy)',
            border: 'none', borderRadius: 6, padding: '8px 18px',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--sans)',
          }}>{t('common.confirm')}</button>
        </div>
      </div>
    </div>
  )
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
        background: '#F3E4CE', borderRadius: compact ? 20 : 8,
        border: '0.5px solid rgba(156,84,25,.25)',
        fontSize: compact ? 10 : 11, color: 'var(--amb)',
        fontFamily: 'var(--mono)',
      }}>
        <span>⚠</span>
        <span>{compact ? t('backup.badge.none') : t('backup.badge.noneLong')}</span>
      </div>
    )
  }

  if (days > 30) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: compact ? '4px 10px' : '10px 12px',
        background: '#F5E6E3', borderRadius: compact ? 20 : 8,
        border: '0.5px solid rgba(162,62,46,.25)',
        fontSize: compact ? 10 : 11, color: 'var(--red)',
        fontFamily: 'var(--mono)',
      }}>
        <span>⚠</span>
        <span>{compact ? t('backup.badge.daysShort', { n: days }) : t('backup.badge.oldLong', { n: days })}</span>
      </div>
    )
  }

  if (days > 14) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: compact ? '4px 10px' : '10px 12px',
        background: '#F3E4CE', borderRadius: compact ? 20 : 8,
        border: '0.5px solid rgba(156,84,25,.25)',
        fontSize: compact ? 10 : 11, color: 'var(--amb)',
        fontFamily: 'var(--mono)',
      }}>
        <span>◑</span>
        <span>{compact ? t('backup.badge.daysShort', { n: days }) : t('backup.badge.staleLong', { n: days })}</span>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: compact ? '4px 10px' : '10px 12px',
      background: 'var(--pos-bg)', borderRadius: compact ? 20 : 8,
      border: '0.5px solid rgba(53,110,87,.25)',
      fontSize: compact ? 10 : 11, color: 'var(--pos)',
      fontFamily: 'var(--mono)',
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
export function BackupReminderBanner() {
  const { settings, updateSettings, exportData, incomes, expenses, debts, goals } = useApp()
  const { t } = useT()
  const [dismissed, setDismissed] = useState(false)
  const [exporting, setExporting] = useState(false)
  const lastBackup = settings.lastBackupAt
  const days = daysSince(lastBackup)
  const hasRealData = incomes.length > 0 || expenses.length > 0 || debts.length > 0 || goals.length > 0

  // Datos ficticios de demo no necesitan respaldo — nunca mostrar acá.
  const stale = !settings?.isDemo && hasRealData && (lastBackup === null || lastBackup === undefined || days > 14)
  if (!stale || dismissed) return null

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
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      padding: '12px 16px', marginBottom: 16, borderRadius: 10,
      background: !lastBackup ? '#F3E4CE' : '#F3E4CE',
      border: '0.5px solid rgba(133,79,11,.25)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>⚠</span>
        <div style={{ fontSize: 12, color: 'var(--amb)', fontFamily: 'var(--mono)', lineHeight: 1.5 }}>
          {!lastBackup ? t('backup.reminder.none') : t('backup.reminder.old', { n: days })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={handleBackupNow} disabled={exporting} style={{
          background: 'var(--amb)', color: '#fff', border: 'none', borderRadius: 6,
          padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: exporting ? 'default' : 'pointer',
          opacity: exporting ? 0.6 : 1,
        }}>{exporting ? t('backup.reminder.creating') : `↓ ${t('backup.reminder.cta')}`}</button>
        <button onClick={() => setDismissed(true)} aria-label={t('backup.reminder.dismiss')} style={{
          background: 'none', border: 'none', color: 'var(--amb)', fontSize: 13, cursor: 'pointer', minWidth: 32, minHeight: 32,
        }}>✕</button>
      </div>
    </div>
  )
}

// ── MAIN BACKUP MANAGER ───────────────────────────────────────────────────────
export default function BackupManager() {
  const { settings, updateSettings, exportData, importData, incomes, expenses, budgets, debts, goals } = useApp()
  const { t } = useT()
  const [status, setStatus]           = useState(null)
  const [importing, setImporting]     = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)
  const [pendingData, setPendingData] = useState(null)
  const [cloudSyncing, setCloudSyncing] = useState(false)
  const [cloudInfo, setCloudInfo]     = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    if (CLOUD_ENABLED) cloudStatus().then(setCloudInfo)
  }, [])

  const lastBackup = settings.lastBackupAt
  const days = daysSince(lastBackup)
  const hasRealData = incomes.length > 0 || expenses.length > 0 || debts.length > 0 || goals.length > 0

  // Cuenta registros totales para mostrar en el respaldo
  const totalRecords = incomes.length + expenses.length + budgets.length + debts.length + goals.length

  // ── EXPORTAR ────────────────────────────────────────────────────────────────
  async function handleExport() {
    try {
      await exportData()
      // Guardar fecha del último respaldo
      await updateSettings({ ...settings, lastBackupAt: new Date().toISOString() })
      setStatus({ type: 'ok', msg: t('backup.status.exportOk') })
      setTimeout(() => setStatus(null), 5000)
    } catch (e) {
      setStatus({ type: 'error', msg: t('backup.status.exportErr') })
    }
  }

  // ── CLOUD PUSH ──────────────────────────────────────────────────────────────
  async function handleCloudPush() {
    setCloudSyncing(true)
    setStatus(null)
    try {
      const result = await cloudPush()
      await updateSettings({ ...settings, lastCloudSyncAt: result.savedAt })
      setCloudInfo(await cloudStatus())
      setStatus({ type: 'ok', msg: `☁ ${t('backup.status.cloudPushOk')}` })
    } catch (e) {
      setStatus({ type: 'error', msg: t('backup.status.cloudPushErr', { msg: e.message || t('backup.status.checkConnection') }) })
    } finally {
      setCloudSyncing(false)
      setTimeout(() => setStatus(null), 5000)
    }
  }

  // ── CLOUD PULL ──────────────────────────────────────────────────────────────
  async function handleCloudPull() {
    setCloudSyncing(true)
    setStatus(null)
    try {
      const result = await cloudPull()
      if (!result) {
        setStatus({ type: 'warn', msg: t('backup.status.cloudEmpty') })
        return
      }
      await importData(new File(
        [JSON.stringify(result.payload)],
        'cloud-backup.json',
        { type: 'application/json' }
      ))
      setStatus({ type: 'ok', msg: `☁ ${t('backup.status.cloudPullOk', { date: formatDate(result.savedAt) })}` })
    } catch (e) {
      setStatus({ type: 'error', msg: t('backup.status.cloudPullErr', { msg: e.message || t('backup.status.checkConnection') }) })
    } finally {
      setCloudSyncing(false)
      setTimeout(() => setStatus(null), 6000)
    }
  }

  // ── SELECCIONAR ARCHIVO ─────────────────────────────────────────────────────
  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setImporting(true)
    setStatus(null)

    try {
      // Leer y parsear
      const text = await file.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        setStatus({ type: 'error', msg: t('backup.status.invalidJson') })
        setImporting(false)
        return
      }

      // Validar
      const { valid, errors, isDemoBackup } = validateBackupFile(data, t)
      if (!valid) {
        setStatus({ type: 'error', msg: errors.join(' ') })
        setImporting(false)
        return
      }

      // Guardar para confirmar
      setPendingFile(file.name)
      setPendingData(data)

      // Si hay datos reales, pedir confirmación
      if (hasRealData) {
        setConfirmOpen(true)
      } else {
        await doImport(data)
      }
    } catch (e) {
      setStatus({ type: 'error', msg: t('backup.status.readErr') })
    } finally {
      setImporting(false)
    }
  }

  // ── CONFIRMAR E IMPORTAR ────────────────────────────────────────────────────
  async function doImport(data) {
    setConfirmOpen(false)
    setImporting(true)
    try {
      await importData(new File(
        [JSON.stringify(data)],
        pendingFile || 'backup.json',
        { type: 'application/json' }
      ))
      // Actualizar fecha de respaldo si el archivo la tenía
      if (data._meta?.createdAt) {
        await updateSettings({ ...settings, lastBackupAt: data._meta.createdAt })
      }
      setStatus({ type: 'ok', msg: t('backup.status.restoreOk') })
      setPendingFile(null)
      setPendingData(null)
    } catch (e) {
      setStatus({ type: 'error', msg: t('backup.status.restoreErr') })
    } finally {
      setImporting(false)
      setTimeout(() => setStatus(null), 5000)
    }
  }

  const srow = {
    display: 'flex', alignItems: 'flex-start',
    justifyContent: 'space-between', padding: '14px 0',
    borderBottom: '0.5px solid var(--brd)', gap: 12,
  }
  const slbl = { fontSize: 13, fontWeight: 500, color: 'var(--tx)' }
  const ssub = { fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)', marginTop: 2, lineHeight: 1.5 }
  const btn = (variant = 'default') => ({
    padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', border: 'none', fontFamily: 'var(--sans)',
    flexShrink: 0, transition: 'all .15s',
    ...(variant === 'primary' ? { background: 'var(--laton)', color: 'var(--navy)' } : {}),
    ...(variant === 'default' ? { background: 'var(--sur2)', color: 'var(--tx)', border: '0.5px solid var(--brd2)' } : {}),
    ...(variant === 'danger'  ? { background: 'transparent', color: 'var(--red)', border: '0.5px solid rgba(162,62,46,.35)' } : {}),
  })

  return (
    <>
      {/* Modal de confirmación de restauración */}
      <ConfirmModal
        isOpen={confirmOpen}
        title={t('backup.confirm.title')}
        message={plural(t, 'backup.confirm.message', totalRecords, { file: pendingFile })}
        onConfirm={() => doImport(pendingData)}
        onCancel={() => { setConfirmOpen(false); setPendingFile(null); setPendingData(null) }}
        danger
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Estado del respaldo */}
        <BackupStatusBadge />

        {/* Alerta si no hay datos */}
        {!hasRealData && (
          <div style={{
            padding: '10px 14px', background: 'var(--sur2)',
            border: '0.5px solid var(--brd)', borderRadius: 8,
            fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)', lineHeight: 1.5,
          }}>
            {t('backup.noData')}
          </div>
        )}

        {/* Explicación educativa */}
        <div style={{
          padding: '14px 16px', background: 'var(--sur2)',
          border: '0.5px solid var(--brd)', borderRadius: 8,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx)', marginBottom: 6 }}>
            <Lock size={12} strokeWidth={1.7} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 5, flexShrink: 0 }} />{t('backup.where.title')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--tm)', lineHeight: 1.7, fontFamily: 'var(--mono)' }}>
            {t('backup.where.body')} <strong style={{ color: 'var(--tx)' }}>{t('backup.where.warn')}</strong>.{' '}
            {t('backup.where.noRecovery')}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)' }}>
            {t('backup.where.tip')}
          </div>
        </div>

        {/* Crear respaldo */}
        <div style={srow}>
          <div style={{ flex: 1 }}>
            <div style={slbl}>{t('backup.create.title')}</div>
            <div style={ssub}>
              {plural(t, 'backup.create.sub', totalRecords)}
              {lastBackup && <><br />{t('backup.badge.okLong', { date: formatDate(lastBackup) })} ({days !== null && days > 0 ? plural(t, 'backup.ago', days) : t('backup.ago.today')})</>}
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={!hasRealData}
            style={{ ...btn('primary'), opacity: hasRealData ? 1 : 0.5, cursor: hasRealData ? 'pointer' : 'not-allowed' }}
          >
            ↓ {t('backup.create.title')}
          </button>
        </div>

        {/* Restaurar respaldo */}
        <div style={{ ...srow, borderBottom: 'none' }}>
          <div style={{ flex: 1 }}>
            <div style={slbl}>{t('backup.restore.title')}</div>
            <div style={ssub}>
              {t('backup.restore.sub')}<br />
              <span style={{ color: 'var(--amb)' }}>⚠ {t('backup.restore.warn')}</span>
            </div>
          </div>
          <label style={{ flexShrink: 0 }}>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              style={{ ...btn('default'), opacity: importing ? 0.6 : 1 }}
            >
              {importing ? t('backup.restore.importing') : `↑ ${t('backup.restore.btn')}`}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
              disabled={importing}
            />
          </label>
        </div>

        {/* ── CLOUD SYNC ── */}
        {CLOUD_ENABLED && (
          <div style={{ marginTop: 8, padding: '16px', background: 'var(--sur2)', border: '0.5px solid var(--brd)', borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)', marginBottom: 2 }}>☁ {t('backup.cloud.title')}</div>
                <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)' }}>
                  {cloudInfo?.connected
                    ? `${t('backup.cloud.connected', { id: cloudInfo.userId })}${cloudInfo.lastSync ? ' · ' + t('backup.cloud.lastSync', { date: formatDate(cloudInfo.lastSync) }) : ''}`
                    : t('backup.cloud.noSession')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleCloudPull}
                  disabled={cloudSyncing}
                  title={t('backup.cloud.pullTitle')}
                  style={{ ...btn('default'), fontSize: 11, padding: '6px 12px', opacity: cloudSyncing ? 0.5 : 1 }}
                >
                  ↓ {t('backup.restore.btn')}
                </button>
                <button
                  onClick={handleCloudPush}
                  disabled={cloudSyncing || !hasRealData}
                  title={t('backup.cloud.pushTitle')}
                  style={{ ...btn('primary'), fontSize: 11, padding: '6px 12px', opacity: (cloudSyncing || !hasRealData) ? 0.5 : 1 }}
                >
                  {cloudSyncing ? t('backup.cloud.syncing') : `↑ ${t('backup.cloud.sync')}`}
                </button>
              </div>
            </div>
            <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)', lineHeight: 1.5 }}>
              {t('backup.cloud.note')}
            </div>
          </div>
        )}

        {/* Mensaje de estado */}
        {status && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, fontSize: 11,
            fontFamily: 'var(--mono)', lineHeight: 1.5,
            background: status.type === 'ok' ? 'var(--pos-bg)' : status.type === 'error' ? '#F5E6E3' : '#F3E4CE',
            color: status.type === 'ok' ? 'var(--pos)' : status.type === 'error' ? 'var(--red)' : 'var(--amb)',
            border: `0.5px solid ${status.type === 'ok' ? 'rgba(53,110,87,.25)' : status.type === 'error' ? 'rgba(162,62,46,.25)' : 'rgba(156,84,25,.25)'}`,
          }}>
            {status.type === 'ok' ? '✓' : '⚠'} {status.msg}
          </div>
        )}

      </div>
    </>
  )
}
