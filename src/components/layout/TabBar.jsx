// src/components/layout/TabBar.jsx
// Navegación primaria en móvil (L2, aprobado por Walter el 21-oct-2026): barra
// ANCLADA de borde a borde con 5 destinos — Inicio · Movimientos · Presupuestos
// · Metas · Menú —, el mismo modelo que Invest. Reemplaza las 3 pestañas de la
// decisión D2 (08-oct).
// Activo igual que Invest: tinta Navy 600 y una barra Latón de 3 px en el borde
// superior de la pestaña (Latón marca "dónde estás"). El "+" sigue siendo un
// botón propio (AddFab) encima de la barra, abajo a la derecha: no tapa la barra.
// La pestaña activa sale de activeTabFor(page) (R04): las páginas internas
// encienden su pestaña madre, así la barra nunca queda sin activo.
import { Home, ArrowLeftRight, Wallet, Target, LayoutGrid, Plus } from 'lucide-react'
import { activeTabFor, TAB_HOME, TAB_MOVEMENTS, TAB_BUDGETS, TAB_GOALS, TAB_MENU } from './navConfig.js'
import s from './shell.module.css'

export const TABS = [
  { id: TAB_HOME,      Ic: Home,           lb: 'nav.dashboard' },
  { id: TAB_MOVEMENTS, Ic: ArrowLeftRight, lb: 'nav.sec.movements' },
  { id: TAB_BUDGETS,   Ic: Wallet,         lb: 'nav.budgets' },
  { id: TAB_GOALS,     Ic: Target,         lb: 'nav.goals' },
  { id: TAB_MENU,      Ic: LayoutGrid,     lb: 'nav.menuLabel' },
]

export default function TabBar({ page, onNavigate, t }) {
  const active = activeTabFor(page)
  return (
    <nav className={s.tabbar} aria-label={t('nav.tabsLabel')} data-tabbar>
      {TABS.map((tab) => {
        const { id, Ic, lb } = tab
        const on = active === id
        return (
          <button
            key={id}
            type="button"
            className={s.tab + (on ? ' ' + s.tabActive : '')}
            // aria-current solo cuando la página visible ES la raíz; en una página
            // interna (Ingresos, Ajustes) la pestaña se ve activa pero no es "la página".
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

// "+" propio (R02): Latón con ícono Navy (la acción primaria), encima de la
// barra. Conserva data-tour="tab-add" para el recorrido del demo.
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
