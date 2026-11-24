// src/pages/legal/legalMeta.js
// Datos comunes de las páginas legales (es/en/pt/de). Sin React ni hooks: lo
// importan los módulos de contenido y legal.test.js en node.
import { PRIVACY_DEPLOY_DATE, PRIVACY_PREVIOUS_DATE, REBRAND_DEPLOY_DATE } from '../../data/deployDate.js'
import { STORE_BUILD } from '../../native/storeBuild.js'

export const OPERATOR = 'MAXNOVA & LUCI Global LLC'
export const SUPPORT_EMAIL = 'support@moyiq.app'

// Versión vigente de los textos legales (rebranding moyiq, Entrega 1). La fecha
// de vigencia es el día del despliegue coordinado y se fija en un solo lugar:
// data/deployDate.js (REBRAND_DEPLOY_DATE). El snapshot de la versión anterior
// está en `02 - MOY IQ/03 - Legal y Cumplimiento/versiones/`
// (2026-11-17-app-*-antes-de-moyiq.jsx).
export const LEGAL_EFFECTIVE_DATE = REBRAND_DEPLOY_DATE
export const LEGAL_VERSION = LEGAL_EFFECTIVE_DATE.slice(0, 7)

const DATE_LOCALE = { es: 'es-ES', en: 'en-US', pt: 'pt-BR', de: 'de-DE' }
function effectiveLabel(lang, date = LEGAL_EFFECTIVE_DATE) {
  const d = new Date(`${date}T12:00:00Z`)
  const day = new Intl.DateTimeFormat(DATE_LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)
  return { es: `Vigente desde el ${day}`, en: `Effective ${day}`, pt: `Em vigor desde ${day}`, de: `Gültig ab ${day}` }[lang]
}

// Fecha visible en el encabezado de cada página legal. Al cambiar el texto de
// fondo de cualquiera de las cuatro páginas, cambiar LEGAL_EFFECTIVE_DATE.
export const LAST_UPDATED = {
  es: effectiveLabel('es'),
  en: effectiveLabel('en'),
  pt: effectiveLabel('pt'),
  de: effectiveLabel('de'),
}

// Política de Privacidad: vigencia propia (data/deployDate.js, PRIVACY_DEPLOY_DATE)
// porque cambió de fondo después del 18-nov (auditoría 360, LEG-N1). La versión es
// la fecha completa, para distinguirla de la anterior aunque caigan en el mismo mes,
// y el encabezado cita la versión a la que reemplaza.
export const PRIVACY_EFFECTIVE_DATE = PRIVACY_DEPLOY_DATE
export const PRIVACY_VERSION = PRIVACY_EFFECTIVE_DATE
export const PRIVACY_REPLACES = PRIVACY_PREVIOUS_DATE
const REPLACES_LABEL = {
  es: `reemplaza a la versión ${PRIVACY_REPLACES}`,
  en: `replaces version ${PRIVACY_REPLACES}`,
  pt: `substitui a versão ${PRIVACY_REPLACES}`,
  de: `ersetzt die Fassung ${PRIVACY_REPLACES}`,
}
export const PRIVACY_LAST_UPDATED = Object.fromEntries(
  ['es', 'en', 'pt', 'de'].map(lang => [lang, `${effectiveLabel(lang, PRIVACY_EFFECTIVE_DATE)} · ${REPLACES_LABEL[lang]}`]),
)

// Aviso del cambio de nombre, al inicio de las cuatro páginas legales.
// "MOY IQ" aparece aquí a propósito (alias permitido en copyLint.test.js).
export const REBRAND_NOTICE = {
  es: 'MOY IQ ahora se llama moyiq; el responsable y el tratamiento de los datos no cambian.',
  en: 'MOY IQ is now called moyiq; the controller and the processing of the data do not change.',
  pt: 'O MOY IQ agora se chama moyiq; o controlador e o tratamento dos dados não mudam.',
  de: 'MOY IQ heißt jetzt moyiq; der Verantwortliche und die Verarbeitung der Daten ändern sich nicht.',
}

export const LEGAL_LANGS = ['es', 'en', 'pt', 'de']

// Idioma desconocido → español (mismo criterio que el fallback de useT).
export function pickLang(map, lang) {
  return map[lang] || map.es
}

// Identificación de la empresa (registro público de Sunbiz). Va en Términos y
// Privacidad de los cuatro idiomas. Nunca publicar EIN ni datos bancarios.
export const COMPANY = {
  name: 'MAXNOVA & LUCI Global LLC',
  documentNumber: 'L26000222229',
  address: '10482 NW 31st Terrace, Office 1D, Doral, FL 33172',
  managers: 'Walter M. La Madriz Guerra, Patricia L. Velazco Gil',
}

// La página de cancelación por idioma la da utils/cancelUrl.js (cancelUrl()).
// Acá había un CANCEL_URLS sin uso que la duplicaba (C15, 23-nov-2026).

// Portal de clientes de Stripe (link público de inicio de sesión; el mismo que
// publica la landing en cancelar.html, terms y license). Menú → Ayuda →
// Gestionar suscripción (LEG-12).
export const STRIPE_PORTAL_URL = STORE_BUILD ? '' : 'https://billing.stripe.com/p/login/6oU9AM8Ht3aggzi8qZfnO00'
