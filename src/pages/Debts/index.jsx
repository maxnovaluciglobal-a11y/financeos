// src/pages/Debts/index.jsx — v1.5
import { useState, useMemo, useEffect } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { KPI, Card, CardHeader, FormGroup, FormRow, Btn, Alert, Badge, ProgressBar, PageHeader } from '../../components/ui/index.jsx'
import { fmtMoney, fmtPct, DEBT_TYPES, debtEmoji, moneyLocale, dateLocale } from '../../utils/index.js'
import { CURRENCY_SYMBOLS } from '../shared/constants.js'
import DebtProgressList from '../../components/charts/DebtProgressList.jsx'
import { loadIndicadores } from '../../utils/indicadores.js'
import ProGate from '../../components/ui/ProGate.jsx'

// Pago real que se cobraría hoy — incluye el interés del período, con la misma
// fórmula que usa el simulador de liquidación más abajo. Antes "Registrar pago"
// solo restaba el pago del saldo sin sumar el interés primero, así que cada
// pago real dejaba el saldo guardado más bajo de lo que en verdad era.
function nextPaymentAmount(d) {
  const rate = (Number(d.rate) || 0) / 100 / 12
  const balanceWithInterest = Number(d.balance) + Number(d.balance) * rate
  return Math.min(Number(d.minPayment) || 0, balanceWithInterest)
}

// ── Calculadora Avalanche / Snowball ─────────────────────────────────────────
function calcPayoffPlan(debts, extraPayment, method) {
  if (!debts.length) return { months: 0, totalInterest: 0, order: [] }
  let pool = debts
    .filter(d => d.balance > 0 && d.minPayment > 0)
    .map(d => ({ ...d, balance: Number(d.balance), minPayment: Number(d.minPayment), rate: Number(d.rate) || 0 }))

  // Ordenar según método
  if (method === 'avalanche') pool.sort((a, b) => b.rate - a.rate)
  else pool.sort((a, b) => a.balance - b.balance) // snowball

  let months = 0
  let totalInterest = 0
  const maxMonths = 600

  while (pool.some(d => d.balance > 0) && months < maxMonths) {
    months++
    // Aplicar interés mensual
    pool = pool.map(d => {
      if (d.balance <= 0) return d
      const interest = d.balance * (d.rate / 100 / 12)
      totalInterest += interest
      return { ...d, balance: d.balance + interest }
    })
    // Pagar mínimos
    pool = pool.map(d => {
      if (d.balance <= 0) return d
      const pay = Math.min(d.minPayment, d.balance)
      return { ...d, balance: Math.max(0, d.balance - pay) }
    })
    // Bola de nieve real: el pago mínimo de las deudas YA saldadas se libera y
    // se suma al pago extra que ataca la siguiente deuda activa (sin esto, el
    // tiempo de pago se sobreestimaba ~2×).
    const freedMinimums = pool.filter(d => d.balance <= 0).reduce((s, d) => s + (Number(d.minPayment) || 0), 0)
    let extra = extraPayment + freedMinimums
    for (let i = 0; i < pool.length && extra > 0; i++) {
      if (pool[i].balance > 0) {
        const pay = Math.min(extra, pool[i].balance)
        pool[i] = { ...pool[i], balance: Math.max(0, pool[i].balance - pay) }
        extra -= pay
      }
    }
  }

  return { months, totalInterest: Math.round(totalInterest) }
}

