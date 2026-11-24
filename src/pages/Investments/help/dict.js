// Textos de la Ayuda de Inversiones: español en el chunk de la hoja de ayuda,
// en/pt/de a demanda (src/i18n/lazyDict.js), así no pesan en la carga inicial
// ni en el chunk de Inversiones (la hoja se carga con lazy()).
import { createLazyDict, useLazyDict } from '../../../i18n/lazyDict.js'
import es from './strings.es.js'

export const helpDict = createLazyDict(es, {
  en: () => import('./strings.en.js'),
  pt: () => import('./strings.pt.js'),
  de: () => import('./strings.de.js'),
})

export const useHelpT = () => useLazyDict(helpDict)

// Grupos y preguntas, en orden (las de la ayuda de Invest, inventario 06,
// más las de alertas). Cada pregunta: hlp.q.<id> y hlp.a.<id>.
export const HELP_GROUPS = [
  { id: 'nav', qs: ['sections', 'views', 'asset'] },
  { id: 'data', qs: ['fresh', 'ma', 'rsi', 'macd'] },
  { id: 'risk', qs: ['calc', 'stop', 'cash', 'tramos'] },
  { id: 'alerts', qs: ['alertsHow', 'alertsOld'] },
  { id: 'account', qs: ['where', 'ai', 'free'] },
]
export const HELP_EMAIL = 'support@moyiq.app'
