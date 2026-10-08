// src/utils/cancelUrl.js
// Página de cancelación online de la landing en el idioma del usuario
// (§ 312k BGB / leyes de renovación automática de EE. UU.). El formulario
// alemán vive en /de/kuendigen.html, que se publica junto con el resto de los
// textos legales alemanes: mientras DE_LEGAL_PUBLISHED sea false, el alemán va
// a la versión en inglés. Portugués no tiene página propia: inglés.
import { DE_LEGAL_PUBLISHED } from '../pages/legal/deLegal.js'

export const CANCEL_URLS = {
  es: 'https://moyiq.app/cancelar.html',
  en: 'https://moyiq.app/en/cancel.html',
  de: 'https://moyiq.app/de/kuendigen.html',
}

// `deLegalPublished` solo se sobrescribe en tests.
export function cancelUrl(lang, deLegalPublished = DE_LEGAL_PUBLISHED) {
  const base = String(lang || '').toLowerCase().split(/[-_]/)[0]
  if (base === 'es') return CANCEL_URLS.es
  if (base === 'de' && deLegalPublished) return CANCEL_URLS.de
  return CANCEL_URLS.en
}
