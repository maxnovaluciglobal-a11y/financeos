// src/demo/DemoTour.jsx
// Recorrido guiado del demo (T09). El overlay vive ahora en
// components/tour/Tour.jsx (R08, compartido con los recorridos por pantalla);
// acá quedan los pasos del demo y su marca de "visto".
// Se marca como visto en localStorage (fnos_demo_tour_done): arranca solo la
// primera vez y se repite desde el "?" del banner.
import { useCallback } from 'react'
import Tour from '../components/tour/Tour.jsx'

export const TOUR_DONE_KEY = 'fnos_demo_tour_done'
export const hasSeenDemoTour = () => { try { return localStorage.getItem(TOUR_DONE_KEY) === '1' } catch { return true } }
const markTourSeen = () => { try { localStorage.setItem(TOUR_DONE_KEY, '1') } catch {} }

// Orden del recorrido. title/body son claves i18n.
const STEPS = [
  { id: 'kpi-free',    title: 'demo.tour.kpiFree.title',    body: 'demo.tour.kpiFree.body' },
  { id: 'tab-add',     title: 'demo.tour.tabAdd.title',     body: 'demo.tour.tabAdd.body' },
  { id: 'iq-score',    title: 'demo.tour.iqScore.title',    body: 'demo.tour.iqScore.body' },
  { id: 'nav-country', title: 'demo.tour.navCountry.title', body: 'demo.tour.navCountry.body' },
]

export default function DemoTour({ open, onClose }) {
  const close = useCallback(() => { markTourSeen(); onClose?.() }, [onClose])
  return <Tour open={open} steps={STEPS} onClose={close} labelledBy="demo-tour-title" />
}
