// src/pages/Budgets/BudgetWizard.jsx — R8b (ola C; patrón de rial, más corto),
// 30-oct-2026. "Armar mi presupuesto en 3 pasos" en una hoja de alto completo:
// 1) ingreso del mes, 2) ahorro en %, 3) categorías y límites, y un resumen con
// la barra Ahorro / Presupuestado / Sin asignar (SplitBar de R8a). Crea con
// addBudget; una categoría que ya tiene presupuesto queda igual salvo que se
// pida actualizarla (updateBudget). Nada de la página se quita: el formulario
// de una línea, "Aplicar sugerencias" y "Copiar del mes anterior" siguen.
// La lógica (sugerencias, reparto, validación, escrituras) es pura y vive en
// budgetWizard.js. Un solo primario Latón por paso; montos con useMoney (T13).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import Sheet from '../../components/ui/Sheet.jsx'
import CategoryIcon from '../../components/CategoryIcon.jsx'
import { StateTag } from '../../components/ledger/index.js'
import Money, { useMoney } from '../../components/Money.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { fmtMoney, fmtPct, catName, catLabel, currencySymbol, currentMonth, getCategoriesExpense, today as todayStr } from '../../utils/index.js'
import { budgetSplit, clampSavingsPct, SAVINGS_PCT_MAX } from '../../utils/budgets.js'
import { monthPlan, pendingTotals, recurringMonthlyTotals } from '../../utils/recurring.js'
import { monthLabel } from '../shared/constants.js'
import { prevMonthKey } from './budgetCopy.js'
import { SplitBar } from './BudgetSplit.jsx'
import {
  suggestWizardIncome, initialSavingsPct, suggestWizardRows, wizardTotals,
  validateIncome, validateRows, planWizardWrites, parseAmountInput,
} from './budgetWizard.js'
import w from './budgetWizard.module.css'

const SAVINGS_CHIPS = [0, 5, 10, 15, 20]
const asInput = (n) => (Number(n) > 0 ? String(Math.round(Number(n))) : '')

