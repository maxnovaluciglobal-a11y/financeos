// src/components/backup/BackupManager.jsx
// Sistema de respaldo y restauración — FinanceOS Fase 6
// Principio: el usuario debe entender que sus datos viven en su dispositivo.
// FinanceOS no puede recuperar datos si no existe un respaldo previo.

import { useState, useRef, useEffect } from 'react'
import { Lock } from 'lucide-react'
import SignalIcon, { InlineIcon } from '../icons/SignalIcon.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { CLOUD_ENABLED } from '../../core/supabase.js'
import { cloudPush, cloudPull, cloudStatus } from '../../core/cloudSync.js'

import { useT } from '../../i18n/useT.js'
import { plural, daysSince, formatDate, validateBackupFile } from './BackupStatus.jsx'
import { MIN_PASSPHRASE_LENGTH, isEncryptedBackupText, passphraseOk, decryptBackupFile } from '../../utils/backupFile.js'

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
        border: 0,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)', marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--tm)', lineHeight: 1.7, marginBottom: 20, whiteSpace: 'pre-line' }}>{message}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            background: 'var(--fill)', border: 0,
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
  const [encOn, setEncOn]       = useState(false)
  const [encPass, setEncPass]   = useState('')
  const [encText, setEncText]   = useState(null)
  const [encName, setEncName]   = useState('')
  const [openPass, setOpenPass] = useState('')
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
    if (encOn && !passphraseOk(encPass)) {
      setStatus({ type: 'error', msg: t('backup.enc.tooShort', { n: MIN_PASSPHRASE_LENGTH }) })
      return
    }
    try {
      await exportData(encOn ? { passphrase: encPass } : undefined)
      // Guardar fecha del último respaldo
      await updateSettings({ ...settings, lastBackupAt: new Date().toISOString() })
      setStatus({ type: 'ok', msg: t(encOn ? 'backup.enc.exportOk' : 'backup.status.exportOk') })
      if (encOn) { setEncPass(''); setEncOn(false) }
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
      if (isEncryptedBackupText(text)) {
        setEncText(text)
        setEncName(file.name)
        setOpenPass('')
        return
      }
      let data
      try {
        data = JSON.parse(text)
      } catch {
        setStatus({ type: 'error', msg: t('backup.status.invalidJson') })
        return
      }
      await acceptData(data, file.name)
    } catch (e) {
      setStatus({ type: 'error', msg: t('backup.status.readErr') })
    } finally {
      setImporting(false)
    }
  }

  // Valida el contenido y pide confirmación (o restaura de una vez si no hay datos).
  async function acceptData(data, name) {
    const { valid, errors } = validateBackupFile(data, t)
    if (!valid) {
      setStatus({ type: 'error', msg: errors.join(' ') })
      return
    }
    setPendingFile(name)
    setPendingData(data)
    if (hasRealData) setConfirmOpen(true)
    else await doImport(data, name)
  }

  // ── RESPALDO CIFRADO: pedir la contraseña y abrirlo ─────────────────────────
  async function handleOpenEncrypted() {
    setImporting(true)
    setStatus(null)
    try {
      let data
      try {
        data = await decryptBackupFile(encText, openPass)
      } catch (e) {
        setStatus({ type: 'error', msg: t(e?.message === 'wrong_key' ? 'backup.enc.wrong' : 'backup.enc.corrupt') })
        return
      }
      const name = encName
      setEncText(null); setOpenPass('')
      await acceptData(data, name)
    } finally {
      setImporting(false)
    }
  }

  // ── CONFIRMAR E IMPORTAR ────────────────────────────────────────────────────
  async function doImport(data, name) {
    setConfirmOpen(false)
    setImporting(true)
    try {
      await importData(new File(
        [JSON.stringify(data)],
        name || pendingFile || 'backup.json',
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
  const ssub = { fontSize: 11, color: 'var(--th)', fontFamily: 'var(--sans)', marginTop: 2, lineHeight: 1.5 }
  const btn = (variant = 'default') => ({
    padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, minHeight: 44,
    cursor: 'pointer', border: 'none', fontFamily: 'var(--sans)',
    flexShrink: 0, transition: 'all .15s',
    ...(variant === 'primary' ? { background: 'var(--laton)', color: 'var(--navy)' } : {}),
    ...(variant === 'default' ? { background: 'var(--fill)', color: 'var(--tx)', border: 0 } : {}),
    ...(variant === 'danger'  ? { background: 'var(--fill)', color: 'var(--red)', border: 0 } : {}),
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
            padding: '10px 14px', background: 'var(--fill)',
            border: 0, borderRadius: 8,
            fontSize: 11, color: 'var(--th)', fontFamily: 'var(--sans)', lineHeight: 1.5,
          }}>
            {t('backup.noData')}
          </div>
        )}

        {/* Explicación educativa */}
        <div style={{
          padding: '14px 16px', background: 'var(--fill)',
          border: 0, borderRadius: 8,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx)', marginBottom: 6 }}>
            <Lock size={12} strokeWidth={1.7} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 5, flexShrink: 0 }} />{t('backup.where.title')}
          </div>
          <div style={{ fontSize: 11, color: 'var(--tm)', lineHeight: 1.7, fontFamily: 'var(--sans)' }}>
            {t('backup.where.body')} <strong style={{ color: 'var(--tx)' }}>{t('backup.where.warn')}</strong>.{' '}
            {t('backup.where.noRecovery')}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--th)', fontFamily: 'var(--sans)' }}>
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

        {/* Proteger el archivo con contraseña (opcional) */}
        <div style={{ ...srow, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          {/* width:auto: el `input { width: 100% }` global estiraba la casilla y
              empujaba el texto a la derecha (R10). Fila de 44 px tocable entera. */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, ...slbl, cursor: 'pointer' }}>
            <input type="checkbox" checked={encOn} onChange={e => setEncOn(e.target.checked)} style={{ width: 18, height: 18, margin: 0, padding: 0, flexShrink: 0 }} />
            {t('backup.enc.toggle')}
          </label>
          <div style={ssub}>{t('backup.enc.hint')}</div>
          {encOn && (
            <input
              type="password"
              value={encPass}
              onChange={e => setEncPass(e.target.value)}
              autoComplete="new-password"
              aria-label={t('backup.enc.label', { n: MIN_PASSPHRASE_LENGTH })}
              placeholder={t('backup.enc.label', { n: MIN_PASSPHRASE_LENGTH })}
              style={{ padding: '8px 10px', borderRadius: 6, border: '0.5px solid var(--brd2)', background: 'var(--sur)', color: 'var(--tx)', fontSize: 13 }}
            />
          )}
        </div>

        {/* Abrir un respaldo cifrado */}
        {encText && (
          <div role="group" aria-label={t('backup.enc.askTitle')} style={{ padding: '14px 16px', background: 'var(--fill)', border: 0, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={slbl}>{t('backup.enc.askTitle')}</div>
            <div style={ssub}>{t('backup.enc.askBody', { file: encName })}</div>
            <input
              type="password"
              value={openPass}
              onChange={e => setOpenPass(e.target.value)}
              autoComplete="current-password"
              aria-label={t('backup.enc.askLabel')}
              placeholder={t('backup.enc.askLabel')}
              style={{ padding: '8px 10px', borderRadius: 6, border: '0.5px solid var(--brd2)', background: 'var(--sur)', color: 'var(--tx)', fontSize: 13 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleOpenEncrypted} disabled={importing || !openPass} style={{ ...btn('primary'), opacity: importing || !openPass ? 0.6 : 1 }}>{t('backup.enc.open')}</button>
              <button onClick={() => { setEncText(null); setOpenPass('') }} style={btn('default')}>{t('common.cancel')}</button>
            </div>
          </div>
        )}

        {/* Restaurar respaldo */}
        <div style={{ ...srow, borderBottom: 'none' }}>
          <div style={{ flex: 1 }}>
            <div style={slbl}>{t('backup.restore.title')}</div>
            <div style={ssub}>
              {t('backup.restore.sub')}<br />
              <span style={{ color: 'var(--amb)' }}><InlineIcon kind="alert" size={13} />{t('backup.restore.warn')}</span>
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
              accept=".json,.txt,application/json,text/plain"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
              disabled={importing}
            />
          </label>
        </div>

        {/* ── CLOUD SYNC ── */}
        {CLOUD_ENABLED && (
          <div style={{ marginTop: 8, padding: '16px', background: 'var(--fill)', border: 0, borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)', marginBottom: 2 }}>☁ {t('backup.cloud.title')}</div>
                <div style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--sans)' }}>
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
            <div style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--sans)', lineHeight: 1.5 }}>
              {t('backup.cloud.note')}
            </div>
          </div>
        )}

        {/* Mensaje de estado */}
        {status && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, fontSize: 11,
            fontFamily: 'var(--sans)', lineHeight: 1.5,
            background: status.type === 'ok' ? 'var(--pos-bg)' : status.type === 'error' ? 'var(--red-bg)' : 'var(--amb-bg)',
            color: status.type === 'ok' ? 'var(--pos)' : status.type === 'error' ? 'var(--red)' : 'var(--amb)',
            border: 0,
          }}>
            <InlineIcon kind={status.type === 'ok' ? 'ok' : 'alert'} size={13} />{status.msg}
          </div>
        )}

      </div>
    </>
  )
}
