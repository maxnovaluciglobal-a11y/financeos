// src/utils/pricing.js
// Precios de Pro formateados según el idioma de la interfaz, desde config.pricing
// (fuente única). Las claves i18n llevan el "US$" y reciben {m}/{y} ya formateados:
// es/pt/de -> "4,99", en -> "4.99".
import config from '../config.js'

const LANG_NUMBER_LOCALE = { es: 'es-ES', en: 'en-US', pt: 'pt-BR', de: 'de-DE' }

export function formatPrice(amount, lang = 'es') {
  return new Intl.NumberFormat(LANG_NUMBER_LOCALE[lang] || 'es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// Variables listas para t(): { m: mensual, y: anual }
export function proPriceVars(lang = 'es', pricing = config.pricing) {
  return { m: formatPrice(pricing.proMonthly, lang), y: formatPrice(pricing.proAnnual, lang) }
}

// CTA de Pro (ProGate): la prueba solo se ofrece si está habilitada Y hay una
// URL de checkout https real. Con cualquiera de las dos faltando se mantiene
// el CTA de siempre ("Ver planes" hacia la landing).
export function proCta(pricing = config.pricing, fallbackUrl = 'https://moyiq.app/#pricing') {
  const url = typeof pricing?.trialCheckoutUrl === 'string' ? pricing.trialCheckoutUrl.trim() : ''
  if (pricing?.trialEnabled === true && /^https:\/\//.test(url)) {
    return { trial: true, href: url, labelKey: 'pro.gate.trialCta' }
  }
  return { trial: false, href: fallbackUrl, labelKey: 'pro.gate.cta' }
}
