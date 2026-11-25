// src/components/categories/RuleSheet.jsx — crear o editar una regla de
// categoría (24-nov-2026): "Cuando el detalle contenga X → categoría Y".
// Se abre desde un movimiento ("Aplicar siempre a «Uber»") y desde Ajustes ›
// Categorías y reglas. Opcional y apagado por defecto: aplicar la regla a los
// movimientos guardados que coinciden y siguen sin categoría o por revisar.
// Todo queda en el dispositivo (utils/categoryRules.js).
import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import Sheet from '../ui/Sheet.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { getCategoriesExpense, getCategoriesIncome } from '../../utils/index.js'
import { upsertRule, undoUpsert, removeRule, matchingRecords, normalizeText, RULE_MIN_LENGTH, RULE_KINDS } from '../../utils/categoryRules.js'
import { prefsOf, emojiFor, nameFor } from '../../utils/categoryPrefs.js'
import { isUncategorized, needsReview, markReviewed, reviewOrigin } from '../../utils/review.js'
import { getSettings } from '../../core/db/index.js'
import css from './categories.module.css'
import { withCategoryStrings } from '../../i18n/categories/index.js'

const isOpen = (rec) => needsReview(rec) || isUncategorized(rec)

/**
 * Lo que la regla le hace a un movimiento guardado: le pone la categoría y lo
 * da por revisado. Un fijo registrado solo sigue en Por revisar (la persona
 * todavía tiene que confirmar el monto y la fecha): solo cambia la categoría.
 * @param {any} rec @param {string} category
 */
export function applyRuleTo(rec, category) {
  if (reviewOrigin(rec) === 'recurring' && needsReview(rec)) {
    const out = { ...rec, category }
    delete out.categorySuggested
    return out
  }
  return markReviewed(rec, { category })
}

/**
 * Guarda la regla (y, si se pide, la aplica a lo guardado). Compartido con la
 * hoja de categoría de Por revisar y las propuestas. `undo()` quita la regla
 * (o devuelve la que reemplazó) sobre las reglas guardadas en ese momento.
 * Si el texto choca con otra regla al editar: { conflict } y no guarda nada.
 * @returns {Promise<{ rule: any, changed: number, undo: () => Promise<void> } | { conflict: any } | null>}
 */
export async function saveCategoryRule(ctx, input, { applyPast = false } = {}) {
  const r = upsertRule(ctx.settings?.categoryRules, input)
  if (!r) return null
  if (r.conflict) return { conflict: r.conflict }
  await ctx.updateSettings?.({ ...ctx.settings, categoryRules: r.rules })
  let changed = 0
  if (applyPast) {
    for (const { kind, rec } of matchingRecords(r.rule, { incomes: ctx.incomes, expenses: ctx.expenses }, { isOpen })) {
      const next = applyRuleTo(rec, r.rule.category)
      await (kind === 'income' ? ctx.updateIncome?.(next) : ctx.updateExpense?.(next))
      changed++
    }
  }
  const undo = async () => {
    // Los ajustes de ahora (no los de cuando se guardó): solo se quita la regla.
    const cur = (await getSettings().catch(() => null)) || ctx.settings
    await ctx.updateSettings?.({ ...cur, categoryRules: undoUpsert(cur?.categoryRules, r) })
  }
  return { rule: r.rule, changed, undo }
}

