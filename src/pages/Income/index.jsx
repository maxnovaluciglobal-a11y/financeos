// src/pages/Income/index.jsx — v1.5
import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useT } from '../../i18n/useT.js'
import { KPI, Card, CardHeader, TxRow, FormGroup, FormRow, Btn, Alert, PageHeader } from '../../components/ui/index.jsx'
import { fmtMoney, CAT_COLORS, getCategoriesIncome, RECURRENCES, today, catLabel, recurrenceLabel } from '../../utils/index.js'
import { CURRENCY_SYMBOLS, monthLabel } from '../shared/constants.js'
import MonthSelector from '../shared/MonthSelector.jsx'
import { parseTransactionText } from '../../utils/smsParser.js'

export default function Income({ setPage }) {
  const { incomes, expenses, addIncome, delIncome, updateIncome, settings, deleteWithUndo } = useApp()
  const { t, lang } = useT()
  // Nombres de propiedades/proyectos ya usados (para autocompletar)
  const projectOptions = useMemo(() => [...new Set([...(incomes||[]), ...(expenses||[])].map(r => r?.project).filter(Boolean))], [incomes, expenses])
  const [f, setF]       = useState({ source: '', amount: '', date: today(), category: 'Salario', recurrence: 'Único', notes: '' })
  const [err, setErr]   = useState('')
  const [saving, setSaving]   = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm]   = useState({})
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteMsg, setPasteMsg]   = useState(null)
  const categoriesIncome = useMemo(() => getCategoriesIncome(settings), [settings])

  function detectFromPaste() {
    const r = parseTransactionText(pasteText)
    if (!r || (r.amount == null && !r.merchant)) {
      setPasteMsg({ ok:false, text:t('income.paste.fail') })
      return
    }
    if (r.amount != null) setF(p => ({ ...p, amount: String(r.amount) }))
    if (r.merchant) setF(p => ({ ...p, source: r.merchant }))
    if (r.date) setF(p => ({ ...p, date: r.date }))
    if (r.type === 'expense') {
      setPasteMsg({ ok:false, text:t('income.paste.looksExpense') })
    } else {
      setPasteMsg({ ok:true, text: r.confidence === 'high' ? t('income.paste.detected') : t('income.paste.partial') })
    }
    setShowPaste(false)
  }

  const activeMonth = settings.activeMonth || new Date().toISOString().slice(0, 7)
  const filtered    = useMemo(() => incomes.filter(r => r.date?.startsWith(activeMonth)), [incomes, activeMonth])
  const sym         = CURRENCY_SYMBOLS[settings.currency] || '$'
  const total       = useMemo(() => filtered.reduce((s, r) => s + r.amount, 0), [filtered])
  const fixed       = useMemo(() => filtered.filter(r => r.recurrence !== 'Único').reduce((s, r) => s + r.amount, 0), [filtered])
  const investment  = useMemo(() => filtered.filter(r => r.inv).reduce((s, r) => s + r.amount, 0), [filtered])

  async function saveEdit(r) {
    if (!editForm.source?.trim() || !editForm.amount || Number(editForm.amount) <= 0) return
    await updateIncome({ ...r, source:editForm.source.trim(), amount:Number(editForm.amount), date:editForm.date||r.date, category:editForm.category||r.category, recurrence:editForm.recurrence||r.recurrence, notes:editForm.notes||'' })
    setEditingId(null); setEditForm({})
  }

  async function submit() {
    if (!f.source.trim())               { setErr(t('income.err.name')); return }
    if (!f.amount || Number(f.amount) <= 0) { setErr(t('income.err.amount')); return }
    setErr(''); setSaving(true)
    try { await addIncome({ ...f, amount: Number(f.amount) }) }
    catch {}
    finally {
      setSaving(false)
      setF({ source: '', amount: '', date: today(), category: 'Salario', recurrence: 'Único', notes: '' })
    }
  }

  return (
    <div className="stack">
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <PageHeader title={t('income.title')} sub={t('income.sub', { month: monthLabel(activeMonth), n: filtered.length })} />
        <MonthSelector incomes={incomes} expenses={[]} />
      </div>
      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <KPI label={t('income.kpi.totalMonth')} value={fmtMoney(total, sym)} color="green" sub={investment > 0 ? t('income.kpi.invOfWhich', { v: fmtMoney(investment, sym) }) : undefined} />
        <KPI label={t('income.kpi.fixed')}      value={fmtMoney(fixed, sym)} sub={total > 0 ? t('income.kpi.pctOfTotal', { pct: (fixed/total*100).toFixed(1) }) : '-'} />
        <KPI label={t('income.kpi.variable')}  value={fmtMoney(total - fixed, sym)} sub={total > 0 ? t('income.kpi.pctOfTotal', { pct: ((total-fixed)/total*100).toFixed(1) }) : '-'} />
      </div>
      <div className="grid2">
        <Card>
          <CardHeader title={t('income.new')} />
          {err && <Alert type="danger">⚠ {err}</Alert>}

          {setPage && (
            <button type="button" onClick={() => setPage('import')}
              style={{ background:'none', border:'none', padding:0, marginBottom:10, fontSize:11, fontFamily:'var(--mono)', color:'var(--accent, #00b8d9)', cursor:'pointer', textAlign:'left', display:'block' }}>
              {t('common.importShortcut')}
            </button>
          )}
          <div style={{ marginBottom:12 }}>
            {!showPaste ? (
              <button type="button" onClick={() => { setShowPaste(true); setPasteMsg(null) }}
                style={{ background:'var(--sur2,#f4f4f0)', border:'.5px dashed var(--brd2)', borderRadius:6,
                  padding:'7px 12px', fontSize:12, color:'var(--tm)', cursor:'pointer', width:'100%', textAlign:'left' }}>
                {t('income.paste.btn')}
              </button>
            ) : (
              <div style={{ background:'var(--sur2,#f4f4f0)', border:'.5px solid var(--brd2)', borderRadius:8, padding:10 }}>
                <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={3}
                  placeholder={t('income.paste.placeholder')}
                  style={{ width:'100%', boxSizing:'border-box', padding:'7px 9px', fontSize:12, borderRadius:6, border:'.5px solid var(--brd2)' }} />
                <div style={{ display:'flex', gap:8, marginTop:8 }}>
                  <Btn variant="primary" size="sm" onClick={detectFromPaste} disabled={!pasteText.trim()}>{t('income.paste.detect')}</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => { setShowPaste(false); setPasteText('') }}>{t('common.cancel')}</Btn>
                </div>
                <div style={{ fontSize:9, color:'var(--th)', fontFamily:'var(--mono)', marginTop:6, lineHeight:1.5 }}>
                  {t('income.paste.local')}
                </div>
              </div>
            )}
            {pasteMsg && (
              <div style={{ marginTop:8, fontSize:11, color: pasteMsg.ok ? 'var(--grn)' : 'var(--red)', fontFamily:'var(--mono)' }}>
                {pasteMsg.text}
              </div>
            )}
          </div>

          <FormGroup label={t('income.form.source')}>
            <input type="text" value={f.source} placeholder={t('income.form.sourcePh')} onChange={e => setF(p => ({ ...p, source: e.target.value }))} />
          </FormGroup>
          <FormRow>
            <FormGroup label={t('income.form.amount', { currency: settings.currency || 'CLP' })}><input type="number" inputMode="decimal" min="0" value={f.amount} placeholder="0" onChange={e => setF(p => ({ ...p, amount: e.target.value }))} /></FormGroup>
            <FormGroup label={t('income.form.date')}><input type="date" value={f.date} onChange={e => setF(p => ({ ...p, date: e.target.value }))} /></FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label={t('income.form.category')}><select value={f.category} onChange={e => setF(p => ({ ...p, category: e.target.value }))}>{categoriesIncome.map(c => <option key={c} value={c}>{catLabel(c, lang)}</option>)}</select></FormGroup>
            <FormGroup label={t('income.form.recurrence')}><select value={f.recurrence} onChange={e => setF(p => ({ ...p, recurrence: e.target.value }))}>{RECURRENCES.map(r => <option key={r} value={r}>{recurrenceLabel(r, lang)}</option>)}</select></FormGroup>
          </FormRow>
          <FormGroup label={t('income.form.notes')}><input type="text" value={f.notes} placeholder={t('income.form.notesPh')} onChange={e => setF(p => ({ ...p, notes: e.target.value }))} /></FormGroup>
          <label style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:12, color:'var(--tm)', cursor:'pointer', margin:'4px 0 10px', lineHeight:1.4 }}>
            <input type="checkbox" checked={!!f.inv} onChange={e => setF(p => ({ ...p, inv: e.target.checked }))} style={{ width:16, height:16, flexShrink:0, marginTop:1 }} />
            <span style={{ minWidth:0 }}>{t('income.form.invCheck')}</span>
          </label>
          <FormGroup label={t('income.form.project')}>
            <input type="text" list="fnos-projects" value={f.project || ''} placeholder={t('income.form.projectPh')} onChange={e => setF(p => ({ ...p, project: e.target.value }))} />
            <datalist id="fnos-projects">{projectOptions.map(p => <option key={p} value={p} />)}</datalist>
          </FormGroup>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="primary" onClick={submit} disabled={saving}>{saving ? t('income.form.saving') : t('income.form.submit')}</Btn>
            <Btn variant="ghost" onClick={() => { setF({ source: '', amount: '', date: today(), category: 'Salario', recurrence: 'Único', notes: '' }); setErr('') }}>{t('income.form.clear')}</Btn>
          </div>
        </Card>
        <Card>
          <CardHeader title={t('income.history', { n: filtered.length })} />
          {filtered.length === 0
            ? <div style={{textAlign:'center',padding:'24px 0'}}>
                <div style={{fontSize:13,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:12}}>{t('income.emptyText')}</div>
                <button onClick={() => setF(p => ({...p, recurrence:'Mensual'}))} style={{background:'var(--laton)',color:'var(--navy)',border:'none',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:600,cursor:'pointer'}}>{t('income.emptyBtn')}</button>
              </div>
            : <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {filtered.map(r => editingId === r.id ? (
                  <div key={r.id} style={{padding:'10px 12px',borderRadius:8,border:'0.5px solid rgba(10,92,62,.3)',background:'rgba(10,92,62,.04)',marginBottom:6}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                      <div style={{gridColumn:'1/-1'}}>
                        <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:3}}>{t('income.edit.source')}</div>
                        <input type="text" value={editForm.source||''} onChange={e=>setEditForm(f=>({...f,source:e.target.value}))}
                          style={{width:'100%',padding:'5px 8px',fontSize:12,borderRadius:5,border:'0.5px solid var(--brd)',background:'var(--bg)',color:'var(--tx)',boxSizing:'border-box'}}/>
                      </div>
                      <div>
                        <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:3}}>{t('income.edit.amount')}</div>
                        <input type="number" inputMode="decimal" min="0" value={editForm.amount||''} onChange={e=>setEditForm(f=>({...f,amount:e.target.value}))}
                          style={{width:'100%',padding:'5px 8px',fontSize:12,borderRadius:5,border:'0.5px solid var(--brd)',background:'var(--bg)',color:'var(--tx)',boxSizing:'border-box'}}/>
                      </div>
                      <div>
                        <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:3}}>{t('income.edit.date')}</div>
                        <input type="date" value={editForm.date||''} onChange={e=>setEditForm(f=>({...f,date:e.target.value}))}
                          style={{width:'100%',padding:'5px 8px',fontSize:12,borderRadius:5,border:'0.5px solid var(--brd)',background:'var(--bg)',color:'var(--tx)',boxSizing:'border-box'}}/>
                      </div>
                      <div>
                        <div style={{fontSize:10,color:'var(--th)',fontFamily:'var(--mono)',marginBottom:3}}>{t('income.edit.category')}</div>
                        <select value={editForm.category||''} onChange={e=>setEditForm(f=>({...f,category:e.target.value}))}
                          style={{width:'100%',padding:'5px 8px',fontSize:12,borderRadius:5,border:'0.5px solid var(--brd)',background:'var(--bg)',color:'var(--tx)',boxSizing:'border-box'}}>
                          {categoriesIncome.map(c=><option key={c} value={c}>{catLabel(c, lang)}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      <Btn variant="primary" size="xs" onClick={()=>saveEdit(r)}>{t('income.edit.save')}</Btn>
                      <Btn variant="ghost"   size="xs" onClick={()=>{setEditingId(null);setEditForm({})}}>{t('income.edit.cancel')}</Btn>
                    </div>
                  </div>
                ) : (
                  <div key={r.id}>
                    <TxRow dot={CAT_COLORS[r.category]||'#888'} name={`${r.inv?'💼 ':''}${r.source}`}
                      meta={`${catLabel(r.category, lang)} · ${r.date.slice(5).replace('-','/')}${r.recurrence!=='Único'?' · '+recurrenceLabel(r.recurrence, lang):''}${r.inv?' · '+t('income.row.investment'):''}`}
                      amount={fmtMoney(r.amount,sym)} isIncome
                      onDelete={()=>deleteWithUndo('incomes', r, t('common.deleted'), t('common.undo'))}
                      onEdit={()=>{setEditingId(r.id);setEditForm({source:r.source,amount:r.amount,date:r.date,category:r.category,recurrence:r.recurrence,notes:r.notes||''})}} />
                  </div>
                ))}
              </div>
          }
        </Card>
      </div>
    </div>
  )
}
