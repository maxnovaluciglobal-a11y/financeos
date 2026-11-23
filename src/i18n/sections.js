// src/i18n/sections.js — textos de secciones que se cargan aparte.
//
// Una sección pesada (Inversiones) saca sus claves del diccionario principal
// para no engordar la carga inicial (scripts/bundleBudget.js) y las registra
// acá cuando su chunk llega: el español con el chunk, en/pt/de con import()
// (src/pages/Investments/i18n/investStrings.js). translate() las busca después
// del diccionario del idioma activo, así useT() sigue igual en esas pantallas.
// La sección no se pinta hasta tener su idioma: nunca se ve la clave cruda.
export const sectionStrings = { es: {}, en: {}, pt: {}, de: {} }

export function addSectionStrings(lang, dict) {
  if (!sectionStrings[lang]) sectionStrings[lang] = {}
  Object.assign(sectionStrings[lang], dict)
}
