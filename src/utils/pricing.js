// src/utils/pricing.js
// Precios de Pro formateados según el idioma de la interfaz, desde config.pricing
// (fuente única). Las claves i18n llevan el "US$" y reciben {m}/{y} ya formateados:
// es/pt/de -> "4,99", en -> "4.99".
import config from '../config.js'
import { PRICING_URLS, isPricingUrl, pricingUrl } from './landingUrls.js'

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

// Idioma del correo de licencia: el Payment Link de Stripe no acepta un
// parámetro de idioma, pero sí client_reference_id (documentado en
// https://docs.stripe.com/payment-links/url-parameters) y Stripe lo devuelve
// en checkout.session.completed; stripe-webhook lo lee con
// langFromClientReference ('lang_en' → inglés). Solo para links de Stripe.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
//
// C-39 / PRD-2 (20-oct-2026): con la cuenta de la sesión (account = { id, email })
// el client_reference_id pasa a 'u_<id>_lang_xx' y el checkout llega con el email
// precargado (prefilled_email): stripe-webhook deja Pro activado en esa cuenta y
// el usuario no pega la clave a mano. Sin cuenta, queda como antes.
export function withCheckoutLang(url, lang, account = null) {
  // La página de planes de la landing (sin prueba disponible) va en el idioma
  // de la interfaz, como cancelUrl() (C14).
  if (isPricingUrl(url)) return pricingUrl(lang)
  if (typeof url !== 'string' || !/^https:\/\/buy\.stripe\.com\//.test(url)) return url
  if (!['es', 'en', 'pt', 'de'].includes(lang)) return url
  try {
    const u = new URL(url)
    if (!u.searchParams.has('client_reference_id')) {
      const id = account && UUID_RE.test(String(account.id || '')) ? String(account.id).toLowerCase() : null
      u.searchParams.set('client_reference_id', id ? `u_${id}_lang_${lang}` : `lang_${lang}`)
    }
    const email = account && typeof account.email === 'string' ? account.email.trim() : ''
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !u.searchParams.has('prefilled_email')) {
      u.searchParams.set('prefilled_email', email)
    }
    return u.toString()
  } catch { return url }
}

// ── Períodos de facturación de Pro (auditoría 360, C-03 / COM-3) ─────────────
// LicenseGate, ProGate y Ajustes ofrecen la elección anual/mensual, igual que la
// landing (moyiq.app/#pricing): el anual va primero y preseleccionado.
export const BILLING_PERIODS = ['annual', 'monthly']
export const DEFAULT_BILLING_PERIOD = 'annual'

// Anual expresado por mes (39.99 / 12 = 3.33), como lo muestra la landing.
export function annualPerMonth(pricing = config.pricing) {
  return Math.round((pricing.proAnnual / 12) * 100) / 100
}

// Ahorro del anual frente a pagar 12 meses sueltos, en % entero (4.99 × 12 vs 39.99 = 33).
export function annualSavingPct(pricing = config.pricing) {
  return Math.round((1 - pricing.proAnnual / (pricing.proMonthly * 12)) * 100)
}

// Payment Link de Pro (sin prueba: la prueba de 14 días se empieza en la app,
// sin tarjeta) para el período elegido; cualquier valor que no sea 'monthly'
// cuenta como anual. Sin un link https (compilación de tienda), la página de
// precios de la landing. `trial` queda en false siempre: ningún checkout
// promete una prueba.
export function checkoutFor(period, pricing = config.pricing, fallbackUrl = PRICING_URLS.es) {
  const raw = period === 'monthly' ? pricing?.checkoutUrl : pricing?.checkoutUrlAnnual
  const url = typeof raw === 'string' ? raw.trim() : ''
  if (/^https:\/\//.test(url)) return { trial: false, href: url }
  return { trial: false, href: fallbackUrl }
}

// Etiqueta del plan para el evento checkout_start (sin datos de la cuenta).
export function checkoutPlan(period) {
  return period === 'monthly' ? 'monthly' : 'annual'
}

// La misma etiqueta, sacada del enlace que realmente se abre: null si no es uno
// de los dos Payment Links de Pro.
export function checkoutPlanForHref(href, pricing = config.pricing) {
  if (typeof href !== 'string' || !href) return null
  const clean = (u) => (typeof u === 'string' ? u.trim() : '')
  if (clean(pricing?.checkoutUrlAnnual) && href === clean(pricing.checkoutUrlAnnual)) return 'annual'
  if (clean(pricing?.checkoutUrl) && href === clean(pricing.checkoutUrl)) return 'monthly'
  return null
}
