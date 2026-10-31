// src/pages/Movements/MovementsList.jsx — la lista primero (UI-M3, B3a)
// Búsqueda y filtros (origen fijo/único y categoría, que llegan de la página), grupos por día con
// lo que entró y lo que salió, y filas que abren el detalle en una hoja.
// Ingresos y gastos en la misma lista (D-B): el tipo lo elige el control
// "Todos · Gastos · Ingresos" de la página. Modelo: Copilot (agrupado por día),
// Revolut (fila), Flowbite/shadcn (detalle en hoja).

import { useMemo, useState } from 'react'
import { Repeat, ArrowDownLeft, Pencil, Trash2 } from 'lucide-react'
import SwipeRow from '../../components/ui/SwipeRow.jsx'
import Amount from '../../components/Amount.jsx'
import CategoryIcon from '../../components/CategoryIcon.jsx'
import { InlineIcon } from '../../components/icons/SignalIcon.jsx'
import { useT } from '../../i18n/useT.js'
import { catName, expSubcatLabel, dateLocale, localDateStr, fmtDayMonth } from '../../utils/index.js'
import { filterMovements, groupByDay, dayLabel, isFixed, inLens } from './movementsList.js'
import s from './movements.module.css'

const PAGE = 40

// Una fila de la lista (también la usa la hoja del día del calendario, B3b).
export function MovementRow({ e, type = 'all', sym, lens, onOpen, onEdit, onDelete }) {
  const { t, lang } = useT()
  const catNameOf = (c) => catName(c, lang)
  const amt = (n) => inLens(n, lens)
  const income = e.kind === 'income'
  const name = e.name || catNameOf(e.category)
  // Deslizar es un atajo: tocar la fila abre el detalle con las mismas dos
  // acciones a la vista (causa 18).
  const swipe = [
    onEdit && { key: 'edit', label: t('movl.sheet.edit'), icon: Pencil, onClick: () => onEdit(e) },
    onDelete && { key: 'delete', label: t('movl.sheet.delete'), icon: Trash2, onClick: () => onDelete(e), danger: true },
  ].filter(Boolean)
  return (
    <SwipeRow actions={swipe}>
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
    </SwipeRow>
  )
}

// Poda P2 (30-oct-2026): la búsqueda, el origen y la categoría los maneja la
// página (lupa en la fila de controles, hoja "Filtrar" y chips quitables); la
// lista solo filtra y agrupa con lo que recibe.
export default function MovementsList({ items, type = 'all', sym, lens, query = '', kind = 'all', category, onClearFilters, onOpen, onEdit, onDelete, empty }) {
  const { t, lang } = useT()
  const ofType = useMemo(() => filterMovements(items, { type }), [items, type])
  const filtered = useMemo(
    () => filterMovements(ofType, { query, category, kind, catNameOf: (c) => catName(c, lang) }),
    [ofType, query, category, kind, lang],
  )
  // "Ver más" vuelve a 40 cuando cambia un filtro (sin efecto: se guarda con la clave del filtro).
  const filterKey = `${type}|${query}|${kind}|${category || ''}`
  const [page, setPage] = useState({ key: filterKey, limit: PAGE })
  const limit = page.key === filterKey ? page.limit : PAGE
  const shown = filtered.slice(0, limit)
  const groups = useMemo(() => groupByDay(shown), [shown])
  const today = localDateStr()
  const filteredOn = !!(query.trim() || category || kind !== 'all')
  const amt = (n) => inLens(n, lens)

  return (
    <section aria-labelledby="movl-title" data-tour="mov-list" className={s.listSection}>
      <h2 id="movl-title" className="sr-only">{t('movl.title')}</h2>

      <p className="sr-only" role="status" aria-live="polite">{filteredOn ? t('movl.count', { n: filtered.length }) : ''}</p>

      {ofType.length === 0 ? empty : filtered.length === 0 ? (
        <div className={s.empty}>
          <p style={{ margin: '0 0 8px' }}>{t('movl.empty.filtered')}</p>
          <button type="button" className="fos-link" onClick={onClearFilters}>{t('movl.clear')}</button>
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
                {g.items.map((e) => (
                  <li key={e.key || e.id}><MovementRow e={e} type={type} sym={sym} lens={lens} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} /></li>
                ))}
              </ul>
            </div>
          ))}
          {filtered.length > limit && (
            <div className={s.more}>
              <button type="button" className="fos-link" onClick={() => setPage({ key: filterKey, limit: limit + PAGE })}>
                {t('mov.list.showMore', { n: Math.min(PAGE, filtered.length - limit) })}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
