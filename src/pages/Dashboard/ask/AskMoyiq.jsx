// src/pages/Dashboard/ask/AskMoyiq.jsx — "Pregúntale a moyiq" (Inicio v2,
// 24-nov-2026). Preguntas sugeridas que se responden EN EL TELÉFONO con reglas
// fijas (askAnswers.js) y las mismas cifras del Inicio: sin servidor ni modelo
// de lenguaje; la tarjeta y cada respuesta lo dicen. Se abre desde la tarjeta
// del Inicio y desde el ícono blanco de la cabecera.
import { useCallback } from 'react'
import { ChevronRight } from 'lucide-react'
import Sheet from '../../../components/ui/Sheet.jsx'
import Money, { useMoney } from '../../../components/Money.jsx'
import { Isotipo } from '../../../components/Logo.jsx'
import { fmtMoney, fmtPct, catName } from '../../../utils/index.js'
import { monthLabel } from '../../shared/constants.js'
import { prevMonthOf } from '../dashboardModel.js'
import { ASK_QUESTIONS, answerFor } from './askAnswers.js'
import p from './ask.module.css'

export function AskCard({ onAsk, t }) {
  return (
    <section className={p.ask} aria-labelledby="home-proto-ask">
      <div className={p.askHead}>
        <span className={p.askAvatarLg} aria-hidden="true"><Isotipo size={18} decorative style={{ color: 'var(--on-grad-text)' }} /></span>
        <div className={p.askHeadText}>
          <h2 id="home-proto-ask" className={p.askTitle}>{t('home.ask.title')}</h2>
          <p className={p.askSub}>{t('home.ask.sub')}</p>
        </div>
      </div>
      <div className={p.chips}>
        {ASK_QUESTIONS.map(id => (
          <button key={id} type="button" className={p.chip} onClick={() => onAsk(id)} aria-haspopup="dialog">
            {t(`home.ask.q.${id}`)}
          </button>
        ))}
      </div>
    </section>
  )
}

function Diff({ d, money, t, invert = false }) {
  if (Math.round(d) === 0) return <span className={p.diffSame}>{t('home.ask.compare.same')}</span>
  const up = d > 0
  const good = invert ? !up : up
  return (
    <span className={good ? p.diffGood : p.diffBad}>
      <span aria-hidden="true">{up ? '↑ ' : '↓ '}</span>
      {t(up ? 'home.ask.compare.more' : 'home.ask.compare.less', { v: money(Math.abs(d)) })}
    </span>
  )
}

