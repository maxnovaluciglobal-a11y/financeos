// src/pages/Budgets/index.jsx — v1.6 (poda P2, 30-oct-2026)
// "¿En qué me estoy pasando?": el titular con el ritmo y el anillo es el
// protagonista; los 3 KPIs quedan en una línea debajo (el detalle, en una
// hoja), cada categoría en "Gastado X de Y" con barra y estado (Restante,
// arrastre, editar y borrar en la hoja de la categoría) y el reparto del
// ingreso plegado bajo la lista. Un solo primario: "Armar o ajustar
// presupuesto" (el asistente). El formulario de una línea, el modelo 50/30/20
// y "Copiar del mes anterior" siguen, en el menú ⋯ (cada uno en su hoja).
import { useState, useMemo } from 'react'
import { InlineIcon } from '../../components/icons/SignalIcon.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { KPI, FormGroup, FormRow, Btn, Alert, PageHeader, EmptyState, EmptyPickList } from '../../components/ui/index.jsx'
import { Target, Trash2, ChevronRight, ChevronDown, Ellipsis, Pencil } from 'lucide-react'
import { StateTag, Meter, HairlineTable } from '../../components/ledger/index.js'
import CategoryIcon from '../../components/CategoryIcon.jsx'
import Amount from '../../components/Amount.jsx'
import Sheet from '../../components/ui/Sheet.jsx'
import { interpolateParts } from '../../i18n/translate.js'
import s from './budgets.module.css'
import { budgetsFromPreviousMonth } from './budgetCopy.js'
import { kpiLine, rowLine, rowDetail, parseLimit } from './budgetsView.js'
import { budgetRollover, budgetStatus, budgetPace, categoryState, CATEGORY_STATE_TONE, exceedsWithTolerance, unbudgetedSpent } from '../../utils/budgets.js'
import BudgetSplit from './BudgetSplit.jsx'
import BudgetWizard from './BudgetWizard.jsx'
import w from './budgetWizard.module.css'
import { fmtMoney as fmtMoneyRaw, fmtPct, getCategoriesExpense, catLabel, currentMonth, catName, currencySymbol } from '../../utils/index.js'
import { monthLabel } from '../shared/constants.js'
import MonthSelector from '../shared/MonthSelector.jsx'
import Money, { useMoney } from '../../components/Money.jsx'
import SheetSelect from '../../components/ui/SheetSelect.jsx'

