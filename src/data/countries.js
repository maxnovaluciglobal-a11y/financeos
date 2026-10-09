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
export const PRIMARY_COUNTRIES = ['CL', 'MX', 'CO', 'AR', 'ES', 'PE', 'US']

export const countryKey = (code) => `country.${code}`
export const suggestedCurrency = (code) => COUNTRIES.find(c => c.code === code)?.currency || 'USD'

// La plantilla de perfil ya NO depende del país (09-oct-2026): ver
// templateIdForProfile en data/templates.js. Antes había un mapa
// TEMPLATE_BY_COUNTRY (EC/PE/CO/VE → 'freelancer', por la tasa de autoempleo
// del Banco Mundial); se retiró porque un país no dice si UNA persona trabaja
// por su cuenta. El onboarding lo pregunta.