export function AskSheet({ open, q, onQ, onClose, data, sym, lang, setPage, t }) {
  const { m } = useMoney()
  const money = useCallback((n) => m(fmtMoney(n, sym)), [m, sym])
  const a = q ? answerFor(q, data) : null
  let body = null
  if (q === 'spent' && a) {
    body = a.count === 0 ? <p className={p.ansLead}>{t('home.ask.spent.none')}</p> : (
      <>
        <p className={p.ansLead}>{t('home.ask.spent.body', { v: money(a.spent), count: t(`home.count.${a.count === 1 ? 'one' : 'many'}`, { n: a.count }) })}</p>
        {a.share != null && <p className={p.ansText}>{t('home.ask.spent.share', { pct: fmtPct(a.share), inc: money(a.income) })}</p>}
      </>
    )
  } else if (q === 'top' && a) {
    body = a.rows.length === 0 ? <p className={p.ansLead}>{t('home.ask.spent.none')}</p> : (
      <>
        <p className={p.ansText}>{t('home.ask.top.total', { v: money(a.total) })}</p>
        <ol className={p.topList}>
          {a.rows.map((r, i) => (
            <li key={r.category} className={p.topRow}>
              <span className={p.topRank} aria-hidden="true">{i + 1}</span>
              <span className={p.topMain}>
                <span className={p.topName}>{catName(r.category, lang)}</span>
                <span className={p.topBar} aria-hidden="true"><span style={{ width: `${Math.max(4, Math.round(r.share * 100))}%` }} /></span>
              </span>
              <span className={`num ${p.topAmt}`}><Money>{fmtMoney(r.amount, sym)}</Money><small>{fmtPct(r.share)}</small></span>
            </li>
          ))}
        </ol>
        {a.more > 0 && <p className={p.ansNote}>{t(`home.ask.top.more.${a.more === 1 ? 'one' : 'many'}`, { n: a.more })}</p>}
      </>
    )
  } else if (q === 'compare' && a) {
    const prevKey = prevMonthOf(data.activeMonth)
    body = !a.hasPrev ? <p className={p.ansLead}>{t('home.ask.compare.noPrev', { month: monthLabel(prevKey) })}</p> : (
      <>
        <p className={p.ansText}>{a.cutDay ? t('home.ask.compare.toDay', { month: monthLabel(prevKey), day: a.cutDay }) : t('home.ask.compare.full', { month: monthLabel(prevKey) })}</p>
        <dl className={p.cmp}>
          {[
            { k: 'income', label: t('dash.kpi.income'), row: a.income },
            { k: 'spent', label: t('dash.kpi.expenses'), row: a.spent, invert: true },
            { k: 'left', label: t('home.ask.compare.left'), row: a.left },
          ].map(r => (
            <div key={r.k} className={p.cmpRow}>
              <dt>{r.label}</dt>
              <dd>
                <span className={`num ${p.cmpVal}`}><Money>{fmtMoney(r.row.cur, sym)}</Money></span>
                <span className={`num ${p.cmpPrev}`}>{monthLabel(prevKey)}: <Money>{fmtMoney(r.row.prev, sym)}</Money></span>
                <Diff d={r.row.diff} money={money} t={t} invert={r.invert} />
              </dd>
            </div>
          ))}
        </dl>
      </>
    )
  } else if (q === 'perDay' && a) {
    body = a.short ? <p className={p.ansLead}>{t('home.ask.perDay.short', { v: money(Math.abs(a.free)) })}</p>
      : a.closed ? <p className={p.ansLead}>{t('home.ask.perDay.closed', { v: money(a.free) })}</p>
        : (
          <>
            <p className={p.ansBig}><span className="num"><Money>{fmtMoney(a.perDay, sym)}</Money></span></p>
            <p className={p.ansLead}>{t(a.daysLeft === 1 ? 'home.ask.perDay.one' : 'home.ask.perDay.many', { v: money(a.perDay), n: a.daysLeft })}</p>
            <p className={p.ansNote}>{t('home.ask.perDay.note', { v: money(a.free) })}</p>
          </>
        )
  }
  const others = ASK_QUESTIONS.filter(id => id !== q)
  return (
    <Sheet open={open} onClose={onClose} ariaLabel={q ? t(`home.ask.q.${q}`) : t('home.ask.title')} maxWidth={460}>
      <div className={p.ansHead}>
        <span className={p.askAvatarLg} aria-hidden="true"><Isotipo size={18} decorative style={{ color: 'var(--on-grad-text)' }} /></span>
        <h2 className={p.sheetTitle}>{q ? t(`home.ask.q.${q}`) : t('home.ask.title')}</h2>
      </div>
      <div className={p.ans} aria-live="polite">{body}</div>
      {q && q !== 'perDay' && setPage && (
        <button type="button" className={p.ansCta} onClick={() => { onClose(); setPage('movements') }}>
          {t('home.ask.cta')}<ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
      <p className={p.ansOthersLb}>{q ? t('home.ask.others') : t('home.ask.open')}</p>
      <div className={p.chipsSheet}>
        {(q ? others : ASK_QUESTIONS).map(id => (
          <button key={id} type="button" className={p.chipSheet} onClick={() => onQ(id)}>{t(`home.ask.q.${id}`)}</button>
        ))}
      </div>
      <p className={p.ansSource}>{t('home.ask.source')}</p>
    </Sheet>
  )
}
