// src/components/layout/TabBar.jsx
// Navegación primaria en móvil (Inicio v2, 24-nov-2026, aprobado por Walter):
// 3 destinos — Inicio · Movimientos · Más — y el "+" aparte. Reemplaza los 5
// de L2 (21-oct), cuyas etiquetas se cortaban; Presupuestos y Metas están en
// los botones redondos del Inicio y al principio de Más.
// Cápsula flotante (19-nov-2026, aprobada por Walter; referencias Gocash y
// Rial): los 5 destinos van en una píldora translúcida separada de los bordes,
// y el "+" queda a su lado como botón redondo propio, en la misma zona del
// pulgar (no se mezcla con los destinos: es una acción, no un lugar). La
// pestaña activa es una píldora rellena con el ícono relleno. Si alguna
// etiqueta no entra, quedan solo los íconos (siguen siendo el nombre accesible).
// AddFab queda para Ingresos, la pantalla empujada que no tiene barra.
// La pestaña activa sale de activeTabFor(page) (R04): las páginas internas
// encienden su pestaña madre, así la barra nunca queda sin activo.
import { useLayoutEffect, useRef, useState } from 'react'
import { Home, ArrowLeftRight, LayoutGrid, Plus, Wallet } from 'lucide-react'
import { activeTabFor, TAB_HOME, TAB_MOVEMENTS, TAB_BUDGETS, TAB_MENU } from './navConfig.js'
import { tabPress } from './pageStack.js'
import s from './shell.module.css'

// Íconos rellenos de la pestaña activa, en la grilla de 24 de lucide.
const solid = (d) => function SolidIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" clipRule="evenodd"><path d={d} /></svg>
}
const HomeOn = solid('M12 2.6 3.3 9.8c-.2.2-.3.4-.3.7V20c0 .6.4 1 1 1h5.2v-6.4c0-.3.2-.6.6-.6h4.4c.4 0 .6.3.6.6V21H20c.6 0 1-.4 1-1v-9.5c0-.3-.1-.5-.3-.7L12 2.6Z')
const MovementsOn = solid('M8 3 2.6 8.2 8 13.4V10h13.4V6.5H8V3Zm8 7.6V14H2.6v3.5H16V21l5.4-5.2L16 10.6Z')
const WalletOn = solid('M5 4h12a2 2 0 0 1 2 2v1.2H6a1 1 0 0 0 0 2h13A2 2 0 0 1 21 11v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm11.5 9.2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z')
const GridOn = solid('M4.5 3h4A1.5 1.5 0 0 1 10 4.5v4A1.5 1.5 0 0 1 8.5 10h-4A1.5 1.5 0 0 1 3 8.5v-4A1.5 1.5 0 0 1 4.5 3Zm11 0h4A1.5 1.5 0 0 1 21 4.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 14 8.5v-4A1.5 1.5 0 0 1 15.5 3Zm-11 11h4a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 8.5 21h-4A1.5 1.5 0 0 1 3 19.5v-4A1.5 1.5 0 0 1 4.5 14Zm11 0h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5Z')

// Índice de la pestaña que va justo después del "+" (2 a cada lado).
const ADD_AT = 2

export const TABS = [
  { id: TAB_HOME,      Ic: Home,           On: HomeOn,      lb: 'nav.dashboard' },
  { id: TAB_MOVEMENTS, Ic: ArrowLeftRight, On: MovementsOn, lb: 'nav.sec.movements' },
  { id: TAB_BUDGETS,   Ic: Wallet,         On: WalletOn,    lb: 'nav.budgets' },
  { id: TAB_MENU,      Ic: LayoutGrid,     On: GridOn,      lb: 'nav.menuLabel' },
]

// Texto agrandado del sistema (AND-11): la WebView de Android escala la letra
// con su textZoom y la consulta de contenedor de shell.module.css (25em) no se
// entera, así que las etiquetas quedaban cortadas ("Ho…", "Transacti…"). Se
// mide de verdad: si alguna etiqueta no entra, quedan solo los íconos (la
// etiqueta sigue siendo el nombre accesible); si vuelven a entrar todas, vuelven.
// Pura para poder probarla: anchos naturales de las etiquetas, ancho visible de
// cada una y ancho de la cápsula.
export function tabLabelsFit({ natural, visible, pill, compact, pad = 12 }) {
  if (!natural.length || !pill) return !compact
  if (compact) return natural.reduce((a, w) => a + w + pad, 0) <= pill - 8
  // Una etiqueta de 1 px ya la ocultó la consulta de contenedor: no cuenta.
  return natural.every((w, i) => (visible[i] ?? 0) <= 1 || w <= visible[i] + 1)
}

function useTabLabelsFit(pillRef, deps) {
  const [compact, setCompact] = useState(false)
  const compactRef = useRef(compact)
  compactRef.current = compact
  useLayoutEffect(() => {
    const pill = pillRef.current
    if (!pill) return undefined
    const check = () => {
      const labels = [...pill.querySelectorAll('[data-tab-label]')]
      const fit = tabLabelsFit({
        natural: labels.map(l => l.scrollWidth),
        visible: labels.map(l => l.clientWidth),
        pill: pill.clientWidth,
        compact: compactRef.current,
      })
      if (fit === compactRef.current) setCompact(!fit)
    }
    check()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(check)
    ro.observe(pill)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps = textos de las pestañas
  }, deps)
  return compact
}

export default function TabBar({ page, onNavigate, onReselect, onAdd, t }) {
  const active = activeTabFor(page)
  const pillRef = useRef(null)
  const compact = useTabLabelsFit(pillRef, TABS.map(tab => t(tab.lb)))
  return (
    <nav className={s.tabbar} aria-label={t('nav.tabsLabel')} data-tabbar data-labels={compact ? 'off' : undefined}>
      <div className={s.tabPill} ref={pillRef}>
      {TABS.map((tab, i) => {
        const { id, Ic, On, lb } = tab
        const on = active === id
        const btn = (
          <button
            key={id}
            type="button"
            className={s.tab + (on ? ' ' + s.tabActive : '')}
            // aria-current solo cuando la página visible ES la raíz; en una página
            // interna (Ingresos, Ajustes) la pestaña se ve activa pero no es "la página".
            aria-current={on ? (page === id ? 'page' : 'true') : undefined}
            onClick={() => (tabPress(page, id) === 'top' ? onReselect?.() : onNavigate(id))}
          >
            <span className={s.tabIc} aria-hidden="true">
              {on ? <On /> : <Ic size={22} strokeWidth={1.7} />}
            </span>
            <span className={s.tabLb} data-tab-label>{t(lb)}</span>
          </button>
        )
        // Opción D: el "+" va en el centro de la cápsula, entre las dos mitades.
        if (i !== ADD_AT || !onAdd) return btn
        return [
          <span key="add" className={s.tabAddSlot}>
            <button type="button" className={s.tabAdd} aria-label={t('qa.title')} data-tour="tab-add" onClick={onAdd}>
              <Plus size={30} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </span>,
          btn,
        ]
      })}
      </div>
    </nav>
  )
}

// "+" flotante (R02): solo donde no hay barra (Ingresos). Mismo botón redondo
// violeta que el de la cápsula.
export function AddFab({ onAdd, t }) {
  return (
    <button
      type="button"
      className={s.fab}
      aria-label={t('qa.title')}
      data-tour="tab-add"
      onClick={onAdd}
    >
      <Plus size={24} strokeWidth={2.2} aria-hidden="true" />
    </button>
  )
}
