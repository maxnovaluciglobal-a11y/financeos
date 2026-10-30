// src/pages/Movements/MovementsList.jsx — la lista primero (UI-M3, B3a)
// Búsqueda, chips de filtro (origen fijo/único y categoría), grupos por día con
// lo que entró y lo que salió, y filas que abren el detalle en una hoja.
// Ingresos y gastos en la misma lista (D-B): el tipo lo elige el control
// "Todos · Gastos · Ingresos" de la página. Modelo: Copilot (agrupado por día),
// Revolut (fila), Flowbite/shadcn (detalle en hoja).

import { useMemo, useState } from 'react'
import { Search, Repeat, ArrowDownLeft } from 'lucide-react'
import Amount from '../../components/Amount.jsx'
import CategoryIcon from '../../components/CategoryIcon.jsx'
import { InlineIcon } from '../../components/icons/SignalIcon.jsx'
import { useT } from '../../i18n/useT.js'
import { catName, expSubcatLabel, dateLocale, localDateStr, fmtDayMonth } from '../../utils/index.js'
import { filterMovements, groupByDay, categoriesByAmount, dayLabel, isFixed, inLens } from './movementsList.js'
import s from './movements.module.css'

const PAGE = 40

export default function MovementsList({ items, type = 'all', sym, lens, category, onCategory, onOpen, toolbarEnd, empty }) {
  const { t, lang } = useT()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('all') // origen: 'all' | 'oneoff' | 'fixed'
  const [limit, setLimit] = useState(PAGE)

  const catNameOf = (c) => catName(c, lang)
  const ofType = useMemo(() => filterMovements(items, { type }), [items, type])
  const cats = useMemo(() => categoriesByAmount(ofType), [ofType])
  const filtered = useMemo(
    () => filterMovements(ofType, { query, category, kind, catNameOf: (c) => catName(c, lang) }),
    [ofType, query, category, kind, lang],
  )
  const shown = filtered.slice(0, limit)
  const groups = useMemo(() => groupByDay(shown), [shown])
  const today = localDateStr()
  const filteredOn = !!(query.trim() || category || kind !== 'all')
  const amt = (n) => inLens(n, lens)

  // Origen como dos interruptores (sin un segundo "Todos": el "Todos" de la
  // página es el del tipo). Tocar el activo lo apaga.
  const kinds = [['oneoff', t('movl.filter.oneoff')], ['fixed', t('movl.filter.fixed')]]
  const reset = () => setLimit(PAGE)

  return (
    <section aria-labelledby="movl-title" data-tour="mov-list">
      <h2 id="movl-title" className="sr-only">{t('movl.title')}</h2>
      <div className={s.toolbar}>
        <div className={s.search} role="search">
          <Search size={16} strokeWidth={1.7} aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); reset() }}
            placeholder={t('movl.search.ph')} aria-label={t('movl.search.label')} />
        </div>
        {toolbarEnd}
      </div>

      {ofType.length > 0 && (
        <div className={s.chips} role="group" aria-label={t('movl.filter.label')}>
          {kinds.map(([k, label]) => (
            <button key={k} type="button" className="fos-chip" aria-pressed={kind === k}
              onClick={() => { setKind(kind === k ? 'all' : k); reset() }}>{label}</button>
          ))}
          {(cats.length > 1 || category) && <span className={s.chipSep} aria-hidden="true" />}
          {(cats.length > 1 || category) && cats.map((c) => (
            <button key={c} type="button" className="fos-chip" aria-pressed={category === c}
              onClick={() => { onCategory(category === c ? null : c); reset() }}>
              <CategoryIcon category={c} size={20} />{catNameOf(c)}
            </button>
          ))}
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite">{filteredOn ? t('movl.count', { n: filtered.length }) : ''}</p>

      {ofType.length === 0 ? empty : filtered.length === 0 ? (
        <div className={s.empty}>
          <p style={{ margin: '0 0 8px' }}>{t('movl.empty.filtered')}</p>
          <button type="button" className="fos-link" onClick={() => { setQuery(''); setKind('all'); onCategory(null) }}>{t('movl.clear')}</button>
        </div>
      ) : (
        <>
          {groups.map((g) => (
            <div key={g.date} className={s.day}>
              <div className={s.dayHd}>
                <h3>{dayLabel(g.date, { today, locale: dateLocale(), t })}</h3>
                <span className={s.dayTotal}>
                  {g.income > 0 && (
                    <span className={s.dayIn}>
                      <span className="sr-only">{t('movl.type.income')}: </span>
                      <Amount value={amt(g.income)} sym={sym} plus />
                    </span>
                  )}
                  {(g.expense > 0 || g.income === 0) && (
                    <span>
                      <span className="sr-only">{t('movl.type.expense')}: </span>
                      <Amount value={-amt(g.expense)} sym={sym} />
                    </span>
                  )}
                </span>
              </div>
              <ul className={s.rows}>
                {g.items.map((e) => {
                  const income = e.kind === 'income'
                  const name = e.name || catNameOf(e.category)
                  return (
                    <li key={e.key || e.id}>
                      <button type="button" className={s.row} aria-haspopup="dialog" onClick={() => onOpen(e)}>
                        <CategoryIcon category={e.category} />
                        <span className={s.rowText}>
                          <span className={s.rowName}>{e.inv && <InlineIcon kind="investment" size={12} />}{name}</span>
                          <span className={s.rowMeta}>
                            {income && type === 'all' && <><ArrowDownLeft size={12} strokeWidth={1.8} aria-hidden="true" />{t('movl.kind.income')}<span aria-hidden="true">·</span></>}
                            {catNameOf(e.category)}{e.subcategory ? ` › ${expSubcatLabel(e.subcategory, lang)}` : ''}
                            {isFixed(e) && <><span aria-hidden="true">·</span><Repeat size={12} strokeWidth={1.7} aria-hidden="true" />{t('movl.filter.fixed')}</>}
                            <span className="sr-only">{`, ${fmtDayMonth(e.date)}`}</span>
                          </span>
                        </span>
                        <Amount className={income ? `${s.rowAmt} ${s.rowAmtIn}` : s.rowAmt}
                          value={income ? amt(e.amount) : -amt(e.amount)} sym={sym} plus={income} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
          {filtered.length > limit && (
            <div className={s.more}>
              <button type="button" className="fos-link" onClick={() => setLimit((l) => l + PAGE)}>
                {t('mov.list.showMore', { n: Math.min(PAGE, filtered.length - limit) })}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
