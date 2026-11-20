// src/components/backup/SyncErrorNotice.jsx — aviso en el Inicio cuando el
// sync falló (sin conexión, sesión vencida, frase de paso…): antes el error
// solo quedaba en el log local (auditoría 360, G1-N3). Se va solo cuando un
// sync sale bien; "Reintentar ahora" lo prueba enseguida. En los bloqueos
// (frase de paso, clave…) reintentar no sirve: el botón lleva a Ajustes › Datos.
import { useState } from 'react'
import { CloudOff } from 'lucide-react'
import rs from './BackupReminder.module.css'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { isSyncEnabled } from '../../core/sync.js'
import { syncStatusKey, isSyncBlocked } from '../../pages/Settings/syncStatusText.js'
import { requestSettingsSub } from '../../pages/Settings/settingsIndex.js'

export default function SyncErrorNotice({ setPage }) {
  const { settings, syncState, runSync } = useApp()
  const { t } = useT()
  const [busy, setBusy] = useState(false)
  if (settings?.isDemo || !isSyncEnabled() || syncState?.state !== 'error') return null
  // Bloqueos por frase de paso o por la clave: el texto vive en Ajustes.
  const key = syncStatusKey(syncState)
  const blocked = isSyncBlocked(syncState)

  async function retry() {
    setBusy(true)
    try { await runSync?.() } finally { setBusy(false) }
  }

  return (
    <div className={rs.strip} role="status" aria-label={t('settings.syncStatus.aria')}>
      <div className={rs.msg}>
        <CloudOff size={18} strokeWidth={1.7} aria-hidden="true" />
        <span>{t(key)}</span>
      </div>
      <div className={rs.actions}>
        {blocked
          ? setPage && <button type="button" className={rs.cta} onClick={() => { requestSettingsSub('data'); setPage('settings') }}>{t('settings.syncStatus.openSettings')}</button>
          : <button type="button" className={rs.cta} onClick={retry} disabled={busy}>{t('settings.syncStatus.retry')}</button>}
      </div>
    </div>
  )
}