export default function BudgetWizard({ onClose }) {
  const { budgets, expenses, incomes, recurring, settings, addBudget, updateBudget, updateSettings, showToast } = useApp()
  const { t, lang } = useT()
  const { m } = useMoney()
  const sym = currencySymbol(settings.currency, settings.language)
  const money = (v) => m(fmtMoney(v, sym))
  const activeMonth = settings.activeMonth || currentMonth()
  const prevMonth = prevMonthKey(activeMonth)

  // Paso 1: ingreso sugerido (real del mes + fijos previstos → mes anterior →
  // fijos → estimado del onboarding).
  const incomeSuggestion = useMemo(() => {
    const sum = (ym) => (incomes || []).filter(r => r.date?.startsWith(ym) && !r.inv).reduce((s, r) => s + (Number(r.amount) || 0), 0)
    const day = todayStr()
    let monthPending = 0, recurringMonthly = 0
    try {
      monthPending = pendingTotals(monthPlan(recurring || [], activeMonth, { incomes, expenses, today: day })).income
      recurringMonthly = recurringMonthlyTotals(recurring || [], { today: day }).income
    } catch { /* sin fijos válidos: se usa lo real */ }
    return suggestWizardIncome({ monthReal: sum(activeMonth), monthPending, prevReal: sum(prevMonth), recurringMonthly, estimated: settings.estimatedMonthlyIncome })
  }, [incomes, expenses, recurring, activeMonth, prevMonth, settings.estimatedMonthlyIncome])

  const [step, setStep] = useState(1)
  const [incomeRaw, setIncomeRaw] = useState(() => asInput(incomeSuggestion.amount))
  const [savingsRaw, setSavingsRaw] = useState(() => String(initialSavingsPct(settings)))
  const [rows, setRows] = useState(null)
  const [rowsSource, setRowsSource] = useState(null)
  const [rowsEdited, setRowsEdited] = useState(false)
  const [updateExisting, setUpdateExisting] = useState(false)
  const [showErr, setShowErr] = useState(false)
  const [addCat, setAddCat] = useState('')
  const [busy, setBusy] = useState(false)
  const incomeRef = useRef(null)
  const titleRef = useRef(null)
  const firstStep = useRef(true)
  // Al cambiar de paso, el foco va al título del paso (el lector lo anuncia).
  useEffect(() => {
    if (firstStep.current) { firstStep.current = false; return }
    titleRef.current?.focus()
  }, [step])

  const income = Math.max(0, parseAmountInput(incomeRaw) || 0)
  const savingsPct = clampSavingsPct(savingsRaw)
  const existingByCat = useMemo(() => new Map((budgets || []).map(b => [b.category, b])), [budgets])
  const list = rows || []
  const totals = wizardTotals({ income, savingsPct, rows: list, budgets, updateExisting })
  const rowCheck = validateRows(list, { budgets, updateExisting })
  const existingInRows = list.filter(r => existingByCat.has(r.category)).length
  const allCats = useMemo(() => getCategoriesExpense(settings), [settings])
  const addable = allCats.filter(c => !list.some(r => r.category === c))

  function buildRows() {
    const sug = suggestWizardRows({ expenses, activeMonth, settings, income, savingsPct })
    setRows(sug.rows.map(r => ({ category: r.category, amount: asInput(r.limit) })))
    setRowsSource(sug.source)
  }
  function editRows(fn) { setRowsEdited(true); setRows(prev => fn(prev || [])) }

  function next() {
    if (step === 1 && validateIncome(incomeRaw)) { setShowErr(true); incomeRef.current?.focus(); return }
    if (step === 2 && !rowsEdited) buildRows()
    if (step === 3 && !rowCheck.ok) {
      setShowErr(true)
      const i = list.findIndex(r => rowCheck.errors[r.category])
      setTimeout(() => document.getElementById(i >= 0 ? `bud-wiz-row-${i}` : 'bud-wiz-add')?.focus(), 0)
      return
    }
    setShowErr(false)
    setStep(s => Math.min(4, s + 1))
  }
  function back() { setShowErr(false); if (step === 1) onClose(); else setStep(s => s - 1) }

  async function create() {
    if (busy || !rowCheck.ok) return
    setBusy(true)
    try {
      const plan = planWizardWrites({ rows: list, budgets, updateExisting })
      for (const b of plan.create) await addBudget(b)
      for (const b of plan.update) await updateBudget(b)
      if (savingsPct !== (Number(settings.savingsTargetPct) || 0) || settings.savingsTargetPct === undefined) {
        await updateSettings({ ...settings, savingsTargetPct: savingsPct })
      }
      const n = plan.create.length + plan.update.length
      showToast?.(n === 0 ? t('budgets.wiz.doneNone') : n === 1 ? t('budgets.wiz.done.one') : t('budgets.wiz.done.many', { n }))
      onClose()
    } catch {
      // addBudget/updateBudget ya muestran su propio aviso de error.
      setBusy(false)
    }
  }

  const titles = { 1: t('budgets.wiz.income.title'), 2: t('budgets.wiz.savings.title'), 3: t('budgets.wiz.cats.title'), 4: t('budgets.wiz.sum.title') }
  const incomeErr = showErr && step === 1 && validateIncome(incomeRaw)

  return (
    <Sheet open onClose={onClose} ariaLabel={t('budgets.wiz.aria')} maxWidth={520} initialFocusRef={incomeRef}>
      <div className={w.wrap}>
        <header className={w.head}>
          <div className={w.headTop}>
            <span className={w.stepLbl}>{step <= 3 ? t('budgets.wiz.step', { n: step }) : t('budgets.wiz.sum.label')}</span>
            <button type="button" className={w.close} onClick={onClose} aria-label={t('common.close')} title={t('common.close')}>
              <X size={20} strokeWidth={1.7} aria-hidden="true" />
            </button>
          </div>
          <div className={w.progress} aria-hidden="true">
            {[1, 2, 3].map(n => <span key={n} className={n <= step ? w.progOn : undefined} />)}
          </div>
          <h2 ref={titleRef} tabIndex={-1} className={w.title}>{titles[step]}</h2>
        </header>

        <div className={w.body}>
          {step === 1 && (
            <div className={w.field}>
              <label htmlFor="bud-wiz-income" className={w.label}>{t('budgets.wiz.income.label', { month: monthLabel(activeMonth) })}</label>
              <div className={w.amountBox}>
                <span className={w.sym} aria-hidden="true">{sym}</span>
                <input id="bud-wiz-income" ref={incomeRef} type="text" inputMode="decimal" autoComplete="off"
                  className={w.amountInput} value={incomeRaw} placeholder="0"
                  aria-invalid={incomeErr ? 'true' : undefined} aria-describedby="bud-wiz-income-src"
                  onChange={e => setIncomeRaw(e.target.value.replace(/[^\d.,\s]/g, '').slice(0, 16))}
                  onKeyDown={e => { if (e.key === 'Enter') next() }} />
              </div>
              <p id="bud-wiz-income-src" className={w.note}>
                {t(`budgets.wiz.income.src.${incomeSuggestion.source}`, { month: monthLabel(incomeSuggestion.source === 'prev' ? prevMonth : activeMonth) })}
              </p>
              {incomeErr && <p className={w.err} role="alert">{t('budgets.wiz.income.err')}</p>}
            </div>
          )}

          {step === 2 && (() => {
            const sp = budgetSplit({ income, savingsPct })
            return (
              <div className={w.field}>
                <label htmlFor="bud-wiz-savings" className={w.label}>{t('budgets.wiz.savings.label')}</label>
                <div className={w.pctRow}>
                  <div className={w.amountBox} style={{ width: 120 }}>
                    <input id="bud-wiz-savings" type="text" inputMode="numeric" autoComplete="off" className={w.amountInput}
                      value={savingsRaw} placeholder="0" aria-label={t('budgets.split.savingsAria', { max: SAVINGS_PCT_MAX })}
                      onChange={e => setSavingsRaw(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
                      onKeyDown={e => { if (e.key === 'Enter') next() }} />
                    <span className={w.sym} aria-hidden="true">%</span>
                  </div>
                  <div className={w.chips} role="group" aria-label={t('budgets.wiz.savings.chipsAria')}>
                    {SAVINGS_CHIPS.map(p => (
                      <button key={p} type="button" className="fos-chip" aria-pressed={savingsPct === p} onClick={() => setSavingsRaw(String(p))}>
                        {fmtPct(p / 100, { decimals: 0 })}
                      </button>
                    ))}
                  </div>
                </div>
                <p className={w.note}>{t('budgets.wiz.savings.note')}</p>
                <dl className={w.pair} aria-live="polite">
                  <div><dt>{t('budgets.wiz.savings.amount')}</dt><dd className="num">{money(sp.savings)}</dd></div>
                  <div><dt>{t('budgets.wiz.savings.rest')}</dt><dd className="num">{money(Math.max(0, income - sp.savings))}</dd></div>
                </dl>
              </div>
            )
          })()}

          {step === 3 && (
            <div className={w.field}>
              {rowsSource && !rowsEdited && (
                <p className={w.note} style={{ marginTop: 0 }}>{t(`budgets.wiz.cats.src.${rowsSource}`, { month: monthLabel(prevMonth) })}</p>
              )}
              <div className={w.live} aria-live="polite">
                <p className={totals.over > 0 ? `${w.liveLine} ${w.liveOver}` : w.liveLine}>
                  {totals.over > 0
                    ? <>{t('budgets.split.over')} <Money>{fmtMoney(totals.over, sym)}</Money></>
                    : <>{t('budgets.wiz.cats.free')} <span className="num"><Money>{fmtMoney(totals.free, sym)}</Money></span></>}
                </p>
                <SplitBar split={totals} sym={sym} />
              </div>
              {existingInRows > 0 && (
                <label className={w.check}>
                  <input type="checkbox" checked={updateExisting} onChange={e => setUpdateExisting(e.target.checked)} />
                  <span>{t('budgets.wiz.cats.update', { n: existingInRows })}</span>
                </label>
              )}
              <ul className={w.rows} aria-label={t('budgets.wiz.cats.title')}>
                {list.map((r, i) => {
                  const name = catName(r.category, lang)
                  const ex = existingByCat.get(r.category)
                  const locked = !!ex && !updateExisting
                  const err = showErr && rowCheck.errors[r.category]
                  const id = `bud-wiz-row-${i}`
                  return (
                    <li key={r.category} className={w.row}>
                      <span className={w.rowIcon}><CategoryIcon category={r.category} /></span>
                      <div className={w.rowMain}>
                        <label htmlFor={id} className={w.rowName}>{name}</label>
                        {ex && <StateTag tone="muted" label={t('budgets.wiz.cats.existing')} />}
                        {err && <span className={w.err} id={`${id}-err`}>{t(err === 'dup' ? 'budgets.wiz.cats.err.dup' : 'budgets.wiz.cats.err.limit')}</span>}
                      </div>
                      <div className={`${w.amountBox} ${w.rowAmount}`}>
                        <span className={w.sym} aria-hidden="true">{sym}</span>
                        <input id={id} type="text" inputMode="decimal" autoComplete="off" className={w.amountInput}
                          value={locked ? asInput(ex.limit) : r.amount} disabled={locked} placeholder="0"
                          aria-label={t('budgets.wiz.cats.limitAria', { cat: name })}
                          aria-invalid={err ? 'true' : undefined} aria-describedby={err ? `${id}-err` : undefined}
                          onChange={e => { const v = e.target.value.replace(/[^\d.,\s]/g, '').slice(0, 16); editRows(p => p.map(x => x.category === r.category ? { ...x, amount: v } : x)) }} />
                      </div>
                      <button type="button" className={w.iconBtn} onClick={() => editRows(p => p.filter(x => x.category !== r.category))}
                        aria-label={t('budgets.wiz.cats.remove', { cat: name })} title={t('budgets.wiz.cats.remove', { cat: name })}>
                        <Trash2 size={16} strokeWidth={1.7} aria-hidden="true" />
                      </button>
                    </li>
                  )
                })}
              </ul>
              {showErr && rowCheck.empty && <p className={w.err} role="alert">{t('budgets.wiz.cats.err.empty')}</p>}
              {addable.length > 0 && (
                <div className={w.addRow}>
                  <label htmlFor="bud-wiz-add" className="sr-only">{t('budgets.wiz.cats.add')}</label>
                  <select id="bud-wiz-add" value={addCat} onChange={e => setAddCat(e.target.value)}>
                    <option value="">{t('budgets.wiz.cats.add')}</option>
                    {addable.map(c => <option key={c} value={c}>{catLabel(c, lang)}</option>)}
                  </select>
                  <button type="button" className="fos-btn-secondary" style={{ width: 'auto' }} disabled={!addCat}
                    onClick={() => { editRows(p => [...p, { category: addCat, amount: '' }]); setAddCat('') }}>
                    <Plus size={16} strokeWidth={1.7} aria-hidden="true" />{t('budgets.wiz.cats.addBtn')}
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 4 && (() => {
            const plan = planWizardWrites({ rows: list, budgets, updateExisting })
            const status = (cat) => plan.create.some(x => x.category === cat) ? 'new' : plan.update.some(x => x.category === cat) ? 'update' : 'keep'
            return (
              <div className={w.field}>
                <dl className={w.pair}>
                  <div><dt>{t('budgets.wiz.sum.income')}</dt><dd className="num">{money(income)}</dd></div>
                  <div><dt>{t('budgets.wiz.sum.savings', { pct: fmtPct(savingsPct / 100, { decimals: 0 }) })}</dt><dd className="num">{money(totals.savings)}</dd></div>
                </dl>
                <SplitBar split={totals} sym={sym} />
                <ul className={w.sumList} aria-label={t('budgets.wiz.sum.listAria')}>
                  {list.map(r => {
                    const st = status(r.category)
                    const ex = existingByCat.get(r.category)
                    const v = st === 'keep' && ex ? ex.limit : parseAmountInput(r.amount)
                    return (
                      <li key={r.category}>
                        <span className={w.sumName}>{catName(r.category, lang)}</span>
                        <StateTag tone={st === 'keep' ? 'muted' : 'ok'} label={t(`budgets.wiz.sum.${st}`)} />
                        <span className={`num ${w.sumAmt}`}><Money>{fmtMoney(v, sym)}</Money></span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })()}
        </div>

        <footer className={w.foot}>
          <button type="button" className="fos-btn-secondary" onClick={back} disabled={busy}>
            {step === 1 ? t('common.cancel') : t('budgets.wiz.back')}
          </button>
          {step < 4
            ? <button type="button" className="fos-btn-primary" onClick={next}>{t('budgets.wiz.next')}</button>
            : <button type="button" className="fos-btn-primary" onClick={create} disabled={busy || !rowCheck.ok}>
                {busy ? t('budgets.wiz.saving') : t('budgets.wiz.sum.create')}
              </button>}
        </footer>
      </div>
    </Sheet>
  )
}
