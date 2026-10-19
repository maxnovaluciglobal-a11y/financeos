// src/pages/Settings/DiagnosticsRow.jsx — "Copiar registro de errores" (D-16).
import { useState } from 'react'
import { Btn } from '../../components/ui/index.jsx'
import { useT } from '../../i18n/useT.js'
import config from '../../config.js'
import { buildDiagnostics, copyDiagnostics } from '../../core/diagnostics.js'

export default function DiagnosticsRow({ rowStyle, labelStyle, subStyle }) {
  const { t, lang } = useT()
  const [status, setStatus] = useState('')
  const onCopy = async () => {
    const text = buildDiagnostics({ version: config.app?.version || '', lang, userAgent: navigator.userAgent })
    setStatus((await copyDiagnostics(text)) ? t('settings.diagnostics.copied') : t('settings.diagnostics.copyFailed'))
  }
  return (
    <div style={rowStyle}>
      <div>
        <div style={labelStyle}>{t('settings.diagnostics.label')}</div>
        <div style={subStyle}>{t('settings.diagnostics.sub')}</div>
        <div role="status" aria-live="polite" style={{ ...subStyle, color: 'var(--tm)' }}>{status}</div>
      </div>
      <Btn variant="ghost" size="sm" onClick={onCopy}>{t('settings.diagnostics.btn')}</Btn>
    </div>
  )
}
