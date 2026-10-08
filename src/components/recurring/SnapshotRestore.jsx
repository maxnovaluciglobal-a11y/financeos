// src/components/recurring/SnapshotRestore.jsx — copia local previa a los
// movimientos fijos (migración v4). Solo aparece si existe en este
// dispositivo. Restaurar pide confirmación en dos pasos (reemplaza los datos).
import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { Btn } from '../ui/index.jsx'
import { listSnapshots, restoreSnapshot } from '../../core/db/index.js'
import { PRE_RECURRING_SNAPSHOT_ID } from '../../core/db/migrations.js'
import { dateLocale } from '../../utils/index.js'

export default function SnapshotRestore() {
  const { settings, rehydrate, showToast } = useApp()
  const { t } = useT()
  const [snap, setSnap] = useState(null)
  const [confirming, setConfirming] = useState(false)
  useEffect(() => {
    if (settings?.isDemo) return
    listSnapshots().then(list => setSnap(list.find(x => x.id === PRE_RECURRING_SNAPSHOT_ID) || null)).catch(() => {})
  }, [settings?.isDemo])
  if (!snap) return null
  let when = ''
  try { when = new Date(snap.createdAt).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' }) } catch {}

  async function restore() {
    try {
      await restoreSnapshot(PRE_RECURRING_SNAPSHOT_ID)
      await rehydrate?.()
      showToast?.(t('rec.restore.done'), 'ok')
    } catch { showToast?.(t('rec.restore.error'), 'error') }
    setConfirming(false)
  }

  return (
    <div style={{ borderTop: '.5px solid var(--brd)', marginTop: 14, paddingTop: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)', marginBottom: 2 }}>{t('rec.restore.title')}</div>
      <p style={{ fontSize: 12, color: 'var(--th)', lineHeight: 1.5, margin: '0 0 8px' }}>{t('rec.restore.desc', { date: when })}</p>
      {confirming ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--tx)', flex: '1 1 220px' }}>{t('rec.restore.confirm')}</span>
          <Btn variant="primary" size="sm" onClick={restore}>{t('rec.restore.btn')}</Btn>
          <Btn variant="ghost" size="sm" onClick={() => setConfirming(false)}>{t('common.cancel')}</Btn>
        </div>
      ) : (
        <Btn variant="ghost" size="sm" onClick={() => setConfirming(true)}>{t('rec.restore.btn')}</Btn>
      )}
    </div>
  )
}
