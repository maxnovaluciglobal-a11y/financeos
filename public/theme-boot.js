// public/theme-boot.js — pinta el tema ANTES de React (N4, 30-oct-2026).
// Sin esto, con el tema "Sistema" y el teléfono en oscuro se veía un destello
// claro al abrir: el tema real vive en IndexedDB y se aplica recién al
// hidratar. applyTheme() (src/utils/theme.js) guarda la preferencia en
// localStorage 'fos_theme_pref'; acá se lee y se resuelve igual que
// resolveTheme(). Archivo externo del mismo origen: la CSP ('self') lo permite
// sin agregar hashes. Si algo falla, no hace nada (queda el claro de siempre).
(function () {
  try {
    var pref = localStorage.getItem('fos_theme_pref')
    var dark = pref === 'dark' || (pref === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  } catch (e) { /* sin almacenamiento: tema por defecto */ }
})()
