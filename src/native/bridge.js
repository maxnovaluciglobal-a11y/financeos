// src/native/bridge.js — integración con la app nativa (Capacitor 8).
//
// main.jsx lo importa de forma dinámica SOLO si isNativeApp(): en la web no se
// descarga. Los plugins se piden por nombre con registerPlugin (el código
// nativo y sus versiones viven en el repo privado moyiq-ios-capacitor); acá
// solo hace falta @capacitor/core.
//
//   SystemBars (core)  barras del sistema: texto claro u oscuro según el
//                      theme-color que pinta cada pantalla (la escena de Inicio
//                      lo cambia a morado; ver InicioScene.jsx)
//   Haptics            utils/haptics.js → Taptic Engine
//   SplashScreen       se oculta apenas la app pintó
//   App                botón atrás de Android; enlaces moyiq:// y universales
//   Browser            vuelta del inicio con Google/Apple (nativeAuth.js)
//   Keyboard           se configura en capacitor.config (resize nativo)
import { registerPlugin, SystemBars, SystemBarsStyle } from '@capacitor/core'
import { parseNativeUrl } from './nativeLinks.js'
import { setNativeHaptics } from './nativeHaptics.js'
import { logRejection } from '../utils/errorLog.js'

// Un plugin nativo que falla no tiene que romper la app: queda en el registro de errores.
const soft = (p, where) => p.catch(logRejection(`native:${where}`))

const App = registerPlugin('App')
const Haptics = registerPlugin('Haptics')
const SplashScreen = registerPlugin('SplashScreen')

const LAUNCH_KEY = 'fnos_native_launch_url'

// Luminancia relativa de un color #rrggbb (WCAG). null si no se puede leer.
export function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}

// Fondo oscuro → texto claro (SystemBarsStyle.Dark), y al revés.
export function barStyleFor(hex) {
  const l = luminance(hex)
  if (l === null) return SystemBarsStyle.Default
  return l < 0.4 ? SystemBarsStyle.Dark : SystemBarsStyle.Light
}

function currentThemeColor(doc, win) {
  const metas = [...doc.querySelectorAll('meta[name="theme-color"]')]
  const match = metas.find(m => !m.media || win.matchMedia?.(m.media).matches) || metas[0]
  return match?.getAttribute('content') || null
}

// "rgb(r, g, b)" / "rgba(r, g, b, a)" → "#rrggbb", o null si es transparente.
export function rgbToHex(css) {
  const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/.exec(String(css || ''))
  if (!m || (m[4] !== undefined && Number(m[4]) < 0.5)) return null
  return '#' + [m[1], m[2], m[3]].map(v => Number(v).toString(16).padStart(2, '0')).join('')
}

// Color que de verdad está detrás de la barra de estado: el fondo del primer
// elemento opaco bajo el centro de la franja superior. El theme-color no sirve
// solo: la app lo deja en morado aunque la pantalla de acceso sea blanca.
function colorUnderStatusBar(doc, win) {
  if (doc.documentElement.dataset.scene === 'on') return currentThemeColor(doc, win)
  let el = doc.elementFromPoint?.(win.innerWidth / 2, 2)
  while (el && el !== doc.documentElement) {
    const cs = win.getComputedStyle(el)
    // Un degradado (la franja del demo) tiene background-color transparente:
    // vale su primer color.
    const hex = rgbToHex(cs.backgroundColor) || (/gradient/.test(cs.backgroundImage || '') ? rgbToHex(cs.backgroundImage) : null)
    if (hex) return hex
    el = el.parentElement
  }
  return rgbToHex(win.getComputedStyle(doc.body).backgroundColor) || rgbToHex(win.getComputedStyle(doc.documentElement).backgroundColor)
}

function installSystemBars(win) {
  const doc = win.document
  let last = null
  let queued = false
  const sync = () => {
    queued = false
    const style = barStyleFor(colorUnderStatusBar(doc, win))
    if (style === last) return
    last = style
    soft(SystemBars.setStyle({ style }), 'systemBars')
  }
  const schedule = () => { if (!queued) { queued = true; win.setTimeout(sync, 120) } }
  sync()
  const mo = new MutationObserver(schedule)
  mo.observe(doc.head, { subtree: true, attributes: true, attributeFilter: ['content', 'media'], childList: true })
  mo.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'data-scene'] })
  mo.observe(doc.body, { subtree: true, childList: true })
  win.addEventListener('scroll', schedule, { capture: true, passive: true })
  win.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', schedule)
}

function installHaptics() {
  // iOS: el generador de selección se prepara una vez; sin esto selectionChanged no suena.
  soft(Haptics.selectionStart(), 'haptics')
  setNativeHaptics({
    selection: () => { soft(Haptics.selectionChanged(), 'haptics') },
    // Confirmaciones (guardar, borrar): impacto liviano, como el sistema.
    tap: () => { soft(Haptics.impact({ style: 'LIGHT' }), 'haptics') },
    success: () => { soft(Haptics.notification({ type: 'SUCCESS' }), 'haptics') },
    warning: () => { soft(Haptics.notification({ type: 'WARNING' }), 'haptics') },
  })
}

async function handleUrl(url, win) {
  const r = parseNativeUrl(url)
  if (!r) return
  if (r.kind === 'auth') {
    const [{ authClient }, { completeNativeOAuth }] = await Promise.all([
      import('../core/authClient.js'), import('./nativeAuth.js'),
    ])
    await completeNativeOAuth(authClient, r)
    return
  }
  const here = win.location.pathname + win.location.search
  if (r.path !== here) win.location.replace(r.path)
}

function installLinksAndBack(win) {
  soft(App.addListener('appUrlOpen', ({ url }) => { soft(handleUrl(url, win), 'appUrlOpen') }), 'appUrlOpen')
  // Arranque en frío desde un enlace: se procesa una vez (la recarga a la
  // ruta nueva devuelve la misma launch URL).
  App.getLaunchUrl().then((res) => {
    const url = res?.url
    if (!url) return
    try {
      if (win.sessionStorage.getItem(LAUNCH_KEY) === url) return
      win.sessionStorage.setItem(LAUNCH_KEY, url)
    } catch { /* sin sessionStorage: se procesa igual */ }
    return handleUrl(url, win)
  }).catch(logRejection('native:launchUrl'))
  // Android: atrás cierra la hoja o vuelve de pantalla (popstate, igual que en
  // la PWA); en la primera pantalla manda la app al fondo en vez de cerrarla.
  soft(App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack && win.history.length > 1) win.history.back()
    else soft(App.minimizeApp(), 'minimize')
  }), 'backButton')
}

export function installNative(win = window) {
  const root = win.document.documentElement
  root.dataset.native = 'on'
  try { installHaptics() } catch { /* sigue sin hápticos nativos */ }
  try { installSystemBars(win) } catch { /* sigue con las barras del sistema */ }
  try { installLinksAndBack(win) } catch { /* sin enlaces profundos */ }
  win.requestAnimationFrame(() => { soft(SplashScreen.hide({ fadeOutDuration: 200 }), 'splash') })
}
