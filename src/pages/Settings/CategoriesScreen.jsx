// src/pages/Settings/CategoriesScreen.jsx — Ajustes › Categorías y reglas
// (24-nov-2026). Las categorías del registro rápido en píldoras (quitar,
// agregar, editar nombre, emoji y color) y la lista de reglas de categoría
// (editar y eliminar). Todo vive en settings, en el dispositivo; viaja en el
// respaldo y en el sync cifrado como cualquier ajuste.
import { lazy, Suspense, useMemo, useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { rulesOf, removeRule } from '../../utils/categoryRules.js'
import { prefsOf, emojiFor, nameFor } from '../../utils/categoryPrefs.js'
import { Setting } from './settingsUi.jsx'
import { withCategoryStrings } from '../../i18n/categories/index.js'
import css from '../../components/categories/categories.module.css'

const CategoryManagerPanel = lazy(() => import('../../components/categories/CategoryManager.jsx').then(m => ({ default: m.CategoryManagerPanel })))
const RuleSheet = lazy(() => import('../../components/categories/RuleSheet.jsx'))

function CategoriesScreen() {
  const { settings, updateSettings, showToast } = useApp() || {}
  const { t, lang } = useT()
  const rules = useMemo(() => rulesOf(settings), [settings])
  const prefs = useMemo(() => prefsOf(settings), [settings])
  const [editRule, setEditRule] = useState(null) // {} nueva, o la regla
  const kindLabel = (k) => t(`crules.kind.${k}`)

  async function del(rule) {
    const before = settings?.categoryRules
    await updateSettings?.({ ...settings, categoryRules: removeRule(before, rule.id) })
    // Deshacer devuelve la lista de antes (borrar una regla no toca movimientos).
    showToast?.(t('crules.deleted'), 'ok', { label: t('common.undo'), onAction: () => updateSettings?.({ ...settings, categoryRules: before }) })
  }

  return (
    <div style={{ paddingTop: 10 }}>
      <Setting id="categories">
        <h3 className={css.title}>{t('cats.title')}</h3>
        <p className={css.sub}>{t('cats.sub')}</p>
        <Suspense fallback={null}><CategoryManagerPanel /></Suspense>
      </Setting>

      <Setting id="rules" style={{ marginTop: 28 }}>
        <h3 className={css.title}>{t('crules.title')}</h3>
        <p className={css.sub}>{t('crules.sub')}</p>
        {rules.length === 0 ? <p className={css.empty}>{t('crules.empty')}</p> : (
          <ul className={css.rules}>
            {[...rules].sort((a, b) => a.match.localeCompare(b.match)).map(r => (
              <li key={r.id} className={css.ruleRow}>
                <button type="button" className={css.ruleMain} onClick={() => setEditRule(r)} aria-haspopup="dialog">
                  <span className={css.ruleMatch}>{t('crules.row', { match: r.match })}</span>
                  <span className={css.ruleCat}>
                    <span aria-hidden="true">{emojiFor(r.category, prefs)} </span>{nameFor(r.category, prefs, lang)} · {kindLabel(r.kind)}
                  </span>
                </button>
                <button type="button" className={css.iconBtn} onClick={() => setEditRule(r)} aria-label={t('crules.editAria', { match: r.match })} aria-haspopup="dialog">
                  <Pencil size={17} strokeWidth={1.7} aria-hidden="true" />
                </button>
                <button type="button" className={`${css.iconBtn} ${css.danger}`} onClick={() => del(r)} aria-label={t('crules.deleteAria', { match: r.match })}>
                  <Trash2 size={17} strokeWidth={1.7} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className={css.modeBtn} onClick={() => setEditRule({})} aria-haspopup="dialog">
          <Plus size={16} strokeWidth={2} aria-hidden="true" />{t('crules.new')}
        </button>
        <p className={css.note}>{t('crules.local')}</p>
      </Setting>

      {editRule && (
        <Suspense fallback={null}>
          <RuleSheet onClose={() => setEditRule(null)} initial={editRule} />
        </Suspense>
      )}
    </div>
  )
}

export default withCategoryStrings(CategoriesScreen, null)
