// src/pages/Settings/NotificationsScreen.jsx — Ajustes › Notificaciones (R10, rial #55).
// Un canal por fila con una frase de qué envía. Hoy hay un solo canal que se
// puede encender o apagar: los avisos push de este dispositivo (opt-in, ligados
// a la licencia). No se agregan canales nuevos.
import { useState } from 'react'
import { Btn } from '../../components/ui/index.jsx'
import StateTag from '../../components/ledger/StateTag.jsx'
import { useT } from '../../i18n/useT.js'
import { getLicenseKey } from '../../utils/licenseValidator.js'
import { pushSupported, isPushEnabled, enablePush, disablePush } from '../../core/push.js'
import { srow, slbl, ssub, Setting } from './settingsUi.jsx'

export default function NotificationsScreen() {
  const { t } = useT()
  const [on, setOn]     = useState(isPushEnabled())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg]   = useState('')
  const hasKey    = !!getLicenseKey()
  const supported = pushSupported()

  async function toggle() {
    if (busy) return
    setBusy(true); setMsg('')
    try {
      if (on) {
        await disablePush()
        setOn(false)
      } else {
        const r = await enablePush()
        if (r.ok) { setOn(true) }
        else {
          setMsg(r.error === 'permission_denied'
            ? t('settings.push.permissionDenied')
            : t('settings.push.genericError'))
        }
      }
    } finally { setBusy(false) }
  }

  const actionLabel = busy ? t('settings.sync.busy') : on ? t('settings.sync.disable') : t('settings.sync.enable')

  return (
    <div>
      <Setting id="push" style={{ ...srow, borderBottom: 'none', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 220px' }}>
          <div style={slbl}>{t('settings.push.channel.title')}</div>
          <div style={{ ...ssub, lineHeight: 1.6, marginTop: 4 }}>{t('settings.push.channel.sends')}</div>
          <div style={{ marginTop: 8, fontSize: 12 }} role="status">
            {!hasKey ? <StateTag tone="muted" label={t('settings.push.noLicense')} />
              : !supported ? <StateTag tone="muted" label={t('settings.push.unsupported')} />
              : on ? <StateTag tone="ok" label={t('settings.push.state.on')} />
              : <StateTag tone="muted" label={t('settings.push.state.off')} />}
          </div>
          {msg && <div style={{ ...ssub, color: 'var(--neg)', marginTop: 8, lineHeight: 1.6 }}>{msg}</div>}
        </div>
        {hasKey && supported && (
          <Btn variant="ghost" onClick={toggle} disabled={busy} aria-label={`${actionLabel} · ${t('settings.push.channel.title')}`}>
            {actionLabel}
          </Btn>
        )}
      </Setting>
    </div>
  )
}
