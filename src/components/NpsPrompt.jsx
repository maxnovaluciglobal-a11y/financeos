// src/components/NpsPrompt.jsx — NPS automático (auditoría 360, PRD-5).
// Aparece una vez por cuenta, al día 14 desde el alta o a los 10 movimientos
// (utils/npsPrompt.js). La respuesta va a send-feedback (kind 'nps'): puntaje,
// comentario opcional y el motivo del disparo; nunca montos.
import { useEffect, useRef, useState } from 'react'
import Sheet from './ui/Sheet.jsx'
import { useT } from '../i18n/useT.js'
import { useApp } from '../context/AppContext.jsx'
import { getSession } from '../core/auth.js'
import { sendFeedback } from '../core/feedback.js'
import Turnstile from './Turnstile.jsx'
import { getLicensePlan } from '../utils/licenseValidator.js'
import { npsTrigger, closeNps } from '../utils/npsPrompt.js'
import { logClientError } from '../utils/errorLog.js'
import config from '../config.js'

const SCORES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const SHOW_DELAY_MS = 4000

export default function NpsPrompt({ createdAt }) {
  const { t, lang } = useT()
  // SEG-1: send-feedback verifica Turnstile (sin site key no hay widget ni token).
  const captcha = useRef(null)
  const { expenses = [], incomes = [], settings, loading } = useApp()
  const [trigger, setTrigger] = useState(null)
  const [score, setScore] = useState(null)
  const [comment, setComment] = useState('')
  const [state, setState] = useState('idle') // idle | sending | sent | error
  const firstRef = useRef(null)
  const movements = expenses.length + incomes.length

  useEffect(() => {
    if (loading || trigger || settings?.isDemo) return
    const why = npsTrigger({ createdAt, movements })
    if (!why) return
    const id = setTimeout(() => setTrigger(why), SHOW_DELAY_MS)
    return () => clearTimeout(id)
  }, [loading, createdAt, movements, trigger, settings?.isDemo])

  function dismiss() {
    closeNps(state === 'sent' ? 'answered' : 'dismissed', trigger)
    setTrigger('closed')
  }

  async function submit(e) {
    e.preventDefault()
    if (score == null || state === 'sending') return
    setState('sending')
    const session = await getSession()
    const turnstileToken = await captcha.current?.getToken()
    const r = await sendFeedback({
      kind: 'nps', accessToken: session?.access_token, nps: score, message: comment.trim(), turnstileToken,
      meta: { version: config.app?.version || '', lang, country: settings?.country || '', plan: getLicensePlan(), trigger },
    })
    captcha.current?.reset()
    if (r.ok || r.error === 'already_answered') {
      closeNps('answered', trigger)
      setState('sent')
      return
    }
    logClientError({ type: 'nps', message: `nps send failed: ${r.error}` })
    setState('error')
  }

  if (!trigger || trigger === 'closed') return null
  const label = { display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--tx)', marginBottom: 6 }
  return (
    <Sheet open onClose={dismiss} ariaLabel={t('nps.title')} maxWidth={480} initialFocusRef={firstRef}>
      <h2 style={{ margin: '0 0 6px', fontFamily: 'var(--display)', fontSize: 20, fontWeight: 700, color: 'var(--tx)' }}>{t('nps.title')}</h2>
      {state === 'sent' ? (
        <>
          <p role="status" style={{ fontSize: 14, color: 'var(--tm)', lineHeight: 1.55, margin: '0 0 16px' }}>{t('nps.thanks')}</p>
          <button type="button" className="fos-btn-primary" onClick={dismiss} style={{ width: '100%' }}>{t('nps.close')}</button>
        </>
      ) : (
        <form onSubmit={submit}>
          <fieldset style={{ border: 'none', padding: 0, margin: '0 0 14px' }}>
            <legend style={{ ...label, padding: 0, fontSize: 14, lineHeight: 1.5 }}>{t('nps.question')}</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 4 }}>
              {SCORES.map((n) => (
                <button
                  key={n} ref={n === 0 ? firstRef : undefined} type="button" className="fos-chip" aria-pressed={score === n}
                  onClick={() => setScore(score === n ? null : n)}
                  style={{ minWidth: 0, minHeight: 44, padding: 0, justifyContent: 'center' }}
                >{n}</button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--th)', marginTop: 4 }}>
              <span>{t('feedback.npsLow')}</span><span>{t('feedback.npsHigh')}</span>
            </div>
          </fieldset>
          <label htmlFor="nps-comment" style={label}>{t('nps.commentLabel')}</label>
          <textarea
            id="nps-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={2000}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 16, fontFamily: 'var(--sans)', border: '1px solid var(--brd)', borderRadius: 8, background: 'var(--bg)', color: 'var(--tx)', resize: 'vertical', marginBottom: 14 }}
          />
          <Turnstile ref={captcha} action="nps" errorText={t('authGate.errorCaptcha')} />
          {state === 'error' && <p role="alert" style={{ fontSize: 13, color: 'var(--red)', margin: '0 0 12px' }}>{t('nps.error')}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button type="button" className="fos-btn-secondary" onClick={dismiss}>{t('nps.later')}</button>
            <button type="submit" className="fos-btn-primary" disabled={score == null || state === 'sending'}>
              {state === 'sending' ? t('nps.sending') : t('nps.send')}
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--th)', margin: '10px 0 0', lineHeight: 1.5 }}>{t('nps.privacy')}</p>
        </form>
      )}
    </Sheet>
  )
}
