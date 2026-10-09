// src/pages/Dashboard/DonutEmpty.jsx — estado vacío de "Gastos por categoría"
// en el Inicio (feedback de Walter, 09-oct-2026: la tarjeta tiene que estar
// siempre, también en un mes sin gastos). Anillo vacío con la misma
// proporción que el donut, una frase y el atajo al Registro rápido ("+").
// Sin cifras (nada que ocultar con "ocultar montos") y sin animación.
import { useT } from '../../i18n/useT.js'
import { openQuickAdd } from '../../components/quickAddBus.js'
import hs from './Home.module.css'

export default function DonutEmpty() {
  const { t } = useT()
  return (
    <div className={hs.donutEmpty}>
      <svg className={hs.donutEmptyRing} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle cx="50" cy="50" r="41" fill="none" stroke="var(--sur3)" strokeWidth="16" />
        <circle cx="50" cy="50" r="49.25" fill="none" stroke="var(--brd2)" strokeWidth="0.75" />
        <circle cx="50" cy="50" r="32.75" fill="none" stroke="var(--brd2)" strokeWidth="0.75" />
      </svg>
      <div className={hs.donutEmptyBody}>
        <p className={hs.donutEmptyText}>{t('home.donut.empty')}</p>
        <button type="button" className={`fos-btn-secondary ${hs.donutEmptyBtn}`} onClick={() => openQuickAdd('expense')}>
          {t('home.donut.add')}
        </button>
      </div>
    </div>
  )
}
