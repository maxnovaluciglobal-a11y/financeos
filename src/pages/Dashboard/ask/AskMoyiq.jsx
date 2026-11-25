// src/pages/Dashboard/ask/AskMoyiq.jsx — "Pregúntale a moyiq" (Inicio v2,
// 24-nov-2026). Preguntas sugeridas que se responden EN EL TELÉFONO con reglas
// fijas (askAnswers.js) y las mismas cifras del Inicio: sin servidor ni modelo
// de lenguaje; la tarjeta y cada respuesta lo dicen. Se abre desde la tarjeta
// del Inicio y desde el ícono blanco de la cabecera.
import { useCallback } from 'react'
import { ChevronRight, CircleHelp } from 'lucide-react'
import Sheet from '../../../components/ui/Sheet.jsx'
import Money, { useMoney } from '../../../components/Money.jsx'
import { Isotipo } from '../../../components/Logo.jsx'
import { fmtMoney, fmtPct, catName, dateLocale } from '../../../utils/index.js'
import { monthLabel } from '../../shared/constants.js'
import { prevMonthOf } from '../dashboardModel.js'
import { ASK_QUESTIONS, answerFor, monthMode } from './askAnswers.js'
import p from './ask.module.css'
// "Ordenar mis movimientos" (24-nov-2026): propone categorías para grupos de
// movimientos parecidos y la persona confirma. Mismas reglas fijas en el teléfono.
import Proposals, { useProposals } from '../../../components/categories/Proposals.jsx'
import { withCategoryStrings } from '../../../i18n/categories/index.js'

export const TIDY_Q = 'tidy'

const cap = (x) => (x ? x.charAt(0).toLocaleUpperCase() + x.slice(1) : x)

// Nombre del mes para las frases ("octubre"; con el año si no es el actual).
export function monthName(ym, today = new Date(), locale = dateLocale()) {
  const [y, mo] = String(ym).split('-').map(Number)
  if (!y || !mo) return String(ym || '')
  const opts = y === today.getFullYear() ? { month: 'long' } : { month: 'long', year: 'numeric' }
  try { return new Intl.DateTimeFormat(locale, opts).format(new Date(y, mo - 1, 1)) } catch { return String(ym) }
}

// Las preguntas siguen al mes elegido en la cabecera: "este mes" solo si es el
// mes en curso; si no, "¿Cuánto gasté en octubre?" (revisión del 24-nov).
export function questionLabel(id, { activeMonth, t, today = new Date(), locale } = {}) {
  if (id === TIDY_Q) return t('propose.askChip')
  const current = !activeMonth || monthMode(activeMonth, today) === 'current'
  if (!current && (id === 'spent' || id === 'compare')) return t(`home.ask.q.${id}.other`, { month: monthName(activeMonth, today, locale) })
  return t(`home.ask.q.${id}`)
}

