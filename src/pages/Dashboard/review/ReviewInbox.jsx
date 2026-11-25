// src/pages/Dashboard/review/ReviewInbox.jsx — "Por revisar" en el Inicio.
// Movimientos que la app creó sola o con una categoría adivinada (utils/review.js):
// fijos registrados solos, filas importadas, el Atajo de Apple Pay, un enlace
// o un dictado. Cada fila: nombre, fecha, de dónde vino, monto y tres acciones
// de un toque: confirmar (✓), cambiar la categoría (chip) y abrir el detalle
// (tocar la fila). "Revisar todo" abre la lista completa. Sin pendientes no se
// muestra nada: no hay un "Todo al día" que ocupe lugar.
// Lo pesado (las hojas) vive en ReviewSheets.jsx y se carga al tocar.
import { lazy, Suspense, useMemo, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useApp } from '../../../context/AppContext.jsx'
import { useT } from '../../../i18n/useT.js'
import Amount from '../../../components/Amount.jsx'
import CategoryIcon from '../../../components/CategoryIcon.jsx'
import { catName, fmtDayMonth } from '../../../utils/index.js'
import { reviewQueue, markReviewed, REVIEW_HOME_LIMIT } from '../../../utils/review.js'
import { GuideStringsGate } from '../../../i18n/guide/index.js'
import { useProposals, ProposalCard } from '../../../components/categories/Proposals.jsx'
import { saveCategoryRule } from '../../../components/categories/RuleSheet.jsx'
import { prefsOf, nameFor } from '../../../utils/categoryPrefs.js'
import { logRejection } from '../../../utils/errorLog.js'
import { CategoryStringsGate } from '../../../i18n/categories/index.js'
import s from './review.module.css'

const CategorySheet = lazy(() => import('./ReviewSheets.jsx').then(m => ({ default: m.CategorySheet })))
const ReviewAllSheet = lazy(() => import('./ReviewSheets.jsx').then(m => ({ default: m.ReviewAllSheet })))
const ReviewMovementSheet = lazy(() => import('./ReviewSheets.jsx').then(m => ({ default: m.ReviewMovementSheet })))

// Acciones de la bandeja, compartidas con la lista completa. El aviso de cada
// acción es el toast (role="status"): sin otra región en vivo que lo repita.
export function useReviewActions() {
  const ctx = useApp() || {}
  const { t } = useT()
  const save = (row, rec) => (row.kind === 'income' ? ctx.updateIncome?.(rec) : ctx.updateExpense?.(rec))
  // `rule` ("Usar siempre esta categoría para…"): la regla se crea en la misma
  // acción, y "Deshacer" la quita junto con el cambio del movimiento.
  async function confirm(row, patch, { rule = null } = {}) {
    try {
      await save(row, markReviewed(row.rec, patch))
      let saved = null
      if (rule && patch?.category) {
        saved = await saveCategoryRule(ctx, { match: rule, category: patch.category, kind: row.kind })
          .catch((err) => { logRejection('review.saveRule')(err); return null })
      }
      const msg = patch?.category
        ? t('review.toast.category', { cat: catName(patch.category, ctx.settings?.language) })
        : t('review.toast.confirmed')
      ctx.showToast?.(msg, 'ok', {
        label: t('common.undo'),
        onAction: async () => { await save(row, row.rec); await saved?.undo?.() },
      })
    } catch { /* AppContext ya mostró el error */ }
  }
  // Todos juntos: una transacción y un solo render; "Deshacer" los devuelve.
  async function confirmAll(rows) {
    const writes = (rec, row) => ({ store: row.kind === 'income' ? 'incomes' : 'expenses', record: rec })
    const run = async (pick) => {
      const { putMovements } = await import('./reviewBatch.js')
      await putMovements(rows.map(r => writes(pick(r), r)))
      await ctx.rehydrate?.()
    }
    try {
      await run(r => markReviewed(r.rec))
      ctx.showToast?.(t('review.toast.all', { n: rows.length }), 'ok', {
        label: t('common.undo'),
        onAction: () => run(r => r.rec).catch(() => ctx.showToast?.(t('toast.update.expense'), 'error')),
      })
    } catch { ctx.showToast?.(t('toast.update.expense'), 'error') }
  }
  return { ctx, confirm, confirmAll, save }
}

