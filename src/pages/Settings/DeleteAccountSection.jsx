// Borrar la cuenta (auditoría 360, C-22 / SEG-5). Confirmación fuerte: primero
// se ofrece el respaldo, después hay que escribir la palabra de confirmación
// del idioma; recién ahí se habilita el botón. Lo hace core/deleteAccount.js.
import { useEffect, useRef, useState } from 'react'
import { Btn } from '../../components/ui/index.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { getSession, signOutAuth } from '../../core/auth.js'
import { requestAccountDeletion, wipeAccountFromDevice } from '../../core/deleteAccount.js'
import { getLicensePlan } from '../../utils/licenseValidator.js'
import { cancelUrl } from '../../utils/cancelUrl.js'
import { logClientError } from '../../utils/errorLog.js'

export const DELETED_FLAG = 'fnos_account_deleted'

export function confirmMatches(typed, word) {
  return String(typed || '').trim().toLocaleUpperCase() === String(word || '').toLocaleUpperCase()
}

export default function DeleteAccountSection({ autoOpen = false }) {
  const { exportData } = useApp()
  const { t, lang } = useT()
  const [open, setOpen] = useState(autoOpen)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [exported, setExported] = useState(false)
  const inputRef = useRef(null)
  const cardRef = useRef(null)
  const word = t('deleteAccount.confirmWord')
  const isPro = getLicensePlan() === 'pro'
  const ready = confirmMatches(typed, word) && !busy

  useEffect(() => { if (open && !autoOpen) inputRef.current?.focus() }, [open, autoOpen])
  // Desde el enlace público (?open=delete-account) la página recién se monta y
  // Shell mueve el foco al título: esperar a que termine la transición.
  useEffect(() => {
    if (!autoOpen) return
    const id = setTimeout(() => {
      cardRef.current?.scrollIntoView?.({ block: 'start' })
      inputRef.current?.focus({ preventScroll: true })
    }, 400)
    return () => clearTimeout(id)
  }, [autoOpen])

  async function handleExport() {
    try { await exportData(); setExported(true) } catch { setError(t('deleteAccount.exportError')) }
  }

  async function handleDelete() {
    if (!ready) return
    setBusy(true)
    setError('')
    const session = await getSession()
    const uid = session?.user?.id
    const r = await requestAccountDeletion(session?.access_token)
    if (!r.ok) {
      setBusy(false)
      setError(r.error === 'session_required' ? t('deleteAccount.errorSession') : t('deleteAccount.errorGeneric'))
      return
    }
    try { sessionStorage.setItem(DELETED_FLAG, '1') } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ }
    await wipeAccountFromDevice(uid)
    try { await signOutAuth() } catch (e) { logClientError({ type: 'swallowed', message: String(e?.message || e), source: 'deleteAccount.signOut' }) }
    window.location.reload()
  }

  const p = { fontSize: 13, color: 'var(--tm)', lineHeight: 1.6, margin: '0 0 10px' }
  return (
    // R10: vive en Ajustes › Zona de riesgo, separado por una línea (sin caja).
    <div id="delete-account" ref={cardRef} style={{ borderTop: '1px solid var(--brd2)', paddingTop: 14 }}>
      <h3 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>{t('deleteAccount.title')}</h3>
      <p style={p}>{t('deleteAccount.what')}</p>
      <p style={p}>{t('deleteAccount.kept')}</p>
      {isPro && (
        <p style={{ ...p, color: 'var(--tx)' }}>
          {t('deleteAccount.proWarning')}{' '}
          <a href={cancelUrl(lang)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--tx)' }}>{t('deleteAccount.proCancelLink')}</a>
        </p>
      )}
      {!open ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant="ghost" size="sm" onClick={handleExport}>{exported ? t('deleteAccount.exportDone') : t('deleteAccount.exportBtn')}</Btn>
          <Btn variant="danger" size="sm" onClick={() => setOpen(true)} aria-expanded={false} aria-controls="delete-account-confirm">{t('deleteAccount.startBtn')}</Btn>
        </div>
      ) : (
        <div id="delete-account-confirm" style={{ padding: '12px', border: '1px solid var(--red)', borderRadius: 8, background: 'var(--red-bg)' }}>
          <p style={{ ...p, color: 'var(--tx)' }}>{t('deleteAccount.irreversible')}</p>
          {!exported && (
            <div style={{ marginBottom: 10 }}>
              <Btn variant="ghost" size="sm" onClick={handleExport}>{t('deleteAccount.exportBtn')}</Btn>
            </div>
          )}
          <label htmlFor="delete-account-word" style={{ display: 'block', fontSize: 13, color: 'var(--tx)', marginBottom: 6 }}>
            {t('deleteAccount.typeLabel', { word })}
          </label>
          <input
            id="delete-account-word"
            ref={inputRef}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleDelete() }}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-describedby={error ? 'delete-account-error' : undefined}
            style={{ width: '100%', maxWidth: 260, padding: '10px 12px', fontSize: 16, border: '1px solid var(--brd)', borderRadius: 8, background: 'var(--bg)', color: 'var(--tx)', boxSizing: 'border-box', marginBottom: 10 }}
          />
          {error && <p id="delete-account-error" role="alert" style={{ ...p, color: 'var(--red)' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn variant="danger" size="sm" onClick={handleDelete} disabled={!ready} aria-disabled={!ready}>
              {busy ? t('deleteAccount.deleting') : t('deleteAccount.confirmBtn')}
            </Btn>
            <Btn variant="ghost" size="sm" onClick={() => { setOpen(false); setTyped(''); setError('') }} disabled={busy}>{t('common.cancel')}</Btn>
          </div>
        </div>
      )}
    </div>
  )
}
