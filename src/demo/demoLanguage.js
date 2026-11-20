// src/demo/demoLanguage.js
// Idioma con que arranca el demo (auditoría 360, UX-N3). Antes salía solo de
// navigator.languages: la landing en español abría el demo en inglés en un
// teléfono en inglés, `?persona=ve` mezclaba interfaz en inglés con datos
// venezolanos y el idioma elegido en Ajustes se perdía al recargar.
// Orden: `?lang=` explícito > idioma de la persona de `?persona=` > el último
// idioma elegido en el demo (localStorage) > el del navegador.
// Lo usan DemoGate (antes del provider) y DemoProvider, así que los dos ven el mismo.
import { SUPPORTED_LANGS, detectLanguage } from '../i18n/translate.js'

export const DEMO_LANG_KEY = 'fnos_demo_lang'

// Idioma natural de cada persona del demo.
export const PERSONA_LANG = { sofia: 'es', ve: 'es', us: 'en', de: 'de' }

function param(search, name) {
  try { return String(new URLSearchParams(search || '').get(name) || '').trim().toLowerCase() } catch { return '' }
}

export function readStoredDemoLang() {
  try { return localStorage.getItem(DEMO_LANG_KEY) } catch { return null }
}

export function storeDemoLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return
  try { localStorage.setItem(DEMO_LANG_KEY, lang) } catch { /* almacenamiento o API del navegador no disponible: se sigue sin ello */ }
}

export function pickDemoLanguage({ search = '', stored = null, locales } = {}) {
  const lang = param(search, 'lang').split(/[-_]/)[0]
  if (SUPPORTED_LANGS.includes(lang)) return lang
  const persona = param(search, 'persona')
  if (Object.hasOwn(PERSONA_LANG, persona)) return PERSONA_LANG[persona]
  if (SUPPORTED_LANGS.includes(stored)) return stored
  return detectLanguage(locales)
}

// Atajo para el navegador: lee la URL y lo guardado.
export function currentDemoLanguage() {
  return pickDemoLanguage({
    search: typeof window !== 'undefined' ? window.location.search : '',
    stored: readStoredDemoLang(),
  })
}
