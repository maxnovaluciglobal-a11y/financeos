// src/context/AppContext.jsx — v1.2 (QA fixes)
// FIX aplicados:
//   1. DB-first: await dbAdd() ANTES de dispatch() — garantiza persistencia
//   2. Error handling con toast visible al usuario
//   3. BOM UTF-8 en CSV para Excel Windows
//   4. currency guardado como código limpio ('CLP', no 'CLP — Peso chileno')
//   5. activeMonth en settings para filtro por mes
//   6. Loading states para acciones async

import { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useState, useRef } from 'react'
import {
  dbGetAll, dbAdd, dbDelete, clearAllData,
  getSettings, saveSettings, exportAllData, importAllData,
  isUsingFallback, firstRunSettings,
  reconcileRecurringSources, confirmOccurrencesInDb,
} from '../core/db/index.js'
import { uid, SEED_INCOMES, SEED_EXPENSES, SEED_BUDGETS, SEED_DEBTS, SEED_GOALS, setMoneyLocale, setDateLocale, localDateStr, catName, recurrenceLabel, methodLabel, currentMonth } from '../utils/index.js'
import { dueAutoConfirmations, ruleFromRecord, withAmountFrom, ruleAfterLinkedRecord } from '../utils/recurring.js'
import { monthAdvance } from '../utils/monthAdvance.js'
import { markLocalChange, pullAndApplyIfNewer, isSyncEnabled, setSyncEnabled, initialSync, pushNow } from '../core/sync.js'
import { hapticTap } from '../utils/haptics.js'
import { translate } from '../i18n/translate.js'
import { loadLang } from '../i18n/langCache.js'

export const AppContext = createContext(null)

const initialState = {
  incomes:  [],
  expenses: [],
  budgets:  [],
  debts:    [],
  goals:    [],
  subscriptions: [],
  recurring: [],    // reglas de movimientos fijos (utils/recurring.js)
  // Antes de hidratar: lo del navegador (idioma/país/moneda), no 'es'/CL fijo.
  // getSettings() lo reemplaza enseguida por lo guardado, si hay algo guardado.
  settings: firstRunSettings(),
  loading:  true,
  toast:    null, // { msg, type } — 'ok' | 'error'
}