function AskCardBody({ onAsk, t, activeMonth }) {
  const tidy = useProposals().groups.length
  return (
    <section className={p.ask} aria-labelledby="home-ask-title">
      <div className={p.askHead}>
        <span className={p.askAvatarLg} aria-hidden="true"><Isotipo size={18} decorative style={{ color: 'var(--on-grad-text)' }} /></span>
        <div className={p.askHeadText}>
          <h2 id="home-ask-title" className={p.askTitle}>{t('home.ask.title')}</h2>
          <p className={p.askSub}>{t('home.ask.sub')}</p>
        </div>
      </div>
      <div className={p.chips}>
        {ASK_QUESTIONS.map(id => (
          <button key={id} type="button" className={p.chip} onClick={() => onAsk(id)} aria-haspopup="dialog">
            {questionLabel(id, { activeMonth, t })}
          </button>
        ))}
        {tidy > 0 && (
          <button type="button" className={p.chip} onClick={() => onAsk(TIDY_Q)} aria-haspopup="dialog">
            {questionLabel(TIDY_Q, { t })} <span className="num">({tidy})</span>
          </button>
        )}
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

function AskSheetBody({ open, q, onQ, onClose, data, sym, lang, setPage, t, onTour }) {
  const { m } = useMoney()
  const money = useCallback((n) => m(fmtMoney(n, sym)), [m, sym])
  const a = q && q !== TIDY_Q ? answerFor(q, data) : null
  const current = monthMode(data.activeMonth) === 'current'
  const mn = monthName(data.activeMonth)
  const label = (id) => questionLabel(id, { activeMonth: data.activeMonth, t })
  let body = null
  if (q === 'spent' && a) {
    const k = current ? '' : '.other'
    body = a.count === 0 ? <p className={p.ansLead}>{t(`home.ask.spent.none${k}`, { month: mn })}</p> : (
      <>
        <p className={p.ansLead}>{t(`home.ask.spent.body${k}`, { month: mn, v: money(a.spent), count: t(`home.count.${a.count === 1 ? 'one' : 'many'}`, { n: a.count }) })}</p>
        {a.share != null && <p className={p.ansText}>{t(`home.ask.spent.share${k}`, { month: mn, pct: fmtPct(a.share), inc: money(a.income) })}</p>}
      </>
    )
  } else if (q === 'top' && a) {
    body = a.rows.length === 0 ? <p className={p.ansLead}>{t(current ? 'home.ask.spent.none' : 'home.ask.spent.none.other', { month: mn })}</p> : (
      <>
        <p className={p.ansText}>{t(current ? 'home.ask.top.total' : 'home.ask.top.total.other', { month: mn, v: money(a.total) })}</p>
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
            { k: 'balance', label: t('home.ask.compare.balance'), row: a.balance },
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
        <p className={p.ansNote}>{t('home.ask.compare.balanceNote')}</p>
      </>
    )
  } else if (q === 'perDay' && a) {
    body = a.future ? <p className={p.ansLead}>{t('home.ask.perDay.future', { month: cap(mn) })}</p>
      : a.closed ? <p className={p.ansLead}>{t('home.ask.perDay.closed', { month: cap(mn), v: money(a.free) })}</p>
      : a.short ? <p className={p.ansLead}>{t('home.ask.perDay.short', { v: money(Math.abs(a.free)) })}</p>
        : (
          <>
            <p className={p.ansBig}><span className="num"><Money>{fmtMoney(a.perDay, sym)}</Money></span></p>
            <p className={p.ansLead}>{t(a.daysAfter === 0 ? 'home.ask.perDay.one' : 'home.ask.perDay.many', { v: money(a.perDay), n: a.daysAfter })}</p>
            <p className={p.ansNote}>{t('home.ask.perDay.note', { v: money(a.free) })}</p>
          </>
        )
  }
  if (q === TIDY_Q) {
    body = <TidyAnswer sym={sym} t={t} />
  }
  const others = ASK_QUESTIONS.filter(id => id !== q)
  return (
    <Sheet open={open} onClose={onClose} ariaLabel={q ? label(q) : t('home.ask.title')} maxWidth={460}>
      <div className={p.ansHead}>
        <span className={p.askAvatarLg} aria-hidden="true"><Isotipo size={18} decorative style={{ color: 'var(--on-grad-text)' }} /></span>
        <h2 className={p.sheetTitle}>{q ? label(q) : t('home.ask.title')}</h2>
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
          <button key={id} type="button" className={p.chipSheet} onClick={() => onQ(id)}>{label(id)}</button>
        ))}
      </div>
      <p className={p.ansSource}>{t('home.ask.source')}</p>
      {onTour && (
        <button type="button" className={p.ansCta} onClick={() => { onClose(); onTour() }}>
          <CircleHelp size={16} strokeWidth={1.8} aria-hidden="true" />{t('home.tourReplay')}
        </button>
      )}
    </Sheet>
  )
}

// Respuesta de "Ordenar mis movimientos": las propuestas, cada una con su
// confirmación y su Deshacer. Nada cambia sin un toque.
function TidyAnswer({ sym, t }) {
  const n = useProposals().groups.length
  return (
    <>
      <p className={p.ansLead}>{n === 0 ? t('propose.askNone') : t(n === 1 ? 'propose.askLead.one' : 'propose.askLead.many', { n })}</p>
      <Proposals limit={5} sym={sym} />
      <p className={p.ansNote}>{t('propose.askHow')}</p>
    </>
  )
}

// "Ordenar mis movimientos" usa la sección diferida src/i18n/categories.
export const AskCard = withCategoryStrings(AskCardBody, null)
export const AskSheet = withCategoryStrings(AskSheetBody, null)
