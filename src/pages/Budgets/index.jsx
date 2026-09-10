// src/pages/Budgets/index.jsx — v1.5
import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { KPI, Card, CardHeader, FormGroup, FormRow, Btn, Alert, PageHeader } from '../../components/ui/index.jsx'
import { fmtMoney, fmtPct, getCategoriesExpense, catLabel } from '../../utils/index.js'
import { CURRENCY_SYMBOLS, monthLabel } from '../shared/constants.js'
import MonthSelector from '../shared/MonthSelector.jsx'

export default function Budgets() {
  const { budgets, addBudget, delBudget, expenses, incomes, settings, updateSettings, deleteWithUndo } = useApp()
  const { t, lang } = useT()
  const [f, setF]     = useState({ category: 'Vivienda', limit: '' })
  const [err, setErr] = useState('')
  const sym           = CURRENCY_SYMBOLS[settings.currency] || '$'
  const isChile       = (settings.country || 'CL') === 'CL'
  const ahorroLabel   = isChile ? 'Ahorro/APV/Inversión' : 'Ahorro/Inversión'
  const rolloverOn    = !!settings.budgetRollover

  const activeMonth   = settings.activeMonth || new Date().toISOString().slice(0, 7)
  const categoriesExpense = useMemo(() => getCategoriesExpense(settings), [settings])

  // Mes anterior para calcular rollover
  const prevMonth = useMemo(() => {
    const [y, m] = activeMonth.split('-').map(Number)
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
  }, [activeMonth])

  // El presupuesto personal excluye los movimientos marcados como inversión (r.inv)
  const mExpenses     = useMemo(() => expenses.filter(r => r.date?.startsWith(activeMonth) && !r.inv), [expenses, activeMonth])
  const prevExpenses  = useMemo(() => expenses.filter(r => r.date?.startsWith(prevMonth) && !r.inv),   [expenses, prevMonth])
  const mIncomes      = useMemo(() => incomes.filter(r => r.date?.startsWith(activeMonth) && !r.inv), [incomes, activeMonth])
  const ingresoNeto   = useMemo(() => mIncomes.reduce((s, r) => s + r.amount, 0), [mIncomes])
  const expByCat      = useMemo(() => { const m = {}; mExpenses.forEach(e => { m[e.category] = (m[e.category] || 0) + e.amount }); return m }, [mExpenses])
  const prevExpByCat  = useMemo(() => { const m = {}; prevExpenses.forEach(e => { m[e.category] = (m[e.category] || 0) + e.amount }); return m }, [prevExpenses])

  // Rollover por categoría: lo no gastado el mes anterior (máx = limit, no puede ser negativo)
  const rolloverByCat = useMemo(() => {
    if (!rolloverOn) return {}
    const r = {}
    budgets.forEach(b => {
      const prevSpent = prevExpByCat[b.category] || 0
      r[b.category] = Math.max(0, Math.min(b.limit - prevSpent, b.limit))
    })
    return r
  }, [rolloverOn, budgets, prevExpByCat])

  // Límite efectivo = base + rollover
  const effectiveLimitByCat = useMemo(() => {
    const m = {}
    budgets.forEach(b => { m[b.category] = b.limit + (rolloverByCat[b.category] || 0) })
    return m
  }, [budgets, rolloverByCat])

  const totalBudget   = useMemo(() => budgets.reduce((s, b) => s + (effectiveLimitByCat[b.category] || b.limit), 0), [budgets, effectiveLimitByCat])
  const budgetedCats  = useMemo(() => new Set(budgets.map(b => b.category)), [budgets])
  const totalBudgeted = useMemo(() => mExpenses.filter(e => budgetedCats.has(e.category)).reduce((s, r) => s + r.amount, 0), [mExpenses, budgetedCats])
  const overBudget    = useMemo(() => budgets.filter(b => (expByCat[b.category] || 0) > (effectiveLimitByCat[b.category] || b.limit)), [budgets, expByCat, effectiveLimitByCat])

  async function submit() {
    if (!f.limit || Number(f.limit) <= 0)             { setErr(t('budgets.err.limit')); return }
    if (budgets.find(b => b.category === f.category)) { setErr(t('budgets.err.exists')); return }
    setErr('')
    await addBudget({ ...f, limit: Number(f.limit) })
    setF({ category: 'Vivienda', limit: '' })
  }

  function toggleRollover() {
    updateSettings({ ...settings, budgetRollover: !rolloverOn })
  }

  return (
    <div className="stack">
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <PageHeader title={t('budgets.title')} sub={t('budgets.sub', { month: monthLabel(activeMonth) })} />
        <MonthSelector incomes={[]} expenses={expenses} />
        <button
          onClick={toggleRollover}
          title={t('budgets.rollover.title')}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
            background: rolloverOn ? 'var(--accent-bg)' : 'var(--sur2)',
            border: `.5px solid ${rolloverOn ? 'var(--accent)' : 'var(--brd2)'}`,
            borderRadius: 20, padding: '5px 12px', cursor: 'pointer',
            fontSize: 11, fontFamily: 'var(--mono)',
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
              width: 10, height: 10, borderRadius: '50%', background: '#fff', transition: '.2s',
            }} />
          </span>
          {rolloverOn ? t('budgets.rollover.on') : t('budgets.rollover.off')}
        </button>
      </div>
      {rolloverOn && (
        <div style={{ padding: '8px 12px', background: 'var(--accent-bg)', border: '.5px solid var(--accent)', borderRadius: 8, fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--mono)', lineHeight: 1.6 }}>
          {t('budgets.rollover.banner', { prev: monthLabel(prevMonth), cur: monthLabel(activeMonth) })}
        </div>
      )}
      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <KPI label={t('budgets.kpi.total')}     value={fmtMoney(totalBudget, sym)} />
        <KPI label={t('budgets.kpi.spent')} value={fmtMoney(totalBudgeted, sym)} color="red" sub={totalBudget > 0 ? fmtPct(totalBudgeted/totalBudget) : '-'} />
        <KPI label={t('budgets.kpi.over')}  value={overBudget.length} color={overBudget.length > 0 ? 'red' : 'green'} sub={overBudget.length > 0 ? t('budgets.kpi.review') : t('budgets.kpi.allOk')} />
        <KPI label={t('budgets.kpi.coverage')} value={ingresoNeto > 0 ? fmtPct(totalBudget/ingresoNeto) : '—'} color={ingresoNeto > 0 && totalBudget > ingresoNeto ? 'red' : ingresoNeto > 0 && totalBudget/ingresoNeto > 0.8 ? 'amber' : 'green'} sub={ingresoNeto > 0 ? (totalBudget > ingresoNeto ? t('budgets.kpi.exceedsIncome') : totalBudget/ingresoNeto > 0.8 ? t('budgets.kpi.noMargin') : t('budgets.kpi.healthy')) : t('budgets.kpi.noIncome')} />
      </div>
      {ingresoNeto > totalBudget && (
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',padding:'10px 14px',background:'var(--accent-bg)',border:'.5px solid var(--accent)',borderRadius:8}}>
          <div>
            <div style={{fontSize:10,color:'var(--accent)',fontFamily:'var(--mono)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:2}}>{t('budgets.unassigned.label')}</div>
            <div style={{fontSize:16,fontWeight:700,color:'var(--accent)',fontFamily:'var(--mono)'}}>{fmtMoney(ingresoNeto-totalBudget,sym)}</div>
          </div>
          <div style={{fontSize:11,color:'var(--th)',fontFamily:'var(--mono)',maxWidth:320,lineHeight:1.5}}>{t('budgets.unassigned.hint')}</div>
        </div>
      )}
      {overBudget.length > 0 && <Alert type="danger">{t('budgets.alert.over', { cats: overBudget.map(b => catLabel(b.category, lang)).join(', ') })}</Alert>}
      {ingresoNeto > 0 && totalBudget > ingresoNeto && <Alert type="danger">{t('budgets.alert.deficit', { total: fmtMoney(totalBudget,sym), inc: fmtMoney(ingresoNeto,sym), def: fmtMoney(totalBudget-ingresoNeto,sym) })}</Alert>}
      {ingresoNeto > 0 && totalBudget > 0 && totalBudget <= ingresoNeto && totalBudget/ingresoNeto > 0.8 && <Alert type="warning">{t('budgets.alert.tight', { pct: fmtPct(totalBudget/ingresoNeto) })}</Alert>}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:16,marginBottom:16,alignItems:'start'}}>
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <Card>
            <CardHeader title={t('budgets.new')} />
            {err && <Alert type="danger">⚠ {err}</Alert>}
            <FormRow>
              <FormGroup label={t('budgets.form.category')}><select value={f.category} onChange={e => setF(p => ({...p,category:e.target.value}))}>{categoriesExpense.map(c => <option key={c} value={c}>{catLabel(c, lang)}</option>)}</select></FormGroup>
              <FormGroup label={t('budgets.form.limit', { currency: settings.currency||'CLP' })}><input type="number" inputMode="decimal" min="0" value={f.limit} placeholder="0" onChange={e => setF(p => ({...p,limit:e.target.value}))} /></FormGroup>
            </FormRow>
            <Btn variant="primary" onClick={submit}>{t('budgets.form.submit')}</Btn>
          </Card>

          <Card>
            <CardHeader title={t('budgets.model.title')} />
            {ingresoNeto > 0 ? (
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,padding:'8px 12px',background:'var(--sur2)',borderRadius:6}}>
                <span style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)'}}>{t('budgets.model.netIncome', { month: monthLabel(activeMonth) })}</span>
                <span style={{fontSize:13,fontWeight:700,color:'var(--grn)',fontFamily:'var(--mono)'}}>{fmtMoney(ingresoNeto,sym)}</span>
              </div>
            ) : (
              <div style={{fontSize:10,color:'#e84142',fontFamily:'var(--mono)',marginBottom:10,padding:'6px 10px',background:'rgba(232,65,66,.06)',borderRadius:6}}>
                {t('budgets.model.noIncome', { month: monthLabel(activeMonth) })}
              </div>
            )}
            {(() => {
              const inc = ingresoNeto
              // Categorías tomadas 1:1 de CATS_EXPENSE (utils/index.js) — la misma lista
              // que usa el formulario de gasto. Antes usaban nombres propios
              // ("Entretenimiento", "Ropa y calzado", "Restaurantes") que ningún gasto
              // real podía tener nunca, así que el presupuesto quedaba en 0% gastado
              // para siempre. "Restaurantes" se fusiona en Alimentación (12%→17%)
              // porque comer afuera ya es una subcategoría de Alimentación en el
              // formulario de gasto, no una categoría propia.
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
                for (const s of sugs) {
                  if (!budgets.find(b => b.category === s.cat)) await addBudget({category:s.cat,limit:Math.round(inc*s.pct)})
                }
              }
              return (
                <div>
                  <div style={{display:'flex',flexDirection:'column',gap:3,marginBottom:12}}>
                    {sugs.map((s,i) => (
                      <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 10px',borderRadius:6,background:s.highlight?'rgba(10,92,62,.08)':i%2===0?'var(--sur2)':'transparent',border:s.highlight?'0.5px solid rgba(10,92,62,.25)':'none'}}>
                        <div>
                          {/* La fila de ahorro usa etiqueta traducida (no está en el mapa) → emoji fijo */}
                          <span style={{fontSize:11,fontFamily:'var(--mono)',color:s.highlight?'var(--grn)':'var(--tx)',fontWeight:s.highlight?700:400}}>{s.highlight ? `💰 ${s.cat}` : catLabel(s.cat, lang)}</span>
                          <span style={{fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',marginLeft:6}}>{s.grupo}</span>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <span style={{fontSize:11,fontFamily:'var(--mono)',color:s.highlight?'var(--grn)':'var(--tx)',fontWeight:600}}>{inc>0?fmtMoney(Math.round(inc*s.pct),sym):'—'}</span>
                          <span style={{fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',marginLeft:4}}>{(s.pct*100).toFixed(0)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {inc > 0 && <>
                    <div style={{fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:8}}>{t('budgets.model.onlyNew')}</div>
                    <Btn variant="primary" onClick={aplicar}>{t('budgets.model.apply')}</Btn>
                  </>}
                </div>
              )
            })()}
          </Card>
        </div>

        <Card>
          <CardHeader title={t('budgets.summary', { month: monthLabel(activeMonth) })} />
          {budgets.length === 0 ? (
            <div style={{textAlign:'center',padding:'24px 0'}}>
              <div style={{fontSize:13,color:'var(--th)',fontFamily:'var(--mono)'}}>{t('budgets.summary.empty')}</div>
            </div>
          ) : (() => {
            const total   = budgets.reduce((s,b) => s+(effectiveLimitByCat[b.category]||b.limit), 0)
            const gastado = budgets.reduce((s,b) => s+(expByCat[b.category]||0), 0)
            const disponible = Math.max(0, total-gastado)
            const pct = total > 0 ? gastado/total : 0
            const r = 60, cx = 80, cy = 80
            const circ = 2*Math.PI*r
            const dash = Math.min(pct,1)*circ
            const strokeColor = pct >= 1 ? '#e84142' : pct >= 0.8 ? 'var(--amber,#f5a623)' : 'var(--grn)'
            return (
              <div>
                <div style={{display:'flex',alignItems:'center',gap:20,flexWrap:'wrap'}}>
                  <div style={{flexShrink:0}}>
                    <svg width="160" height="160" viewBox="0 0 160 160">
                      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--brd)" strokeWidth="16"/>
                      <circle cx={cx} cy={cy} r={r} fill="none" stroke={strokeColor} strokeWidth="16" strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ/4} strokeLinecap="round"/>
                      <text x={cx} y={cy-10} textAnchor="middle" fontSize="18" fill={strokeColor} fontWeight="700" fontFamily="var(--mono)">{(pct*100).toFixed(0)}%</text>
                      <text x={cx} y={cy+8}  textAnchor="middle" fontSize="9"  fill="var(--th)" fontFamily="var(--mono)">{t('budgets.donut.used')}</text>
                      <text x={cx} y={cy+22} textAnchor="middle" fontSize="8"  fill="var(--th)" fontFamily="var(--mono)">{t('budgets.donut.ofTotal')}</text>
                    </svg>
                  </div>
                  <div style={{flex:1,display:'flex',flexDirection:'column',gap:8}}>
                    {[{lb:t('budgets.lb.total'),v:fmtMoney(total,sym),c:'var(--tx)'},{lb:t('budgets.lb.spent'),v:fmtMoney(gastado,sym),c:strokeColor},{lb:t('budgets.lb.available'),v:fmtMoney(disponible,sym),c:'var(--grn)'}].map(item => (
                      <div key={item.lb} style={{background:'var(--sur2)',borderRadius:6,padding:'8px 12px'}}>
                        <div style={{fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:2}}>{item.lb}</div>
                        <div style={{fontSize:14,fontWeight:700,color:item.c,fontFamily:'var(--mono)'}}>{item.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{marginTop:16,paddingTop:16,borderTop:'0.5px solid var(--brd)'}}>
                  <div style={{fontFamily:'var(--mono)',fontSize:10,letterSpacing:'1px',textTransform:'uppercase',color:'var(--grn)',marginBottom:10}}>{t('budgets.byCat', { month: monthLabel(activeMonth) })}</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:10}}>
                    {budgets.map(b => {
                      const spent    = expByCat[b.category] || 0
                      const effLimit = effectiveLimitByCat[b.category] || b.limit
                      const carry    = rolloverByCat[b.category] || 0
                      const p        = effLimit > 0 ? spent / effLimit : 0
                      const over     = spent > effLimit
                      const warn     = !over && p >= 0.8
                      const clr      = over ? '#e84142' : warn ? 'var(--amber,#f5a623)' : 'var(--grn)'
                      const r2=32,cx2=45,cy2=45,circ2=2*Math.PI*r2,dash2=Math.min(p,1)*circ2
                      return (
                        <div key={b.id} style={{background:'var(--bg)',borderRadius:8,padding:'10px',border:`0.5px solid ${over?'#e84142':warn?'rgba(245,166,35,.3)':'var(--brd)'}`,display:'flex',flexDirection:'column',alignItems:'center',gap:6,position:'relative'}}>
                          <button onClick={() => deleteWithUndo('budgets', b, t('common.deleted'), t('common.undo'))} aria-label={t('common.confirmDelete')} style={{position:'absolute',top:4,right:4,background:'none',border:'none',color:'var(--th)',fontSize:10,cursor:'pointer',padding:'1px 4px'}}>✕</button>
                          <div style={{fontSize:10,fontWeight:600,color:'var(--tx)',fontFamily:'var(--mono)',textAlign:'center',lineHeight:1.2,paddingRight:10}}>{catLabel(b.category, lang)}</div>
                          {carry > 0 && (
                            <div style={{fontSize:8,fontFamily:'var(--mono)',color:'var(--accent)',background:'var(--accent-bg)',borderRadius:4,padding:'1px 5px'}}>
                              ↻ +{fmtMoney(carry,sym)}
                            </div>
                          )}
                          <svg width="90" height="90" viewBox="0 0 90 90">
                            <circle cx={cx2} cy={cy2} r={r2} fill="none" stroke="var(--brd)" strokeWidth="9"/>
                            <circle cx={cx2} cy={cy2} r={r2} fill="none" stroke={clr} strokeWidth="9" strokeDasharray={`${dash2} ${circ2}`} strokeDashoffset={circ2/4} strokeLinecap="round"/>
                            <text x={cx2} y={cy2-4} textAnchor="middle" fontSize="10" fill={clr} fontWeight="700" fontFamily="var(--mono)">{(p*100).toFixed(0)}%</text>
                            <text x={cx2} y={cy2+8} textAnchor="middle" fontSize="6"  fill="var(--th)" fontFamily="var(--mono)">{over?t('budgets.cat.over'):warn?t('budgets.cat.warn'):t('budgets.cat.ok')}</text>
                          </svg>
                          <div style={{textAlign:'center'}}>
                            <div style={{fontSize:11,fontWeight:700,color:clr,fontFamily:'var(--mono)'}}>{fmtMoney(spent,sym)}</div>
                            <div style={{fontSize:8,color:'var(--th)',fontFamily:'var(--mono)'}}>{t('budgets.cat.of', { limit: fmtMoney(effLimit,sym) })}{carry > 0 ? t('budgets.cat.base', { base: fmtMoney(b.limit,sym) }) : ''}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })()}
        </Card>
      </div>
    </div>
  )
}
