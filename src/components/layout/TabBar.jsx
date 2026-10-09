// src/components/layout/TabBar.jsx
// Navegación primaria en móvil (R01, decisiones D1/D2 de Walter, 08-oct-2026):
// barra ANCLADA de borde a borde con 3 pestañas — Inicio · Movimientos · Menú.
// Revierte a propósito la cápsula flotante de 5 ítems del 27-sep.
// Todo lo que vivía en la barra vieja sigue a mano: Presupuestos y el resto del
// NAV están en el Menú (pages/More), y el "+" es un botón propio (AddFab) fuera
// de la barra, abajo a la derecha (R02).
// La pestaña activa sale de activeTabFor(page) (R04): las páginas internas
// encienden su pestaña madre, así la barra nunca queda sin activo.
import { Home, ArrowLeftRight, LayoutGrid, Plus } from 'lucide-react'
import { activeTabFor, TAB_HOME, TAB_MOVEMENTS, TAB_MENU } from './navConfig.js'
import s from './shell.module.css'

const TABS = [
  { id: TAB_HOME,      Ic: Home,           lb: 'nav.dashboard' },
  { id: TAB_MOVEMENTS, Ic: ArrowLeftRight, lb: 'nav.sec.movements' },
  { id: TAB_MENU,      Ic: LayoutGrid,     lb: 'nav.menuLabel' },
]

export default function TabBar({ page, onNavigate, t }) {
  const active = activeTabFor(page)
  return (
    <nav className={s.tabbar} aria-label={t('nav.tabsLabel')} data-tabbar>
      {TABS.map(({ id, Ic, lb }) => {
        const on = active === id
        return (
          <button
            key={id}
            type="button"
            className={s.tab + (on ? ' ' + s.tabActive : '')}
            // aria-current solo cuando la página visible ES la raíz; en una página
            // interna (Metas, Ingresos) la pestaña se ve activa pero no es "la página".
            aria-current={on ? (page === id ? 'page' : 'true') : undefined}
            onClick={() => onNavigate(id)}
          >
            <span className={s.tabIc} aria-hidden="true">
              <Ic size={22} strokeWidth={on ? 2.2 : 1.7} />
            </span>
            <span className={s.tabLb}>{t(lb)}</span>
          </button>
        )
      })}
    </nav>
  )
}

// "+" propio (R02): Latón con ícono Navy, encima de la barra. Conserva
// data-tour="tab-add" para el recorrido del demo.
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
