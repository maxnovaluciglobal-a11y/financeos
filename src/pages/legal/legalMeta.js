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
