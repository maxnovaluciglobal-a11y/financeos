// src/core/auth.js
// Login obligatorio — email/contraseña + Google. Requerido para usar la app
// desde el 12-sep-2026 (antes MOY IQ no tenía ningún concepto de cuenta).
import { authClient, AUTH_ENABLED } from './authClient.js'

export function isAuthConfigured() {
  return AUTH_ENABLED
}

export async function getSession() {
  if (!authClient) return null
  // Sin timeout, un getSession() colgado (red rara, Supabase caído) deja el
  // useEffect de App.jsx esperando para siempre — Inner() devuelve null y la
  // pantalla queda en blanco sin salida. Si no sabemos la sesión a tiempo,
  // tratamos como "no logueado" en vez de colgar (AuthGate deja reintentar).
  const timeout = new Promise(resolve => setTimeout(() => resolve(null), 10000))
  const result = await Promise.race([authClient.auth.getSession(), timeout])
  return result?.data?.session || null
}

export function onAuthChange(callback, onEvent) {
  if (!authClient) return () => {}
  // onEvent es opcional — App.jsx lo usa para detectar PASSWORD_RECOVERY
  // (el link del correo de reset abre la app con una sesión YA válida, así
  // que mirar solo `session` no alcanza para distinguir "inició sesión
  // normal" de "vino a poner una contraseña nueva").
  const { data } = authClient.auth.onAuthStateChange((event, session) => {
    callback(session)
    onEvent?.(event)
  })
  return () => data?.subscription?.unsubscribe()
}

// Manda el correo de recuperación (Supabase Auth). redirectTo vuelve al
// mismo origen/path actual — App.jsx detecta el evento PASSWORD_RECOVERY
// cuando ese link se abre y muestra la pantalla de "elegí una contraseña
// nueva" en vez del flujo normal de login.
export async function resetPasswordForEmail(email) {
  if (!authClient) return { error: 'auth_not_configured' }
  const { error } = await authClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  })
  if (error) return { error: error.message }
  return {}
}

// Se llama con la sesión de recuperación ya activa (ver PASSWORD_RECOVERY
// arriba) — Supabase no pide la contraseña vieja en este flujo, el link del
// correo ya es la prueba de identidad.
export async function updatePassword(newPassword) {
  if (!authClient) return { error: 'auth_not_configured' }
  const { error } = await authClient.auth.updateUser({ password: newPassword })
  if (error) return { error: error.message }
  return {}
}

export async function signUpWithPassword(email, password) {
  if (!authClient) return { error: 'auth_not_configured' }
  // emailRedirectTo: sin esto, el correo de confirmación de signup usa el
  // Site URL único del proyecto (compartido con Invest) en vez del origen
  // real — auth-email-hook/emailHookLogic.ts detecta la marca (MOY IQ vs
  // Invest) mirando este valor, igual que ya hacía resetPasswordForEmail.
  const { data, error } = await authClient.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  })
  if (error) return { error: error.message }
  return { data }
}

// Reenvía el correo de confirmación de signup -- botón "reenviar" en la
// pantalla de checkEmail de AuthGate.jsx. Mismo emailRedirectTo que signUp()
// para que el hook siga detectando la marca correcta (ver signUpWithPassword).
export async function resendSignupConfirmation(email) {
  if (!authClient) return { error: 'auth_not_configured' }
  const { error } = await authClient.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  })
  if (error) return { error: error.message }
  return {}
}

export async function signInWithPassword(email, password) {
  if (!authClient) return { error: 'auth_not_configured' }
  const { data, error } = await authClient.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }
  return { data }
}

export async function signInWithGoogle() {
  if (!authClient) return { error: 'auth_not_configured' }
  const { error } = await authClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  })
  if (error) return { error: error.message }
  return {}
}

export async function signOutAuth() {
  if (!authClient) return
  await authClient.auth.signOut()
}
