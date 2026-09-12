// src/demo/DemoContext.jsx
// Contexto de demo — replica la interfaz de AppContext pero vive 100% en memoria
// NUNCA escribe en IndexedDB — los datos se descartan al cerrar la pestaña
// Se activa cuando la URL contiene ?demo=true

import { createContext, useContext, useReducer, useCallback } from 'react'
import { DEMO_STATE, DEMO_INCOMES_EXITOSO } from './demoData.js'
import { setMoneyLocale, setDateLocale } from '../utils/index.js'

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

  const showToast = useCallback((msg, type = 'ok', action = null) => {
    dispatch({ type: 'SET_TOAST', toast: { msg, type, action } })
    setTimeout(() => dispatch({ type: 'SET_TOAST', toast: null }), action ? 6000 : 3500)
  }, [])
  const dismissToast = useCallback(() => dispatch({ type: 'SET_TOAST', toast: null }), [])

  // Borrado con deshacer en demo (en memoria: re-dispatch del ADD con el mismo item)
  const deleteWithUndo = useCallback((store, item, deletedMsg = 'Eliminado', undoLabel = 'Deshacer') => {
    const DEL = { incomes:'DEL_INCOME', expenses:'DEL_EXPENSE', budgets:'DEL_BUDGET', debts:'DEL_DEBT', goals:'DEL_GOAL', subscriptions:'DEL_SUB' }[store]
    const ADD = { incomes:'ADD_INCOME', expenses:'ADD_EXPENSE', budgets:'ADD_BUDGET', debts:'ADD_DEBT', goals:'ADD_GOAL', subscriptions:'ADD_SUB' }[store]
    if (!DEL || !item?.id) return
    dispatch({ type: DEL, id: item.id })
    showToast(deletedMsg, 'ok', { label: undoLabel, onAction: () => dispatch({ type: ADD, item }) })
  }, [showToast])

  // Todas las operaciones son en memoria — sin await, sin IndexedDB
  const addIncome    = useCallback((item) => { dispatch({ type: 'ADD_INCOME',  item: { ...item, id: uid() } }); showToast('Ingreso agregado en demo.', 'ok') }, [showToast])
  const updateIncome = useCallback((item) => { dispatch({ type: 'UPDATE_INCOME', item }) }, [])
  const delIncome   = useCallback((id)   => { dispatch({ type: 'DEL_INCOME',  id }) }, [])
  const addExpense  = useCallback((item) => { dispatch({ type: 'ADD_EXPENSE', item: { ...item, id: uid() } }); showToast('Gasto agregado en demo.', 'ok') }, [showToast])
  const delExpense    = useCallback((id)   => { dispatch({ type: 'DEL_EXPENSE', id }) }, [])
  const updateExpense = useCallback((item) => { dispatch({ type: 'UPDATE_EXPENSE', item }) }, [])
  const addBudget   = useCallback((item) => { dispatch({ type: 'ADD_BUDGET',  item: { ...item, id: uid() } }); showToast('Presupuesto agregado en demo.', 'ok') }, [showToast])
  const delBudget   = useCallback((id)   => { dispatch({ type: 'DEL_BUDGET',  id }) }, [])
  const addDebt     = useCallback((item) => { dispatch({ type: 'ADD_DEBT',    item: { ...item, id: uid() } }); showToast('Deuda agregada en demo.', 'ok') }, [showToast])
  const delDebt     = useCallback((id)   => { dispatch({ type: 'DEL_DEBT',    id }) }, [])
  const updateDebt   = useCallback((item) => { dispatch({ type: 'UPDATE_DEBT', item }) }, [])
  const updateBudget = useCallback((item) => { dispatch({ type: 'UPDATE_BUDGET', item }) }, [])
  const addGoal     = useCallback((item) => { dispatch({ type: 'ADD_GOAL',    item: { ...item, id: uid() } }); showToast('Meta agregada en demo.', 'ok') }, [showToast])
  const delGoal     = useCallback((id)   => { dispatch({ type: 'DEL_GOAL',    id }) }, [])
  const updateGoal  = useCallback((item) => { dispatch({ type: 'UPDATE_GOAL', item }) }, [])
  const addSubscription    = useCallback((item) => { dispatch({ type: 'ADD_SUB', item: { ...item, id: 'sub-' + Math.random().toString(36).slice(2,9) } }); showToast('Recurrente agregado en demo.', 'ok') }, [showToast])
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
    showToast('Demo reiniciada con datos ficticios.', 'ok')
  }, [showToast])

  // loadDemo en demo = recarga los datos originales
  const loadDemo = useCallback(() => {
    dispatch({ type: 'HYDRATE', payload: DEMO_STATE })
    showToast('Datos demo reiniciados.', 'ok')
  }, [])

  // Export funciona normalmente — usa datos demo
  const exportCSV = useCallback(() => {
    const rows = [
      ['Tipo', 'Fecha', 'Descripción', 'Categoría', 'Monto', 'Método', 'Recurrencia'],
      ...state.incomes.map(r  => ['Ingreso', r.date, r.source,      r.category, r.amount,  '',       r.recurrence]),
      ...state.expenses.map(r => ['Gasto',   r.date, r.description, r.category, -r.amount, r.method, r.recurrence]),
    ]
    const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'moyiq-demo-data.csv'
    a.click()
    URL.revokeObjectURL(url)
    showToast('CSV demo exportado — solo datos ficticios.', 'ok')
  }, [state.incomes, state.expenses, showToast])

  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify(DEMO_STATE, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'moyiq-demo-backup.json'
    a.click()
    URL.revokeObjectURL(url)
    showToast('JSON demo exportado — solo datos ficticios.', 'ok')
  }, [])

  // Import en demo: solo memoria, no persiste
  const importData = useCallback(async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result)
          dispatch({ type: 'HYDRATE', payload: data })
          showToast('Datos cargados en demo (solo en memoria).', 'ok')
          resolve()
        } catch {
          showToast('Error al leer el archivo.', 'error')
          reject()
        }
      }
      reader.readAsText(file)
    })
  }, [showToast])

  const setScenario = useCallback((scenario) => {
    dispatch({ type: 'SET_SCENARIO', scenario })
    showToast(scenario === 'exitoso' ? 'Mostrando mes exitoso · $4.700.000 ingresos' : 'Mostrando mes difícil · $2.280.000 ingresos', 'ok')
  }, [showToast])

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
    enableSync: async () => { showToast('El sync no está disponible en el demo.', 'ok'); return { ok:false } },
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
