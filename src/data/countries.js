// src/data/countries.js
// Países que ofrece el onboarding, con la moneda que se sugiere para cada uno.
// Antes vivía dentro de Onboarding.jsx (con los nombres en español fijos); los
// nombres ahora salen de las claves i18n 'country.<code>'.
// Para agregar un país sigue valiendo la lista de 7 lugares del CLAUDE.md del
// repo (este archivo reemplaza al punto 1, "Onboarding.jsx — array COUNTRIES").

export const COUNTRIES = [
  { code: 'CL',    currency: 'CLP' },
  { code: 'MX',    currency: 'MXN' },
  { code: 'CO',    currency: 'COP' },
  { code: 'AR',    currency: 'ARS' },
  { code: 'ES',    currency: 'EUR' },
  { code: 'PE',    currency: 'PEN' },
  { code: 'EC',    currency: 'USD' },
  { code: 'VE',    currency: 'VES' },
  { code: 'US',    currency: 'USD' },
  { code: 'PT',    currency: 'EUR' },
  { code: 'DE',    currency: 'EUR' },
  { code: 'OTHER', currency: 'USD' },
]

// Los que se muestran sin desplegar la lista completa (mercado principal).
export const PRIMARY_COUNTRIES = ['CL', 'MX', 'CO', 'AR', 'ES', 'PE']

export const countryKey = (code) => `country.${code}`
export const suggestedCurrency = (code) => COUNTRIES.find(c => c.code === code)?.currency || 'USD'

// Plantilla de perfil por país (data/templates.js). Regla simple y explícita:
// ninguna de las 7 plantillas es específica de un país (todas son perfiles de
// uso: personal, pareja, freelancer, pyme, deudas, ahorro, educador), así que
// hoy todos los países reciben 'personal', la plantilla general. El país ya
// cambia la moneda, la herramienta fiscal y el menú "Tu país". El mapa existe
// para poder asignar otra plantilla a un país sin tocar el onboarding; un país
// que no está en el mapa cae a 'personal'. Se puede cambiar en Ajustes.
const TEMPLATE_BY_COUNTRY = {}

export function templateForCountry(code) {
  return TEMPLATE_BY_COUNTRY[code] || 'personal'
}
