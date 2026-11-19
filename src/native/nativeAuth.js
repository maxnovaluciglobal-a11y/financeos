// src/native/nativeAuth.js — inicio con Google/Apple dentro de la app nativa.
//
// Google bloquea el inicio de sesión dentro de vistas web embebidas, y la vuelta
// de Supabase no puede apuntar a capacitor://localhost. Por eso:
//   1. signInWithOAuth con skipBrowserRedirect y redirectTo moyiq://auth-callback
//      (cliente con flowType 'pkce', ver core/authClient.js);
//   2. la URL del proveedor se abre con @capacitor/browser (SFSafariViewController
//      en iOS, Custom Tabs en Android: navegador del sistema, permitido por Google);
//   3. el proveedor vuelve a moyiq://auth-callback?code=…, el sistema abre la app,
//      native/bridge.js recibe appUrlOpen y llama a completeNativeOAuth().
// Requisito en Supabase (Walter): agregar moyiq://auth-callback a Auth → URL
// Configuration → Redirect URLs. Sin eso Supabase vuelve al Site URL (la web).
import { registerPlugin } from '@capacitor/core'
import { AUTH_CALLBACK, tokensFromHash } from './nativeLinks.js'

const Browser = registerPlugin('Browser')

export async function nativeOAuth(authClient, provider) {
  const { data, error } = await authClient.auth.signInWithOAuth({
    provider,
    options: { redirectTo: AUTH_CALLBACK, skipBrowserRedirect: true },
  })
  if (error) return { error: error.message }
  if (!data?.url) return { error: 'oauth_no_url' }
  try { await Browser.open({ url: data.url, presentationStyle: 'popover' }) } catch (e) { return { error: String(e?.message || e) } }
  return {}
}

export async function completeNativeOAuth(authClient, { code, hash }) {
  try { await Browser.close() } catch { /* Android: no hay vista que cerrar */ }
  if (!authClient) return { error: 'auth_not_configured' }
  if (code) {
    const { error } = await authClient.auth.exchangeCodeForSession(code)
    return error ? { error: error.message } : {}
  }
  const tokens = tokensFromHash(hash)
  if (tokens) {
    const { error } = await authClient.auth.setSession(tokens)
    return error ? { error: error.message } : {}
  }
  return { error: 'oauth_no_code' }
}
