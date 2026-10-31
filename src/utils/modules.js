// src/utils/modules.js — módulos que se activan (poda P3, aprobada por Walter
// el 30-oct-2026). Lo que usa una minoría (Propiedades, Modo asesor) no ocupa
// fila en "Más" ni en el riel mientras esté apagado.
//
// Regla de compatibilidad: una cuenta sin `settings.modules` (todas las que
// existían antes de la poda) tiene encendido lo que ya veía; nadie pierde nada
// visible. Solo el onboarding nuevo escribe `modules`, con Propiedades según la
// respuesta ("¿Tienes propiedades o alquileres?") y Modo asesor apagado. Todo
// se revierte en Ajustes › Funciones.
//
// Inversiones (Opción 1 de D-08, 30-oct-2026) es distinto: es opt-in para
// TODAS las cuentas, viejas y nuevas. Lee el portafolio que Invest guarda en el
// servidor, y MOY IQ es local por defecto: eso no se enciende sin que la
// persona lo pida. Es gratis y nunca Pro: los datos de mercado no tienen
// licencia comercial (INV-1).
export const MODULE_DEFAULTS = { properties: true, advisor: true, investments: false }
export const MODULE_IDS = Object.keys(MODULE_DEFAULTS)

// Página de cada módulo (ids de navConfig.js / App.jsx).
export const MODULE_PAGE = { properties: 'projects', advisor: 'advisor', investments: 'investments' }

export function moduleOn(settings, id) {
  const m = settings?.modules
  if (!m || typeof m !== 'object' || !(id in m)) return MODULE_DEFAULTS[id] ?? true
  return m[id] === true
}

// Ajustes para una cuenta nueva (onboarding).
export function newAccountModules({ hasProperties = false } = {}) {
  return { properties: !!hasProperties, advisor: false, investments: false }
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

// Módulos apagados que justifican la fila "Activar más funciones" de "Más":
// los que venían encendidos. Inversiones apagado es el estado normal de todas
// las cuentas; contarlo sumaría una fila a quien nunca tuvo una.
export function promptableModulesOff(settings) {
  return modulesOff(settings).filter(id => MODULE_DEFAULTS[id])
}
