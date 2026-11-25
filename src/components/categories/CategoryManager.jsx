// src/components/categories/CategoryManager.jsx — elegir las categorías del
// registro rápido (24-nov-2026). Las de "En el registro" se quitan con un
// toque; las de "Para agregar" se suman con un toque; mantener presionada
// cualquiera abre su edición. El botón "Editar nombre, emoji o color" hace lo
// mismo sin pulsación larga. Quitar nunca borra datos (utils/categoryPrefs.js).
// Se usa en una hoja (desde el alta) y embebido en Ajustes › Categorías y reglas.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, Plus, Check, ChevronLeft } from 'lucide-react'
import Sheet from '../ui/Sheet.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { getCategoriesExpense, getCategoriesIncome, catName } from '../../utils/index.js'
import {
  prefsOf, visibleCats, availableCats, hideCatPatch, addCatPatch, lookPatch,
  emojiFor, nameFor, slotFor, COLOR_SLOTS, EMOJI_CHOICES, NAME_MAX,
} from '../../utils/categoryPrefs.js'
import { useLongPress } from './CategoryPills.jsx'
import css from './categories.module.css'
import { withCategoryStrings } from '../../i18n/categories/index.js'

function EditLook({ cat, prefs, lang, t, onSave, onBack }) {
  const [name, setName] = useState(() => nameFor(cat, prefs, lang))
  const [emoji, setEmoji] = useState(() => emojiFor(cat, prefs))
  const [slot, setSlot] = useState(() => slotFor(cat, prefs))
  const original = catName(cat, lang)
  const save = () => onSave({ name: name.trim() === original ? '' : name.trim(), emoji, slot })
  // Al entrar, el foco va al título de la edición (el botón tocado ya no existe).
  const titleRef = useRef(null)
  useEffect(() => { titleRef.current?.focus() }, [])
  return (
    <div>
      <button type="button" className={css.modeBtn} onClick={onBack}>
        <ChevronLeft size={18} strokeWidth={1.8} aria-hidden="true" />{t('cats.back')}
      </button>
      <h3 className={css.title} ref={titleRef} tabIndex={-1}>{t('cats.editTitle', { cat: nameFor(cat, prefs, lang) })}</h3>
      <div className={css.preview} aria-hidden="true">
        <span className="fos-chip"><span className={css.pillEmoji}>{emoji}</span>{name || original}</span>
      </div>
      <label className={css.field}>{t('cats.name')}
        <input type="text" value={name} maxLength={NAME_MAX} onChange={e => setName(e.target.value)} />
      </label>
      <p className={css.note}>{t('cats.nameNote')}</p>
      <p className={css.section} id="cats-emoji-lb">{t('cats.emoji')}</p>
      <div className={css.grid} role="group" aria-labelledby="cats-emoji-lb">
        {[...new Set([emojiFor(cat, {}), ...EMOJI_CHOICES])].map(e => (
          <button key={e} type="button" className={css.emojiBtn} aria-pressed={emoji === e} onClick={() => setEmoji(e)} aria-label={t('cats.emojiAria', { emoji: e })}>
            <span aria-hidden="true">{e}</span>
          </button>
        ))}
      </div>
      <p className={css.section} id="cats-color-lb">{t('cats.color')}</p>
      <div className={css.grid} role="group" aria-labelledby="cats-color-lb">
        {COLOR_SLOTS.map((n, i) => (
          <button key={n} type="button" className={css.swatch} aria-pressed={slot === n} onClick={() => setSlot(n)}
            aria-label={t('cats.colorAria', { n: i + 1 })} style={{ background: `var(--cat-${n})` }}>
            {slot === n && <Check size={18} strokeWidth={2.4} aria-hidden="true" />}
          </button>
        ))}
      </div>
      <div className={css.actions}>
        <button type="button" className="fos-btn-secondary" onClick={() => onSave({ name: '', emoji: '', slot: null })}>{t('cats.reset')}</button>
        <button type="button" className="fos-btn-primary" onClick={save}>{t('cats.save')}</button>
      </div>
    </div>
  )
}

