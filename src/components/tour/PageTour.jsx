// src/components/tour/PageTour.jsx — compatibilidad (R08). Desde la ayuda en la
// app (26-nov-2026) el estado de los recorridos vive en components/help/useHelp.js
// y el overlay se monta desde HelpHost.jsx (diferido). Acá quedan los atajos de
// siempre para pedir un recorrido desde otra pantalla.
export { requestTourReplay, takeTourReplay, TOUR_REPLAY_EVENT, TOUR_REPLAY_KEY } from '../help/helpCore.js'
