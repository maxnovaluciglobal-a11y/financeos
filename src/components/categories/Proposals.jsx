// src/components/categories/Proposals.jsx — "moyiq propone, tú confirmas"
// (24-nov-2026). Tarjetas con grupos de movimientos parecidos sin categoría
// (utils/categoryGroups.js): "Estos 3 movimientos parecen de Delivery." Con un
// toque se categorizan los 3 (y se pueden deshacer desde el aviso); "Otra
// categoría" deja elegir; "Ahora no" la esconde hasta que el grupo cambie.
// Se muestran en Por revisar (Inicio) y en "Pregúntale a moyiq". Todo se
// calcula en el teléfono, sin servidor ni modelo de lenguaje.
import { useMemo, useState, useSyncExternalStore } from 'react'
import { Sparkles, ChevronDown } from 'lucide-react'
import Sheet from '../ui/Sheet.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { useMoney } from '../Money.jsx'
import { getCategoriesExpense, getCategoriesIncome, fmtMoney, fmtDayMonth } from '../../utils/index.js'
import { proposeGroups, applyGroup } from '../../utils/categoryGroups.js'
import { rulesOf } from '../../utils/categoryRules.js'
import { prefsOf, emojiFor, nameFor } from '../../utils/categoryPrefs.js'
import { saveCategoryRule } from './RuleSheet.jsx'
import css from './categories.module.css'
import { withCategoryStrings } from '../../i18n/categories/index.js'

// Propuestas escondidas con "Ahora no": id del grupo + cuántos tenía. Si llega
// otro movimiento parecido, la propuesta vuelve. Clave de la cuenta (fos_*).
// El estado es del módulo: todas las instancias (Por revisar, "Pregúntale a
// moyiq" y el contador de su chip) ven el mismo "Ahora no" al instante.
export const DISMISS_KEY = 'fos_propose_dismissed'
const readDismissed = () => { try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]')) } catch { return new Set() } }
const writeDismissed = (set) => { try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...set].slice(-50))) } catch { /* almacenamiento no disponible: la propuesta vuelve a aparecer */ } }
export const dismissId = (g) => `${g.id}#${g.items.length}`
let dismissedSet = null
const listeners = new Set()
const dismissedSnapshot = () => (dismissedSet ??= readDismissed())
const subscribeDismissed = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
export function dismissProposal(group) {
  const next = new Set(dismissedSnapshot()); next.add(dismissId(group))
  dismissedSet = next
  writeDismissed(next)
  for (const fn of listeners) fn()
}

// Los grupos se calculan una vez por combinación de datos (mismos arreglos y
// ajustes = mismo resultado), aunque haya varias instancias montadas.
let memo = { incomes: null, expenses: null, settings: null, groups: [] }
export function proposalsFor(incomes, expenses, settings) {
  if (memo.incomes === incomes && memo.expenses === expenses && memo.settings === settings) return memo.groups
  const groups = proposeGroups({ incomes, expenses }, {
    rules: rulesOf(settings),
    merchantRules: settings?.merchantRules,
    allowedFor: (k) => (k === 'income' ? getCategoriesIncome(settings) : getCategoriesExpense(settings)),
  })
  memo = { incomes, expenses, settings, groups }
  return groups
}

export function useProposals() {
  const ctx = useApp() || {}
  const { t, lang } = useT()
  const dismissed = useSyncExternalStore(subscribeDismissed, dismissedSnapshot, dismissedSnapshot)
  const settings = ctx.settings
  const groups = proposalsFor(ctx.incomes, ctx.expenses, settings)
  const visible = useMemo(() => groups.filter(g => !dismissed.has(dismissId(g))), [groups, dismissed])
  const prefs = useMemo(() => prefsOf(settings), [settings])

  // Todos juntos, como "Confirmar los N" de Por revisar: una transacción y una
  // sola recarga. "Deshacer" devuelve los movimientos y quita la regla que se
  // haya creado en la misma acción.
  const writeAll = async (list) => {
    const { putMovements } = await import('../../pages/Dashboard/review/reviewBatch.js')
    await putMovements(list.map(x => ({ store: x.kind === 'income' ? 'incomes' : 'expenses', record: x.rec })))
    await ctx.rehydrate?.()
  }
  async function apply(group, category, { rule = false } = {}) {
    const { next, prev } = applyGroup(group, category)
    try {
      await writeAll(next)
      const saved = rule ? await saveCategoryRule(ctx, { match: group.key, category, kind: group.kind }) : null
      const msg = t('propose.done', { n: next.length, cat: nameFor(category, prefs, lang) })
      ctx.showToast?.(msg, 'ok', {
        label: t('common.undo'),
        onAction: async () => {
          try { await writeAll(prev); await saved?.undo?.() } catch { ctx.showToast?.(t('toast.update.expense'), 'error') }
        },
      })
    } catch { ctx.showToast?.(t('toast.update.expense'), 'error') }
  }
  return { groups: visible, apply, dismiss: dismissProposal, prefs, settings }
}

