// src/components/Turnstile.jsx — widget de Cloudflare Turnstile (SEG-1 / SEG-7).
// Sin VITE_TURNSTILE_SITE_KEY no renderiza nada ni carga scripts. Con clave: modo
// "interaction-only" (solo aparece si Cloudflare necesita que la persona haga clic) y un
// mensaje visible con role="alert" si la verificación falla.
//
// Uso: const ts = useRef(null); <Turnstile ref={ts} action="login" />
//      const token = await ts.current?.getToken()   // '' sin clave o si falló
//      ...enviar...; ts.current?.reset()             // cada token sirve una vez
//      errorText={t('authGate.errorCaptcha')}
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { TURNSTILE_SITE_KEY, loadTurnstile, createTokenBox } from '../core/turnstile.js'

// errorText: texto ya traducido (authGate.errorCaptcha). Va por prop porque DemoGate se monta
// antes de AppProvider y traduce con useTFor, no con useT.
const Turnstile = forwardRef(function Turnstile({ action, errorText, siteKey = TURNSTILE_SITE_KEY, showError = false }, ref) {
  const boxRef = useRef(null)
  const widgetId = useRef(null)
  const tokens = useRef(createTokenBox())
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!siteKey) return undefined
    let cancelled = false
    loadTurnstile().then((ts) => {
      if (cancelled || !boxRef.current) return
      widgetId.current = ts.render(boxRef.current, {
        sitekey: siteKey,
        action,
        appearance: 'interaction-only',
        'response-field': false,
        callback: (token) => { setFailed(false); tokens.current.put(token) },
        'expired-callback': () => { tokens.current.clear(); ts.reset(widgetId.current) },
        'error-callback': () => { setFailed(true); tokens.current.fail(); return true },
      })
    }).catch(() => { if (!cancelled) { setFailed(true); tokens.current.fail() } })
    return () => {
      cancelled = true
      if (widgetId.current != null) { try { window.turnstile?.remove(widgetId.current) } catch { /* ya no está */ } }
      widgetId.current = null
    }
  }, [siteKey, action])

  useImperativeHandle(ref, () => ({
    getToken: () => (siteKey ? tokens.current.take() : Promise.resolve('')),
    reset: () => {
      if (!siteKey || widgetId.current == null) return
      tokens.current.clear()
      try { window.turnstile?.reset(widgetId.current) } catch { /* sin widget */ }
    },
    markFailed: () => setFailed(true),
  }), [siteKey])

  if (!siteKey) return null
  return (
    <div>
      <div ref={boxRef} />
      {(failed || showError) && (
        <p role="alert" style={{ fontSize: 13, color: 'var(--red)', margin: '8px 0 0', lineHeight: 1.5 }}>
          {errorText}
        </p>
      )}
    </div>
  )
})

export default Turnstile
