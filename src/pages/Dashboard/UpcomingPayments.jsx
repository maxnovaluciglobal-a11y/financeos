// src/pages/Dashboard/UpcomingPayments.jsx — "¿qué viene?" (M5, pieza 3).
// Próximos pagos de los siguientes 30 días. Desde la unificación (08-oct-2026)
// salen de los movimientos fijos: cuotas de Deudas, Suscripciones y gastos
// fijos manuales, solo los PREVISTOS (lo ya confirmado no vuelve a aparecer).
// Fechas en hora local (dashboardModel.js).
import { useMemo } from 'react'
import Money from '../../components/Money.jsx'
import { IconTarjetas, NAV_ICONS } from '../../components/icons/Icons.jsx'
import { useT } from '../../i18n/useT.js'
import { fmtMoney, localDateStr } from '../../utils/index.js'
import { upcomingFromRules } from './dashboardModel.js'
import { CalendarClock } from 'lucide-react'
import s from './Home.module.css'

const SubIcon = NAV_ICONS.subscriptions

function parts(dateStr, lang) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  let mon = ''
  try { mon = dt.toLocaleDateString(lang, { month: 'short' }).replace('.', '') } catch {}
  let full = dateStr
  try { full = dt.toLocaleDateString(lang, { weekday: 'long', day: 'numeric', month: 'long' }) } catch {}
  return { day: d, mon, full }
}

const ManualIcon = ({ size }) => <CalendarClock size={size} strokeWidth={1.7} aria-hidden="true" />
const KIND_ICON = { debt: IconTarjetas, sub: SubIcon, manual: ManualIcon }
const KIND_LABEL = { debt: 'home.upcoming.kind.debt', sub: 'home.upcoming.kind.sub', manual: 'rec.source.manual' }

export default function UpcomingPayments({ rules, incomes, expenses, debts, subscriptions, sym, setPage }) {
  const { t, lang } = useT()
  const todayStr = localDateStr()
  const { items, total } = useMemo(
    () => upcomingFromRules(rules || [], { incomes, expenses, today: todayStr }),
    // la fecha de hoy entra en la clave: al pasar la medianoche se recalcula
    [rules, incomes, expenses, todayStr],
  )
  const tomorrowStr = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return localDateStr(d) })()
  const hiddenCount = total - items.length
  // Enlaces a donde se cargan las fechas: siempre que haya datos de ese tipo
  // (aunque ninguno caiga en los 5 primeros) y, sin pagos, a los dos.
  const hasDebts = (debts || []).length > 0
  const hasSubs = (subscriptions || []).length > 0

  return (
    <section className={`${s.card} rise`} aria-labelledby="home-upcoming-title">
      <div className={s.cardHead}>
        <h2 id="home-upcoming-title" className={s.cardTitle}>{t('home.upcoming.title')}</h2>
        <span className={s.cardHint}>{t('home.upcoming.hint')}</span>
      </div>

      {items.length === 0 ? (
        <p className={s.empty}>{t('home.upcoming.empty')}</p>
      ) : (
        <ul className={s.rows}>
          {items.map(it => {
            const p = parts(it.date, lang)
            const when = it.date === todayStr ? t('home.upcoming.today') : it.date === tomorrowStr ? t('home.upcoming.tomorrow') : null
            const Ic = KIND_ICON[it.kind] || ManualIcon
            return (
              <li key={it.id} className={`${s.row} ${s.payRow}`}>
                <div className={s.payDate} title={p.full}>
                  <span className={s.payDay} aria-hidden="true">{p.day}</span>
                  <span className={s.payMon} aria-hidden="true">{p.mon}</span>
                  <span className="sr-only">{p.full}</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className={s.payName}>{it.name}</div>
                  <div className={s.payKind}>
                    <Ic size={14} />
                    <span>{t(KIND_LABEL[it.kind] || 'rec.source.manual')}</span>
                    {when && <span className={s.payWhen}>· {when}</span>}
                  </div>
                </div>
                <div className={s.payAmt}><Money>{fmtMoney(it.amount, sym)}</Money></div>
              </li>
            )
          })}
        </ul>
      )}

      {hiddenCount > 0 && <div className={s.more}>{t(`home.upcoming.more.${hiddenCount === 1 ? 'one' : 'many'}`, { n: hiddenCount })}</div>}
      {setPage && (
        <div className={s.footLinks}>
          {(hasDebts || items.length === 0) && <button type="button" className={s.cardLink} onClick={() => setPage('debts')}>{t('dash.action.viewDebts')} →</button>}
          {(hasSubs || items.length === 0) && <button type="button" className={s.cardLink} onClick={() => setPage('subscriptions')}>{t('dash.action.viewSubs')} →</button>}
          <button type="button" className={s.cardLink} onClick={() => setPage('recurring')}>{t('rec.sheet.goList')} →</button>
        </div>
      )}
    </section>
  )
}