function PickSheet({ group, settings, prefs, lang, t, onClose, onPick }) {
  const cats = group.kind === 'income' ? getCategoriesIncome(settings) : getCategoriesExpense(settings)
  const [rule, setRule] = useState(false)
  return (
    <Sheet open onClose={onClose} ariaLabel={t('propose.pick')} maxWidth={440}>
      <h2 className={css.title}>{t('propose.pick')}</h2>
      <p className={css.sub}>{t('propose.leadMerchant', { n: group.items.length, key: group.key })}</p>
      <div className={css.pills} role="group" aria-label={t('propose.pick')} style={{ justifyContent: 'flex-start' }}>
        {cats.map(c => (
          <button key={c} type="button" className={`fos-chip ${css.pill} ${css.pillOn}`} aria-pressed={group.category === c} onClick={() => onPick(c, rule)}>
            <span aria-hidden="true" className={css.pillEmoji}>{emojiFor(c, prefs)}</span>
            <span>{nameFor(c, prefs, lang)}</span>
          </button>
        ))}
      </div>
      <label className={css.check}>
        <input type="checkbox" checked={rule} onChange={e => setRule(e.target.checked)} style={{ width: 16, height: 16, flexShrink: 0 }} />
        <span>{t('propose.alsoRule', { key: group.key })}</span>
      </label>
    </Sheet>
  )
}

export function ProposalCard({ group, prefs, settings, sym, onApply, onDismiss }) {
  const { t, lang } = useT()
  const { m } = useMoney()
  const [listOpen, setListOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const n = group.items.length
  const cat = group.category ? nameFor(group.category, prefs, lang) : ''
  const listId = `prop-${group.id.replace(/[^\w-]/g, '_')}`
  return (
    <article className={css.proposal} aria-label={t('propose.title')}>
      <p className={css.proposalLb}><Sparkles size={14} strokeWidth={1.8} aria-hidden="true" />{t('propose.title')}</p>
      <p className={css.proposalLead}>
        {group.category ? t('propose.lead', { n, cat }) : t('propose.leadMerchant', { n, key: group.key })}
      </p>
      <p className={css.proposalWhy}>{t(`propose.why.${group.reason}`, { key: group.key, n })}</p>
      {listOpen && (
        <ul id={listId} className={css.proposalItems} aria-label={t('propose.see', { n })}>
          {group.items.map(({ rec }) => (
            <li key={rec.id}>
              <span>{rec.description || rec.source || ''} · <span className="num">{fmtDayMonth(rec.date)}</span></span>
              <span className="num">{m(fmtMoney(rec.amount, sym))}</span>
            </li>
          ))}
        </ul>
      )}
      <div className={css.proposalBtns}>
        {group.category && (
          <button type="button" className="fos-btn-primary" onClick={() => onApply(group, group.category)}
            aria-label={t('propose.applyAria', { n, key: group.key, cat })}>
            {t('propose.apply', { n })}
          </button>
        )}
        <button type="button" className="fos-btn-secondary" onClick={() => setPicking(true)} aria-haspopup="dialog">
          {group.category ? t('propose.other') : t('propose.pick')}
        </button>
        <button type="button" className="fos-link" aria-expanded={listOpen} aria-controls={listId} onClick={() => setListOpen(o => !o)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {listOpen ? t('propose.hide') : t('propose.see', { n })}
          <ChevronDown size={14} strokeWidth={2} aria-hidden="true" style={{ transform: listOpen ? 'rotate(180deg)' : 'none' }} />
        </button>
        <button type="button" className="fos-link" onClick={() => onDismiss(group)}>{t('propose.dismiss')}</button>
      </div>
      <p className={css.note}>{t('propose.note')}</p>
      {picking && (
        <PickSheet group={group} settings={settings} prefs={prefs} lang={lang} t={t} onClose={() => setPicking(false)}
          onPick={(c, rule) => { setPicking(false); onApply(group, c, { rule }) }} />
      )}
    </article>
  )
}

/** Lista de propuestas (máximo `limit`). Sin propuestas no pinta nada. */
function Proposals({ limit = 2, sym, emptyText }) {
  // El aviso de cada acción es el toast (role="status"): sin otra región en vivo.
  const { groups, apply, dismiss, prefs, settings } = useProposals()
  return (
    <>
      {groups.length === 0
        ? (emptyText ? <p className={css.empty}>{emptyText}</p> : null)
        : groups.slice(0, limit).map(g => (
          <ProposalCard key={g.id} group={g} prefs={prefs} settings={settings} sym={sym} onApply={apply} onDismiss={dismiss} />
        ))}
    </>
  )
}

export default withCategoryStrings(Proposals, null)
