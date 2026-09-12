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

export function onAuthChange(callback) {
  if (!authClient) return () => {}
  const { data } = authClient.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data?.subscription?.unsubscribe()
}

export async function signUpWithPassword(email, password) {
  if (!authClient) return { error: 'auth_not_configured' }
  const { data, error } = await authClient.auth.signUp({ email, password })
  if (error) return { error: error.message }
  return { data }
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
