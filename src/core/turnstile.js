// src/core/turnstile.js — Cloudflare Turnstile en los formularios públicos y el login
// (auditoría 360: SEG-1 y SEG-7; servidor y orden de encendido en docs/turnstile.md).
//
// Solo se activa si existe VITE_TURNSTILE_SITE_KEY (clave PÚBLICA del widget `moyiq-forms`).
// Sin clave: no se carga ningún script de Cloudflare, getToken() devuelve '' y los formularios
// y el login funcionan exactamente como antes (lead-submit deja pasar mientras no haya
// TURNSTILE_ENFORCE en el servidor, y Supabase Auth no pide captcha mientras no se prenda).

export const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export function turnstileSiteKey(env = import.meta.env) {
  return String(env?.VITE_TURNSTILE_SITE_KEY || '').trim()
}

export const TURNSTILE_SITE_KEY = turnstileSiteKey()
export const TURNSTILE_ENABLED = !!TURNSTILE_SITE_KEY

let scriptPromise = null

// Carga api.js una sola vez. Rechaza si no carga en 15 s (bloqueador, sin red).
export function loadTurnstile(doc = typeof document !== 'undefined' ? document : null, win = typeof window !== 'undefined' ? window : null) {
  if (win?.turnstile) return Promise.resolve(win.turnstile)
  if (scriptPromise) return scriptPromise
  if (!doc || !win) return Promise.reject(new Error('turnstile_no_dom'))
  scriptPromise = new Promise((resolve, reject) => {
    const s = doc.createElement('script')
    s.src = TURNSTILE_SCRIPT_URL
    s.async = true
    s.defer = true
    const timer = setTimeout(() => fail(new Error('turnstile_timeout')), 15000)
    function fail(err) { clearTimeout(timer); scriptPromise = null; s.remove?.(); reject(err) }
    s.onload = () => {
      clearTimeout(timer)
      if (win.turnstile) resolve(win.turnstile)
      else fail(new Error('turnstile_missing'))
    }
    s.onerror = () => fail(new Error('turnstile_load_failed'))
    doc.head.appendChild(s)
  })
  return scriptPromise
}

// Caja del token: el widget deposita tokens, el formulario los pide al enviar.
// take() devuelve el token vigente o espera hasta `timeoutMs` a que llegue; si el widget
// falla o vence el plazo, devuelve '' (el servidor decide: en modo observar deja pasar).
// Un token sirve una sola vez: take() lo consume, y el formulario llama a reset() del widget.
export function createTokenBox() {
  let token = ''
  let failed = false
  let waiters = []
  const flush = (value) => { const w = waiters; waiters = []; for (const fn of w) fn(value) }
  return {
    put(value) { token = String(value || ''); if (token) { failed = false; flush(token) } },
    clear() { token = '' },
    // Después de un fallo, take() no espera: el envío sale sin token y el servidor decide.
    fail() { token = ''; failed = true; flush('') },
    peek() { return token },
    take(timeoutMs = 10000) {
      if (token) { const v = token; token = ''; return Promise.resolve(v) }
      if (failed) return Promise.resolve('')
      return new Promise((resolve) => {
        const timer = setTimeout(() => { waiters = waiters.filter(w => w !== done); resolve('') }, timeoutMs)
        function done(v) { clearTimeout(timer); if (v) token = ''; resolve(v) }
        waiters.push(done)
      })
    },
  }
}

// Supabase Auth con captcha prendido y sin token (o con uno inválido) responde
// "captcha protection: request disallowed (...)" / "captcha verification process failed".
export function isCaptchaError(message) {
  return /captcha/i.test(String(message || ''))
}

// Cuerpo de lead-submit: { rpc, args, turnstileToken? } (contrato en docs/turnstile.md).
export function leadSubmitBody(rpc, args, turnstileToken) {
  const body = { rpc, args }
  if (turnstileToken) body.turnstileToken = turnstileToken
  return body
}

// Opciones de supabase.auth.*: suma captchaToken solo si hay token.
export function withCaptcha(options, captchaToken) {
  return captchaToken ? { ...(options || {}), captchaToken } : (options || {})
}