function DebtPayoffSimulator({ debts, sym }) {
  const { t } = useT()
  const [method, setMethod]   = useState('avalanche')
  const [extra, setExtra]     = useState(0)
  const activeDebts = debts.filter(d => d.balance > 0 && d.minPayment > 0)

  const base     = useMemo(() => calcPayoffPlan(activeDebts, 0, method), [activeDebts, method])
  const withExtra = useMemo(() => calcPayoffPlan(activeDebts, Number(extra)||0, method), [activeDebts, extra, method])

  const monthsSaved    = base.months - withExtra.months
  const interestSaved  = base.totalInterest - withExtra.totalInterest

  const fmtMonths = m => m >= 600 ? t('debts.sim.years50') : m > 12 ? `${Math.floor(m/12)} ${Math.floor(m/12)>1?t('debts.sim.years'):t('debts.sim.year')} ${m%12?`${m%12} ${t('debts.sim.month')}`:''}` : `${m} ${m!==1?t('debts.sim.months'):t('debts.sim.month')}`

  if (!activeDebts.length) return null

  return (
    <Card>
      <CardHeader title={t('debts.sim.title')} />
      <p style={{fontSize:12,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:16,marginTop:-4,lineHeight:1.6}}>
        {t('debts.sim.intro')}
      </p>

      {/* Selector de método */}
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
        {[
          { id:'avalanche', label:t('debts.sim.avalanche'), desc:t('debts.sim.avalancheDesc') },
          { id:'snowball',  label:t('debts.sim.snowball'),  desc:t('debts.sim.snowballDesc') },
        ].map(m => (
          <button key={m.id} onClick={() => setMethod(m.id)} style={{
            flex:1, minWidth:160, padding:'10px 14px', borderRadius:8, cursor:'pointer', textAlign:'left',
            border: method===m.id ? '1.5px solid var(--grn)' : '.5px solid var(--brd)',
            background: method===m.id ? 'rgba(10,92,62,.06)' : 'var(--sur)',
          }}>
            <div style={{fontSize:12,fontWeight:600,color: method===m.id ? 'var(--grn)' : 'var(--tx)',fontFamily:'var(--mono)'}}>{m.label}</div>
            <div style={{fontSize:11.5,color:'var(--th)',fontFamily:'var(--sans)',marginTop:3,lineHeight:1.45}}>{m.desc}</div>
          </button>
        ))}
      </div>

      {/* Input pago extra */}
      <div style={{marginBottom:16}}>
        <label style={{fontSize:11,color:'var(--th)',fontFamily:'var(--mono)',textTransform:'uppercase',letterSpacing:'.5px',display:'block',marginBottom:4}}>
          {t('debts.sim.extraLabel', { sym })}
        </label>
        <input
          type="number" inputMode="decimal" min="0" value={extra}
          onChange={e => setExtra(e.target.value)}
          placeholder={t('debts.sim.extraPh')}
          style={{width:'100%',maxWidth:240,padding:'7px 10px',borderRadius:7,border:'.5px solid var(--brd)',background:'var(--sur)',color:'var(--tx)',fontFamily:'var(--mono)',fontSize:13}}
        />
      </div>

      {/* Resultados */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:12}}>
        <div style={{padding:'12px 14px',borderRadius:8,background:'var(--sur)',border:'.5px solid var(--brd)'}}>
          <div style={{fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:4}}>{t('debts.sim.freeIn')}</div>
          <div style={{fontSize:18,fontWeight:700,color:'var(--tx)',fontFamily:'var(--mono)'}}>{fmtMonths(withExtra.months)}</div>
          {monthsSaved > 0 && <div style={{fontSize:10,color:'var(--grn)',fontFamily:'var(--mono)',marginTop:3}}>{t('debts.sim.earlier', { t: fmtMonths(monthsSaved) })}</div>}
        </div>
        <div style={{padding:'12px 14px',borderRadius:8,background:'var(--sur)',border:'.5px solid var(--brd)'}}>
          <div style={{fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:4}}>{t('debts.sim.totalInterest')}</div>
          <div style={{fontSize:18,fontWeight:700,color:'var(--red,#e53e3e)',fontFamily:'var(--mono)'}}>{fmtMoney(withExtra.totalInterest,sym)}</div>
          {interestSaved > 0 && <div style={{fontSize:10,color:'var(--grn)',fontFamily:'var(--mono)',marginTop:3}}>{t('debts.sim.saved', { v: fmtMoney(interestSaved,sym) })}</div>}
        </div>
        {(Number(extra)||0) > 0 && monthsSaved > 0 && (
          <div style={{padding:'12px 14px',borderRadius:8,background:'rgba(10,92,62,.06)',border:'1px solid rgba(10,92,62,.2)'}}>
            <div style={{fontSize:9,color:'var(--grn)',fontFamily:'var(--mono)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:4}}>{t('debts.sim.withExtra', { v: sym+Number(extra).toLocaleString(moneyLocale()) })}</div>
            <div style={{fontSize:13,fontWeight:700,color:'var(--grn)',fontFamily:'var(--mono)'}}>{t('debts.sim.youSave', { v: fmtMoney(interestSaved,sym) })}</div>
            <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginTop:3}}>{t('debts.sim.inLess', { t: fmtMonths(monthsSaved) })}</div>
          </div>
        )}
      </div>

      {/* Orden de pago */}
      <div style={{marginTop:4}}>
        <div style={{fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',textTransform:'uppercase',letterSpacing:'.8px',marginBottom:8}}>
          {t('debts.sim.order', { m: method === 'avalanche' ? 'Avalanche' : 'Snowball' })}
        </div>
        {[...activeDebts]
          .sort((a,b) => method==='avalanche' ? (Number(b.rate)||0)-(Number(a.rate)||0) : Number(a.balance)-Number(b.balance))
          .map((d,i) => (
            <div key={d.id} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 0',borderTop:i>0?'.5px solid var(--brd)':'none'}}>
              <div style={{width:20,height:20,borderRadius:'50%',background:i===0?'var(--grn)':'var(--brd)',color:i===0?'#fff':'var(--th)',fontSize:10,fontFamily:'var(--mono)',fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{i+1}</div>
              <div style={{flex:1,fontSize:12,fontFamily:'var(--mono)',color:'var(--tx)'}}>{d.creditor}</div>
              <div style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--th)'}}>{fmtMoney(d.balance,sym)}</div>
              {Number(d.rate) > 0 && <Badge color="red">{d.rate}% TAE</Badge>}
            </div>
          ))
        }
      </div>
      <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginTop:12,lineHeight:1.6}}>
        {t('debts.sim.disclaimer')}
      </div>
    </Card>
  )
}

