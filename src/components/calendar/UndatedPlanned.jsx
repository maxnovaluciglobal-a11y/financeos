// src/components/calendar/UndatedPlanned.jsx — grupo "Sin fecha" (rial #47, D4)
// Previstos cuyo origen no tiene fecha (deuda sin vencimiento, suscripción sin
// próximo cobro): no se inventa un día en la cuadrícula. Se listan debajo, con
// la cantidad en una insignia y la palabra "Previsto". Solo se muestra si hay.

import { useId } from 'react'
import { CalendarClock } from 'lucide-react'
import Money from '../Money.jsx'
import { useT } from '../../i18n/useT.js'
import { fmtMoney } from '../../utils/index.js'
import c from './calendar.module.css'

export default function UndatedPlanned({ items, sym }) {
  const { t } = useT()
  const id = useId()
  if (!items?.length) return null
  return (
    <section className={c.undated} aria-labelledby={id}>
      <h3 id={id} className={c.undatedHd}>
        {t('movl.cal.undated.title')}
        <span className={c.badge} aria-label={t('movl.cal.undated.count', { n: items.length })}>{items.length}</span>
      </h3>
      <ul className={c.undatedRows}>
        {items.map((o) => {
          const income = o.kind === 'income'
          return (
            <li key={o.ruleId} className={c.undatedRow}>
              <span style={{ minWidth: 0 }}>
                <span className={c.undatedName} style={{ display: 'block' }}>{o.rule.description}</span>
                <span className={c.undatedMeta}>
                  {t(`rec.source.${o.rule.source || 'manual'}`)}
                  <span aria-hidden="true">·</span>
                  <CalendarClock size={12} strokeWidth={1.8} aria-hidden="true" />{t('rec.status.pending')}
                </span>
              </span>
              <span className={c.undatedAmt}><Money>{`${income ? '+' : '−'}${fmtMoney(o.expected ?? o.amount, sym)}`}</Money></span>
            </li>
          )
        })}
      </ul>
      <p className={c.undatedHint}>{t('movl.cal.undated.hint')}</p>
    </section>
  )
}
