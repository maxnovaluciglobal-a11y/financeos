// src/demo/DemoContext.jsx
// Contexto de demo — replica la interfaz de AppContext pero vive 100% en memoria
// NUNCA escribe en IndexedDB — los datos se descartan al cerrar la pestaña
// Se activa cuando la URL contiene ?demo=true

import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react'
import { buildDemoState, pickDemoPersonaId, demoPersona } from './demoData.js'
import { detectLanguage } from '../i18n/translate.js'
import { setMoneyLocale, setDateLocale, fmtMoney, currencySymbol, catName, recurrenceLabel, methodLabel, localDateStr } from '../utils/index.js'
import { reconcileRules } from '../utils/recurringSources.js'
import { planConfirmations } from '../utils/recurringConfirm.js'
import { ruleFromRecord, withAmountFrom } from '../utils/recurring.js'
import { translate } from '../i18n/translate.js'
import { loadLang } from '../i18n/langCache.js'

export const DemoContext = createContext(null)

// Suscripciones y Deudas tienen su regla de fijos también en el demo: después
// de cada cambio en el origen, las reglas se alinean en memoria (misma
// reconcileRules que la app real).
const SOURCE_ACTIONS = new Set(['ADD_SUB', 'DEL_SUB', 'UPDATE_SUB', 'ADD_DEBT', 'DEL_DEBT', 'UPDATE_DEBT'])
function reducer(state, action) {
  const next = baseReducer(state, action)
  if (!SOURCE_ACTIONS.has(action.type) || next === state) return next
  const ups = reconcileRules(next.recurring || [], next.subscriptions || [], next.debts || [], { today: localDateStr() })
  if (!ups.length) return next
  const ids = new Set(ups.map(r => r.id))
  return { ...next, recurring: [...(next.recurring || []).filter(r => !ids.has(r.id)), ...ups] }
}

// Replica el mismo reducer que AppContext para compatibilidad total
function baseReducer(state, action) {
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
    case 'ADD_SUB':        return { ...state, subscriptions: [action.item, ...(state.subscriptions||[])] }
    case 'DEL_SUB':        return { ...state, subscriptions: (state.subscriptions||[]).filter(s => s.id !== action.id) }
    case 'UPDATE_SUB':     return { ...state, subscriptions: (state.subscriptions||[]).map(s => s.id === action.item.id ? action.item : s) }
    case 'UPDATE_DEBT':    return { ...state, debts:    state.debts.map(d => d.id === action.item.id ? action.item : d) }
    case 'ADD_GOAL':     return { ...state, goals:    [...state.goals, action.item] }
    case 'DEL_GOAL':     return { ...state, goals:    state.goals.filter(g => g.id !== action.id) }
    case 'UPDATE_GOAL':  return { ...state, goals:    state.goals.map(g => g.id === action.item.id ? action.item : g) }
    case 'SET_RECURRING':return { ...state, recurring: action.items }
    case 'UPSERT_RULE':  return { ...state, recurring: [...(state.recurring || []).filter(r => r.id !== action.item.id), action.item] }
    case 'DEL_RULE':     return { ...state, recurring: (state.recurring || []).filter(r => r.id !== action.id) }
    // Confirmar ocurrencias en memoria: registros nuevos + deudas con saldo bajado.
    case 'APPLY_CONFIRMATIONS': {
      const inc = action.writes.filter(w => w.store === 'incomes').map(w => w.record)
      const exp = action.writes.filter(w => w.store === 'expenses').map(w => w.record)
      const debts = new Map(action.writes.filter(w => w.debt).map(w => [w.debt.id, w.debt]))
      return { ...state,
        incomes: [...inc, ...state.incomes],
        expenses: [...exp, ...state.expenses],
        debts: state.debts.map(d => debts.get(d.id) || d),
      }
    }
    case 'SAVE_SETTINGS':return { ...state, settings: action.settings }
    // En demo, "borrar todo" recarga los datos de la misma persona (y conserva el idioma elegido)
    case 'CLEAR_ALL':    return { ...state, ...buildDemoState(state.personaId, state.settings?.language) }
    case 'SET_SCENARIO': {
      const p = demoPersona(state.personaId)
      return { ...state, incomes: action.scenario === 'exitoso' ? p.incomesGood : p.incomesHard }
    }
    case 'SET_TOAST':    return { ...state, toast: action.toast }
    default:             return state
  }
}

