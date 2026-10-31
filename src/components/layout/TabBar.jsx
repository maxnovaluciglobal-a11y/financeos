// src/components/layout/TabBar.jsx
// Navegación primaria en móvil (L2, aprobado por Walter el 21-oct-2026): barra
// ANCLADA de borde a borde con 5 destinos — Inicio · Movimientos · Presupuestos
// · Metas · Menú. Reemplaza las 3 pestañas de la decisión D2 (08-oct).
// Activo (31-oct-2026): ícono relleno y tinta, como iOS y Android; la barra
// Latón de 3 px era un patrón de pestañas web. El "+" vive DENTRO de la barra, a
// la derecha, en la misma zona del pulgar: ya no flota sobre la columna de
// montos. AddFab queda para Ingresos, la pantalla empujada que no tiene barra.
// La pestaña activa sale de activeTabFor(page) (R04): las páginas internas
// encienden su pestaña madre, así la barra nunca queda sin activo.
import { Home, ArrowLeftRight, Wallet, Target, LayoutGrid, Plus } from 'lucide-react'
import { activeTabFor, TAB_HOME, TAB_MOVEMENTS, TAB_BUDGETS, TAB_GOALS, TAB_MENU } from './navConfig.js'
import { tabPress } from './pageStack.js'
import s from './shell.module.css'

// Íconos rellenos de la pestaña activa, en la grilla de 24 de lucide.
const solid = (d) => function SolidIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" clipRule="evenodd"><path d={d} /></svg>
}
const HomeOn = solid('M12 2.6 3.3 9.8c-.2.2-.3.4-.3.7V20c0 .6.4 1 1 1h5.2v-6.4c0-.3.2-.6.6-.6h4.4c.4 0 .6.3.6.6V21H20c.6 0 1-.4 1-1v-9.5c0-.3-.1-.5-.3-.7L12 2.6Z')
const MovementsOn = solid('M8 3 2.6 8.2 8 13.4V10h13.4V6.5H8V3Zm8 7.6V14H2.6v3.5H16V21l5.4-5.2L16 10.6Z')
const WalletOn = solid('M5.2 3.6A3.2 3.2 0 0 0 2 6.8v10.4a3.2 3.2 0 0 0 3.2 3.2h13.6a3.2 3.2 0 0 0 3.2-3.2v-1.7h-4.6a3.5 3.5 0 0 1 0-7H22V9.8a3 3 0 0 0-3-3H5.2a.8.8 0 0 1 0-1.6H19V3.6H5.2Zm12.2 7.4a2 2 0 1 0 0 4H22v-4h-4.6Z')
const TargetOn = solid('M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 3.6a6.4 6.4 0 1 1 0 12.8 6.4 6.4 0 0 1 0-12.8ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z')
const GridOn = solid('M4.5 3h4A1.5 1.5 0 0 1 10 4.5v4A1.5 1.5 0 0 1 8.5 10h-4A1.5 1.5 0 0 1 3 8.5v-4A1.5 1.5 0 0 1 4.5 3Zm11 0h4A1.5 1.5 0 0 1 21 4.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 14 8.5v-4A1.5 1.5 0 0 1 15.5 3Zm-11 11h4a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 8.5 21h-4A1.5 1.5 0 0 1 3 19.5v-4A1.5 1.5 0 0 1 4.5 14Zm11 0h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5Z')

export const TABS = [
  { id: TAB_HOME,      Ic: Home,           On: HomeOn,      lb: 'nav.dashboard' },
  { id: TAB_MOVEMENTS, Ic: ArrowLeftRight, On: MovementsOn, lb: 'nav.sec.movements' },
  { id: TAB_BUDGETS,   Ic: Wallet,         On: WalletOn,    lb: 'nav.budgets' },
  { id: TAB_GOALS,     Ic: Target,         On: TargetOn,    lb: 'nav.goals' },
  { id: TAB_MENU,      Ic: LayoutGrid,     On: GridOn,      lb: 'nav.menuLabel' },
]

export default function TabBar({ page, onNavigate, onReselect, onAdd, t }) {
  const active = activeTabFor(page)
  return (
    <nav className={s.tabbar} aria-label={t('nav.tabsLabel')} data-tabbar>
      {TABS.map((tab) => {
        const { id, Ic, On, lb } = tab
        const on = active === id
        return (
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
            <span className={s.tabLb}>{t(lb)}</span>
          </button>
        )
      })}
      {onAdd && (
        <span className={s.tabAddSlot}>
          <button type="button" className={s.tabAdd} aria-label={t('qa.title')} data-tour="tab-add" onClick={onAdd}>
            <Plus size={24} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </span>
      )}
    </nav>
  )
}

// "+" flotante (R02): solo donde no hay barra (Ingresos). Latón con ícono Navy.
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
