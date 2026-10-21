// src/pages/Budgets/index.jsx — v1.5
import { useState, useMemo } from 'react'
import SignalIcon, { InlineIcon } from '../../components/icons/SignalIcon.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { KPI, Card, CardHeader, FormGroup, FormRow, Btn, Alert, PageHeader, EmptyState, EmptyPickList } from '../../components/ui/index.jsx'
import { Target, Trash2 } from 'lucide-react'
import { StateTag, Meter, HairlineTable } from '../../components/ledger/index.js'
import CategoryIcon from '../../components/CategoryIcon.jsx'
import Amount from '../../components/Amount.jsx'
import { interpolateParts } from '../../i18n/translate.js'
import s from './budgets.module.css'
import { budgetsFromPreviousMonth } from './budgetCopy.js'
import { budgetRollover, budgetStatus, budgetPace, categoryState, CATEGORY_STATE_TONE } from '../../utils/budgets.js'
import { fmtMoney as fmtMoneyRaw, fmtPct, getCategoriesExpense, catLabel, currentMonth, catName, currencySymbol } from '../../utils/index.js'
import { monthLabel } from '../shared/constants.js'
import MonthSelector from '../shared/MonthSelector.jsx'
import Money, { useMoney } from '../../components/Money.jsx'

export default function Budgets() {
  const { budgets, addBudget, expenses, incomes, settings, updateSettings, deleteWithUndo, showToast } = useApp()
  const { t, lang } = useT()
  const [f, setF]     = useState({ category: 'Vivienda', limit: '' })
  const [err, setErr] = useState('')
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
  const budgetedCats  = useMemo(() => new Set(budgets.map(b => b.category)), [budgets])
  const totalBudgeted = useMemo(() => mExpenses.filter(e => budgetedCats.has(e.category)).reduce((s, r) => s + r.amount, 0), [mExpenses, budgetedCats])
  const overBudget    = useMemo(() => budgets.filter(b => budgetStatus(expByCat[b.category] || 0, effectiveLimitByCat[b.category] || b.limit).over), [budgets, expByCat, effectiveLimitByCat])

  async function submit() {
    if (!f.limit || Number(f.limit) <= 0)             { setErr(t('budgets.err.limit')); return }
    if (budgets.find(b => b.category === f.category)) { setErr(t('budgets.err.exists')); return }
    setErr('')
    await addBudget({ ...f, limit: Number(f.limit) })
    setF({ category: 'Vivienda', limit: '' })
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
  function focusNewBudget() {
    const el = document.getElementById('budget-new-category')
    el?.scrollIntoView({ block: 'center', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    el?.focus({ preventScroll: true })
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
  function assignCategory(cat) {
    if (categoriesExpense.includes(cat)) setF(p => ({ ...p, category: cat }))
    focusNewBudget()
  }

  // Ring resumen (texto a 11 px reales o más: el SVG se dibuja 1:1)
  const ringPct = totalBudget > 0 ? totalBudgeted / totalBudget : 0
  const ringColor = ringPct > 1 ? 'var(--neg)' : ringPct >= 0.8 ? 'var(--warn)' : 'var(--navy-400)'
  const RC = 2 * Math.PI * 48

  return (
    <div className="stack">
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <PageHeader title={t('budgets.title')} sub={t('budgets.sub', { month: monthLabel(activeMonth) })} />
        <MonthSelector incomes={[]} expenses={expenses} />
        <button
          onClick={toggleRollover}
          title={t('budgets.rollover.title')}
          role="switch"
          aria-checked={rolloverOn}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
            background: rolloverOn ? 'var(--accent-bg)' : 'var(--sur2)',
            border: `.5px solid ${rolloverOn ? 'var(--accent)' : 'var(--brd2)'}`,
            borderRadius: 'var(--rs)', padding: '5px 12px', cursor: 'pointer', minHeight: 44,
            fontSize: 12, fontFamily: 'var(--sans)',
            color: rolloverOn ? 'var(--accent)' : 'var(--th)',
          }}
        >
          <span style={{
            width: 28, height: 14, borderRadius: 7, position: 'relative', flexShrink: 0,
            background: rolloverOn ? 'var(--accent)' : 'var(--brd2)', transition: '.2s',
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
          secondary={{ label: t('budgets.first.manual'), onClick: focusNewBudget }}>
          <EmptyPickList label={t('budgets.first.listAria')} items={copyCandidates.map(b => ({
            key: b.category,
            label: catName(b.category, lang),
            amount: <Money>{fmtMoneyRaw(b.limit, sym)}</Money>,
            checked: !skipped.has(b.category),
            onChange: (on) => setSkipped(prev => { const n = new Set(prev); on ? n.delete(b.category) : n.add(b.category); return n }),
          }))} />
        </EmptyState>
      )}
      {budgets.length === 0 && copyCandidates.length === 0 && (
        <EmptyState icon={Target}
          title={t('empty.budgets.title')}
          text={t('empty.budgets.text')}
          cta={t('empty.budgets.cta')} onCta={focusNewBudget} />
      )}
      {rolloverOn && (
        <div style={{ padding: '8px 12px', background: 'var(--accent-bg)', border: '.5px solid var(--accent)', borderRadius: 8, fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--sans)', lineHeight: 1.6 }}>
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
              {!pace.closed && (
                <StateTag tone={pace.pace === 'ok' ? 'ok' : pace.pace === 'fast' ? 'warn' : 'risk'}
                  label={pace.pace === 'ok' ? t('budgets.pace.ok') : pace.pace === 'fast' ? t('budgets.pace.fast') : t('budgets.state.over')} />
              )}
            </div>
            {pace.perDay > 0 && <div className={s.perDay}>{t('budgets.pace.perDay', { v: fmtMoney(pace.perDay, sym) })}</div>}
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

      {totalBudget > 0 && (
        <div className={`kpi-row ${s.kpis}`}>
          <KPI label={t('budgets.kpi.over')} value={overBudget.length} alert={overBudget.length > 0 ? t('ui.state.overBudget') : undefined} sub={overBudget.length > 0 ? t('budgets.kpi.review') : t('budgets.kpi.allOk')} />
          <KPI label={t('budgets.kpi.coverage')} value={ingresoNeto > 0 ? fmtPct(totalBudget/ingresoNeto) : '—'} color={ingresoNeto > 0 && totalBudget > ingresoNeto ? 'red' : 'default'} alert={ingresoNeto > 0 && totalBudget > ingresoNeto ? t('budgets.kpi.exceedsIncome') : undefined} sub={ingresoNeto > 0 ? (totalBudget > ingresoNeto ? undefined : totalBudget/ingresoNeto > 0.8 ? t('budgets.kpi.noMargin') : t('budgets.kpi.healthy')) : t('budgets.kpi.noIncome')} />
          <KPI label={t('budgets.kpi.total')} value={fmtMoney(totalBudget, sym)} />
        </div>
      )}
      {ingresoNeto > totalBudget && (
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',padding:'10px 14px',background:'var(--accent-bg)',borderRadius:8}}>
          <div>
            <div style={{fontSize: 12,color:'var(--accent)',fontFamily: 'var(--sans)', fontWeight: 600,marginBottom:2}}>{t('budgets.unassigned.label')}</div>
            <div className="num" style={{fontSize:16,color:'var(--accent)'}}><Money>{fmtMoney(ingresoNeto-totalBudget,sym)}</Money></div>
          </div>
          <div style={{fontSize:12,color:'var(--tm)',fontFamily: 'var(--sans)',maxWidth:320,lineHeight:1.5}}>{t('budgets.unassigned.hint')}</div>
        </div>
      )}
      {overBudget.length > 0 && <Alert type="danger">{t('budgets.alert.over', { cats: overBudget.map(b => catName(b.category, lang)).join(', ') })}</Alert>}
      {ingresoNeto > 0 && totalBudget > ingresoNeto && <Alert type="danger">{t('budgets.alert.deficit', { total: fmtMoney(totalBudget,sym), inc: fmtMoney(ingresoNeto,sym), def: fmtMoney(totalBudget-ingresoNeto,sym) })}</Alert>}
      {ingresoNeto > 0 && totalBudget > 0 && totalBudget <= ingresoNeto && totalBudget/ingresoNeto > 0.8 && <Alert type="warning">{t('budgets.alert.tight', { pct: fmtPct(totalBudget/ingresoNeto) })}</Alert>}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:24,marginBottom:16,alignItems:'start'}}>
        {/* Por categoría primero: es lo que se viene a mirar. */}
        <section className={s.section} aria-labelledby="bud-list-title" data-tour="bud-summary">
          <h2 id="bud-list-title" className={s.sectionTitle}>{t('budgets.byCat', { month: monthLabel(activeMonth) })}</h2>
          {rows.length === 0 ? (
            <p style={{fontSize:13,color:'var(--th)',padding:'12px 0'}}>{t('budgets.summary.empty')}</p>
          ) : (
            <ul className={s.list} aria-label={t('budgets.list.aria')}>
              {rows.map(r => {
                const name = catName(r.category, lang)
                const stateLabel = t(`budgets.state.${r.state}`)
                const left = r.limit - r.spent
                return (
                  <li key={r.key} className={s.item}>
                    <span className={s.icon}><CategoryIcon category={r.category} /></span>
                    <div className={s.itemTop}>
                      <span className={s.name}>{name}</span>
                      <StateTag tone={CATEGORY_STATE_TONE[r.state]} label={stateLabel} />
                      {r.budget
                        ? <button type="button" className={s.iconBtn} onClick={() => deleteWithUndo('budgets', r.budget, t('common.deleted'), t('common.undo'))} aria-label={t('budgets.deleteAria', { cat: name })} title={t('budgets.deleteAria', { cat: name })}><Trash2 size={16} strokeWidth={1.7} aria-hidden="true" /></button>
                        : <button type="button" className={s.linkBtn} onClick={() => assignCategory(r.category)} aria-label={t('budgets.unbudgeted.assignAria', { cat: name })}>{t('budgets.unbudgeted.assign')}</button>}
                    </div>
                    {r.limit > 0 && (
                      <Meter className={s.meter} value={r.spent} max={r.limit} tone={CATEGORY_STATE_TONE[r.state]}
                        label={name}
                        valueText={t('budgets.meter.text', { pct: fmtPct(r.spent / r.limit, { decimals: 0 }), spent: fmtMoney(r.spent, sym), limit: fmtMoney(r.limit, sym) })} />
                    )}
                    <dl className={s.triad}>
                      <div><dt>{t('budgets.col.budget')}</dt><dd>{r.limit > 0 ? amt(r.limit) : '—'}</dd></div>
                      <div><dt>{t('budgets.col.spent')}</dt><dd>{amt(r.spent)}</dd></div>
                      <div>
                        <dt>{r.limit > 0 && left < 0 ? t('budgets.col.over') : t('budgets.col.left')}</dt>
                        <dd className={r.limit > 0 && left < 0 ? s.neg : undefined}>{r.limit > 0 ? amt(Math.abs(left)) : '—'}</dd>
                      </div>
                    </dl>
                    {r.carry > 0 && <div className={s.carry}>{t('budgets.carry', { v: fmtMoney(r.carry, sym) })}</div>}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <Card data-tour="bud-new">
            <CardHeader title={t('budgets.new')} />
            {err && <Alert type="danger">{err}</Alert>}
            <FormRow>
              <FormGroup label={t('budgets.form.category')}><select id="budget-new-category" value={f.category} onChange={e => setF(p => ({...p,category:e.target.value}))}>{categoriesExpense.map(c => <option key={c} value={c}>{catLabel(c, lang)}</option>)}</select></FormGroup>
              <FormGroup label={t('budgets.form.limit', { currency: settings.currency||'CLP' })}><input type="number" inputMode="decimal" min="0" value={f.limit} placeholder="0" onChange={e => setF(p => ({...p,limit:e.target.value}))} /></FormGroup>
            </FormRow>
            <Btn variant="primary" onClick={submit}>{t('budgets.form.submit')}</Btn>
          </Card>

          <section className={s.section} aria-labelledby="bud-model-title" data-tour="bud-model">
            <h2 id="bud-model-title" className={s.sectionTitle}>{t('budgets.model.title')}</h2>
            {(() => {
              const inc = ingresoNeto
              // Categorías tomadas 1:1 de CATS_EXPENSE (utils/index.js) — la misma lista
              // que usa el formulario de gasto. "Restaurantes" se fusiona en
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
                  if (!budgets.find(b => b.category === sg.cat)) await addBudget({category:sg.cat,limit:Math.round(inc*sg.pct)})
                }
              }
              return (
                <div>
                  <p style={{fontSize:13,color:inc > 0 ? 'var(--tm)' : 'var(--neg)',margin:'4px 0 8px'}}>
                    {inc > 0
                      ? <>{t('budgets.model.netIncome', { month: monthLabel(activeMonth) })} <Amount value={inc} sym={sym} signed={false} /></>
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
                      amount: inc > 0 ? <Money>{fmtMoneyRaw(Math.round(inc*sg.pct), sym)}</Money> : '—',
                      share: fmtPct(sg.pct, { decimals: 0 }),
                    }))} />
                  {inc > 0 && <>
                    <div style={{fontSize:12,color:'var(--th)',fontFamily: 'var(--sans)',margin:'10px 0 8px'}}>{t('budgets.model.onlyNew')}</div>
                    <Btn variant="primary" onClick={aplicar}>{t('budgets.model.apply')}</Btn>
                  </>}
                </div>
              )
            })()}
          </section>
        </div>
      </div>
    </div>
  )
}