const uid = () => Math.random().toString(36).slice(2, 10)

export function DemoProvider({ children }) {
  // Persona según el idioma del navegador (en → EE. UU./USD, de → Alemania/EUR,
  // es/pt → Sofía/COP). Arranca en el mes positivo (aspiracional); el toggle
  // lleva a 'mes difícil'.
  const [state, dispatch] = useReducer(reducer, null, () => {
    const language = detectLanguage()
    return {
      ...buildDemoState(pickDemoPersonaId(language), language, 'exitoso'),
      loading: false,
      toast: null,
    }
  })

  // Aplica idioma/moneda iniciales del demo una vez al montar (antes solo se
  // aplicaban al cambiar settings, así que el idioma detectado del navegador
  // no llegaba a fechas, formato de miles ni al <html lang>).
  useEffect(() => {
    const st = state.settings || {}
    document.documentElement.setAttribute('lang', st.language || 'es')
    setMoneyLocale(st.currency || 'CLP', st.language || 'es')
    setDateLocale(st.language || 'es')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Formato de dinero sincrónico en el render (mismo criterio que AppContext):
  // la persona de EE. UU. tiene que pintar "$1,250.00" desde el primer frame.
  setMoneyLocale(state.settings?.currency || 'CLP', state.settings?.language || 'es')

  // Mismo criterio que AppContext: textos en el idioma activo vía ref.
  const langRef = useRef(state.settings?.language || 'es')
  langRef.current = state.settings?.language || 'es'
  useEffect(() => { loadLang(langRef.current) }, [state.settings?.language])
  const tr = useCallback((key, vars) => translate(langRef.current, key, vars), [])

  const showToast = useCallback((msg, type = 'ok', action = null) => {
    dispatch({ type: 'SET_TOAST', toast: { msg, type, action } })
    setTimeout(() => dispatch({ type: 'SET_TOAST', toast: null }), action ? 6000 : 3500)
  }, [])
  const dismissToast = useCallback(() => dispatch({ type: 'SET_TOAST', toast: null }), [])

  // Borrado con deshacer en demo (en memoria: re-dispatch del ADD con el mismo item)
  const deleteWithUndo = useCallback((store, item, deletedMsg, undoLabel) => {
    const DEL = { incomes:'DEL_INCOME', expenses:'DEL_EXPENSE', budgets:'DEL_BUDGET', debts:'DEL_DEBT', goals:'DEL_GOAL', subscriptions:'DEL_SUB', recurring:'DEL_RULE' }[store]
    const ADD = { incomes:'ADD_INCOME', expenses:'ADD_EXPENSE', budgets:'ADD_BUDGET', debts:'ADD_DEBT', goals:'ADD_GOAL', subscriptions:'ADD_SUB', recurring:'UPSERT_RULE' }[store]
    if (!DEL || !item?.id) return
    dispatch({ type: DEL, id: item.id })
    showToast(deletedMsg || tr('common.deleted'), 'ok', { label: undoLabel || tr('common.undo'), onAction: () => dispatch({ type: ADD, item }) })
  }, [showToast, tr])

  // Todas las operaciones son en memoria — sin await, sin IndexedDB
  const addIncome    = useCallback((item) => { dispatch({ type: 'ADD_INCOME',  item: { ...item, id: uid() } }); showToast(tr('demo.toast.added.income'), 'ok') }, [showToast, tr])
  const updateIncome = useCallback((item) => { dispatch({ type: 'UPDATE_INCOME', item }) }, [])
  const delIncome   = useCallback((id)   => { dispatch({ type: 'DEL_INCOME',  id }) }, [])
  const addExpense  = useCallback((item) => { dispatch({ type: 'ADD_EXPENSE', item: { ...item, id: uid() } }); showToast(tr('demo.toast.added.expense'), 'ok') }, [showToast, tr])
  const delExpense    = useCallback((id)   => { dispatch({ type: 'DEL_EXPENSE', id }) }, [])
  const updateExpense = useCallback((item) => { dispatch({ type: 'UPDATE_EXPENSE', item }) }, [])
  const addBudget   = useCallback((item) => { dispatch({ type: 'ADD_BUDGET',  item: { ...item, id: uid() } }); showToast(tr('demo.toast.added.budget'), 'ok') }, [showToast, tr])
  const delBudget   = useCallback((id)   => { dispatch({ type: 'DEL_BUDGET',  id }) }, [])
  const addDebt     = useCallback((item) => { dispatch({ type: 'ADD_DEBT',    item: { ...item, id: uid() } }); showToast(tr('demo.toast.added.debt'), 'ok') }, [showToast, tr])
  const delDebt     = useCallback((id)   => { dispatch({ type: 'DEL_DEBT',    id }) }, [])
  const updateDebt   = useCallback((item) => { dispatch({ type: 'UPDATE_DEBT', item }) }, [])
  const updateBudget = useCallback((item) => { dispatch({ type: 'UPDATE_BUDGET', item }) }, [])
  const addGoal     = useCallback((item) => { dispatch({ type: 'ADD_GOAL',    item: { ...item, id: uid() } }); showToast(tr('demo.toast.added.goal'), 'ok') }, [showToast, tr])
  const delGoal     = useCallback((id)   => { dispatch({ type: 'DEL_GOAL',    id }) }, [])
  const updateGoal  = useCallback((item) => { dispatch({ type: 'UPDATE_GOAL', item }) }, [])
  const addSubscription    = useCallback((item) => { dispatch({ type: 'ADD_SUB', item: { ...item, id: 'sub-' + Math.random().toString(36).slice(2,9) } }); showToast(tr('demo.toast.added.subscription'), 'ok') }, [showToast, tr])
  const deleteSubscription = useCallback((id)   => { dispatch({ type: 'DEL_SUB', id }) }, [])
  const updateSubscription = useCallback((item) => { dispatch({ type: 'UPDATE_SUB', item }) }, [])

  // ── Movimientos fijos (en memoria) ──
  const stateRef = useRef(state)
  stateRef.current = state
  const saveRule = useCallback((rule) => {
    const item = { ...rule, id: rule.id || 'rec-' + uid(), createdAt: rule.createdAt || new Date().toISOString() }
    dispatch({ type: 'UPSERT_RULE', item })
    return item
  }, [])
  const confirmOccurrences = useCallback((items) => {
    const st = stateRef.current
    const debtsById = new Map((st.debts || []).map(d => [d.id, d]))
    const writes = planConfirmations(items, [...st.incomes, ...st.expenses], debtsById, { today: localDateStr(), now: new Date().toISOString() })
    if (writes.length) dispatch({ type: 'APPLY_CONFIRMATIONS', writes })
    // Una deuda saldada termina su regla (como en la app real).
    if (writes.some(w => w.debt)) dispatch({ type: 'UPDATE_DEBT', item: writes.filter(w => w.debt).slice(-1)[0].debt })
    return { records: writes.map(w => w.record), debts: writes.filter(w => w.debt).map(w => w.debt) }
  }, [])
  const skipOccurrence = useCallback((rule, date, skip = true) => {
    const skipped = new Set(rule.skipped || [])
    if (skip) skipped.add(date); else skipped.delete(date)
    return saveRule({ ...rule, skipped: [...skipped].sort() })
  }, [saveRule])
  const setRuleAmountFrom = useCallback((rule, ym, amount) => saveRule(withAmountFrom(rule, ym, amount)), [saveRule])
  const addWithRule = useCallback((kind, data, freq = 'monthly') => {
    const rule = saveRule(ruleFromRecord(data, { kind, freq, id: 'rec-' + uid() }))
    const linked = { ...data, recurringId: rule.id, occurrenceDate: data.date }
    dispatch({ type: kind === 'income' ? 'ADD_INCOME' : 'ADD_EXPENSE', item: { ...linked, id: uid() } })
    showToast(tr(kind === 'income' ? 'demo.toast.added.income' : 'demo.toast.added.expense'), 'ok')
    return rule
  }, [saveRule, showToast, tr])

  const updateSettings = useCallback((settings) => {
    dispatch({ type: 'SAVE_SETTINGS', settings })
    document.documentElement.setAttribute('data-theme', settings.theme || 'light')
    document.documentElement.setAttribute('lang', settings.language || 'es')
    // El demo también debe respetar el formato de miles de la moneda elegida
    // (AppContext lo hace en un efecto; aquí el provider es independiente).
    setMoneyLocale(settings.currency || 'CLP', settings.language || 'es')
    setDateLocale(settings.language || 'es')
  }, [])

  // En demo, "borrar todo" recarga datos demo — no puede dejar vacío
  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' })
    showToast(tr('demo.toast.reset'), 'ok')
  }, [showToast, tr])

  // loadDemo en demo = recarga los datos originales
  const loadDemo = useCallback(() => {
    dispatch({ type: 'HYDRATE', payload: buildDemoState(state.personaId, state.settings?.language) })
    showToast(tr('demo.toast.reloaded'), 'ok')
  }, [showToast, tr, state.personaId, state.settings?.language])

  // Export funciona normalmente — usa datos demo
  const exportCSV = useCallback(() => {
    const rows = [
      ['type', 'date', 'description', 'category', 'amount', 'method', 'recurrence'].map(c => tr(`csv.col.${c}`)),
      ...state.incomes.map(r  => [tr('csv.type.income'),  r.date, r.source,      catName(r.category, langRef.current), r.amount,  '',                                     recurrenceLabel(r.recurrence, langRef.current)]),
      ...state.expenses.map(r => [tr('csv.type.expense'), r.date, r.description, catName(r.category, langRef.current), -r.amount, methodLabel(r.method, langRef.current), recurrenceLabel(r.recurrence, langRef.current)]),
    ]
    const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'moyiq-demo-data.csv'
    a.click()
    URL.revokeObjectURL(url)
    showToast(tr('demo.toast.csv'), 'ok')
  }, [state.incomes, state.expenses, showToast, tr])

  const exportData = useCallback(() => {
    const { personaId, ...data } = buildDemoState(state.personaId, state.settings?.language)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'moyiq-demo-backup.json'
    a.click()
    URL.revokeObjectURL(url)
    showToast(tr('demo.toast.json'), 'ok')
  }, [showToast, tr, state.personaId, state.settings?.language])

  // Import en demo: solo memoria, no persiste
  const importData = useCallback(async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result)
          dispatch({ type: 'HYDRATE', payload: data })
          showToast(tr('demo.toast.imported'), 'ok')
          resolve()
        } catch {
          showToast(tr('toast.readError'), 'error')
          reject()
        }
      }
      reader.readAsText(file)
    })
  }, [showToast, tr])

  const setScenario = useCallback((scenario) => {
    dispatch({ type: 'SET_SCENARIO', scenario })
    // Total de ingresos del mes activo de ese escenario (antes iba fijo en el texto).
    const month = state.settings?.activeMonth || ''
    const p = demoPersona(state.personaId)
    const list = scenario === 'exitoso' ? p.incomesGood : p.incomesHard
    const total = list.filter(r => r.date?.startsWith(month)).reduce((s, r) => s + (Number(r.amount) || 0), 0)
    const sym = currencySymbol(state.settings?.currency, state.settings?.language)
    showToast(tr(scenario === 'exitoso' ? 'demo.toast.scenarioGood' : 'demo.toast.scenarioHard', { amount: fmtMoney(total, sym) }), 'ok')
  }, [showToast, tr, state.personaId, state.settings?.activeMonth, state.settings?.currency, state.settings?.language])

  const value = {
    ...state,
    addIncome,  delIncome,  updateIncome,
    addExpense, delExpense, updateExpense,
    addBudget,  delBudget,  updateBudget,
    addDebt,    delDebt,    updateDebt,
    addGoal,    delGoal,    updateGoal,
    addSubscription, deleteSubscription, updateSubscription,
    saveRule, confirmOccurrences, skipOccurrence, setRuleAmountFrom, addWithRule,
    updateSettings,
    clearAll,   loadDemo,
    exportData, exportCSV,  importData,
    // Sync no disponible en demo (no-ops)
    enableSync: async () => { showToast(tr('demo.toast.noSync'), 'ok'); return { ok:false } },
    disableSync: () => {},
    showToast, dismissToast, deleteWithUndo, setScenario,
  }

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}

// Hook que devuelve el contexto de demo
export const useDemo = () => {
  const ctx = useContext(DemoContext)
  if (!ctx) throw new Error('useDemo debe usarse dentro de DemoProvider')
  return ctx
}
