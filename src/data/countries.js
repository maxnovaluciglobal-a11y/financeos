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

// Plantilla de perfil por país (data/templates.js). Las 7 plantillas son perfiles
// de uso (personal, pareja, freelancer, pyme, deudas, ahorro, educador), no de
// país; el país solo elige con cuál se arranca. Regla explícita: 'freelancer'
// donde el trabajo por cuenta propia es la mayoría o casi (≥40 % del empleo
// total), 'personal' en el resto.
// Fuente: Banco Mundial / OIT, estimación modelada "Self-employed, total (% of
// total employment)" (SL.EMP.SELF.ZS), 2025 — EC 52,3 · PE 51,3 · CO 45,6 ·
// VE 40,4. Los siguientes quedan lejos del corte: MX 30,8 · AR 25,6 · CL 23,9 ·
// ES 14,5 · PT 14,4 · DE 8,1 · US 6,1.
// https://data.worldbank.org/indicator/SL.EMP.SELF.ZS (consultado 08-oct-2026).
// Un país que no está en el mapa cae a 'personal'. Se cambia en Ajustes →
// Plantillas de perfil, sin tocar los movimientos ya registrados.
const TEMPLATE_BY_COUNTRY = { EC: 'freelancer', PE: 'freelancer', CO: 'freelancer', VE: 'freelancer' }

export function templateForCountry(code) {
  return TEMPLATE_BY_COUNTRY[code] || 'personal'
}
