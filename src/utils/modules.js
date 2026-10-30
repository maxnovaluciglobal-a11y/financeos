// src/utils/modules.js — módulos que se activan (poda P3, aprobada por Walter
// el 30-oct-2026). Lo que usa una minoría (Propiedades, Modo asesor) no ocupa
// fila en "Más" ni en el riel mientras esté apagado.
//
// Regla de compatibilidad: una cuenta sin `settings.modules` (todas las que
// existían antes de la poda, y el demo) tiene TODO encendido; nadie pierde
// nada visible. Solo el onboarding nuevo escribe `modules`, con Propiedades
// según la respuesta ("¿Tienes propiedades o alquileres?") y Modo asesor
// apagado. Todo se revierte en Ajustes › Funciones.
export const MODULE_IDS = ['properties', 'advisor']

// Página de cada módulo (ids de navConfig.js / App.jsx).
export const MODULE_PAGE = { properties: 'projects', advisor: 'advisor' }

export function moduleOn(settings, id) {
  const m = settings?.modules
  if (!m || typeof m !== 'object' || !(id in m)) return true
  return m[id] === true
}

// Ajustes para una cuenta nueva (onboarding).
export function newAccountModules({ hasProperties = false } = {}) {
  return { properties: !!hasProperties, advisor: false }
}

// Patch de settings que enciende o apaga un módulo, completando los demás con
// su estado actual (así una cuenta vieja no apaga los otros al tocar uno).
export function setModule(settings, id, on) {
  const cur = Object.fromEntries(MODULE_IDS.map(k => [k, moduleOn(settings, k)]))
  return { modules: { ...cur, [id]: !!on } }
}

export function modulesOff(settings) {
  return MODULE_IDS.filter(id => !moduleOn(settings, id))
}
