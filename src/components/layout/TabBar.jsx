// src/components/layout/TabBar.jsx
// Navegación primaria en móvil — reemplaza al hamburguesa + FAB flotante.
// El "+" central abre QuickAdd directo (mismo gesto de 1 toque que tenía el FAB,
// ahora bajo el pulgar); "more" navega a la página src/pages/More/index.jsx,
// que reusa el árbol completo de NAV (navConfig.js) como lista agrupada.
import { Home, ArrowLeftRight, Plus, Target, Ellipsis } from 'lucide-react'
import s from './shell.module.css'

const TABS = [
  { id: 'dashboard', Ic: Home,           lb: 'nav.dashboard' },
  { id: 'movements', Ic: ArrowLeftRight, lb: 'nav.expenses' },
  { id: 'add',       Ic: Plus,           lb: 'qa.title', primary: true },
  { id: 'budgets',   Ic: Target,         lb: 'nav.budgets' },
  { id: 'more',      Ic: Ellipsis,       lb: 'nav.more' },
]

export default function TabBar({ page, onNavigate, onAdd, t }) {
  return (
    <nav className={s.tabbar} aria-label={t('nav.menuLabel')}>
      {TABS.map(({ id, Ic, lb, primary }) => {
        const on = page === id
        return (
          <button
            key={id}
            type="button"
            className={primary ? s.tabAdd : s.tab + (on ? ' ' + s.tabActive : '')}
            aria-current={!primary && on ? 'page' : undefined}
            aria-label={primary ? t(lb) : undefined}
            data-tour={primary ? 'tab-add' : undefined}
            onClick={() => primary ? onAdd() : onNavigate(id)}
          >
            <Ic size={primary ? 24 : 21} strokeWidth={on ? 2.2 : 1.7} aria-hidden={primary || undefined} />
            {!primary && <span className={s.tabLb}>{t(lb)}</span>}
          </button>
        )
      })}
    </nav>
  )
}