export function ReviewRow({ row, sym, lang, onConfirm, onCategory, onOpen, t, scope = 'rv' }) {
  const { rec, kind } = row
  const prefs = prefsOf(useApp()?.settings)
  const name = row.name || nameFor(rec.category, prefs, lang)
  const cat = row.uncategorized ? t('review.noCategory') : nameFor(rec.category, prefs, lang)
  const id = `${scope}-${row.key}`
  return (
    <li className={s.row}>
      {/* El nombre accesible dice qué abre; de dónde vino y el monto se leen
          como descripción (aria-describedby), así no se pierden. */}
      <button type="button" className={s.main} onClick={() => onOpen(row)}
        aria-label={t('review.openAria', { name, date: fmtDayMonth(rec.date) })} aria-describedby={`${id}-o ${id}-a`}>
        <CategoryIcon category={rec.category} />
        <span className={s.text}>
          <span className={s.name}>{name}</span>
          <span className={s.meta}>
            <span className="num">{fmtDayMonth(rec.date)}</span>
            <span className={s.origin} id={`${id}-o`}>{t(`review.origin.${row.origin}`)}</span>
          </span>
        </span>
        <span id={`${id}-a`} className={s.amtWrap}><Amount className={kind === 'income' ? s.amtInc : s.amt} value={kind === 'income' ? rec.amount : -rec.amount} sym={sym} plus={kind === 'income'} /></span>
      </button>
      <div className={s.actions}>
        <button type="button" className={`${s.catChip} ${row.uncategorized ? s.catChipEmpty : ''}`} onClick={() => onCategory(row)}
          aria-haspopup="dialog" aria-label={t('review.categoryAria', { name, cat })}>
          <span className={s.catChipText}>{cat}</span>
          <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
        </button>
        <button type="button" className={s.ok} onClick={() => onConfirm(row)} aria-label={t('review.confirmAria', { name })}>
          <Check size={18} strokeWidth={2.2} aria-hidden="true" />
          <span>{t('review.confirm')}</span>
        </button>
      </div>
    </li>
  )
}

// Las hojas quedan montadas después de abrirse una vez y se cierran con
// `open`: así conservan la animación de salida (y la fila que mostraban).
function useSheetSlot() {
  const [slot, setSlot] = useState({ row: null, open: false })
  return [slot, (row) => setSlot({ row, open: true }), () => setSlot(p => ({ ...p, open: false }))]
}

// Textos en las secciones diferidas src/i18n/guide (Por revisar) y
// src/i18n/categories (propuestas, nombres propios de categorías).
export default function ReviewInbox(props) {
  return (
    <Suspense fallback={null}>
      <GuideStringsGate><CategoryStringsGate><ReviewInboxBody {...props} /></CategoryStringsGate></GuideStringsGate>
    </Suspense>
  )
}

function ReviewInboxBody({ sym }) {
  const { t, lang } = useT()
  const { ctx, confirm, confirmAll, save } = useReviewActions()
  const rows = useMemo(() => reviewQueue({ incomes: ctx.incomes, expenses: ctx.expenses }), [ctx.incomes, ctx.expenses])
  const [cat, openCat, closeCat] = useSheetSlot()
  const [mov, openMov, closeMov] = useSheetSlot()
  const [all, openAll, closeAll] = useSheetSlot()
  const n = rows.length
  const shown = rows.slice(0, REVIEW_HOME_LIMIT)
  const handlers = { onConfirm: (r) => confirm(r), onCategory: openCat, onOpen: openMov }
  const kindStore = (row) => (row.kind === 'income' ? 'incomes' : 'expenses')
  // "moyiq propone, tú confirmas": grupos de movimientos parecidos (utils/categoryGroups.js).
  // Se anuncia con el toast, como el resto de Por revisar: un solo aviso.
  const proposals = useProposals()
  const topProposal = proposals.groups[0]

  return (
    <>
      {(n > 0 || topProposal) && (
        <section className={s.inbox} aria-labelledby="review-title" data-tour="home-review">
          <div className={s.head}>
            <h2 id="review-title" className={s.title}>
              {t('review.title')}
              {n > 0 && <span className={`num ${s.badge}`} aria-hidden="true">{n}</span>}
              {n > 0 && <span className="sr-only">{t(n === 1 ? 'review.countOne' : 'review.countMany', { n })}</span>}
            </h2>
            {n > 0 && <button type="button" className={s.all} onClick={() => openAll(true)} aria-haspopup="dialog">{t('review.all')}</button>}
          </div>
          {topProposal && (
            <ProposalCard group={topProposal} prefs={proposals.prefs} settings={proposals.settings} sym={sym}
              onApply={proposals.apply} onDismiss={proposals.dismiss} />
          )}
          {n > 0 && (
            <ul className={s.list}>
              {shown.map(r => <ReviewRow key={r.key} row={r} sym={sym} lang={lang} t={t} {...handlers} />)}
            </ul>
          )}
        </section>
      )}
      <Suspense fallback={null}>
        {cat.row && <CategorySheet key={cat.row.key} row={cat.row} open={cat.open} settings={ctx.settings} onClose={closeCat}
          onPick={(category, opts) => {
            const r = cat.row; closeCat(); confirm(r, { category }, { rule: opts?.rule || null })
          }} />}
        {mov.row && <ReviewMovementSheet row={mov.row} open={mov.open} sym={sym} settings={ctx.settings}
          onClose={closeMov} onSave={(rec) => save(mov.row, markReviewed(rec))}
          onDelete={ctx.deleteWithUndo ? (rec) => ctx.deleteWithUndo(kindStore(mov.row), rec, t('common.deleted'), t('common.undo')) : undefined} />}
        {all.row && <ReviewAllSheet rows={rows} open={all.open} sym={sym} onClose={closeAll}
          onConfirmAll={() => { confirmAll(rows); closeAll() }} {...handlers} />}
      </Suspense>
    </>
  )
}

