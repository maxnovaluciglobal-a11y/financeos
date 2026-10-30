// Sincronización entre dispositivos en Ajustes (C-21 / D-05).
// - Activar desde cero pide crear una frase de paso (v2).
// - Si la nube ya tiene una copia con frase, la pide para este dispositivo.
// - Quien ya sincronizaba con la licencia (v1) sigue igual hasta que elige
//   "Proteger con frase de paso": primero descarga un respaldo, después la
//   migración sube la copia nueva y la verifica (si falla, la nube queda como
//   estaba). Desde v2 se puede volver a la licencia (rollback).
import { useState } from 'react'
import { Lock } from 'lucide-react'
import { Btn } from '../../components/ui/index.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { getLicenseKey, validateLicense, isLicenseHash } from '../../utils/licenseValidator.js'
import {
  isSyncEnabled, syncMeta, syncAvailable, syncMode, migrateToPassphrase, rollbackToLicenseKey,
  unlockWithPassphrase, pullAndApplyIfNewer,
} from '../../core/sync.js'
import { MIN_PASSPHRASE_LENGTH, normalizePassphrase } from '../../utils/syncCrypto.js'

export function passphraseProblem(pass, confirm, isNew) {
  if (normalizePassphrase(pass).length < MIN_PASSPHRASE_LENGTH) return 'syncPass.errShort'
  if (isNew && pass !== confirm) return 'syncPass.errMismatch'
  return null
}

const sub = { fontSize: 12, color: 'var(--tm)', lineHeight: 1.6, marginTop: 4 }
const input = { width: '100%', maxWidth: 360, boxSizing: 'border-box', padding: '10px 12px', fontSize: 16, border: '1px solid var(--brd)', borderRadius: 8, background: 'var(--bg)', color: 'var(--tx)', marginBottom: 8 }
const lbl = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--tx)', marginBottom: 4 }
const box = { marginTop: 10, padding: '12px', background: 'var(--sur2)', borderRadius: 'var(--r)', border: '0.5px solid var(--brd)' }