export default function Debts() {
  const { debts, addDebt, delDebt, updateDebt, addExpense, incomes, expenses, settings, deleteWithUndo } = useApp()
  const { t } = useT()
  const [show, setShow]             = useState(false)
  const [f, setF]                   = useState({ creditor:'', debtType:'Tarjeta', initial:'', balance:'', minPayment:'', dueDate:'', rate:'', totalInstallments:'', paidInstallments:'', project:'', ufDebt:false })
  const [err, setErr]               = useState('')
  const [confirmPay, setConfirmPay] = useState(null)
  const [payMsg, setPayMsg]         = useState(null)
  const [linkingId, setLinkingId]   = useState(null)
  const [linkValue, setLinkValue]   = useState('')

  // Vista previa CLP en vivo para montos ingresados en UF
  const ufPreview = (v) => {
    const n = Number(v)
    if (!f.ufDebt || !ufValue || !n) return null
    return <div style={{fontSize:10,color:'var(--grn)',fontFamily:'var(--mono)',marginTop:3}}>≈ ${Math.round(n*ufValue).toLocaleString(moneyLocale())} CLP</div>
  }
  const sym = CURRENCY_SYMBOLS[settings.currency] || '$'
  const isChile = (settings.country || 'CL') === 'CL'

  // ── Deudas en UF (Chile): la fuente de verdad es el monto en UF; el CLP se
  // revalúa automáticamente con la UF del día para que TODOS los cálculos de la
  // app (patrimonio, disponible, asesor) sigan funcionando en pesos sin cambios.
  const [ufValue, setUfValue] = useState(0)
  const [ufIsFallback, setUfIsFallback] = useState(false)
  useEffect(() => {
    if (!isChile) return
    loadIndicadores().then(ind => {
      if (ind?.uf > 0) { setUfValue(ind.uf); setUfIsFallback(ind.source !== 'api') }
    }).catch(() => {})
  }, [isChile])

  // Revaluación silenciosa: si el CLP guardado difiere >0.5% de ufBalance × UF de hoy, actualizar
  useEffect(() => {
    if (!ufValue || !updateDebt) return
    debts.filter(d => Number(d.ufBalance) > 0).forEach(d => {
      const clp = Math.round(d.ufBalance * ufValue)
      if (Math.abs((d.balance || 0) - clp) / clp > 0.005) {
        updateDebt({ ...d,
          balance: clp,
          initial: d.ufInitial > 0 ? Math.round(d.ufInitial * ufValue) : d.initial,
          minPayment: d.ufMinPayment > 0 ? Math.round(d.ufMinPayment * ufValue) : d.minPayment,
        })
      }
    })
  }, [ufValue, debts.length])

  const totalBalance = useMemo(() => debts.reduce((s,d) => s+d.balance, 0), [debts])
  const totalMin     = useMemo(() => debts.reduce((s,d) => s+d.minPayment, 0), [debts])
  const totalPaid    = useMemo(() => debts.reduce((s,d) => s+Math.max(0,(Number(d.initial)||Number(d.balance)||0)-Number(d.balance||0)), 0), [debts])
  const knownProjects = useMemo(() => {
    const set = new Set()
    ;[...(incomes||[]), ...(expenses||[])].forEach(r => { const k=(r?.project||'').trim(); if(k) set.add(k) })
    return [...set].sort()
  }, [incomes, expenses])

  async function handleRegisterPayment(d) {
    const rate = (Number(d.rate) || 0) / 100 / 12
    const balanceWithInterest = Number(d.balance) + Number(d.balance) * rate
    const monto = nextPaymentAmount(d)
    if (monto <= 0) return
    const newBalance = Math.max(0, balanceWithInterest - monto)
    const todayStr = new Date().toISOString().slice(0,10)
    const ufFields = (Number(d.ufBalance) > 0 && ufValue > 0)
      ? { ufBalance: Math.max(0, (Number(d.ufBalance) + Number(d.ufBalance) * rate) - monto / ufValue) }
      : {}
    await updateDebt({...d, ...ufFields, balance:newBalance, paidInstallments:(Number(d.paidInstallments)||0)+1})
    await addExpense({
      date: todayStr,
      description: t('debts.payment.desc', { creditor: d.creditor }),
      amount: monto,
      category: 'Deudas',
      notes: t('debts.payment.note', { n: (Number(d.paidInstallments)||0)+1 }),
    })
    setConfirmPay(null)
    setPayMsg({id:d.id, text:t('debts.card.paidMsg', { amt: sym+Math.round(monto).toLocaleString(moneyLocale()) })})
    setTimeout(() => setPayMsg(null), 3000)
  }

  async function submit() {
    if (!f.creditor.trim() || !f.balance || Number(f.balance) <= 0) { setErr(t('debts.err.required')); return }
    const init = Number(f.initial) || Number(f.balance)
    if (Number(f.balance) > init) { setErr(t('debts.err.balance')); return }
    setErr('')
    if (f.ufDebt && ufValue > 0) {
      // Montos ingresados en UF → guardar UF como fuente de verdad + CLP del día
      await addDebt({...f,
        ufInitial: init, ufBalance: Number(f.balance), ufMinPayment: Number(f.minPayment)||0,
        initial: Math.round(init * ufValue), balance: Math.round(Number(f.balance) * ufValue),
        minPayment: Math.round((Number(f.minPayment)||0) * ufValue),
        rate:Number(f.rate)||0, totalInstallments:Number(f.totalInstallments)||0, paidInstallments:Number(f.paidInstallments)||0})
    } else {
      await addDebt({...f, initial:init, balance:Number(f.balance), minPayment:Number(f.minPayment)||0, rate:Number(f.rate)||0, totalInstallments:Number(f.totalInstallments)||0, paidInstallments:Number(f.paidInstallments)||0})
    }
    setF({creditor:'',debtType:'Tarjeta',initial:'',balance:'',minPayment:'',dueDate:'',rate:'',totalInstallments:'',paidInstallments:'',project:'',ufDebt:false})
    setShow(false)
  }

  return (
    <div className="stack">
      <PageHeader title={t('debts.title')} sub={t('debts.sub')} />
      <p style={{fontSize:12.5,color:'var(--th)',fontFamily:'var(--sans)',lineHeight:1.5,marginBottom:12,marginTop:-4}}>{t('debts.intro')}</p>
      <div className="kpi-row">
        <KPI label={t('debts.kpi.total')}       value={fmtMoney(totalBalance,sym)} color="red" />
        <KPI label={t('debts.kpi.minPay')} value={fmtMoney(totalMin,sym)} />
        <KPI label={t('debts.kpi.active')}    value={debts.length} />
        <KPI label={t('debts.kpi.paid')}      value={fmtMoney(totalPaid,sym)} color="green" />
      </div>
      <div><Btn variant="primary" onClick={() => setShow(s => !s)} aria-expanded={show}>{show ? t('debts.toggle.close') : t('debts.toggle.new')}</Btn></div>
      {show && (
        <Card>
          <CardHeader title={t('debts.new')} />
          {err && <Alert type="danger">⚠ {err}</Alert>}
          {isChile && ufValue > 0 && (
            <label style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:12, color:'var(--tm)', cursor:'pointer', margin:'0 0 10px', lineHeight:1.4 }}>
              <input type="checkbox" checked={!!f.ufDebt} onChange={e => setF(p=>({...p, ufDebt:e.target.checked}))} style={{ width:16, height:16, flexShrink:0, marginTop:1 }} />
              <span style={{ minWidth:0 }}>{t('debts.uf.check')} <span style={{ fontSize:10, color: ufIsFallback ? 'var(--amb,#f5a623)' : 'var(--th)', fontFamily:'var(--mono)' }}>({t('debts.uf.rate', { v: '$'+Math.round(ufValue).toLocaleString(moneyLocale()) })}{ufIsFallback ? ' · ' + t('debts.uf.stale') : ''})</span></span>
            </label>
          )}
          <FormRow>
            <FormGroup label={t('debts.form.creditor')}><input type="text" value={f.creditor} placeholder={t('debts.form.creditorPh')} onChange={e => setF(p=>({...p,creditor:e.target.value}))} /></FormGroup>
            <FormGroup label={t('debts.form.type')}><select value={f.debtType} onChange={e => setF(p=>({...p,debtType:e.target.value}))}>{DEBT_TYPES.map(tp => <option key={tp} value={tp}>{debtEmoji(tp)} {t('debts.type.'+tp)}</option>)}</select></FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label={t('debts.form.balance', { currency: f.ufDebt ? 'UF' : (settings.currency||'CLP') })}><input type="number" inputMode="decimal" min="0" step="0.01" value={f.balance} placeholder={f.ufDebt ? 'ej. 2500.50' : '0'} onChange={e => setF(p=>({...p,balance:e.target.value}))} />{ufPreview(f.balance)}</FormGroup>
            <FormGroup label={f.ufDebt ? t('debts.form.initial') + ' (UF)' : t('debts.form.initial')}><input type="number" inputMode="decimal" min="0" step="0.01" value={f.initial} placeholder={f.ufDebt ? 'ej. 3000' : t('debts.form.initialPh')} onChange={e => setF(p=>({...p,initial:e.target.value}))} />{ufPreview(f.initial)}</FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label={f.ufDebt ? t('debts.form.minPay') + ' (UF)' : t('debts.form.minPay')}><input type="number" inputMode="decimal" min="0" step="0.01" value={f.minPayment} placeholder={f.ufDebt ? 'ej. 7.55' : '0'} onChange={e => setF(p=>({...p,minPayment:e.target.value}))} />{ufPreview(f.minPayment)}</FormGroup>
          </FormRow>
          <div style={{marginTop:8,marginBottom:8}}>
            <button type="button" onClick={() => setF(p=>({...p,_showExtra:!p._showExtra}))} aria-expanded={!!f._showExtra}
              style={{background:'none',border:'none',color:'var(--grn)',fontSize:12,fontFamily:'var(--mono)',cursor:'pointer',padding:0}}>
              {f._showExtra ? t('debts.form.less') : t('debts.form.more')}
            </button>
          </div>
          {f._showExtra && (
            <>
              <FormRow>
                <FormGroup label={t('debts.form.dueDate')}><input type="date" value={f.dueDate} onChange={e => setF(p=>({...p,dueDate:e.target.value}))} /></FormGroup>
                <FormGroup label={t('debts.form.rate')}><input type="number" inputMode="decimal" min="0" max="200" value={f.rate} placeholder="0" onChange={e => setF(p=>({...p,rate:e.target.value}))} /></FormGroup>
              </FormRow>
              <FormRow>
                <FormGroup label={t('debts.form.totalInst')}><input type="number" inputMode="decimal" min="0" value={f.totalInstallments} placeholder={t('debts.form.totalInstPh')} onChange={e => setF(p=>({...p,totalInstallments:e.target.value}))} /></FormGroup>
                <FormGroup label={t('debts.form.paidInst')}><input type="number" inputMode="decimal" min="0" value={f.paidInstallments} placeholder={t('debts.form.paidInstPh')} onChange={e => setF(p=>({...p,paidInstallments:e.target.value}))} /></FormGroup>
              </FormRow>
              <FormRow>
                <FormGroup label={t('debts.projectLabel')}>
                  <input type="text" list="fnos-debt-projects" value={f.project} placeholder={t('debts.projectPlaceholder')} onChange={e => setF(p=>({...p,project:e.target.value}))} />
                  <datalist id="fnos-debt-projects">{knownProjects.map(n => <option key={n} value={n} />)}</datalist>
                </FormGroup>
              </FormRow>
            </>
          )}
          <div style={{display:'flex',gap:8}}>
            <Btn variant="primary" onClick={submit}>{t('debts.form.submit')}</Btn>
            <Btn variant="ghost" onClick={() => setShow(false)}>{t('common.cancel')}</Btn>
          </div>
        </Card>
      )}
      {debts.length === 0 && !show && (
        <Card><div style={{textAlign:'center',padding:'24px 0'}}>
          <div style={{fontSize:13,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:12}}>{t('debts.empty')}</div>
          <button onClick={() => setShow(true)} style={{background:'var(--laton)',color:'var(--navy)',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:600,cursor:'pointer'}}>{t('debts.emptyBtn')}</button>
        </div></Card>
      )}
      {debts.map(d => {
        const paid      = Math.max(0, d.initial - d.balance)
        const prog      = d.initial > 0 ? paid/d.initial : 0
        const totalInst = Number(d.totalInstallments)||0
        const paidInst  = Number(d.paidInstallments)||0
        const pendInst  = totalInst > 0 ? Math.max(0,totalInst-paidInst) : 0
        const instProg  = totalInst > 0 ? paidInst/totalInst : 0
        // Meses restantes considerando el interés (coincide con el simulador).
        // Si el pago mínimo no cubre el interés, la deuda no se amortiza → null.
        const monthsLeft = (() => {
          if (d.minPayment > 0 && d.balance > 0) {
            const r = (Number(d.rate) || 0) / 100 / 12
            if (r <= 0) return Math.ceil(d.balance / d.minPayment)
            if (d.minPayment <= d.balance * r) return null  // no converge
            return Math.ceil(-Math.log(1 - (r * d.balance) / d.minPayment) / Math.log(1 + r))
          }
          return pendInst > 0 ? pendInst : 0
        })()
        // Meses calendario reales, no monthsLeft*30 días — ese redondeo se
        // acumulaba hasta ~9 meses de error en deudas largas (600 meses).
        const finDate   = monthsLeft > 0
          ? (() => { const dt = new Date(); dt.setMonth(dt.getMonth() + monthsLeft); return dt.toLocaleDateString(dateLocale(),{month:'short',year:'numeric'}) })()
          : null
        return (
          <Card key={d.id}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
              <div style={{fontSize:13,fontWeight:600,color:'var(--tx)',display:'flex',alignItems:'center',gap:6,minWidth:0}}>
                {/* Selector de tipo editable in-situ para deudas existentes */}
                <select
                  value={d.debtType || 'Tarjeta'}
                  onChange={e => updateDebt({ ...d, debtType: e.target.value })}
                  aria-label={t('debts.form.type')}
                  title={t('debts.form.type')}
                  style={{ width:'auto', flexShrink:0, padding:'2px 4px', fontSize:13, fontFamily:'var(--sans)', fontWeight:600,
                           color:'var(--tx)', background:'var(--sur2)', border:'.5px solid var(--brd2)', borderRadius:6, cursor:'pointer' }}>
                  {DEBT_TYPES.map(tp => <option key={tp} value={tp}>{debtEmoji(tp)} {t('debts.type.'+tp)}</option>)}
                </select>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.creditor}</span>
              </div>
              <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap',justifyContent:'flex-end'}}>
                {d.rate > 0 && <Badge color="red">{d.rate}% TAE</Badge>}
                {Number(d.ufBalance) > 0 && <Badge color="amber">UF</Badge>}
                {(d.project||'').trim() && <Badge color="green">🏢 {d.project}</Badge>}
                {d.balance > 0 && d.minPayment > 0 && confirmPay !== d.id && (
                  <button onClick={() => setConfirmPay(d.id)}
                    style={{fontSize:11,padding:'2px 8px',borderRadius:4,border:'0.5px solid rgba(10,92,62,.3)',background:'rgba(10,92,62,.08)',color:'var(--grn)',cursor:'pointer',fontFamily:'var(--mono)',fontWeight:600}}>
                    {t('debts.card.payBtn')}
                  </button>
                )}
                {d.balance <= 0 && <span style={{fontSize:10,padding:'2px 8px',borderRadius:4,background:'rgba(10,92,62,.1)',color:'var(--grn)',fontFamily:'var(--mono)'}}>{t('debts.card.settled')}</span>}
                <button onClick={() => deleteWithUndo('debts', d, t('common.deleted'), t('common.undo'))} aria-label={t('debts.card.delete')} style={{background:'none',border:'none',color:'var(--th)',fontSize:13,cursor:'pointer',minWidth:44,minHeight:44,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>✕</button>
              </div>
            </div>
            {confirmPay === d.id && (
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',marginBottom:8,background:'rgba(10,92,62,.06)',borderRadius:6,border:'0.5px solid rgba(10,92,62,.2)',flexWrap:'wrap'}}>
                <span style={{fontSize:12,color:'var(--tx)',fontFamily:'var(--mono)',flex:1}}>
                  {t('debts.card.confirmPay', { amt: sym+Math.round(nextPaymentAmount(d)).toLocaleString(moneyLocale()), creditor: d.creditor })}
                </span>
                <div style={{display:'flex',gap:6}}>
                  <Btn variant="primary" size="xs" onClick={() => handleRegisterPayment(d)}>{t('debts.card.confirm')}</Btn>
                  <Btn variant="ghost"   size="xs" onClick={() => setConfirmPay(null)}>{t('common.cancel')}</Btn>
                </div>
              </div>
            )}
            {payMsg?.id === d.id && (
              <div style={{fontSize:11,color:'var(--grn)',fontFamily:'var(--mono)',marginBottom:6,padding:'4px 8px',background:'rgba(10,92,62,.06)',borderRadius:4}}>{payMsg.text}</div>
            )}
            {!(d.project||'').trim() && knownProjects.length > 0 && (
              linkingId === d.id ? (
                <div style={{marginBottom:8,padding:'8px 10px',background:'var(--sur2)',border:'.5px solid var(--brd2)',borderRadius:6}}>
                  <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:6,lineHeight:1.5}}>{t('debts.linkProjectHint')}</div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <input type="text" list="fnos-debt-projects" value={linkValue} placeholder={t('debts.projectPlaceholder')}
                      onChange={e=>setLinkValue(e.target.value)}
                      style={{flex:1,minWidth:160,padding:'5px 9px',fontSize:12,borderRadius:6,border:'.5px solid var(--brd2)',background:'var(--bg)',color:'var(--tx)'}}/>
                    <Btn variant="primary" size="xs" onClick={async()=>{ if(linkValue.trim()){ await updateDebt({...d, project:linkValue.trim()}); setLinkingId(null); setLinkValue('') } }}>✓</Btn>
                    <Btn variant="ghost" size="xs" onClick={()=>{setLinkingId(null);setLinkValue('')}}>✕</Btn>
                  </div>
                </div>
              ) : (
                <button onClick={()=>{setLinkingId(d.id);setLinkValue('')}}
                  style={{marginBottom:8,background:'none',border:'.5px dashed var(--brd2)',borderRadius:6,padding:'4px 10px',fontSize:10,fontFamily:'var(--mono)',color:'var(--th)',cursor:'pointer'}}>
                  {t('debts.linkProject')}
                </button>
              )
            )}
            <div style={{fontSize:11,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:8}}>
              {Number(d.ufBalance) > 0
                ? <>{t('debts.uf.balance', { uf: d.ufBalance.toLocaleString(moneyLocale(), { maximumFractionDigits: 2 }), clp: fmtMoney(d.balance,sym) })}{d.ufMinPayment > 0 ? t('debts.uf.installment', { uf: d.ufMinPayment.toLocaleString(moneyLocale(), { maximumFractionDigits: 2 }), clp: fmtMoney(d.minPayment,sym) }) : ''}{d.dueDate ? t('debts.card.due', { d: d.dueDate.slice(5).replace('-','/') }) : ''}</>
                : <>{t('debts.card.balance', { v: fmtMoney(d.balance,sym) })}{d.minPayment ? t('debts.card.installment', { v: fmtMoney(d.minPayment,sym) }) : ''}{d.dueDate ? t('debts.card.due', { d: d.dueDate.slice(5).replace('-','/') }) : ''}</>
              }
            </div>
            <div style={{marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:10,fontFamily:'var(--mono)',color:'var(--th)',marginBottom:3}}>
                <span>{t('debts.card.progressAmt')}</span><span>{t('debts.card.paidPct', { pct: fmtPct(prog) })}</span>
              </div>
              <ProgressBar value={paid} max={d.initial} color="green" height={5}/>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:3,fontSize:10,fontFamily:'var(--mono)',color:'var(--th)'}}>
                <span>{t('debts.card.paidLb', { v: fmtMoney(paid,sym) })}{Number(d.ufInitial) > 0 && Number(d.ufBalance) >= 0 ? ' · ' + t('debts.uf.paid', { uf: (d.ufInitial - d.ufBalance).toLocaleString(moneyLocale(), { maximumFractionDigits: 2 }) }) : ''}</span><span>{t('debts.card.initialLb', { v: fmtMoney(d.initial,sym) })}</span>
              </div>
            </div>
            {totalInst > 0 && (
              <div style={{marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:10,fontFamily:'var(--mono)',color:'var(--th)',marginBottom:3}}>
                  <span>{t('debts.card.installments')}</span><span>{paidInst}/{totalInst}</span>
                </div>
                <div style={{height:5,background:'var(--brd)',borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${Math.min(instProg*100,100)}%`,background:'var(--accent)',borderRadius:3,transition:'.3s'}}/>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',marginTop:3,fontSize:10,fontFamily:'var(--mono)'}}>
                  <span style={{color:'var(--accent)'}}>{t('debts.card.instPaid', { n: paidInst })}</span>
                  <span style={{color:'var(--amb,#f5a623)'}}>{t('debts.card.instPending', { n: pendInst })}</span>
                </div>
              </div>
            )}
            {monthsLeft > 0 && (
              <div style={{marginTop:6,padding:'8px 10px',borderRadius:6,background:'var(--accent-bg)',border:'.5px solid var(--accent)',display:'flex',gap:16,flexWrap:'wrap'}}>
                <div><div style={{fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:2}}>{t('debts.card.monthsLeft')}</div><div style={{fontSize:14,fontWeight:700,color:'var(--tx)',fontFamily:'var(--mono)'}}>{monthsLeft}</div></div>
                {finDate && <div><div style={{fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:2}}>{t('debts.card.estEnd')}</div><div style={{fontSize:14,fontWeight:700,color:'var(--accent)',fontFamily:'var(--mono)'}}>📅 {finDate}</div></div>}
                {d.minPayment > 0 && <div><div style={{fontSize:9,color:'var(--th)',fontFamily:'var(--mono)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:2}}>{t('debts.card.totalLeft')}</div><div style={{fontSize:14,fontWeight:700,color:'var(--red)',fontFamily:'var(--mono)'}}>{fmtMoney(d.balance,sym)}</div></div>}
              </div>
            )}
          </Card>
        )
      })}
      {debts.length > 0 && <ProGate feature="Simulador de liquidación de deudas"><DebtPayoffSimulator debts={debts} sym={sym} /></ProGate>}
      {debts.length > 0 && <DebtProgressList debts={debts} sym={sym} />}
    </div>
  )
}