export function reducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':      return { ...state, ...action.payload, loading: false }
    case 'ADD_INCOME':   return { ...state, incomes:  [action.item, ...state.incomes] }
    case 'DEL_INCOME':   return { ...state, incomes:  state.incomes.filter(r => r.id !== action.id) }
    case 'ADD_EXPENSE':  return { ...state, expenses: [action.item, ...state.expenses] }
    case 'DEL_EXPENSE':  return { ...state, expenses: state.expenses.filter(r => r.id !== action.id) }
    case 'ADD_BUDGET':   return { ...state, budgets:  [...state.budgets, action.item] }
    case 'DEL_BUDGET':   return { ...state, budgets:  state.budgets.filter(b => b.id !== action.id) }
    case 'ADD_DEBT':     return { ...state, debts:    [...state.debts, action.item] }
    case 'DEL_DEBT':     return { ...state, debts:    state.debts.filter(d => d.id !== action.id) }
    case 'UPDATE_INCOME':  return { ...state, incomes:  state.incomes.map(r => r.id === action.item.id ? action.item : r) }
    case 'UPDATE_EXPENSE': return { ...state, expenses: state.expenses.map(r => r.id === action.item.id ? action.item : r) }
    case 'UPDATE_BUDGET':  return { ...state, budgets:  state.budgets.map(b => b.id === action.item.id ? action.item : b) }
    case 'UPDATE_DEBT':    return { ...state, debts:    state.debts.map(d => d.id === action.item.id ? action.item : d) }
    case 'ADD_GOAL':     return { ...state, goals:    [...state.goals, action.item] }
    case 'DEL_GOAL':     return { ...state, goals:    state.goals.filter(g => g.id !== action.id) }
    case 'UPDATE_GOAL':  return { ...state, goals:    state.goals.map(g => g.id === action.item.id ? action.item : g) }
    case 'ADD_SUB':      return { ...state, subscriptions: [action.item, ...state.subscriptions] }
    case 'DEL_SUB':      return { ...state, subscriptions: state.subscriptions.filter(s => s.id !== action.id) }
    case 'UPDATE_SUB':   return { ...state, subscriptions: state.subscriptions.map(s => s.id === action.item.id ? action.item : s) }
    case 'SET_RECURRING':return { ...state, recurring: action.items }
    case 'UPSERT_RULE':  return { ...state, recurring: [...state.recurring.filter(r => r.id !== action.item.id), action.item] }
    case 'DEL_RULE':     return { ...state, recurring: state.recurring.filter(r => r.id !== action.id) }
    case 'SAVE_SETTINGS':return { ...state, settings: action.settings }
    case 'CLEAR_ALL':    return { ...state, incomes: [], expenses: [], budgets: [], debts: [], goals: [], subscriptions: [], recurring: [] }
    case 'SET_TOAST':    return { ...state, toast: action.toast }
    default:             return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Textos de toasts/CSV en el idioma activo. AppContext es el provider, no
  // puede usar useT(); lee el idioma por ref para que los callbacks memoizados
  // no tengan que depender de settings.
  const langRef = useRef(state.settings?.language || 'es')
  langRef.current = state.settings?.language || 'es'
  useEffect(() => { loadLang(langRef.current) }, [state.settings?.language])
  const tr = useCallback((key, vars) => translate(langRef.current, key, vars), [])

  // ── Toast helper ─────────────────────────────────────────────────────────────
  // action opcional: { label, onAction } → renderiza un botón (p.ej. "Deshacer").
  // Con acción, el toast dura más (6s) para dar tiempo a reaccionar.
  const toastTimer = useRef(null)
  const showToast = useCallback((msg, type = 'ok', action = null) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    dispatch({ type: 'SET_TOAST', toast: { msg, type, action } })
    toastTimer.current = setTimeout(() => dispatch({ type: 'SET_TOAST', toast: null }), action ? 6000 : 3500)
  }, [])
  const dismissToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    dispatch({ type: 'SET_TOAST', toast: null })
  }, [])

  // ── Re-hidratar desde la DB (reutilizado por hydrate inicial y por el sync) ────
  const rehydrate = useCallback(async () => {
    const [incomes, expenses, budgets, debts, goals, subscriptions, recurring, settings] = await Promise.all([
      dbGetAll('incomes'), dbGetAll('expenses'), dbGetAll('budgets'),
      dbGetAll('debts'),   dbGetAll('goals'),    dbGetAll('subscriptions'),
      dbGetAll('recurring').catch(() => []), getSettings(),
    ])
    dispatch({ type: 'HYDRATE', payload: { incomes, expenses, budgets, debts, goals, subscriptions, recurring, settings } })
    document.documentElement.setAttribute('data-theme', settings.theme || 'light')
    // Sin esto un lector de pantalla pronuncia toda la app con reglas fonéticas
    // españolas aunque el idioma elegido sea inglés, portugués o alemán.
    document.documentElement.setAttribute('lang', settings.language || 'es')
  }, [])

  // Alinea las reglas de Suscripciones/Deudas después de un cambio en el origen.
  const syncSources = useCallback(async () => {
    try {
      const ups = await reconcileRecurringSources()
      if (ups.length) dispatch({ type: 'SET_RECURRING', items: await dbGetAll('recurring') })
    } catch (e) { console.error('[FinanceOS] fijos de suscripciones/deudas:', e) }
  }, [])

  // ── Borrado con deshacer ──────────────────────────────────────────────────────
  // Reemplaza el confirm() nativo: borra de inmediato y ofrece "Deshacer" ~6s.
  // Restaura re-insertando el MISMO item (conserva su id) y rehidratando desde DB.
  // Genérico y sin tocar el esquema: store ∈ incomes|expenses|budgets|debts|goals|subscriptions.
  // Suscripciones y Deudas tienen su regla de fijos: tras borrar o deshacer,
  // la regla se alinea (termina o se reabre) — ver reconcileRecurringSources.
  const resyncIfSource = async (store) => {
    if (store !== 'subscriptions' && store !== 'debts') return
    try { await reconcileRecurringSources(); dispatch({ type: 'SET_RECURRING', items: await dbGetAll('recurring') }) } catch {}
  }
  // Registro de una ocurrencia borrado → la ocurrencia queda omitida (no la
  // recrea el registro automático); restaurado → se reabre. utils/recurring.js.
  const markLinked = async (record, deleted) => {
    if (!record?.recurringId) return
    try {
      const next = ruleAfterLinkedRecord(await dbGetAll('recurring'), record, { deleted })
      if (next) { await dbAdd('recurring', next); dispatch({ type: 'UPSERT_RULE', item: next }) }
    } catch (e) { console.error('[FinanceOS] fijo del registro borrado:', e) }
  }
  const deleteWithUndo = useCallback(async (store, item, deletedMsg, undoLabel) => {
    if (!item?.id) return
    try {
      await dbDelete(store, item.id)
      if (store === 'incomes' || store === 'expenses') await markLinked(item, true)
      await rehydrate()
      await resyncIfSource(store)
      hapticTap()
      showToast(deletedMsg || tr('common.deleted'), 'ok', {
        label: undoLabel || tr('common.undo'),
        onAction: async () => { try { await dbAdd(store, item); if (store === 'incomes' || store === 'expenses') await markLinked(item, false); await rehydrate(); await resyncIfSource(store) } catch (e) { showToast(tr('toast.undoFailed'), 'error') } },
      })
    } catch (e) {
      showToast(tr('toast.deleteError'), 'error')
    }
  }, [rehydrate, showToast, tr])

  // ── Movimientos fijos: mantenimiento al abrir (y al volver a la app) ───────
  // 1) Suscripciones/Deudas → reglas (idempotente, una transacción).
  // 2) El mes activo avanza solo si empezó un mes nuevo (utils/monthAdvance.js).
  // 3) Reglas con registro automático: se registran las ocurrencias ya vencidas
  //    (idempotente: ids deterministas + chequeo dentro de la transacción).
  // Un candado evita dos pasadas a la vez (StrictMode, visibilitychange).
  const maintRef = useRef(false)
  const runRecurringMaintenance = useCallback(async () => {
    if (maintRef.current) return
    maintRef.current = true
    try {
      const upserts = await reconcileRecurringSources()
      const settings = await getSettings()
      const adv = monthAdvance(settings, currentMonth())
      if (adv) await saveSettings(adv)
      const [rules, incomes, expenses] = await Promise.all([dbGetAll('recurring'), dbGetAll('incomes'), dbGetAll('expenses')])
      const due = dueAutoConfirmations(rules, { incomes, expenses, today: localDateStr() })
      let created = 0
      if (due.length) created = (await confirmOccurrencesInDb(due.map(o => ({ rule: o.rule, date: o.date })))).records.length
      if (upserts.length || adv || created) await rehydrate()
      if (created) showToast(tr(created === 1 ? 'rec.toast.autoOne' : 'rec.toast.autoMany', { n: created }), 'ok')
    } catch (e) {
      console.error('[FinanceOS] mantenimiento de fijos:', e)
    } finally {
      maintRef.current = false
    }
  }, [rehydrate, showToast, tr])

  // ── Hydrate from DB on mount ──────────────────────────────────────────────────
  const hydratedRef = useRef(false)
  useEffect(() => {
    async function hydrate() {
      try {
        await rehydrate()
        if (isUsingFallback()) {
          showToast(tr('toast.fallbackMode'), 'ok')
        }
        await runRecurringMaintenance()
        hydratedRef.current = true
        // Sync opcional: si está activo, baja los cambios de otros dispositivos (no-op si apagado)
        if (isSyncEnabled()) {
          pullAndApplyIfNewer(rehydrate)
            .then(r => { if (r?.applied) { showToast(tr('toast.syncedFromOther'), 'ok'); runRecurringMaintenance() } })
            .catch(() => {})
        }
      } catch (e) {
        console.error('Hydration error:', e)
        // Base existente que no abre: pantalla de error bloqueante (App.jsx),
        // nunca la app vacía sobre localStorage (ver DbOpenError en core/db).
        if (e?.name === 'DbOpenError') { dispatch({ type: 'HYDRATE', payload: { dbError: true } }); return }
        dispatch({ type: 'HYDRATE', payload: {} })
        hydratedRef.current = true
        showToast(tr('toast.loadError'), 'error')
      }
    }
    hydrate()
  }, [rehydrate])

  // Volver a la app otro día (o en otro mes) con la pestaña abierta.
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible' && hydratedRef.current) runRecurringMaintenance() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [runRecurringMaintenance])

  // ── Observa cambios locales → agenda push al sync (no-op si sync apagado) ──────
  useEffect(() => {
    if (!hydratedRef.current) return  // no dispara durante la hidratación inicial
    markLocalChange()
  }, [state.incomes, state.expenses, state.budgets, state.debts, state.goals, state.subscriptions, state.recurring])
  // ── Formato de dinero según la moneda (y el idioma) del usuario ──────────────
  // En el render y no en un efecto: el provider se renderiza antes que sus
  // hijos, así que la primera pintura ya sale con los decimales/símbolo de la
  // moneda correcta (con un efecto, los hijos pintaban una vez con el locale
  // anterior). Es idempotente: solo asigna 4 variables de módulo.
  setMoneyLocale(state.settings?.currency || 'CLP', state.settings?.language || 'es')
  // ── Formato de fechas según el IDIOMA (no la moneda): "Sep" vs "sept" vs "set" ──
  useEffect(() => {
    setDateLocale(state.settings?.language || 'es')
  }, [state.settings?.language])


  // ── Actions — FIX: DB primero, luego dispatch ─────────────────────────────────

  const addIncome = useCallback(async (data) => {
    const item = { ...data, id: uid(), createdAt: new Date().toISOString() }
    try {
      await dbAdd('incomes', item)          // DB primero
      dispatch({ type: 'ADD_INCOME', item }) // UI después de confirmar
    } catch (e) {
      showToast(tr('toast.save.income'), 'error')
      throw e
    }
  }, [showToast, tr])

  const delIncome = useCallback(async (id) => {
    try {
      const rec = (await dbGetAll('incomes')).find(r => r.id === id)
      await dbDelete('incomes', id)
      dispatch({ type: 'DEL_INCOME', id })
      await markLinked(rec, true)
    } catch (e) {
      showToast(tr('toast.delete.income'), 'error')
      throw e
    }
  }, [showToast, tr])

  const updateIncome = useCallback(async (item) => {
    try {
      await dbAdd('incomes', item)
      dispatch({ type: 'UPDATE_INCOME', item })
    } catch (e) {
      showToast(tr('toast.update.income'), 'error')
      throw e
    }
  }, [showToast, tr])

  const addExpense = useCallback(async (data) => {
    const item = { ...data, id: uid(), createdAt: new Date().toISOString() }
    try {
      await dbAdd('expenses', item)
      dispatch({ type: 'ADD_EXPENSE', item })
    } catch (e) {
      showToast(tr('toast.save.expense'), 'error')
      throw e
    }
  }, [showToast, tr])

  const delExpense = useCallback(async (id) => {
    try {
      const rec = (await dbGetAll('expenses')).find(r => r.id === id)
      await dbDelete('expenses', id)
      dispatch({ type: 'DEL_EXPENSE', id })
      await markLinked(rec, true)
    } catch (e) {
      showToast(tr('toast.delete.expense'), 'error')
      throw e
    }
  }, [showToast, tr])

  const updateExpense = useCallback(async (item) => {
    try {
      await dbAdd('expenses', item)
      dispatch({ type: 'UPDATE_EXPENSE', item })
    } catch (e) {
      showToast(tr('toast.update.expense'), 'error')
      throw e
    }
  }, [showToast, tr])

  const addBudget = useCallback(async (data) => {
    const item = { ...data, id: uid() }
    try {
      await dbAdd('budgets', item)
      dispatch({ type: 'ADD_BUDGET', item })
    } catch (e) {
      showToast(tr('toast.save.budget'), 'error')
      throw e
    }
  }, [showToast, tr])

  const delBudget = useCallback(async (id) => {
    try {
      await dbDelete('budgets', id)
      dispatch({ type: 'DEL_BUDGET', id })
    } catch (e) {
      showToast(tr('toast.delete.budget'), 'error')
      throw e
    }
  }, [showToast, tr])

  const updateBudget = useCallback(async (item) => {
    try {
      await dbAdd('budgets', item)
      dispatch({ type: 'UPDATE_BUDGET', item })
    } catch (e) {
      showToast(tr('toast.update.budget'), 'error')
      throw e
    }
  }, [showToast, tr])

  const addDebt = useCallback(async (data) => {
    const item = { ...data, id: uid() }
    try {
      await dbAdd('debts', item)
      dispatch({ type: 'ADD_DEBT', item })
      await syncSources()
    } catch (e) {
      showToast(tr('toast.save.debt'), 'error')
      throw e
    }
  }, [showToast, tr, syncSources])

  const delDebt = useCallback(async (id) => {
    try {
      await dbDelete('debts', id)
      dispatch({ type: 'DEL_DEBT', id })
      await syncSources()
    } catch (e) {
      showToast(tr('toast.delete.debt'), 'error')
      throw e
    }
  }, [showToast, tr, syncSources])

  const updateDebt = useCallback(async (item) => {
    try {
      await dbAdd('debts', item)
      dispatch({ type: 'UPDATE_DEBT', item })
      await syncSources()
    } catch (e) {
      showToast(tr('toast.update.debt'), 'error')
      throw e
    }
  }, [showToast, tr, syncSources])

  const addGoal = useCallback(async (data) => {
    const item = { ...data, id: uid() }
    try {
      await dbAdd('goals', item)
      dispatch({ type: 'ADD_GOAL', item })
    } catch (e) {
      showToast(tr('toast.save.goal'), 'error')
      throw e
    }
  }, [showToast, tr])

  const delGoal = useCallback(async (id) => {
    try {
      await dbDelete('goals', id)
      dispatch({ type: 'DEL_GOAL', id })
    } catch (e) {
      showToast(tr('toast.delete.goal'), 'error')
      throw e
    }
  }, [showToast, tr])

  const updateGoal = useCallback(async (item) => {
    try {
      await dbAdd('goals', item)
      dispatch({ type: 'UPDATE_GOAL', item })
    } catch (e) {
      showToast(tr('toast.update.goal'), 'error')
      throw e
    }
  }, [showToast, tr])

  const updateSettings = useCallback(async (settings) => {
    try {
      await saveSettings(settings)
      dispatch({ type: 'SAVE_SETTINGS', settings })
      document.documentElement.setAttribute('data-theme', settings.theme || 'light')
      document.documentElement.setAttribute('lang', settings.language || 'es')
    } catch (e) {
      showToast(tr('toast.settingsError'), 'error')
    }
  }, [showToast, tr])

  // ── Controles de sync (opt-in) para Ajustes ──────────────────────────────────
  const enableSync = useCallback(async () => {
    setSyncEnabled(true)
    try {
      const r = await initialSync(rehydrate)
      // Verificación real: initialSync es resiliente y se traga los fallos de
      // push. Forzamos un push que SÍ propaga el error para no reportar un
      // "activado" falso cuando la nube rechaza la licencia (bug histórico).
      await pushNow()
      showToast(tr(r?.applied ? 'toast.syncOnApplied' : 'toast.syncOn'), 'ok')
      return { ok: true, applied: !!r?.applied }
    } catch (e) {
      setSyncEnabled(false)
      const invalid = /invalid_license/.test(String(e?.message || ''))
      // (El texto viejo en español además decía "Falta aplicar el fix de sync en
      // Supabase": eso es para el equipo, no para el usuario. Ver CLAUDE.md,
      // sección Supabase, si este error aparece.)
      showToast(tr(invalid ? 'toast.syncInvalidLicense' : 'toast.syncFailed'), 'error')
      return { ok: false }
    }
  }, [rehydrate, showToast, tr])

  const disableSync = useCallback(() => {
    setSyncEnabled(false)
    showToast(tr('toast.syncOff'), 'ok')
  }, [showToast, tr])

  const clearAll = useCallback(async () => {
    try {
      await clearAllData()
      dispatch({ type: 'CLEAR_ALL' })
      // El valor de las propiedades (patrimonio) vive en settings.propertyValues,
      // que clearAllData NO toca. Sin esto, el patrimonio sobrevive al "borrar
      // todo" y aparece precargado en cada licencia. Lo limpiamos aquí para que
      // el borrado deje realmente todo en cero.
      const current = (await getSettings()) || {}
      if (current.propertyValues && Object.keys(current.propertyValues).length) {
        const { propertyValues, ...rest } = current
        await saveSettings(rest)
        dispatch({ type: 'SAVE_SETTINGS', settings: rest })
      }
      showToast(tr('toast.cleared'), 'ok')
    } catch (e) {
      showToast(tr('toast.clearError'), 'error')
    }
  }, [showToast, tr])

  const loadDemo = useCallback(async () => {
    try {
      await clearAllData()
      const seeds = {
        incomes:      SEED_INCOMES.map(r  => ({ ...r,  id: uid() })),
        expenses:     SEED_EXPENSES.map(r => ({ ...r,  id: uid() })),
        budgets:      SEED_BUDGETS.map(r  => ({ ...r,  id: uid() })),
        debts:        SEED_DEBTS.map(r    => ({ ...r,  id: uid() })),
        goals:        SEED_GOALS.map(r    => ({ ...r,  id: uid() })),
        // clearAllData() ya vació subscriptions/importBatches en IndexedDB;
        // sin limpiarlos también acá quedan huérfanos en el estado en memoria
        // hasta el próximo reload.
        subscriptions: [],
        importBatches: [],
      }
      await Promise.all([
        ...seeds.incomes.map(r  => dbAdd('incomes',  r)),
        ...seeds.expenses.map(r => dbAdd('expenses', r)),
        ...seeds.budgets.map(r  => dbAdd('budgets',  r)),
        ...seeds.debts.map(r    => dbAdd('debts',    r)),
        ...seeds.goals.map(r    => dbAdd('goals',    r)),
      ])
      dispatch({ type: 'HYDRATE', payload: seeds })
      showToast(tr('toast.demoLoaded'), 'ok')
    } catch (e) {
      showToast(tr('toast.demoError'), 'error')
    }
  }, [showToast, tr])

  // FIX: BOM UTF-8 (\uFEFF) para que Excel Windows muestre acentos correctamente
  const exportCSV = useCallback(() => {
    try {
      // Encabezados y valores fijos (tipo, categoría canónica, método,
      // recurrencia) en el idioma activo; lo que escribió el usuario va tal cual.
      const lang = langRef.current
      const rows = [
        ['type', 'date', 'description', 'category', 'amount', 'method', 'recurrence', 'notes'].map(c => tr(`csv.col.${c}`)),
        ...state.incomes.map(r  => [tr('csv.type.income'),  r.date, r.source,      catName(r.category, lang), r.amount,  '',                           recurrenceLabel(r.recurrence, lang), r.notes || '']),
        ...state.expenses.map(r => [tr('csv.type.expense'), r.date, r.description, catName(r.category, lang), -r.amount, methodLabel(r.method, lang), recurrenceLabel(r.recurrence, lang), r.notes || '']),
      ]
      const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }) // FIX: BOM
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `moyiq-${localDateStr()}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showToast(tr('toast.csvExported'), 'ok')
    } catch (e) {
      showToast(tr('toast.csvError'), 'error')
    }
  }, [state.incomes, state.expenses, showToast, tr])

  const exportData = useCallback(async () => {
    try {
      const data = await exportAllData()
      // Agregar metadata al respaldo
      const backup = {
        _meta: {
          version:    '1.5',
          app:        'MOY IQ',
          createdAt:  new Date().toISOString(),
          recordCount: {
            incomes:       (data.incomes       || []).length,
            expenses:      (data.expenses      || []).length,
            budgets:       (data.budgets       || []).length,
            debts:         (data.debts         || []).length,
            goals:         (data.goals         || []).length,
            importBatches: (data.importBatches || []).length,
            recurring:     (data.recurring     || []).length,
          },
        },
        ...data,
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `moyiq-backup-${localDateStr()}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast(tr('toast.backupCreated'), 'ok')
    } catch (e) {
      showToast(tr('toast.backupError'), 'error')
    }
  }, [showToast, tr])

  const importData = useCallback(async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result)
          await importAllData(data)
          await reconcileRecurringSources().catch(() => {})
          await rehydrate()
          showToast(tr('toast.imported'), 'ok')
          resolve()
        } catch (err) {
          showToast(tr('toast.importError'), 'error')
          reject(err)
        }
      }
      reader.onerror = () => {
        showToast(tr('toast.readError'), 'error')
        reject(new Error('FileReader error'))
      }
      reader.readAsText(file)
    })
  }, [showToast, tr, rehydrate])

  // ── Subscriptions ─────────────────────────────────────────────
  const addSubscription = useCallback(async (item) => {
    try {
      const newItem = { ...item, id: item.id || uid(), createdAt: item.createdAt || new Date().toISOString() }
      await dbAdd('subscriptions', newItem)
      dispatch({ type: 'ADD_SUB', item: newItem })
      await syncSources()
      return newItem
    } catch (e) { showToast(tr('toast.save.subscription'), 'error') }
  }, [showToast, tr, syncSources])
  const deleteSubscription = useCallback(async (id) => {
    try {
      await dbDelete('subscriptions', id)
      dispatch({ type: 'DEL_SUB', id })
      await syncSources()
    } catch (e) { showToast(tr('toast.delete.subscription'), 'error') }
  }, [showToast, tr, syncSources])
  const updateSubscription = useCallback(async (item) => {
    try {
      await dbAdd('subscriptions', item)
      dispatch({ type: 'UPDATE_SUB', item })
      await syncSources()
    } catch (e) { showToast(tr('toast.update.subscription'), 'error') }
  }, [showToast, tr, syncSources])

  // ── Movimientos fijos ─────────────────────────────────────────
  const saveRule = useCallback(async (rule) => {
    const item = { ...rule, id: rule.id || uid(), createdAt: rule.createdAt || new Date().toISOString() }
    try {
      await dbAdd('recurring', item)
      dispatch({ type: 'UPSERT_RULE', item })
      return item
    } catch (e) { showToast(tr('rec.toast.saveError'), 'error'); throw e }
  }, [showToast, tr])

  // Confirma una o varias ocurrencias ({ rule, date, amount? }). Si alguna es
  // de una deuda, baja el saldo (y si queda saldada, la regla termina).
  const confirmOccurrences = useCallback(async (items) => {
    try {
      const res = await confirmOccurrencesInDb(items)
      await rehydrate()
      if (res.debts.length) await syncSources()
      hapticTap()
      return res
    } catch (e) { showToast(tr('rec.toast.confirmError'), 'error'); throw e }
  }, [rehydrate, syncSources, showToast, tr])

  const skipOccurrence = useCallback(async (rule, date, skip = true) => {
    const skipped = new Set(rule.skipped || [])
    if (skip) skipped.add(date); else skipped.delete(date)
    return saveRule({ ...rule, skipped: [...skipped].sort() })
  }, [saveRule])

  // "Desde ahora": monto nuevo a partir del mes `ym` (el pasado no cambia).
  const setRuleAmountFrom = useCallback(async (rule, ym, amount) => saveRule(withAmountFrom(rule, ym, amount)), [saveRule])

  // "Se repite": guarda el movimiento y crea su regla, con este registro como
  // la primera ocurrencia confirmada.
  const addWithRule = useCallback(async (kind, data, freq = 'monthly') => {
    const rule = await saveRule(ruleFromRecord(data, { kind, freq, id: uid() }))
    const linked = { ...data, recurringId: rule.id, occurrenceDate: data.date }
    if (kind === 'income') await addIncome(linked)
    else await addExpense(linked)
    return rule
  }, [saveRule, addIncome, addExpense])

  const value = useMemo(() => ({
    ...state,
    addIncome,  delIncome,  updateIncome,
    addExpense, delExpense,   updateExpense,
    addBudget,  delBudget,  updateBudget,
    addDebt,    delDebt,    updateDebt,
    addGoal,    delGoal,    updateGoal,
      addSubscription, deleteSubscription, updateSubscription,
    saveRule, confirmOccurrences, skipOccurrence, setRuleAmountFrom, addWithRule,
    updateSettings,
    clearAll,   loadDemo,
    exportData, exportCSV,  importData,
    enableSync, disableSync,
    showToast, dismissToast, deleteWithUndo,
    rehydrate,
  }), [
    state,
    addIncome, delIncome, updateIncome,
    addExpense, delExpense, updateExpense,
    addBudget, delBudget, updateBudget,
    addDebt, delDebt, updateDebt,
    addGoal, delGoal, updateGoal,
    addSubscription, deleteSubscription, updateSubscription,
    saveRule, confirmOccurrences, skipOccurrence, setRuleAmountFrom, addWithRule,
    updateSettings,
    clearAll, loadDemo,
    exportData, exportCSV, importData,
    enableSync, disableSync,
    showToast, dismissToast, deleteWithUndo,
    rehydrate,
  ])


  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider')
  return ctx
}
