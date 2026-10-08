// src/utils/landingLinks.js
// Enlaces a páginas de la landing según el idioma de la app.
//
// Instrucciones de activación de la licencia (LicenseGate):
//   en → /en/activate.html (landing en inglés, 08-oct-2026)
//   de → /en/activate.html: la landing alemana (/de/) no se publica hasta tener
//        Impressum completo y revisión legal; para un usuario alemán el inglés
//        se entiende mejor que el español.
//   es, pt y cualquier otro → /activate.html (español): para quien lee
//        portugués, el español es más cercano que el inglés.
const LANDING = 'https://moyiq.app'

export function activateUrl(lang) {
  return lang === 'en' || lang === 'de' ? `${LANDING}/en/activate.html` : `${LANDING}/activate.html`
}
