// src/pages/Movements/MovementsList.jsx — la lista primero (UI-M3)
// Búsqueda, chips de filtro (fijo/único y categoría), grupos por día con su
// subtotal y filas que abren el detalle en una hoja. Modelo: Copilot (agrupado
// por día), Revolut (fila), Flowbite/shadcn (detalle en hoja).

import { useMemo, useState } from 'react'
import { Search, Repeat } from 'lucide-react'
import Amount from '../../components/Amount.jsx'
import CategoryIcon from '../../components/CategoryIcon.jsx'
import { InlineIcon } from '../../components/icons/SignalIcon.jsx'
import { useT } from '../../i18n/useT.js'
import { catName, expSubcatLabel, dateLocale, localDateStr, fmtDayMonth } from '../../utils/index.js'
import { filterMovements, groupByDay, categoriesByAmount, dayLabel, isFixed } from './movementsList.js'
import s from './movements.module.css'

const PAGE = 40

export default function MovementsList({ expenses, sym, category, onCategory, onOpen, toolbarEnd, empty }) {
  const { t, lang } = useT()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('all')
  const [limit, setLimit] = useState(PAGE)

  const catNameOf = (c) => catName(c, lang)
  const cats = useMemo(() => categoriesByAmount(expenses), [expenses])
  const filtered = useMemo(
    () => filterMovements(expenses, { query, category, kind, catNameOf: (c) => catName(c, lang) }),
    [expenses, query, category, kind, lang],
  )
  const shown = filtered.slice(0, limit)
  const groups = useMemo(() => groupByDay(shown), [shown])
  const today = localDateStr()
  const filteredOn = !!(query.trim() || category || kind !== 'all')

  const kinds = [['all', t('movl.filter.all')], ['oneoff', t('movl.filter.oneoff')], ['fixed', t('movl.filter.fixed')]]

  return (
    <section aria-labelledby="movl-title" data-tour="mov-list">
      <h2 id="movl-title" className="sr-only">{t('movl.title')}</h2>
      <div className={s.toolbar}>
        <div className={s.search} role="search">
          <Search size={16} strokeWidth={1.7} aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE) }}
            placeholder={t('movl.search.ph')} aria-label={t('movl.search.label')} />
        </div>
        {toolbarEnd}
      </div>

      {expenses.length > 0 && (
        <div className={s.chips} role="group" aria-label={t('movl.filter.label')}>
          {kinds.map(([k, label]) => (
            <button key={k} type="button" className="fos-chip" aria-pressed={kind === k} onClick={() => { setKind(k); setLimit(PAGE) }}>{label}</button>
          ))}
          {(cats.length > 1 || category) && <span className={s.chipSep} aria-hidden="true" />}
          {(cats.length > 1 || category) && cats.map((c) => (
            <button key={c} type="button" className="fos-chip" aria-pressed={category === c}
              onClick={() => { onCategory(category === c ? null : c); setLimit(PAGE) }}>
              <CategoryIcon category={c} size={20} />{catNameOf(c)}
            </button>
          ))}
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite">{filteredOn ? t('movl.count', { n: filtered.length }) : ''}</p>

      {expenses.length === 0 ? empty : filtered.length === 0 ? (
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
                  <Amount value={-g.total} sym={sym} />
                </span>
              </div>
              <ul className={s.rows}>
                {g.items.map((e) => {
                  const name = e.description || catNameOf(e.category)
                  return (
                    <li key={e.id}>
                      <button type="button" className={s.row} aria-haspopup="dialog" onClick={() => onOpen(e)}>
                        <CategoryIcon category={e.category} />
                        <span className={s.rowText}>
                          <span className={s.rowName}>{e.inv && <InlineIcon kind="investment" size={12} />}{name}</span>
                          <span className={s.rowMeta}>
                            {catNameOf(e.category)}{e.subcategory ? ` › ${expSubcatLabel(e.subcategory, lang)}` : ''}
                            {isFixed(e) && <><span aria-hidden="true">·</span><Repeat size={12} strokeWidth={1.7} aria-hidden="true" />{t('movl.filter.fixed')}</>}
                            <span className="sr-only">{`, ${fmtDayMonth(e.date)}`}</span>
                          </span>
                        </span>
                        <Amount className={s.rowAmt} value={-(Number(e.amount) || 0)} sym={sym} />
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