export default function Budgets() {
  const { budgets, addBudget, updateBudget, expenses, incomes, settings, updateSettings, deleteWithUndo, showToast } = useApp()
  const { t, lang } = useT()
  const [f, setF]     = useState({ category: 'Vivienda', limit: '' })
  const [err, setErr] = useState('')
  // R8b: asistente de 3 pasos en una hoja (se monta solo al abrirlo).
  const [wizOpen, setWizOpen] = useState(false)
  // Poda P2: hojas de la pantalla. sheet = 'more' | 'kpis' | 'new' | 'model' | null;
  // openRow = clave de la categoría con su hoja de detalle abierta.
  const [sheet, setSheet]       = useState(null)
  const [openRow, setOpenRow]   = useState(null)
  const [editLimit, setEditLimit] = useState(null) // texto del límite en edición (hoja de la categoría)
  const [splitOpen, setSplitOpen] = useState(false)
  const sym           = currencySymbol(settings.currency, settings.language)
  // Ocultar montos (T13): fmtMoney enmascara cuando settings.hideAmounts está activo.
  const { m } = useMoney()
  const fmtMoney = (n, s) => m(fmtMoneyRaw(n, s))
  const isChile       = (settings.country || 'CL') === 'CL'
  const ahorroLabel   = isChile ? 'Ahorro/APV/Inversión' : 'Ahorro/Inversión'
  const rolloverOn    = !!settings.budgetRollover

  const activeMonth   = settings.activeMonth || currentMonth()
  const categoriesExpense = useMemo(() => getCategoriesExpense(settings), [settings])

  // Mes anterior para calcular rollover
  const prevMonth = useMemo(() => {
    const [y, m] = activeMonth.split('-').map(Number)
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
  }, [activeMonth])

  // El presupuesto personal excluye los movimientos marcados como inversión (r.inv)
  const mExpenses     = useMemo(() => expenses.filter(r => r.date?.startsWith(activeMonth) && !r.inv), [expenses, activeMonth])
  const mIncomes      = useMemo(() => incomes.filter(r => r.date?.startsWith(activeMonth) && !r.inv), [incomes, activeMonth])
  const ingresoNeto   = useMemo(() => mIncomes.reduce((s, r) => s + r.amount, 0), [mIncomes])
  const expByCat      = useMemo(() => { const m = {}; mExpenses.forEach(e => { m[e.category] = (m[e.category] || 0) + e.amount }); return m }, [mExpenses])

  // Rollover por categoría: cálculo único de utils/budgets.js (FIN-8: sin
  // arrastre si el presupuesto es nuevo o el mes anterior no tiene datos).
  const rolloverByCat = useMemo(
    () => budgetRollover({ budgets, expenses, activeMonth, settings: { budgetRollover: rolloverOn } }),
    [rolloverOn, budgets, expenses, activeMonth])

  // Límite efectivo = base + rollover
  const effectiveLimitByCat = useMemo(() => {
    const m = {}
    budgets.forEach(b => { m[b.category] = b.limit + (rolloverByCat[b.category] || 0) })
    return m
  }, [budgets, rolloverByCat])

  const totalBudget   = useMemo(() => budgets.reduce((s, b) => s + (effectiveLimitByCat[b.category] || b.limit), 0), [budgets, effectiveLimitByCat])
  // H18 (ola A6): el presupuesto "supera" el ingreso solo por una diferencia real.
  const overIncome = exceedsWithTolerance(totalBudget, ingresoNeto)
  const budgetedCats  = useMemo(() => new Set(budgets.map(b => b.category)), [budgets])
  const totalBudgeted = useMemo(() => mExpenses.filter(e => budgetedCats.has(e.category)).reduce((s, r) => s + r.amount, 0), [mExpenses, budgetedCats])
  const overBudget    = useMemo(() => budgets.filter(b => budgetStatus(expByCat[b.category] || 0, effectiveLimitByCat[b.category] || b.limit).over), [budgets, expByCat, effectiveLimitByCat])

  async function submit() {
    if (!f.limit || Number(f.limit) <= 0)             { setErr(t('budgets.err.limit')); return }
    if (budgets.find(b => b.category === f.category)) { setErr(t('budgets.err.exists')); return }
    setErr('')
    await addBudget({ ...f, limit: Number(f.limit) })
    setF({ category: 'Vivienda', limit: '' })
    setSheet(null)
  }

  // "Copiar del mes anterior" (R10): un presupuesto por categoría con lo que se
  // gastó el mes anterior (ver budgetCopy.js: los presupuestos no son por mes).
  const copyCandidates = useMemo(() => budgetsFromPreviousMonth(expenses, activeMonth, budgets), [expenses, activeMonth, budgets])
  const [copying, setCopying] = useState(false)
  // Primera entrada (pulido 09-oct): con la página vacía se proponen esos
  // presupuestos como lista, todos marcados; el usuario desmarca lo que no quiere.
  const [skipped, setSkipped] = useState(() => new Set())
  const picked = useMemo(() => copyCandidates.filter(b => !skipped.has(b.category)), [copyCandidates, skipped])
  async function copyPrevious(list = copyCandidates) {
    if (copying || list.length === 0) return
    setCopying(true)
    try {
      for (const b of list) await addBudget({ category: b.category, limit: b.limit })
      showToast?.(t('budgets.copy.done', { n: list.length }))
    } finally { setCopying(false) }
  }
  // "Nuevo límite": el formulario de una línea de siempre, ahora en una hoja.
  function openNewBudget(cat) {
    if (cat && categoriesExpense.includes(cat)) setF(p => ({ ...p, category: cat }))
    setErr(''); setOpenRow(null); setSheet('new')
  }

  function toggleRollover() {
    updateSettings({ ...settings, budgetRollover: !rolloverOn })
  }

  // ── Titular y ritmo (UI-M5) ────────────────────────────────────────────
  const pace = budgetPace({ spent: totalBudgeted, total: totalBudget, activeMonth })
  const overTotal = pace.pace === 'over'
  const amt = (v, extra) => <Amount value={v} sym={sym} signed={false} {...extra} />
  const headline = overTotal
    ? interpolateParts(t('budgets.head.over'), {
        over: <span key="o" className={s.big}>{amt(totalBudgeted - totalBudget, { hero: true })}</span>,
        total: <span key="t" className={s.of}>{amt(totalBudget)}</span> })
    : interpolateParts(t('budgets.head.left'), {
        left: <span key="l" className={s.big}>{amt(Math.max(0, pace.left), { hero: true })}</span>,
        total: <span key="t" className={s.of}>{amt(totalBudget)}</span> })
  const usedPct = fmtPct(pace.used, { decimals: 0 })
  const paceText = pace.closed
    ? t('budgets.pace.lineClosed', { used: usedPct })
    : t('budgets.pace.line', { used: usedPct, day: pace.day, days: pace.days })

  // ── KPIs en una línea (poda P2); el detalle completo va en la hoja ──────
  const kl = kpiLine({ overCount: overBudget.length, totalBudget, income: ingresoNeto })
  const kpiText = [
    t(kl.over.key, { n: kl.over.n }),
    kl.coverage.ratio != null ? t(kl.coverage.key, { pct: fmtPct(kl.coverage.ratio, { decimals: 0 }) }) : t(kl.coverage.key),
  ].join(' · ')
  const tight = ingresoNeto > 0 && totalBudget > 0 && !overIncome && totalBudget / ingresoNeto > 0.8

  // ── Filas por categoría: con presupuesto y, al final, gasto sin asignar ──
  const rows = [
    ...budgets.map(b => {
      const spent = expByCat[b.category] || 0
      const limit = effectiveLimitByCat[b.category] || b.limit
      return { key: b.id, budget: b, category: b.category, spent, limit, carry: rolloverByCat[b.category] || 0, state: categoryState(spent, limit) }
    }),
    ...Object.entries(expByCat)
      .filter(([cat, v]) => v > 0 && !budgetedCats.has(cat))
      .sort((a, b) => b[1] - a[1])
      .map(([cat, v]) => ({ key: 'u-' + cat, category: cat, spent: v, limit: 0, carry: 0, state: 'unassigned' })),
  ]
  const row = openRow ? rows.find(r => r.key === openRow) || null : null
  const detail = row ? rowDetail(row) : null
  const closeRow = () => { setOpenRow(null); setEditLimit(null) }
  async function saveLimit() {
    const v = parseLimit(editLimit)
    if (!row?.budget || v == null || !updateBudget) return
    await updateBudget({ ...row.budget, limit: v })
    setEditLimit(null)
  }

  // Modelo 50/30/20: categorías tomadas 1:1 de CATS_EXPENSE (utils/index.js) — la
  // misma lista que usa el formulario de gasto. "Restaurantes" se fusiona en
  // Alimentación (12%→17%) porque comer afuera ya es una subcategoría.
  const sugs = [
    {cat:'Vivienda',pct:0.25,grupo:t('budgets.group.needs')},
    {cat:'Alimentación',pct:0.17,grupo:t('budgets.group.needs')},
    {cat:'Transporte',pct:0.08,grupo:t('budgets.group.needs')},
    {cat:'Salud',pct:0.05,grupo:t('budgets.group.needs')},
    {cat:'Entretención',pct:0.08,grupo:t('budgets.group.lifestyle')},
    {cat:'Educación',pct:0.07,grupo:t('budgets.group.lifestyle')},
    {cat:'Ropa',pct:0.05,grupo:t('budgets.group.lifestyle')},
    {cat:'Otros',pct:0.05,grupo:t('budgets.group.lifestyle')},
    {cat:ahorroLabel,pct:0.20,grupo:t('budgets.group.savings'),highlight:true},
  ]
  async function aplicar() {
    for (const sg of sugs) {
      if (!budgets.find(b => b.category === sg.cat)) await addBudget({category:sg.cat,limit:Math.round(ingresoNeto*sg.pct)})
    }
    setSheet(null)
  }

  // Ring resumen (texto a 11 px reales o más: el SVG se dibuja 1:1)
  const ringPct = totalBudget > 0 ? totalBudgeted / totalBudget : 0
  const ringColor = ringPct > 1 ? 'var(--neg)' : ringPct >= 0.8 ? 'var(--warn)' : 'var(--navy-400)'
  const RC = 2 * Math.PI * 48

  const closeSheet = () => setSheet(null)

  return (
    <div className="stack">
      <PageHeader title={t('budgets.title')} sub={t('budgets.sub', { month: monthLabel(activeMonth) })} />
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <MonthSelector incomes={[]} expenses={expenses} />
        <button
          onClick={toggleRollover}
          title={t('budgets.rollover.title')}
          role="switch"
          aria-checked={rolloverOn}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 0,
            borderRadius: 'var(--r-pill)', padding: '5px 4px', cursor: 'pointer', minHeight: 44,
            fontSize: 13, fontFamily: 'var(--sans)',
            color: rolloverOn ? 'var(--accent)' : 'var(--tm)',
          }}
        >
          <span style={{
            width: 28, height: 14, borderRadius: 7, position: 'relative', flexShrink: 0,
            background: rolloverOn ? 'var(--accent)' : 'var(--fill-2)', transition: '.2s',
            display: 'inline-block',
          }}>
            <span style={{
              position: 'absolute', top: 2, left: rolloverOn ? 16 : 2,
              width: 10, height: 10, borderRadius: '50%', background: 'var(--papel-000)', transition: '.2s',
            }} />
          </span>
          {rolloverOn ? t('budgets.rollover.on') : t('budgets.rollover.off')}
        </button>
      </div>
      {budgets.length === 0 && copyCandidates.length > 0 && (
        <EmptyState icon={Target}
          title={t('budgets.first.title', { month: monthLabel(prevMonth) })}
          text={t('budgets.first.text')}
          cta={picked.length === 1 ? t('budgets.first.create.one') : t('budgets.first.create.many', { n: picked.length })}
          onCta={() => copyPrevious(picked)} ctaDisabled={picked.length === 0 || copying}
          secondary={{ label: t('budgets.first.manual'), onClick: () => openNewBudget() }}>
          <EmptyPickList label={t('budgets.first.listAria')} items={copyCandidates.map(b => ({
            key: b.category,
            label: catName(b.category, lang),
            amount: <Money>{fmtMoneyRaw(b.limit, sym)}</Money>,
            checked: !skipped.has(b.category),
            onChange: (on) => setSkipped(prev => { const n = new Set(prev); on ? n.delete(b.category) : n.add(b.category); return n }),
          }))} />
        </EmptyState>
      )}
      {budgets.length === 0 && copyCandidates.length > 0 && (
        <div className={w.entry} data-tour="bud-model">
          <button type="button" className="fos-link" onClick={() => setWizOpen(true)}>{t('budgets.wiz.open')}</button>
        </div>
      )}
      {budgets.length === 0 && copyCandidates.length === 0 && (
        <div data-tour="bud-model">
          <EmptyState icon={Target}
            title={t('empty.budgets.title')}
            text={t('empty.budgets.text')}
            cta={t('budgets.wiz.open')} onCta={() => setWizOpen(true)}
            secondary={{ label: t('budgets.first.manual'), onClick: () => openNewBudget() }} />
        </div>
      )}
      {rolloverOn && (
        <div style={{ padding: '8px 12px', background: 'var(--accent-bg)', borderRadius: 'var(--r)', fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--sans)', lineHeight: 1.6 }}>
          <InlineIcon kind="subs" size={13} />{t('budgets.rollover.banner', { prev: monthLabel(prevMonth), cur: monthLabel(activeMonth) })}
        </div>
      )}

      {/* Titular en lenguaje natural + ritmo (UI-M5): la cifra protagonista. */}
      {totalBudget > 0 && (
        <section className={`${s.head} ${overTotal ? s.headOver : ''}`} aria-label={t('budgets.head.aria')} data-tour="bud-kpis">
          <div className={s.headBody}>
            <p className={s.headline}>{headline}</p>
            <div className={s.paceRow}>
              <span>{paceText}</span>
              {!pace.closed && (pace.used > 0 ? (
                <StateTag tone={pace.pace === 'ok' ? 'ok' : pace.pace === 'fast' ? 'warn' : 'risk'}
                  label={pace.pace === 'ok' ? t('budgets.pace.ok') : pace.pace === 'fast' ? t('budgets.pace.fast') : t('budgets.state.over')} />
              ) : (
                /* W1/H19 (ola A6): sin gasto, estado neutro en vez de "A buen ritmo". */
                <StateTag tone="muted" label={t('budgets.state.idle')} />
              ))}
            </div>
            {pace.perDay > 0 && <div className={s.perDay}>{t('budgets.pace.perDay', { v: fmtMoney(pace.perDay, sym) })}</div>}
            {/* Los 3 KPIs en una línea (poda P2); tocarla abre el detalle. */}
            <button type="button" className={s.kpiLine} aria-haspopup="dialog" aria-expanded={sheet === 'kpis'} onClick={() => setSheet('kpis')}>
              <StateTag tone={kl.tone} label={kpiText} />
              <ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" />
            </button>
          </div>
          <svg className={s.ring} width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="48" fill="none" stroke="var(--sur3)" strokeWidth="10" />
            <circle cx="60" cy="60" r="48" fill="none" stroke={ringColor} strokeWidth="10"
              strokeDasharray={`${Math.min(ringPct, 1) * RC} ${RC}`} strokeDashoffset={RC / 4} strokeLinecap="butt" />
            <text x="60" y="60" textAnchor="middle" fontSize="20" fill="var(--tx)" fontWeight="600" fontFamily="var(--num)">{fmtPct(ringPct, { decimals: 0 })}</text>
            <text x="60" y="78" textAnchor="middle" fontSize="12" fill="var(--th)" fontFamily="var(--sans)">{t('budgets.ring.used')}</text>
          </svg>
        </section>
      )}

      {/* Alertas, compactas: el detalle con todas las cifras está en la hoja de KPIs. */}
      {overBudget.length > 0 && <Alert type="danger">{t('budgets.alert.over', { cats: overBudget.map(b => catName(b.category, lang)).join(', ') })}</Alert>}
      {ingresoNeto > 0 && overIncome && <Alert type="danger">{t('budgets.p2.alert.deficit', { def: fmtMoney(totalBudget - ingresoNeto, sym) })}</Alert>}
      {tight && <Alert type="warning">{t('budgets.alert.tight', { pct: fmtPct(totalBudget/ingresoNeto) })}</Alert>}

      {/* Por categoría primero: es lo que se viene a mirar. Una línea por categoría. */}
      <section className={s.section} aria-labelledby="bud-list-title" data-tour="bud-summary">
        <h2 id="bud-list-title" className={s.sectionTitle}>{t('budgets.byCat', { month: monthLabel(activeMonth) })}</h2>
        {rows.length === 0 ? (
          <p style={{fontSize:13,color:'var(--th)',padding:'12px 0'}}>{t('budgets.summary.empty')}</p>
        ) : (
          <ul className={s.list} aria-label={t('budgets.list.aria')}>
            {rows.map(r => {
              const name = catName(r.category, lang)
              const line = rowLine(r)
              return (
                <li key={r.key} className={s.rowItem}>
                  <button type="button" className={s.rowBtn} aria-haspopup="dialog" onClick={() => { setOpenRow(r.key); setEditLimit(null) }}>
                    <span className={s.icon}><CategoryIcon category={r.category} /></span>
                    <span className={s.rowMain}>
                      <span className={s.rowTop}>
                        <span className={s.name}>{name}</span>
                        <StateTag tone={CATEGORY_STATE_TONE[r.state]} label={t(`budgets.state.${r.state}`)} />
                      </span>
                      <span className={s.rowLine}>
                        {interpolateParts(t(line.key), {
                          spent: <span key="s" className={s.rowNum}>{amt(line.spent)}</span>,
                          limit: <span key="l" className={s.rowNum}>{amt(line.limit || 0)}</span>,
                        })}
                      </span>
                    </span>
                  </button>
                  {r.limit > 0 && (
                    <Meter className={s.meter} value={r.spent} max={r.limit} tone={CATEGORY_STATE_TONE[r.state]}
                      label={name}
                      valueText={t('budgets.meter.text', { pct: fmtPct(r.spent / r.limit, { decimals: 0 }), spent: fmtMoney(r.spent, sym), limit: fmtMoney(r.limit, sym) })} />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Acciones (poda P2): un solo primario (el asistente) y el menú ⋯. */}
      <div className={s.actions}>
        {budgets.length > 0 && (
          <button type="button" className={`fos-btn-primary ${s.actionMain}`} data-tour="bud-model" onClick={() => setWizOpen(true)}>
            {t('budgets.p2.adjust')}
          </button>
        )}
        <button type="button" className={s.moreBtn} data-tour="bud-new" aria-label={t('budgets.p2.more')} title={t('budgets.p2.more')}
          aria-haspopup="dialog" aria-expanded={sheet === 'more'} onClick={() => setSheet('more')}>
          <Ellipsis size={18} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </div>

      {/* R8a (ola C, patrón rial): reparto del ingreso, plegado bajo la lista (poda P2). */}
      {totalBudget > 0 && ingresoNeto > 0 && (
        <div>
          <button type="button" className={s.disclosure} aria-expanded={splitOpen} aria-controls="bud-split-body"
            data-tour="bud-split" onClick={() => setSplitOpen(v => !v)}>
            <span>{t('budgets.split.title')}</span>
            <ChevronDown size={16} strokeWidth={1.7} aria-hidden="true" />
          </button>
          <div id="bud-split-body" hidden={!splitOpen}>
            <BudgetSplit key={settings.savingsTargetPct || 0} income={ingresoNeto} budgeted={totalBudget} sym={sym} headless
              savingsPct={settings.savingsTargetPct || 0}
              unbudgeted={unbudgetedSpent(expByCat, budgetedCats)}
              onSavingsPct={(v) => updateSettings({ ...settings, savingsTargetPct: v })} />
          </div>
        </div>
      )}

      {/* ── Hojas ──────────────────────────────────────────────────────────── */}
      {/* Menú ⋯: lo que antes estaba en la columna derecha. */}
      <Sheet open={sheet === 'more'} onClose={closeSheet} ariaLabel={t('budgets.p2.more')}>
        <h2 className={s.sheetTitle}>{t('budgets.p2.more')}</h2>
        <ul className={s.menu}>
          <li>
            <button type="button" className={s.menuItem} onClick={() => openNewBudget()}>
              <span className={s.menuLabel}>{t('budgets.p2.newLimit')}</span>
              <span className={s.menuDesc}>{t('budgets.p2.newLimitDesc')}</span>
            </button>
          </li>
          <li>
            <button type="button" className={s.menuItem} onClick={() => setSheet('model')}>
              <span className={s.menuLabel}>{t('budgets.p2.model')}</span>
              <span className={s.menuDesc}>{t('budgets.model.onlyNew')}</span>
            </button>
          </li>
          <li>
            <button type="button" className={s.menuItem} disabled={copyCandidates.length === 0 || copying}
              onClick={async () => { setSheet(null); await copyPrevious(copyCandidates) }}>
              <span className={s.menuLabel}>{t('budgets.copy.cta')}</span>
              <span className={s.menuDesc}>{copyCandidates.length > 0 ? t('budgets.copy.hint', { month: monthLabel(prevMonth) }) : t('budgets.p2.copy.none', { month: monthLabel(prevMonth) })}</span>
            </button>
          </li>
        </ul>
      </Sheet>

      {/* Detalle de los KPIs (antes, tres tarjetas a la vista). */}
      <Sheet open={sheet === 'kpis'} onClose={closeSheet} ariaLabel={t('budgets.p2.kpiSheet')}>
        <h2 className={s.sheetTitle}>{t('budgets.p2.kpiSheet')}</h2>
        <div className={`kpi-row ${s.kpis}`}>
          <KPI label={t('budgets.kpi.over')} value={overBudget.length} alert={overBudget.length > 0 ? t('ui.state.overBudget') : undefined} sub={overBudget.length > 0 ? t('budgets.kpi.review') : t('budgets.kpi.allOk')} />
          <KPI label={t('budgets.kpi.coverage')} value={ingresoNeto > 0 ? fmtPct(totalBudget/ingresoNeto) : '—'} color={ingresoNeto > 0 && overIncome ? 'red' : 'default'} alert={ingresoNeto > 0 && overIncome ? t('budgets.kpi.exceedsIncome') : undefined} sub={ingresoNeto > 0 ? (overIncome ? undefined : totalBudget/ingresoNeto > 0.8 ? t('budgets.kpi.noMargin') : t('budgets.kpi.healthy')) : t('budgets.kpi.noIncome')} />
          <KPI label={t('budgets.kpi.total')} value={fmtMoney(totalBudget, sym)} />
        </div>
        {ingresoNeto > 0 && overIncome && <Alert type="danger">{t('budgets.alert.deficit', { total: fmtMoney(totalBudget,sym), inc: fmtMoney(ingresoNeto,sym), def: fmtMoney(totalBudget-ingresoNeto,sym) })}</Alert>}
      </Sheet>

      {/* Nuevo límite: el formulario de una línea de siempre. */}
      <Sheet open={sheet === 'new'} onClose={closeSheet} ariaLabel={t('budgets.p2.newLimit')}>
        <h2 className={s.sheetTitle}>{t('budgets.p2.newLimit')}</h2>
        {err && <Alert type="danger">{err}</Alert>}
        <FormRow>
          <FormGroup label={t('budgets.form.category')}><SheetSelect id="budget-new-category" value={f.category} onChange={e => setF(p => ({...p,category:e.target.value}))}>{categoriesExpense.map(c => <option key={c} value={c}>{catLabel(c, lang)}</option>)}</SheetSelect></FormGroup>
          <FormGroup label={t('budgets.form.limit', { currency: settings.currency||'CLP' })}><input type="number" inputMode="decimal" min="0" value={f.limit} placeholder="0" onChange={e => setF(p => ({...p,limit:e.target.value}))} /></FormGroup>
        </FormRow>
        <Btn variant="primary" onClick={submit}>{t('budgets.form.submit')}</Btn>
      </Sheet>

      {/* Modelo 50/30/20: la tabla de sugerencias y "Aplicar". */}
      <Sheet open={sheet === 'model'} onClose={closeSheet} ariaLabel={t('budgets.model.title')} maxWidth={520}>
        <h2 className={s.sheetTitle}>{t('budgets.model.title')}</h2>
        <p style={{fontSize:13,color:ingresoNeto > 0 ? 'var(--tm)' : 'var(--neg)',margin:'4px 0 8px'}}>
          {ingresoNeto > 0
            ? <>{t('budgets.model.netIncome', { month: monthLabel(activeMonth) })} <Amount value={ingresoNeto} sym={sym} signed={false} /></>
            : <><InlineIcon kind="alert" size={13} />{t('budgets.model.noIncome', { month: monthLabel(activeMonth) })}</>}
        </p>
        <HairlineTable className={s.model} caption={t('budgets.model.title')} hideCaption
          columns={[
            { key: 'cat', label: t('budgets.model.col.category') },
            { key: 'grupo', label: t('budgets.model.col.group') },
            { key: 'amount', label: t('budgets.model.col.amount'), num: true },
            { key: 'share', label: t('budgets.model.col.share'), num: true },
          ]}
          rows={sugs.map(sg => ({
            key: sg.cat, highlight: sg.highlight, cat: catName(sg.cat, lang), grupo: sg.grupo,
            amount: ingresoNeto > 0 ? <Money>{fmtMoneyRaw(Math.round(ingresoNeto*sg.pct), sym)}</Money> : '—',
            share: fmtPct(sg.pct, { decimals: 0 }),
          }))} />
        {ingresoNeto > 0 && <>
          <div style={{fontSize:12,color:'var(--th)',fontFamily: 'var(--sans)',margin:'10px 0 8px'}}>{t('budgets.model.onlyNew')}</div>
          <Btn variant="primary" onClick={aplicar}>{t('budgets.model.apply')}</Btn>
        </>}
      </Sheet>

      {/* Detalle de una categoría: Restante, arrastre, editar y borrar. */}
      <Sheet open={!!row} onClose={closeRow} ariaLabel={row ? catName(row.category, lang) : ''}>
        {row && detail && (() => {
          const name = catName(row.category, lang)
          return (
            <>
              <div className={s.sheetHead}>
                <CategoryIcon category={row.category} />
                <h2 className={s.sheetTitle} style={{ margin: 0 }}>{name}</h2>
              </div>
              <StateTag tone={CATEGORY_STATE_TONE[row.state]} label={t(`budgets.state.${row.state}`)} />
              {row.limit > 0 && (
                <Meter className={s.sheetMeter} value={row.spent} max={row.limit} tone={CATEGORY_STATE_TONE[row.state]}
                  label={name}
                  valueText={t('budgets.meter.text', { pct: fmtPct(row.spent / row.limit, { decimals: 0 }), spent: fmtMoney(row.spent, sym), limit: fmtMoney(row.limit, sym) })} />
              )}
              <dl className={s.facts}>
                <div><dt>{t('budgets.col.budget')}</dt><dd>{detail.limit > 0 ? amt(detail.limit) : '—'}</dd></div>
                <div><dt>{t('budgets.col.spent')}</dt><dd>{amt(detail.spent)}</dd></div>
                <div>
                  <dt>{detail.left ? t(detail.left.key) : t('budgets.col.left')}</dt>
                  <dd className={detail.left?.over ? s.neg : undefined}>{detail.left ? amt(detail.left.value) : '—'}</dd>
                </div>
                {detail.carry > 0 && <div><dt>{t('budgets.p2.carry')}</dt><dd>{amt(detail.carry)}</dd></div>}
                {detail.carry > 0 && <div><dt>{t('budgets.p2.base')}</dt><dd>{amt(detail.base)}</dd></div>}
              </dl>
              {detail.carry > 0 && <p className={s.carry}>{t('budgets.carry', { v: fmtMoney(detail.carry, sym) })}</p>}

              {row.budget ? (
                editLimit != null ? (
                  <form className={s.editForm} onSubmit={(e) => { e.preventDefault(); saveLimit() }}>
                    <label htmlFor="bud-edit-limit">{t('budgets.form.limit', { currency: settings.currency || 'CLP' })}</label>
                    <input id="bud-edit-limit" type="text" inputMode="decimal" value={editLimit} onChange={e => setEditLimit(e.target.value)} autoComplete="off" />
                    <div className={s.sheetActions}>
                      <button type="button" className="fos-btn-secondary" onClick={() => setEditLimit(null)}>{t('common.cancel')}</button>
                      <button type="submit" className="fos-btn-primary" disabled={parseLimit(editLimit) == null}>{t('budgets.p2.saveLimit')}</button>
                    </div>
                  </form>
                ) : (
                  <div className={s.sheetActions}>
                    {updateBudget && (
                      <button type="button" className="fos-btn-secondary" onClick={() => setEditLimit(String(row.budget.limit ?? ''))}>
                        <Pencil size={16} strokeWidth={1.7} aria-hidden="true" />{t('budgets.p2.editLimit')}
                      </button>
                    )}
                    <button type="button" className="fos-btn-secondary" onClick={() => { const b = row.budget; closeRow(); deleteWithUndo('budgets', b, t('common.deleted'), t('common.undo')) }}>
                      <Trash2 size={16} strokeWidth={1.7} aria-hidden="true" />{t('budgets.p2.delete')}
                    </button>
                  </div>
                )
              ) : (
                <div className={s.sheetActions}>
                  <button type="button" className="fos-btn-secondary" onClick={() => openNewBudget(row.category)}>{t('budgets.unbudgeted.assignAria', { cat: name })}</button>
                </div>
              )}
            </>
          )
        })()}
      </Sheet>

      {wizOpen && <BudgetWizard onClose={() => setWizOpen(false)} />}
    </div>
  )
}
