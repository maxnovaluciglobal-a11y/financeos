// src/components/ahead/ProjectionCard.jsx — "Próximos 12 meses" (24-nov-2026).
// Lo comprometido en fijos, suscripciones y cuotas de deudas,
// mes a mes, con la cuota "4 de 12" y el ✓ de lo ya pagado. Vive en Fijos
// (sin pestaña nueva) y se carga con lazy(): ni su código ni sus textos van
// al JS inicial. Lógica en utils/ahead.js.
//
// Cada mes es una fila-botón de 44 px o más (barra apilada por origen y
// total); al tocarla se despliega su detalle. Los colores de la barra van con
// leyenda y cada fila dice el total en texto: el color nunca es el único dato.
import { useId, useMemo, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Card, CardHeader } from '../ui/index.jsx'
import Money, { useMoney } from '../Money.jsx'
import { fmtMoney, monthYearLabel, localDateStr } from '../../utils/index.js'
import { projectCommitments, projectionSummary, PROJECTION_MONTHS } from '../../utils/ahead.js'
import { dateParts } from './dateParts.js'
import { useAheadStrings } from '../../i18n/ahead/index.js'
import s from './ahead.module.css'

const SOURCES = ['manual', 'subscription', 'debt']

export function InstallmentTag({ inst, t }) {
  if (!inst) return null
  return <span className={`num ${s.inst}`}>{t('ahead.inst', { n: inst.n, total: inst.total })}</span>
}

export function PaidMark({ t, label = 'ahead.paid' }) {
  return (
    <span className={s.paid}>
      <Check size={14} strokeWidth={2.4} aria-hidden="true" />
      {t(label)}
    </span>
  )
}

function MonthDetail({ month, sym, t, tApp, lang, id }) {
  if (!month.items.length) return <p id={id} className={s.monthEmpty}>{t('ahead.proj.monthEmpty')}</p>
  return (
    <ul id={id} className={s.items}>
      {month.items.map(it => {
        const p = dateParts(it.date, lang)
        return (
          <li key={it.key} className={s.item}>
            <span className={`num ${s.itemDate}`}>{p.day} {p.mon}<span className="sr-only">, {p.full}</span></span>
            <span className={s.itemBody}>
              <span className={s.itemName}>{it.name}</span>
              <span className={s.itemMeta}>
                <span>{t(`ahead.proj.src.${it.source}`)}</span>
                <InstallmentTag inst={it.installment} t={t} />
                {it.installment && it.installment.n === it.installment.total && <span>{t('ahead.proj.lastInst')}</span>}
                {it.status === 'paid' && <PaidMark t={t} />}
                {it.status === 'overdue' && <span className={s.overdue}>{tApp('rec.status.overdue')}</span>}
              </span>
            </span>
            <span className={`num ${s.itemAmt} ${it.status === 'paid' ? s.itemAmtPaid : ''}`}><Money>{fmtMoney(it.amount, sym)}</Money></span>
          </li>
        )
      })}
    </ul>
  )
}

export default function ProjectionCard({ rules, debts, incomes, expenses, sym, months = PROJECTION_MONTHS }) {
  const { t, lang, ready } = useAheadStrings()
  const { m } = useMoney()
  const today = localDateStr()
  const uid = useId()
  const data = useMemo(() => projectCommitments({ rules, debts, incomes, expenses, today, months }), [rules, debts, incomes, expenses, today, months])
  const sum = useMemo(() => projectionSummary(data), [data])
  const [open, setOpen] = useState(() => data[0]?.ym || null)
  if (!ready) return null

  const max = Math.max(1, ...data.map(x => x.total))
  const hasAny = data.some(x => x.items.length)

  return (
    <Card data-tour="rec-ahead">
      <CardHeader title={t('ahead.proj.title', { n: months })} />
      <p className={s.sub}>{t('ahead.proj.sub')}</p>
      {!hasAny ? <p className={s.monthEmpty}>{t('ahead.proj.empty')}</p> : (
        <>
          <dl className={s.stats}>
            <div><dt>{t('ahead.proj.total')}</dt><dd className="num"><Money>{fmtMoney(sum.total, sym)}</Money></dd></div>
            <div><dt>{t('ahead.proj.avg')}</dt><dd className="num"><Money>{fmtMoney(sum.average, sym)}</Money></dd></div>
            {sum.peak && <div><dt>{t('ahead.proj.peak')}</dt><dd><span className="num"><Money>{fmtMoney(sum.peak.total, sym)}</Money></span> <span className={s.statNote}>{monthYearLabel(sum.peak.ym)}</span></dd></div>}
          </dl>
          <ul className={s.legend} aria-hidden="true">
            {SOURCES.map(src => <li key={src}><span className={s.swatch} data-src={src} />{t(`ahead.proj.src.${src}`)}</li>)}
          </ul>
          <ul className={s.months} aria-label={t('ahead.proj.chartAria')}>
            {data.map((mo, i) => {
              const isOpen = open === mo.ym
              const detailId = `${uid}-${mo.ym}`
              const parts = SOURCES.filter(src => mo.bySource[src] > 0)
              return (
                <li key={mo.ym}>
                  <button type="button" className={s.monthRow} aria-expanded={isOpen} aria-controls={detailId}
                    onClick={() => setOpen(isOpen ? null : mo.ym)}>
                    <span className={s.monthName}>{monthYearLabel(mo.ym)}</span>
                    <span className={s.bar} aria-hidden="true">
                      {parts.map(src => (
                        <span key={src} className={s.seg} data-src={src} style={{ width: `${(mo.bySource[src] / max * 100).toFixed(2)}%` }} />
                      ))}
                    </span>
                    <span className={`num ${s.monthAmt}`}><Money>{fmtMoney(mo.total, sym)}</Money></span>
                    <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" className={s.chev} data-open={isOpen ? '1' : undefined} />
                    {i === 0 && mo.paid > 0 && <span className={`num ${s.monthPaid}`}>{t('ahead.proj.paidOf', { paid: m(fmtMoney(mo.paid, sym)), total: m(fmtMoney(mo.total, sym)) })}</span>}
                  </button>
                  {isOpen && <MonthDetail month={mo} sym={sym} t={t} tApp={t} lang={lang} id={detailId} />}
                </li>
              )
            })}
          </ul>
          {sum.ending.length > 0 && (
            <p className={s.ends}>{t('ahead.proj.ends', { names: sum.ending.map(e => e.name).join(', ') })}</p>
          )}
        </>
      )}
    </Card>
  )
}
