// src/components/backup/SafariStorageNotice.jsx — aviso único en Safari sin
// instalar (C-34 / META-6): Safari puede borrar los datos de un sitio que no se
// abre en 7 días. Se cierra una vez y no vuelve (clave de dispositivo).
import { useState, useEffect } from 'react'
import { ShieldAlert, X } from 'lucide-react'
import rs from './BackupReminder.module.css'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { shouldShowSafariNotice, safariNoticeDismissed, dismissSafariNotice, isStandaloneApp, requestPersistentStorage } from '../../utils/storagePersist.js'

export default function SafariStorageNotice() {
  const { settings, incomes, expenses } = useApp()
  const { t } = useT()
  const hasData = (incomes?.length || 0) + (expenses?.length || 0) > 0
  const [dismissed, setDismissed] = useState(() => safariNoticeDismissed())

  useEffect(() => { if (hasData && !settings?.isDemo) requestPersistentStorage() }, [hasData, settings?.isDemo])

  const show = !settings?.isDemo && shouldShowSafariNotice({
    ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    standalone: isStandaloneApp(),
    hasData,
    dismissed,
  })
  if (!show) return null

  function close() { dismissSafariNotice(); setDismissed(true) }

  return (
    <div className={rs.strip} role="region" aria-label={t('storage.safari.aria')}>
      <div className={rs.msg}>
        <ShieldAlert size={18} strokeWidth={1.7} aria-hidden="true" />
        <span>{t('storage.safari.body')}</span>
      </div>
      <div className={rs.actions}>
        <button type="button" className={rs.close} onClick={close} aria-label={t('storage.safari.dismiss')}>
          <X size={18} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
