// src/pages/legal/legalMeta.js
// Datos comunes de las páginas legales (es/en/pt/de). Sin React ni hooks: lo
// importan los módulos de contenido y legal.test.js en node.

export const OPERATOR = 'MAXNOVA & LUCI Global LLC'
export const SUPPORT_EMAIL = 'support@moyiq.app'

// Fecha visible en el encabezado de cada página legal. Al cambiar el texto de
// fondo de cualquiera de las cuatro páginas, actualizar los cuatro idiomas.
export const LAST_UPDATED = {
  es: 'Última actualización: octubre 2026',
  en: 'Last updated: October 2026',
  pt: 'Última atualização: outubro de 2026',
  de: 'Stand: Oktober 2026',
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

// Cancelación en línea por idioma (páginas de la landing). pt usa la española.
export const CANCEL_URLS = {
  es: 'https://moyiq.app/cancelar.html',
  en: 'https://moyiq.app/en/cancel.html',
  pt: 'https://moyiq.app/cancelar.html',
  de: 'https://moyiq.app/de/kuendigen.html',
}

// Portal de clientes de Stripe: null hasta que esté activado. Los textos dicen
// "cuando esté disponible" mientras sea null.
export const STRIPE_PORTAL_URL = null