function PassphraseForm({ id, isNew, busy, error, onSubmit, submitLabel, onCancel }) {
  const { t } = useT()
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [local, setLocal] = useState('')
  function submit(e) {
    e.preventDefault()
    const p = passphraseProblem(pass, confirm, isNew)
    if (p) { setLocal(t(p, { n: MIN_PASSPHRASE_LENGTH })); return }
    setLocal('')
    onSubmit(pass)
  }
  const err = local || error
  return (
    <form onSubmit={submit} style={{ marginTop: 8 }}>
      <label htmlFor={`${id}-pass`} style={lbl}>{t(isNew ? 'syncPass.newLabel' : 'syncPass.label')}</label>
      <input id={`${id}-pass`} type="password" value={pass} onChange={(e) => setPass(e.target.value)} style={input}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- the user just opened the sync passphrase form; focus moves into its field
        autoComplete={isNew ? 'new-password' : 'current-password'} aria-describedby={`${id}-hint`} autoFocus />
      {isNew && (
        <>
          <label htmlFor={`${id}-confirm`} style={lbl}>{t('syncPass.confirmLabel')}</label>
          <input id={`${id}-confirm`} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={input} autoComplete="new-password" />
        </>
      )}
      <p id={`${id}-hint`} style={{ ...sub, marginTop: 0, marginBottom: 8 }}>
        {t(isNew ? 'syncPass.newHint' : 'syncPass.hint', { n: MIN_PASSPHRASE_LENGTH })}
      </p>
      {err && <p role="alert" style={{ ...sub, color: 'var(--red)', marginBottom: 8 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Btn variant="primary" size="sm" type="submit" disabled={busy}>{busy ? t('syncPass.working') : submitLabel}</Btn>
        {onCancel && <Btn variant="ghost" size="sm" type="button" onClick={onCancel} disabled={busy}>{t('common.cancel')}</Btn>}
      </div>
    </form>
  )
}

export default function SyncSection() {
  const { enableSync, disableSync, exportData, rehydrate, showToast, syncBlocked, setSyncBlocked } = useApp()
  const { t } = useT()
  const [on, setOn] = useState(isSyncEnabled())
  const [busy, setBusy] = useState(false)
  const [need, setNeed] = useState(null)        // 'new_passphrase' | 'passphrase' | 'license_key' | null
  const [error, setError] = useState('')
  const [migrating, setMigrating] = useState(false)
  const [backupDone, setBackupDone] = useState(false)
  const [confirmRollback, setConfirmRollback] = useState(false)
  const [licenseInput, setLicenseInput] = useState('')
  const [, setTick] = useState(0)
  const refresh = () => setTick((n) => n + 1)

  const available = syncAvailable()
  const hasKey = !!getLicenseKey()
  const rawLicense = hasKey && !isLicenseHash(getLicenseKey())
  const mode = syncMode()
  const meta = syncMeta()
  const lastSync = meta.lastPushedAt || meta.lastPulledAt
  const lastTxt = lastSync ? new Date(lastSync).toLocaleString() : '—'
  const errText = (code) => t(code === 'wrong_key' ? 'syncPass.errWrong'
    : code === 'passphrase_too_short' ? 'syncPass.errShort'
    : code === 'verify_failed' ? 'syncPass.errVerify'
    : code === 'license_key_required' ? 'syncPass.errLicense'
    : 'syncPass.errGeneric', { n: MIN_PASSPHRASE_LENGTH })

  async function start(passphrase) {
    setBusy(true); setError('')
    try {
      const r = await enableSync(passphrase ? { passphrase } : undefined)
      if (r?.ok) { setOn(true); setNeed(null) }
      else if (r?.need) setNeed(r.need)
      else if (r?.error) setError(errText(r.error))
    } finally { setBusy(false); refresh() }
  }

  async function useLicense(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      if (!(await validateLicense(licenseInput))) { setError(t('syncPass.errLicenseInvalid')); return }
      setNeed(null)
    } finally { setBusy(false) }
    await start()
  }

  async function migrate(passphrase) {
    setBusy(true); setError('')
    try {
      await migrateToPassphrase(passphrase, { onApplied: () => rehydrate({ notLocalChange: true }) })
      setMigrating(false)
      showToast(t('syncPass.migrated'), 'ok')
    } catch (e) {
      setError(errText(String(e?.message || '')))
    } finally { setBusy(false); refresh() }
  }

  async function rollback() {
    setBusy(true); setError('')
    try {
      await rollbackToLicenseKey()
      setConfirmRollback(false)
      showToast(t('syncPass.rolledBack'), 'ok')
    } catch (e) {
      setError(errText(String(e?.message || '')))
    } finally { setBusy(false); refresh() }
  }

  async function unlock(passphrase) {
    setBusy(true); setError('')
    try {
      await unlockWithPassphrase(passphrase)
      const r = await pullAndApplyIfNewer(() => rehydrate({ notLocalChange: true }))
      setSyncBlocked(r?.blocked || null)
      if (!r?.blocked) showToast(t('syncPass.unlocked'), 'ok')
    } catch (e) {
      setError(errText(String(e?.message || '')))
    } finally { setBusy(false); refresh() }
  }

  async function backup() {
    try { await exportData(); setBackupDone(true) } catch { setError(t('syncPass.errBackup')) }
  }

  function toggleOff() { disableSync(); setOn(false); setMigrating(false); setNeed(null); refresh() }

  if (!hasKey) return <div style={sub}>{t('settings.sync.noLicense')}</div>
  if (!available) return <div style={sub}>{t('settings.sync.unavailable')}</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 200px' }}>
          <div style={{ fontSize: 13, color: 'var(--tx)', fontWeight: 500 }}>{on ? t('settings.sync.on') : t('settings.sync.off')}</div>
          <div style={sub}>{on ? t('settings.sync.lastSync', { time: lastTxt }) : t('settings.sync.offDesc')}</div>
        </div>
        {on
          ? <Btn variant="ghost" onClick={toggleOff} disabled={busy} aria-label={`${t('settings.sync.disable')} · ${t('settings.sync.title')}`}>{t('settings.sync.disable')}</Btn>
          : !need && <Btn variant="ghost" onClick={() => start()} disabled={busy} aria-label={`${busy ? t('settings.sync.busy') : t('settings.sync.enable')} · ${t('settings.sync.title')}`}>{busy ? t('settings.sync.busy') : t('settings.sync.enable')}</Btn>}
      </div>

      {!on && need === 'new_passphrase' && (
        <div style={box}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>{t('syncPass.newTitle')}</div>
          <p style={sub}>{t('syncPass.newBody')}</p>
          <PassphraseForm id="sync-new" isNew busy={busy} error={error} onSubmit={start} submitLabel={t('syncPass.newSubmit')} onCancel={() => { setNeed(null); setError('') }} />
        </div>
      )}
      {!on && need === 'passphrase' && (
        <div style={box}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>{t('syncPass.askTitle')}</div>
          <p style={sub}>{t('syncPass.askBody')}</p>
          <PassphraseForm id="sync-ask" busy={busy} error={error} onSubmit={start} submitLabel={t('syncPass.askSubmit')} onCancel={() => { setNeed(null); setError('') }} />
        </div>
      )}
      {!on && need === 'license_key' && (
        <form onSubmit={useLicense} style={box}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>{t('syncPass.licenseTitle')}</div>
          <p style={sub}>{t('syncPass.licenseBody')}</p>
          <label htmlFor="sync-license" style={{ ...lbl, marginTop: 8 }}>{t('syncPass.licenseLabel')}</label>
          <input id="sync-license" value={licenseInput} onChange={(e) => setLicenseInput(e.target.value)} style={input} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="FNOS-XXXX-XXXX-XXXX" />
          {error && <p role="alert" style={{ ...sub, color: 'var(--red)' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn variant="primary" size="sm" type="submit" disabled={busy || !licenseInput.trim()}>{t('syncPass.licenseSubmit')}</Btn>
            <Btn variant="ghost" size="sm" type="button" onClick={() => { setNeed(null); setError('') }}>{t('common.cancel')}</Btn>
          </div>
        </form>
      )}

      {on && syncBlocked === 'passphrase_required' && (
        <div style={{ ...box, borderColor: 'var(--laton)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>{t('syncPass.blockedTitle')}</div>
          <p style={sub}>{t('syncPass.blockedBody')}</p>
          <PassphraseForm id="sync-unlock" busy={busy} error={error} onSubmit={unlock} submitLabel={t('syncPass.askSubmit')} />
        </div>
      )}

      {on && syncBlocked && syncBlocked !== 'passphrase_required' && (
        <p role="status" style={{ ...box, ...sub, color: 'var(--tx)' }}>{t('syncPass.blockedOther')}</p>
      )}

      {on && mode === 'v1' && !syncBlocked && (
        <div style={{ ...box, borderColor: 'var(--laton)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>{t('syncPass.migrateTitle')}</div>
          <p style={sub}>{t('syncPass.migrateBody')}</p>
          {!migrating ? (
            <div style={{ marginTop: 8 }}>
              <Btn variant="ghost" size="sm" onClick={() => { setMigrating(true); setError('') }} aria-expanded={false} aria-controls="sync-migrate">{t('syncPass.migrateStart')}</Btn>
            </div>
          ) : (
            <div id="sync-migrate">
              <p style={{ ...sub, color: 'var(--tx)' }}>{t('syncPass.migrateStep1')}</p>
              <Btn variant="ghost" size="sm" onClick={backup}>{backupDone ? t('syncPass.backupDone') : t('syncPass.backupBtn')}</Btn>
              {backupDone && (
                <>
                  <p style={{ ...sub, color: 'var(--tx)', marginTop: 12 }}>{t('syncPass.migrateStep2')}</p>
                  <PassphraseForm id="sync-migrate-form" isNew busy={busy} error={error} onSubmit={migrate} submitLabel={t('syncPass.migrateSubmit')} onCancel={() => { setMigrating(false); setError('') }} />
                </>
              )}
              {!backupDone && error && <p role="alert" style={{ ...sub, color: 'var(--red)' }}>{error}</p>}
            </div>
          )}
        </div>
      )}

      {on && mode === 'v2' && rawLicense && (
        <div style={{ marginTop: 10 }}>
          {!confirmRollback ? (
            <button type="button" onClick={() => setConfirmRollback(true)} style={{ background: 'none', border: 'none', padding: '8px 0', minHeight: 44, color: 'var(--tm)', fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}>
              {t('syncPass.rollbackLink')}
            </button>
          ) : (
            <div style={box}>
              <p style={{ ...sub, color: 'var(--tx)', marginTop: 0 }}>{t('syncPass.rollbackConfirm')}</p>
              {error && <p role="alert" style={{ ...sub, color: 'var(--red)' }}>{error}</p>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn variant="danger" size="sm" onClick={rollback} disabled={busy}>{t('syncPass.rollbackBtn')}</Btn>
                <Btn variant="ghost" size="sm" onClick={() => { setConfirmRollback(false); setError('') }} disabled={busy}>{t('common.cancel')}</Btn>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ ...sub, marginTop: 10, padding: '8px 10px', background: 'var(--sur2)', borderRadius: 'var(--r)', border: '0.5px solid var(--brd)' }}>
        <Lock size={12} strokeWidth={1.7} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 5, flexShrink: 0 }} />
        {t(mode === 'v2' ? 'syncPass.e2eV2' : 'settings.sync.e2e')}
      </div>
    </div>
  )
}
