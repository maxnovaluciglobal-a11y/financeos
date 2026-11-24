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
//   App                botón atrás de Android (backStack.js); enlaces moyiq:// y universales
//   MoyiqNative        solo Android, plugin local del repo nativo: fondo detrás de
//                      las barras, cambio de tema del sistema y "Guardar como"
//                      (saveFile.js). En iOS no existe y todo sigue igual.
//   Browser            vuelta del inicio con Google/Apple (nativeAuth.js)
//   Keyboard           se configura en capacitor.config (resize nativo)
import { registerPlugin, SystemBars, SystemBarsStyle } from '@capacitor/core'
import { parseNativeUrl, NATIVE_OAUTH_ERROR_EVENT } from './nativeLinks.js'
import { setNativeHaptics } from './nativeHaptics.js'
import { logRejection } from '../utils/errorLog.js'
import { handleBack } from './backStack.js'
import { setNativePrefersDark } from '../utils/theme.js'

// Un plugin nativo que falla no tiene que romper la app: queda en el registro de errores.
const soft = (p, where) => p.catch(logRejection(`native:${where}`))

const App = registerPlugin('App')
const Haptics = registerPlugin('Haptics')
const SplashScreen = registerPlugin('SplashScreen')
const MoyiqNative = registerPlugin('MoyiqNative')

function hasPlugin(win, name) {
  try { return win.Capacitor?.isPluginAvailable?.(name) === true } catch { return false }
}

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
  return colorAt(doc, win, 2)
}

// Lo mismo para la barra de navegación (gestos o botones) de abajo.
function colorUnderNavBar(doc, win) {
  return colorAt(doc, win, win.innerHeight - 2)
}

function colorAt(doc, win, y) {
  let el = doc.elementFromPoint?.(win.innerWidth / 2, y)
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

// Android (AND-7): con WebView < 140 Capacitor deja la vista web DEBAJO de las
// barras y lo que se ve detrás es el fondo de la ventana (#FAFAFA en claro).
// Elegir los íconos solo por el color de la página dejaba reloj blanco sobre
// blanco. Con MoyiqNative se pinta ese fondo del mismo color que la página
// (cabecera arriba, barra inferior abajo) y los íconos salen de ese color; con
// WebView ≥ 140 la página ya dibuja detrás de las barras y pintar no cambia nada.
// SystemBars.setStyle vuelve a pintar el fondo de la ventana: por eso los
// colores van siempre DESPUÉS del estilo.
function installSystemBars(win) {
  const doc = win.document
  const paint = hasPlugin(win, 'MoyiqNative')
  let last = null
  let queued = false
  let chain = Promise.resolve()
  const sync = (force = false) => {
    queued = false
    const top = colorUnderStatusBar(doc, win)
    const bottom = paint ? colorUnderNavBar(doc, win) : null
    const key = `${top}|${bottom}`
    if (key === last && !force) return
    last = key
    const status = barStyleFor(top)
    const nav = bottom ? barStyleFor(bottom) : status
    chain = chain.then(async () => {
      if (status === nav) await SystemBars.setStyle({ style: status })
      else {
        await SystemBars.setStyle({ style: status, bar: 'StatusBar' })
        await SystemBars.setStyle({ style: nav, bar: 'NavigationBar' })
      }
      if (paint && top) await MoyiqNative.setBarColors({ top, bottom: bottom || top })
    }).catch(logRejection('native:systemBars'))
  }
  const schedule = () => { if (!queued) { queued = true; win.setTimeout(() => sync(), 120) } }
  sync()
  const mo = new MutationObserver(schedule)
  mo.observe(doc.head, { subtree: true, attributes: true, attributeFilter: ['content', 'media'], childList: true })
  mo.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'data-scene'] })
  mo.observe(doc.body, { subtree: true, childList: true })
  win.addEventListener('scroll', schedule, { capture: true, passive: true })
  win.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', schedule)
  if (paint) {
    // AND-13: con configChanges=uiMode la actividad no se recrea y la WebView no
    // avisa el cambio de prefers-color-scheme: lo avisa el plugin. El tema
    // "Sistema" se vuelve a aplicar (utils/theme.js) y las barras se repintan
    // aunque el tema de la app no cambie (Android repinta la ventana).
    soft(MoyiqNative.addListener('systemThemeChange', ({ dark }) => {
      setNativePrefersDark(!!dark)
      win.setTimeout(() => sync(true), 150)
    }), 'systemTheme')
  }
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
    const res = await completeNativeOAuth(authClient, r)
    // Un canje fallido se avisa en la pantalla de acceso (AuthGate); un enlace
    // que no vino de un OAuth de esta app se ignora en silencio.
    if (res?.error && !res.ignored) {
      win.dispatchEvent(new win.CustomEvent(NATIVE_OAUTH_ERROR_EVENT, { detail: { error: res.error } }))
    }
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
  // Android (AND-3/AND-4, backStack.js): atrás cierra primero la hoja, el
  // diálogo o el menú abierto; después vuelve de pantalla, o de pestaña a
  // Inicio; en Inicio (o en el demo) la app va al fondo, nunca a la pantalla de
  // acceso. Sin la app montada (acceso, alta) se usa el historial como siempre.
  soft(App.addListener('backButton', ({ canGoBack }) => {
    const r = handleBack()
    if (r === 'dismissed' || r === 'navigated') return
    if (r === 'unhandled' && canGoBack && win.history.length > 1) win.history.back()
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
