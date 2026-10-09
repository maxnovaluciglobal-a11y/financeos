// src/components/PushAsk.jsx — hoja de pre-permiso de avisos (R09).
// Explica qué avisos son ANTES de que el navegador muestre su diálogo. "Ahora
// no" cierra sin llamar a Notification.requestPermission(); solo "Activar
// avisos" llama a enablePush() (core/push.js, el mismo de Ajustes). Se muestra
// una sola vez por dispositivo (core/pushAsk.js decide cuándo).
import { useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import Sheet from './ui/Sheet.jsx'
import { useT } from '../i18n/useT.js'
import { enablePush } from '../core/push.js'

export default function PushAsk({ open, onClose, onResult }) {
  const { t } = useT()
  const [busy, setBusy] = useState(false)
  const laterRef = useRef(null)

  async function activate() {
    setBusy(true)
    let r
    try { r = await enablePush() } catch { r = { ok: false, error: 'failed' } }
    setBusy(false)
    onResult?.(r)
    onClose?.()
  }

  return (
    <Sheet open={open} onClose={onClose} ariaLabel={t('pushAsk.title')} maxWidth={420} initialFocusRef={laterRef}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8, padding: '4px 4px 0' }}>
        <span aria-hidden="true" style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56,
          borderRadius: 'var(--rxl)', background: 'var(--grn-bg)', color: 'var(--grn)', marginBottom: 4,
        }}>
          <Bell size={26} strokeWidth={1.7} />
        </span>
        <h2 style={{ margin: 0, fontFamily: 'var(--display)', fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--tx)' }}>
          {t('pushAsk.title')}
        </h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--tm)', maxWidth: 340 }}>{t('pushAsk.body')}</p>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--th)', maxWidth: 340 }}>{t('pushAsk.privacy')}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
        <button type="button" className="fos-btn-primary" onClick={activate} disabled={busy} aria-busy={busy || undefined}>
          {t('pushAsk.enable')}
        </button>
        <button type="button" ref={laterRef} className="fos-btn-secondary" onClick={onClose} disabled={busy}>
          {t('pushAsk.later')}
        </button>
      </div>
    </Sheet>
  )
}
