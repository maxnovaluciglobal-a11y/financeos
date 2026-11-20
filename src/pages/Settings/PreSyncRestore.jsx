// src/pages/Settings/PreSyncRestore.jsx — copia previa a la última
// sincronización (G1-N4). Antes de aplicar datos de otro dispositivo, el sync
// guarda la foto local en el store 'backups'; acá se puede volver a ella.
// Restaurar pide confirmación (reemplaza los datos, y con el sync activo
// también en la nube).
import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { Btn } from '../../components/ui/index.jsx'
import { listSnapshots, restoreSnapshot, PRE_SYNC_SNAPSHOT_ID } from '../../core/db/index.js'
import { dateLocale } from '../../utils/index.js'
import { logRejection } from '../../utils/errorLog.js'
import { snapshotRecordCount } from './syncStatusText.js'

export default function PreSyncRestore() {
  const { settings, rehydrate, showToast, syncState } = useApp()
  const { t } = useT()
  const [snap, setSnap] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  // Se relee después de cada sync que salió bien: la copia se reemplaza.
  const okAt = syncState?.state === 'ok' ? syncState.at : 0
  useEffect(() => {
    if (settings?.isDemo) return
    let alive = true
    listSnapshots()
      .then(list => { if (alive) setSnap(list.find(x => x.id === PRE_SYNC_SNAPSHOT_ID) || null) })
      .catch(logRejection('PreSyncRestore:list'))
    return () => { alive = false }
  }, [settings?.isDemo, okAt])
  const n = snapshotRecordCount(snap?.counts)
  if (!snap || n === 0) return null
  let when = ''
  try { when = new Date(snap.createdAt).toLocaleString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { /* idioma no soportado: queda vacío */ }

  async function restore() {
    setBusy(true)
    try {
      await restoreSnapshot(PRE_SYNC_SNAPSHOT_ID)
      // Sin notLocalChange: lo restaurado cuenta como cambio y se sincroniza.
      await rehydrate?.()
      showToast?.(t('settings.presync.done'), 'ok')
    } catch { showToast?.(t('settings.presync.error'), 'error') }
    setBusy(false)
    setConfirming(false)
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '.5px solid var(--brd)' }}>
      <div style={{ fontSize: 'var(--t-subhead)', fontWeight: 600, color: 'var(--tx)', marginBottom: 2 }}>{t('settings.presync.title')}</div>
      <p style={{ fontSize: 'var(--t-footnote)', color: 'var(--tm)', lineHeight: 1.6, margin: '0 0 8px' }}>{t('settings.presync.desc', { date: when, n })}</p>
      {confirming ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--t-footnote)', color: 'var(--tx)', flex: '1 1 220px' }}>{t('settings.presync.confirm')}</span>
          <Btn variant="danger" size="sm" onClick={restore} disabled={busy}>{t('settings.presync.btn')}</Btn>
          <Btn variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={busy}>{t('common.cancel')}</Btn>
        </div>
      ) : (
        <Btn variant="ghost" size="sm" onClick={() => setConfirming(true)}>{t('settings.presync.btn')}</Btn>
      )}
    </div>
  )
}
