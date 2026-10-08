// src/demo/DemoContext.jsx
// Contexto de demo — replica la interfaz de AppContext pero vive 100% en memoria
// NUNCA escribe en IndexedDB — los datos se descartan al cerrar la pestaña
// Se activa cuando la URL contiene ?demo=true

import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react'
import { DEMO_STATE, DEMO_INCOMES_EXITOSO } from './demoData.js'
import { setMoneyLocale, setDateLocale, fmtMoney, catName, recurrenceLabel, methodLabel } from '../utils/index.js'
import { translate } from '../i18n/translate.js'
import { loadLang } from '../i18n/langCache.js'

export const DemoContext = createContext(null)

// Replica el mismo reducer que AppContext para compatibilidad total
function reducer(state, action) {
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
    case 'SAVE_SETTINGS':return { ...state, settings: action.settings }
    case 'CLEAR_ALL':    return { ...DEMO_STATE } // En demo, "borrar todo" recarga los datos demo
    case 'SET_SCENARIO': return { ...state, incomes: action.scenario === 'exitoso' ? DEMO_INCOMES_EXITOSO : DEMO_STATE.incomes }
    case 'SET_TOAST':    return { ...state, toast: action.toast }
    default:             return state
  }
}

const uid = () => Math.random().toString(36).slice(2, 10)

export function DemoProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, {
    ...DEMO_STATE,
    incomes: DEMO_INCOMES_EXITOSO, // arranca en un mes positivo (aspiracional); el toggle lleva a 'mes difícil'
    loading: false,
    toast: null,
  })

  // Aplica idioma/moneda iniciales del demo una vez al montar (antes solo se
  // aplicaban al cambiar settings, así que el idioma detectado del navegador
  // no llegaba a fechas, formato de miles ni al <html lang>).
  useEffect(() => {
    const st = state.settings || {}
    document.documentElement.setAttribute('lang', st.language || 'es')
    setMoneyLocale(st.currency || 'CLP')
    setDateLocale(st.language || 'es')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    const DEL = { incomes:'DEL_INCOME', expenses:'DEL_EXPENSE', budgets:'DEL_BUDGET', debts:'DEL_DEBT', goals:'DEL_GOAL', subscriptions:'DEL_SUB' }[store]
    const ADD = { incomes:'ADD_INCOME', expenses:'ADD_EXPENSE', budgets:'ADD_BUDGET', debts:'ADD_DEBT', goals:'ADD_GOAL', subscriptions:'ADD_SUB' }[store]
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

  const updateSettings = useCallback((settings) => {
    dispatch({ type: 'SAVE_SETTINGS', settings })
    document.documentElement.setAttribute('data-theme', settings.theme || 'light')
    document.documentElement.setAttribute('lang', settings.language || 'es')
    // El demo también debe respetar el formato de miles de la moneda elegida
    // (AppContext lo hace en un efecto; aquí el provider es independiente).
    setMoneyLocale(settings.currency || 'CLP')
    setDateLocale(settings.language || 'es')
  }, [])

  // En demo, "borrar todo" recarga datos demo — no puede dejar vacío
  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' })
    showToast(tr('demo.toast.reset'), 'ok')
  }, [showToast, tr])

  // loadDemo en demo = recarga los datos originales
  const loadDemo = useCallback(() => {
    dispatch({ type: 'HYDRATE', payload: DEMO_STATE })
    showToast(tr('demo.toast.reloaded'), 'ok')
  }, [showToast, tr])

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
    const blob = new Blob([JSON.stringify(DEMO_STATE, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'moyiq-demo-backup.json'
    a.click()
    URL.revokeObjectURL(url)
    showToast(tr('demo.toast.json'), 'ok')
  }, [showToast, tr])

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
    const list = scenario === 'exitoso' ? DEMO_INCOMES_EXITOSO : DEMO_STATE.incomes
    const total = list.filter(r => r.date?.startsWith(month)).reduce((s, r) => s + (Number(r.amount) || 0), 0)
    showToast(tr(scenario === 'exitoso' ? 'demo.toast.scenarioGood' : 'demo.toast.scenarioHard', { amount: fmtMoney(total) }), 'ok')
  }, [showToast, tr, state.settings?.activeMonth])

  const value = {
    ...state,
    addIncome,  delIncome,  updateIncome,
    addExpense, delExpense, updateExpense,
    addBudget,  delBudget,  updateBudget,
    addDebt,    delDebt,    updateDebt,
    addGoal,    delGoal,    updateGoal,
    addSubscription, deleteSubscription, updateSubscription,
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
