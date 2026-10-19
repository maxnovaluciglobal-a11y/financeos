// src/components/FeedbackSheet.jsx — "Enviar comentarios" del Menú
// (auditoría 360, C-39 / PRD-5): texto libre, NPS 0–10 opcional y casilla para
// adjuntar el registro técnico (sin montos). Llega a support@moyiq.app.
import { useRef, useState } from 'react'
import Sheet from './ui/Sheet.jsx'
import { useT } from '../i18n/useT.js'
import { useApp } from '../context/AppContext.jsx'
import { getSession } from '../core/auth.js'
import { sendFeedback } from '../core/feedback.js'
import { getLicensePlan } from '../utils/licenseValidator.js'
import config from '../config.js'

const NPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export default function FeedbackSheet({ open, onClose }) {
  const { t, lang } = useT()
  const { settings } = useApp()
  const [message, setMessage] = useState('')
  const [nps, setNps] = useState(null)
  const [includeLog, setIncludeLog] = useState(false)
  const [state, setState] = useState('idle') // idle | sending | sent | error
  const [error, setError] = useState('')
  const textRef = useRef(null)

  function close() {
    onClose?.()
    if (state === 'sent') { setMessage(''); setNps(null); setIncludeLog(false); setState('idle') }
  }

  async function submit(e) {
    e.preventDefault()
    if (!message.trim() || state === 'sending') return
    setState('sending'); setError('')
    const session = await getSession()
    const r = await sendFeedback({
      accessToken: session?.access_token, message: message.trim(), nps, includeLog,
      meta: { version: config.app?.version || '', lang, country: settings.country || '', plan: getLicensePlan() },
    })
    if (r.ok) { setState('sent'); return }
    setState('error')
    setError(t(r.error === 'rate_limited' ? 'feedback.errorLimit' : r.error === 'session_required' ? 'feedback.errorSession' : 'feedback.errorGeneric'))
  }

  const label = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--tx)', marginBottom: 6 }
  return (
    <Sheet open={open} onClose={close} ariaLabel={t('feedback.title')} maxWidth={480} initialFocusRef={textRef}>
      <h2 style={{ margin: '0 0 6px', fontFamily: 'var(--display)', fontSize: 20, fontWeight: 700, color: 'var(--tx)' }}>{t('feedback.title')}</h2>
      {state === 'sent' ? (
        <>
          <p role="status" style={{ fontSize: 14, color: 'var(--tm)', lineHeight: 1.55, margin: '0 0 16px' }}>{t('feedback.sent')}</p>
          <button type="button" className="fos-btn-primary" onClick={close} style={{ width: '100%' }}>{t('feedback.close')}</button>
        </>
      ) : (
        <form onSubmit={submit}>
          <p style={{ fontSize: 13, color: 'var(--tm)', lineHeight: 1.55, margin: '0 0 14px' }}>{t('feedback.intro')}</p>
          <label htmlFor="feedback-message" style={label}>{t('feedback.messageLabel')}</label>
          <textarea
            id="feedback-message" ref={textRef} value={message} onChange={(e) => setMessage(e.target.value)}
            rows={5} maxLength={2000} required
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 16, fontFamily: 'var(--sans)', border: '1px solid var(--brd)', borderRadius: 8, background: 'var(--bg)', color: 'var(--tx)', resize: 'vertical', marginBottom: 14 }}
          />
          <fieldset style={{ border: 'none', padding: 0, margin: '0 0 14px' }}>
            <legend style={{ ...label, padding: 0 }}>{t('feedback.npsLabel')}</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 4 }}>
              {NPS.map((n) => (
                <button
                  key={n} type="button" className="fos-chip" aria-pressed={nps === n}
                  onClick={() => setNps(nps === n ? null : n)}
                  style={{ minWidth: 0, minHeight: 44, padding: 0, justifyContent: 'center' }}
                >{n}</button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--th)', marginTop: 4 }}>
              <span>{t('feedback.npsLow')}</span><span>{t('feedback.npsHigh')}</span>
            </div>
          </fieldset>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--tm)', lineHeight: 1.5, marginBottom: 16, cursor: 'pointer' }}>
            <input type="checkbox" checked={includeLog} onChange={(e) => setIncludeLog(e.target.checked)} style={{ marginTop: 3, width: 18, height: 18 }} />
            <span>{t('feedback.logLabel')}</span>
          </label>
          {error && <p role="alert" style={{ fontSize: 13, color: 'var(--red)', margin: '0 0 12px' }}>{error}</p>}
          <button type="submit" className="fos-btn-primary" disabled={!message.trim() || state === 'sending'} style={{ width: '100%' }}>
            {state === 'sending' ? t('feedback.sending') : t('feedback.send')}
          </button>
          <p style={{ fontSize: 12, color: 'var(--th)', margin: '10px 0 0', lineHeight: 1.5 }}>{t('feedback.privacy')}</p>
        </form>
      )}
    </Sheet>
  )
}