function RuleSheet({ open = true, onClose, initial = {} }) {
  const ctx = useApp() || {}
  const { settings, showToast } = ctx
  const { t, lang } = useT()
  const [match, setMatch] = useState(initial.match || '')
  const [kind, setKind] = useState(RULE_KINDS.includes(initial.kind) ? initial.kind : 'expense')
  const [category, setCategory] = useState(initial.category || '')
  const [applyPast, setApplyPast] = useState(false)
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState('')
  const prefs = useMemo(() => prefsOf(settings), [settings])
  const cats = useMemo(() => {
    const list = kind === 'income' ? getCategoriesIncome(settings) : kind === 'expense' ? getCategoriesExpense(settings)
      : [...new Set([...getCategoriesExpense(settings), ...getCategoriesIncome(settings)])]
    return category && !list.includes(category) ? [category, ...list] : list
  }, [kind, settings, category])
  const tooShort = normalizeText(match).length < RULE_MIN_LENGTH
  const pending = useMemo(() => {
    if (tooShort || !category) return 0
    return matchingRecords({ match: normalizeText(match), category, kind }, { incomes: ctx.incomes, expenses: ctx.expenses }, { isOpen }).length
  }, [tooShort, match, category, kind, ctx.incomes, ctx.expenses])
  const editing = !!initial.id

  async function save() {
    if (tooShort || !category || saving) return
    setSaving(true)
    try {
      const r = await saveCategoryRule(ctx, { id: initial.id, match, category, kind }, { applyPast: applyPast && pending > 0 })
      if (r?.conflict) { setConflict(t('crules.duplicate', { match: r.conflict.match })); return }
      if (r) showToast?.(r.changed ? t('crules.appliedPast', { n: r.changed }) : t('crules.saved'), 'ok')
      onClose?.()
    } finally { setSaving(false) }
  }
  async function del() {
    await ctx.updateSettings?.({ ...settings, categoryRules: removeRule(settings?.categoryRules, initial.id) })
    showToast?.(t('crules.deleted'), 'ok')
    onClose?.()
  }

  return (
    <Sheet open={open} onClose={onClose} ariaLabel={t(editing ? 'crules.editTitle' : 'crules.new')} maxWidth={460}>
      <h2 className={css.title}>{t(editing ? 'crules.editTitle' : 'crules.new')}</h2>
      <p className={css.sub}>{t('crules.local')}</p>
      <form onSubmit={e => { e.preventDefault(); save() }}>
        <label className={css.field}>{t('crules.when')}
          <input type="text" value={match} onChange={e => { setMatch(e.target.value); setConflict('') }} placeholder={t('crules.whenPh')}
            autoCapitalize="none" autoComplete="off" aria-describedby="crule-short" aria-invalid={(match && tooShort) || conflict ? 'true' : undefined} />
        </label>
        <p id="crule-short" className={css.note} role={(match && tooShort) || conflict ? 'alert' : undefined}>{match && tooShort ? t('crules.tooShort') : conflict}</p>

        <p className={css.section} id="crule-kind-lb">{t('crules.kind')}</p>
        <div className={css.seg} role="group" aria-labelledby="crule-kind-lb">
          {RULE_KINDS.map(k => (
            <button key={k} type="button" className={css.segBtn} aria-pressed={kind === k} onClick={() => setKind(k)}>{t(`crules.kind.${k}`)}</button>
          ))}
        </div>

        <p className={css.section} id="crule-cat-lb">{t('crules.then')}</p>
        <div className={css.pills} role="group" aria-labelledby="crule-cat-lb" style={{ justifyContent: 'flex-start' }}>
          {cats.map(c => (
            <button key={c} type="button" className={`fos-chip ${css.pill} ${css.pillOn}`} aria-pressed={category === c} onClick={() => setCategory(c)}>
              <span aria-hidden="true" className={css.pillEmoji}>{emojiFor(c, prefs)}</span>
              <span>{nameFor(c, prefs, lang)}</span>
            </button>
          ))}
        </div>

        {pending > 0 && (
          <label className={css.check}>
            <input type="checkbox" checked={applyPast} onChange={e => setApplyPast(e.target.checked)} style={{ width: 16, height: 16, flexShrink: 0 }} />
            <span>{t(pending === 1 ? 'crules.applyPast.one' : 'crules.applyPast.many', { n: pending })}</span>
          </label>
        )}

        <div className={css.actions}>
          {editing && (
            <button type="button" className={`fos-btn-secondary ${css.danger}`} onClick={del}>
              <Trash2 size={16} strokeWidth={1.7} aria-hidden="true" />{t('crules.delete')}
            </button>
          )}
          <button type="submit" className="fos-btn-primary" aria-disabled={tooShort || !category || saving}>{t('crules.save')}</button>
        </div>
      </form>
    </Sheet>
  )
}

export default withCategoryStrings(RuleSheet, null)
