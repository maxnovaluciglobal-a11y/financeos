// src/utils/landingUrls.js — páginas de la landing (moyiq.app) en el idioma de
// la interfaz (C14 de la auditoría de branding, 23-nov-2026). Hasta entonces
// "Ver planes" y "Ayuda" iban siempre a la landing en español. Mismo criterio
// que utils/cancelUrl.js: la landing tiene español, inglés y alemán; el
// portugués no tiene versión propia y va a la inglesa.
export const LANDING_ORIGIN = 'https://moyiq.app'

export const PRICING_URLS = {
  es: `${LANDING_ORIGIN}/#pricing`,
  en: `${LANDING_ORIGIN}/en/#pricing`,
  de: `${LANDING_ORIGIN}/de/#pricing`,
}

// Ayuda: en español hay página propia; inglés y alemán tienen las preguntas
// frecuentes en su portada (#faq).
export const HELP_URLS = {
  es: `${LANDING_ORIGIN}/ayuda.html`,
  en: `${LANDING_ORIGIN}/en/#faq`,
  de: `${LANDING_ORIGIN}/de/#faq`,
}

export function landingLang(lang) {
  const base = String(lang || '').toLowerCase().split(/[-_]/)[0]
  if (base === 'es' || base === 'de') return base
  if (base === 'en' || base === 'pt') return 'en'
  return 'es'
}

export const pricingUrl = (lang) => PRICING_URLS[landingLang(lang)]
export const helpUrl = (lang) => HELP_URLS[landingLang(lang)]

// ¿Es la página de planes de la landing (en cualquier idioma)? La usa
// withCheckoutLang para pasarla al idioma de la interfaz.
export const isPricingUrl = (url) => Object.values(PRICING_URLS).includes(url)
