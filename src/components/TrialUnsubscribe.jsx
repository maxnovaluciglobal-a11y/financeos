// src/components/TrialUnsubscribe.jsx — página de baja de los correos de la
// prueba de Pro (C-35 / COM-10). Sin sesión ni datos locales: solo el id del
// enlace (se monta FUERA de AppProvider: nada de useT/useApp). Pide confirmar con un botón (un escáner de enlaces no da de baja a nadie).
import { useState } from 'react'
import { useTFor } from '../i18n/useT.js'
import { detectLanguage } from '../i18n/translate.js'
import Logo from './Logo.jsx'
import { unsubscribeTrial } from '../utils/trialUnsubscribe.js'

export default function TrialUnsubscribe({ id }) {
  // Fuera de AppProvider (como DemoGate): idioma del navegador.
  const [lang] = useState(() => detectLanguage())
  const { t } = useTFor(lang)
  const [state, setState] = useState('idle') // idle | sending | done | error
  const onConfirm = async () => {
    setState('sending')
    setState((await unsubscribeTrial(id)) ? 'done' : 'error')
  }
  return (
    <main aria-labelledby="unsub-title" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)' }}>
      <div style={{ maxWidth: 440, width: '100%', background: 'var(--sur)', border: '.5px solid var(--brd)', borderRadius: 'var(--rxl)', boxShadow: 'var(--sh-2)', padding: '28px 24px' }}>
        <div style={{ marginBottom: 18 }}><Logo size={28} /></div>
        <h1 id="unsub-title" className="display" style={{ fontSize: 22, fontWeight: 600, color: 'var(--tx)', margin: '0 0 10px' }}>{t('unsub.trial.title')}</h1>
        <p role="status" aria-live="polite" style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--tm)', margin: '0 0 20px' }}>
          {state === 'done' ? t('unsub.trial.done') : state === 'error' ? t('unsub.trial.error') : t('unsub.trial.body')}
        </p>
        {state !== 'done' && (
          <button type="button" className="fos-btn-primary" disabled={state === 'sending'} onClick={onConfirm}>{t('unsub.trial.btn')}</button>
        )}
      </div>
    </main>
  )
}
