// src/components/proTrial/uiDict.js — textos cortos de la prueba de Pro sin
// tarjeta (botón Empezar, aviso "Pro activo hasta…", Ajustes y Más), como
// diccionario diferido (src/i18n/lazyDict.js): no suspende la pantalla; si el
// idioma todavía no llegó, cae al traductor de la app y se vuelve a pintar.
import { createLazyDict, useLazyDict } from '../../i18n/lazyDict.js'
import es from './ui.es.js'

export const trialUiDict = createLazyDict(es, {
  en: () => import('./ui.en.js'),
  pt: () => import('./ui.pt.js'),
  de: () => import('./ui.de.js'),
})

export const useTrialUiT = () => useLazyDict(trialUiDict)