export function CategoryManagerPanel({ initialKind = 'expense', initialEdit = null, onPicked }) {
  const { settings, updateSettings, showToast } = useApp() || {}
  const { t, lang } = useT()
  const [kind, setKind] = useState(initialKind === 'income' ? 'income' : 'expense')
  const [editing, setEditing] = useState(initialEdit)
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState('')
  const rootRef = useRef(null)
  const returnTo = useRef(null)
  const latest = useRef(settings)
  latest.current = settings
  const prefs = useMemo(() => prefsOf(settings), [settings])
  const effective = useMemo(() => (kind === 'income' ? getCategoriesIncome(settings) : getCategoriesExpense(settings)), [kind, settings])
  const shown = visibleCats(effective, prefs, kind)
  const available = availableCats(effective, prefs, kind)
  const lp = useLongPress((c) => c && setEditing(c))
  const { swallow, ...press } = lp

  // Solo el toast anuncia (es región viva): otra región acá lo leía dos veces.
  const say = (msg, tone = 'ok', action = null) => showToast?.(msg, tone, action)
  async function write(patch) { await updateSettings?.({ ...settings, ...patch }) }

  async function remove(c) {
    const patch = hideCatPatch(settings, c, kind, effective)
    if (!patch) { say(t('cats.lastOne'), 'error'); return }
    await write(patch)
    // Un toque quita: "Deshacer" la vuelve a mostrar (con los ajustes de ese momento).
    const undo = async () => {
      const cur = latest.current
      const r = addCatPatch(cur, c, kind, kind === 'income' ? getCategoriesIncome(cur) : getCategoriesExpense(cur))
      if (r) await updateSettings?.({ ...cur, ...r.patch })
    }
    say(t('cats.removed', { cat: nameFor(c, prefs, lang) }), 'ok', { label: t('common.undo'), onAction: undo })
  }
  async function add(c) {
    const r = addCatPatch(settings, c, kind, effective)
    if (!r) return
    await write(r.patch)
    setDraft('')
    say(t('cats.added', { cat: nameFor(r.value, prefs, lang) }))
    onPicked?.(r.value, kind)
  }
  const tap = (c, onTap) => () => { if (swallow()) return; if (editMode) setEditing(c); else onTap(c) }
  // Al salir de la edición, el foco vuelve a la categoría editada.
  const leaveEdit = () => { returnTo.current = editing; setEditing(null) }
  useEffect(() => {
    if (editing || !returnTo.current) return
    const cat = returnTo.current
    returnTo.current = null
    const btn = [...(rootRef.current?.querySelectorAll('button[data-cat]') || [])].find(b => b.dataset.cat === cat)
    btn?.focus()
  }, [editing])

  if (editing) {
    return (
      <EditLook key={editing} cat={editing} prefs={prefs} lang={lang} t={t} onBack={leaveEdit}
        onSave={async (look) => { await write(lookPatch(settings, editing, look)); say(t('cats.saved')); leaveEdit() }} />
    )
  }

  return (
    <div ref={rootRef}>
      <div className={css.seg} role="group" aria-label={t('cats.title')}>
        {['expense', 'income'].map(k => (
          <button key={k} type="button" className={css.segBtn} aria-pressed={kind === k} onClick={() => setKind(k)}>{t(`cats.tab.${k}`)}</button>
        ))}
      </div>

      <p className={css.section}>{t('cats.yours')}</p>
      <div className={css.pills} role="group" aria-label={t('cats.yours')} style={{ justifyContent: 'flex-start' }}>
        {shown.map(c => (
          <button key={c} type="button" data-cat={c} className={`fos-chip ${css.pill} ${css.pillOn} ${editMode ? css.pillEditing : ''}`}
            aria-label={editMode ? t('cats.editAria', { cat: nameFor(c, prefs, lang) }) : t('cats.removeAria', { cat: nameFor(c, prefs, lang) })}
            onClick={tap(c, remove)} {...press}>
            <span aria-hidden="true" className={css.pillEmoji}>{emojiFor(c, prefs)}</span>
            <span aria-hidden="true">{nameFor(c, prefs, lang)}</span>
          </button>
        ))}
      </div>

      <p className={css.section}>{t('cats.available')}</p>
      {available.length === 0 ? <p className={css.empty}>{t('cats.availableEmpty')}</p> : (
        <div className={css.pills} role="group" aria-label={t('cats.available')} style={{ justifyContent: 'flex-start' }}>
          {available.map(c => (
            <button key={c} type="button" data-cat={c} className={`fos-chip ${css.pill} ${css.pillOff} ${editMode ? css.pillEditing : ''}`}
              aria-label={editMode ? t('cats.editAria', { cat: nameFor(c, prefs, lang) }) : t('cats.addAria', { cat: nameFor(c, prefs, lang) })}
              onClick={tap(c, add)} {...press}>
              <Plus size={14} strokeWidth={2} aria-hidden="true" />
              <span aria-hidden="true" className={css.pillEmoji}>{emojiFor(c, prefs)}</span>
              <span aria-hidden="true">{nameFor(c, prefs, lang)}</span>
            </button>
          ))}
        </div>
      )}

      <form className={css.row} onSubmit={e => { e.preventDefault(); add(draft) }}>
        <input type="text" value={draft} maxLength={NAME_MAX} onChange={e => setDraft(e.target.value)}
          placeholder={t('cats.newPh')} aria-label={t('cats.new')} />
        <button type="submit" className="fos-btn-secondary" disabled={!draft.trim()} style={{ minHeight: 44 }}>{t('cats.add')}</button>
      </form>

      <button type="button" className={css.modeBtn} aria-pressed={editMode} onClick={() => setEditMode(m => !m)}>
        {editMode ? <Check size={16} strokeWidth={2} aria-hidden="true" /> : <Pencil size={16} strokeWidth={1.8} aria-hidden="true" />}
        {editMode ? t('cats.done') : t('cats.edit')}
      </button>
      <p className={css.note}>{t('cats.hint')}</p>
    </div>
  )
}

function CategoryManagerSheet({ open = true, onClose, initialKind, initialEdit, onPicked }) {
  const { t } = useT()
  return (
    <Sheet open={open} onClose={onClose} ariaLabel={t('cats.title')} maxWidth={480}>
      <h2 className={css.title}>{t('cats.title')}</h2>
      <p className={css.sub}>{t('cats.sub')}</p>
      <CategoryManagerPanel initialKind={initialKind} initialEdit={initialEdit} onPicked={onPicked} />
      <div className={css.actions}>
        <button type="button" className="fos-btn-primary" onClick={onClose}>{t('cats.done')}</button>
      </div>
    </Sheet>
  )
}

export default withCategoryStrings(CategoryManagerSheet, null)
