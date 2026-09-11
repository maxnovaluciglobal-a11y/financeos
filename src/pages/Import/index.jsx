// src/pages/Import/index.jsx
// Importar movimientos — CSV/XLSX/XLS · FinanceOS
// 100% local · sin dependencias externas · sin envío de datos

import { useState, useCallback, useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { markLocalChange } from '../../core/sync.js'
import { useT } from '../../i18n/useT.js'
import { dbGetAll, dbAdd } from '../../core/db/index.js'
import { uid, moneyLocale, getCategoriesExpense, getCategoriesIncome, catLabel } from '../../utils/index.js'
import { detectBankTemplate, applyTemplate, BANK_TEMPLATES } from './bankTemplates.js'
import {
  parseFile, detectColumns, validateRows, detectDuplicates, suggestCategory,
  createImportBatch, buildTransactions, MAX_ROWS,
} from './fileParser.js'

const s = {
  page: {},
  header: { marginBottom: 24 },
  eyebrow: { fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--grn)', marginBottom: 6 },
  h1: { fontSize: 24, fontWeight: 700, color: 'var(--tx)', fontFamily: 'var(--display)', letterSpacing: '-.02em', marginBottom: 4 },
  sub: { fontSize: 13, color: 'var(--th)', fontFamily: 'var(--mono)' },
  card: { background: 'var(--sur)', border: '.5px solid var(--brd)', borderRadius: 'var(--r)', padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 13, fontWeight: 600, color: 'var(--tx)', marginBottom: 12 },
  steps: { display: 'flex', gap: 8, marginBottom: 28 },
  step: (active, done) => ({
    flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 8,
    fontSize: 11, fontFamily: 'var(--mono)',
    background: done ? 'var(--grn-bg)' : active ? 'var(--accent-bg)' : 'var(--sur)',
    color: done ? 'var(--grn)' : active ? 'var(--accent)' : 'var(--th)',
    border: `.5px solid ${done ? 'var(--grn)' : active ? 'var(--accent)' : 'var(--brd)'}`,
  }),
  dropzone: (drag) => ({
    border: `1.5px dashed ${drag ? 'var(--accent)' : 'var(--brd2)'}`,
    borderRadius: 12, padding: '40px 24px', textAlign: 'center',
    cursor: 'pointer', transition: '.2s',
    background: drag ? 'var(--accent-bg)' : 'var(--sur2)',
  }),
  privacy: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    background: 'var(--accent-bg)', border: '.5px solid var(--accent)',
    borderRadius: 8, padding: '10px 12px', marginTop: 12,
    fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--mono)', lineHeight: 1.5,
  },
  hint: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    background: 'var(--sur2)', border: '.5px solid var(--brd)',
    borderRadius: 8, padding: '10px 12px', marginTop: 8,
    fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)', lineHeight: 1.5,
  },
  select: { width: '100%', background: 'var(--sur2)', border: '.5px solid var(--brd2)', borderRadius: 6, padding: '7px 10px', color: 'var(--tx)', fontSize: 13, fontFamily: 'var(--mono)' },
  label: { fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.5px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '7px 10px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--th)', borderBottom: '1px solid var(--brd)', background: 'var(--sur2)', fontFamily: 'var(--mono)' },
  td: { padding: '7px 10px', borderBottom: '.5px solid var(--brd)', fontFamily: 'var(--mono)', verticalAlign: 'top' },
  badge: (status) => ({
    display: 'inline-block', padding: '2px 7px', borderRadius: 20, fontSize: 10, fontWeight: 600,
    background: status === 'valid' ? 'var(--accent-bg)' : status === 'duplicate' ? 'rgba(245,166,35,.12)' : 'rgba(255,77,106,.12)',
    color: status === 'valid' ? 'var(--accent)' : status === 'duplicate' ? 'var(--amb)' : 'var(--red)',
  }),
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 16 },
  summaryItem: { background: 'var(--sur2)', borderRadius: 8, padding: '10px 12px', border: '.5px solid var(--brd)' },
  summaryLabel: { fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--th)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 },
  summaryVal: { fontSize: 16, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--tx)' },
  btn: { padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: '.15s' },
  btnPrimary: { background: 'var(--laton)', color: 'var(--navy)' },
  btnSecondary: { background: 'var(--sur2)', color: 'var(--tx)', border: '.5px solid var(--brd2)' },
  btnRow: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 },
  disclaimer: { fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)', lineHeight: 1.6, marginTop: 16, padding: '10px 12px', background: 'var(--sur2)', borderRadius: 8, border: '.5px solid var(--brd)' },
  warn: { background: 'rgba(245,166,35,.1)', border: '.5px solid var(--amb)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--amb)', fontFamily: 'var(--mono)', marginBottom: 16 },
}

// keys de traducción
const STEPS = ['imp.step.upload', 'imp.step.map', 'imp.step.review', 'imp.step.import']
const fmt = (n) => (n || 0).toLocaleString(moneyLocale(), { maximumFractionDigits: 0 })

export default function ImportMovements({ setPage } = {}) {
  const { settings, rehydrate } = useApp()
  const { t, lang } = useT()
  const sym = { CLP:'$', USD:'US$', EUR:'€', VES:'Bs.', MXN:'$', ARS:'$', COP:'$' }[settings?.currency] || '$'
  const isDemo = !!settings?.isDemo
  const categoriesExpense = useMemo(() => getCategoriesExpense(settings), [settings])
  const categoriesIncome  = useMemo(() => getCategoriesIncome(settings), [settings])

  const [step, setStep] = useState(0)
  const [drag, setDrag] = useState(false)
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [mapping, setMapping] = useState({})
  const [modeConfig, setModeConfig] = useState({ mode: 'single', negativeIsExpense: true })
  const [rows, setRows] = useState([])
  const [history, setHistory] = useState([])
  const [importing, setImporting] = useState(false)
  const [detectedBank, setDetectedBank] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [warning, setWarning] = useState(null)

  useState(() => {
    if (isDemo) return
    dbGetAll('importBatches').then(d => setHistory(d || []))
  })

  async function handleFile(f) {
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['csv', 'xlsx', 'xls', 'pdf'].includes(ext)) {
      setWarning(t('imp.err.format'))
      return
    }
    setWarning(null)
    setLoading(true)
    try {
      const result = await parseFile(f)
      if (result.rows.length === 0) { setWarning(t('imp.err.empty')); return }
      const suggested = detectColumns(result.headers)
      const bankTemplate = detectBankTemplate(result.headers)
      setFile(f)
      setParsed(result)
      setDetectedBank(bankTemplate)
      if (bankTemplate) {
        const templateMapping = applyTemplate(bankTemplate, result.headers)
        setMapping({
          date:        templateMapping.date        || suggested.date        || result.headers[0] || '',
          description: templateMapping.description || suggested.description || result.headers[1] || '',
          amount:      templateMapping.amount      || suggested.amount      || result.headers[2] || '',
          debit:       templateMapping.debit       || suggested.debit       || '',
          credit:      templateMapping.credit      || suggested.credit      || '',
          category:    suggested.category || '',
          account:     suggested.account  || '',
        })
        setModeConfig(bankTemplate.config)
      } else {
        setMapping({
          date: suggested.date || result.headers[0] || '',
          description: suggested.description || result.headers[1] || '',
          amount: suggested.amount || result.headers[2] || '',
          debit: suggested.debit || '',
          credit: suggested.credit || '',
          category: suggested.category || '',
          account: suggested.account || '',
        })
        if (suggested.debit && suggested.credit) setModeConfig({ mode: 'debit_credit', negativeIsExpense: true })
      }
      if (result.totalLines > MAX_ROWS) setWarning(t('imp.warn.maxRows', { n: result.totalLines, max: MAX_ROWS }))
      setStep(1)
    } catch (err) {
      setWarning(t('imp.err.read', { msg: err.message }))
    } finally {
      setLoading(false)
    }
  }

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [])

  async function handlePreview() {
    const validated = validateRows(parsed.rows, mapping, modeConfig)
    let existing = []
    if (!isDemo) {
      const [inc, exp] = await Promise.all([dbGetAll('incomes'), dbGetAll('expenses')])
      existing = [...(inc || []), ...(exp || [])]
    }
    const withDupes = detectDuplicates(validated, existing)
    // Auto-sugerencia de categoría (heurística local, ver fileParser.js): solo
    // cuando la fila no trae categoría propia (no había columna mapeada). El
    // usuario ve la sugerencia en la tabla de revisión y puede cambiarla antes
    // de confirmar — nunca se aplica en silencio.
    const withCategory = withDupes.map(r => {
      if (r.category) return r
      const suggested = suggestCategory(r.description, existing)
      return suggested ? { ...r, category: suggested, categorySuggested: true } : r
    })
    // Por defecto solo se incluyen los NUEVOS (status 'valid'). Duplicados y
    // posibles duplicados quedan desmarcados para no re-duplicar el mes; el
    // usuario puede incluirlos con un clic si quiere.
    setRows(withCategory.map(r => ({ ...r, _include: r.status === 'valid' })))
    setStep(2)
  }

  async function handleImport() {
    if (isDemo) { setResult({ demo: true }); setStep(3); return }
    setImporting(true)
    try {
      const batchId = uid()
      const now = new Date().toISOString()
      const { incomes, expenses } = buildTransactions(rows, batchId, now)
      // Guardado resiliente: si UNA fila falla, las demás SÍ se guardan (antes un
      // solo error abortaba TODA la importación y no cargaba nada). Sanitiza cada
      // registro a tipos serializables por IndexedDB.
      const clean = (r) => ({
        id: uid(),
        date: String(r.date || ''),
        description: String(r.description || ''),
        concept: String(r.concept || r.description || ''),
        amount: Number(r.amount) || 0,
        category: String(r.category || 'Importado'),
        account: String(r.account || ''),
        notes: '', source: 'csv', importBatchId: batchId, importedAt: now,
        originalDescription: String(r.originalDescription || r.description || ''),
      })
      let ok = 0, fail = 0
      for (const r of [...incomes.map(x => ['incomes', x]), ...expenses.map(x => ['expenses', x])]) {
        try { await dbAdd(r[0], clean(r[1])); ok++ } catch { fail++ }
      }
      const total = incomes.length + expenses.length
      const batch = createImportBatch(file.name, rows)
      batch.id = batchId; batch.importedAt = now; batch.importedRows = ok
      try { await dbAdd('importBatches', batch) } catch {}
      try { localStorage.setItem('fos_recent_import', JSON.stringify(batch)) } catch {}
      setHistory(prev => [batch, ...prev])
      // P0 — reflejar lo importado en TODA la app al instante (antes solo quedaba
      // en IndexedDB y no se veía hasta recargar) y marcar el cambio para que el
      // sync lo suba a la nube.
      if (ok > 0) {
        try { await rehydrate() } catch {}
        try { markLocalChange() } catch {}
      }
      if (fail > 0 && ok === 0) { setWarning(t('imp.err.partial', { ok, total, fail })); return }
      if (fail > 0) setWarning(t('imp.err.partial', { ok, total, fail }))
      setResult(batch)
      setStep(3)
    } catch (err) {
      setWarning(t('imp.err.import', { msg: err.message }))
    } finally {
      setImporting(false)
    }
  }

  function reset() {
    setStep(0); setFile(null); setParsed(null); setRows([]); setResult(null); setWarning(null)
  }

  const stats = useMemo(() => {
    const included = rows.filter(r => r._include)
    return {
      total: rows.length,
      valid: rows.filter(r => r.status === 'valid').length,
      duplicate: rows.filter(r => r.status === 'duplicate').length,
      error: rows.filter(r => r.status === 'error').length,
      toImport: included.filter(r => r.status === 'valid').length,
      incomeAmt: included.filter(r => r.status === 'valid' && r.type === 'income').reduce((s,r) => s+r.amount, 0),
      expenseAmt: included.filter(r => r.status === 'valid' && r.type === 'expense').reduce((s,r) => s+r.amount, 0),
    }
  }, [rows])

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.eyebrow}>{t('imp.eyebrow')}</div>
        <h1 style={s.h1}>{t('imp.title')}</h1>
        <p style={s.sub}>{t('imp.sub')}</p>
      </div>

      <div style={s.steps}>
        {STEPS.map((name, i) => (
          <div key={i} style={s.step(step === i, step > i)}>{step > i ? '✓ ' : `${i+1}. `}{t(name)}</div>
        ))}
      </div>

      {warning && <div style={s.warn}>⚠ {warning}</div>}

      {/* STEP 0 — Importar archivo */}
      {step === 0 && (
        <>
          <div style={s.card}>
            <div style={s.cardTitle}>{t('imp.upload.title')}</div>
            <div
              style={s.dropzone(drag)}
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={onDrop}
              onClick={() => document.getElementById('csv-input').click()}
            >
              {loading
                ? <div style={{ color: 'var(--th)', fontFamily: 'var(--mono)', fontSize: 13 }}>{t('imp.upload.reading')}</div>
                : <>
                    <div style={{ fontSize: 28, marginBottom: 10, color: 'var(--th)' }}>↑</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)', marginBottom: 4 }}>{t('imp.upload.drop')}</div>
                    <div style={{ fontSize: 12, color: 'var(--th)', fontFamily: 'var(--mono)' }}>{t('imp.upload.formats', { max: MAX_ROWS })}</div>
                  </>
              }
            </div>
            <input id="csv-input" type="file" accept=".csv,.xlsx,.xls,.pdf" style={{ display: 'none' }}
              onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
            <div style={s.privacy}>
              <span>◑</span>
              <span>{t('imp.upload.privacy')}</span>
            </div>
            <div style={s.hint}>
              <span>→</span>
              <span>{t('imp.upload.hint')}</span>
            </div>
          </div>

          {/* Panel bancos soportados */}
          <div style={s.card}>
            <div style={s.cardTitle}>{t('imp.banks.title')}</div>
            <p style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)', marginBottom: 14 }}>
              {t('imp.banks.sub')}
            </p>
            {[
              { label: '🇨🇱 Chile', banks: BANK_TEMPLATES.filter(b => b.country === 'CL') },
              { label: '🇲🇽 México', banks: BANK_TEMPLATES.filter(b => b.country === 'MX') },
              { label: '🇨🇴 Colombia', banks: BANK_TEMPLATES.filter(b => b.country === 'CO') },
            ].map(group => (
              <div key={group.label} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--th)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 8 }}>{group.label}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {group.banks.map(b => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 20, background: 'var(--sur2)', border: '.5px solid var(--brd)', fontSize: 11, color: 'var(--tx)', fontFamily: 'var(--mono)' }}>
                      <span>{b.flag}</span>
                      <span>{b.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ fontSize: 10, color: 'var(--th)', fontFamily: 'var(--mono)', marginTop: 4 }}>
              {t('imp.banks.notListed')}
            </div>
          </div>

          {history.length > 0 && (
            <div style={s.card}>
              <div style={s.cardTitle}>{t('imp.history.title')}</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead><tr>
                    <th style={s.th}>{t('imp.history.file')}</th><th style={s.th}>{t('imp.history.date')}</th>
                    <th style={s.th}>{t('imp.history.imported')}</th><th style={s.th}>{t('imp.history.income')}</th>
                    <th style={s.th}>{t('imp.history.expenses')}</th><th style={s.th}>{t('imp.history.skipped')}</th>
                  </tr></thead>
                  <tbody>{history.map((b, i) => (
                    <tr key={i}>
                      <td style={{ ...s.td, color: 'var(--tx)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.fileName}</td>
                      <td style={{ ...s.td, color: 'var(--th)' }}>{b.importedAt?.slice(0,10)}</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{b.importedRows}</td>
                      <td style={{ ...s.td, color: 'var(--accent)' }}>{sym}{fmt(b.totalIncome)}</td>
                      <td style={{ ...s.td, color: 'var(--red)' }}>{sym}{fmt(b.totalExpense)}</td>
                      <td style={{ ...s.td, color: 'var(--th)' }}>{(b.skippedRows||0)+(b.duplicateRows||0)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}

          {history.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--th)', fontSize: 13, fontFamily: 'var(--mono)' }}>
              {t('imp.history.empty')}
            </div>
          )}
        </>
      )}

      {/* STEP 1 — Mapear columnas */}
      {step === 1 && parsed && (
        <div style={s.card}>
          {/* Banner detección banco */}
          {detectedBank ? (
            <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'rgba(10,92,62,.07)',border:'0.5px solid rgba(10,92,62,.2)',borderRadius:8,marginBottom:16}}>
              <div style={{fontSize:22,flexShrink:0}}>{detectedBank.flag}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,color:'var(--grn)',marginBottom:2}}>{t('imp.map.detected', { bank: detectedBank.name })}</div>
                <div style={{fontSize:11,color:'var(--th)',fontFamily:'var(--mono)'}}>{detectedBank.hint} · {t('imp.map.autoMapped')}</div>
              </div>
              <div style={{fontSize:10,padding:'3px 8px',borderRadius:4,background:'rgba(10,92,62,.1)',color:'var(--grn)',fontFamily:'var(--mono)',flexShrink:0}}>{t('imp.map.auto')}</div>
            </div>
          ) : (
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'var(--sur2)',border:'0.5px solid var(--brd)',borderRadius:8,marginBottom:16}}>
              <div style={{fontSize:18}}>📄</div>
              <div style={{fontSize:11,color:'var(--th)',fontFamily:'var(--mono)'}}>{t('imp.map.notDetected')}</div>
            </div>
          )}
          <div style={s.cardTitle}>{t('imp.map.title')}</div>
          <p style={{ fontSize: 12, color: 'var(--th)', fontFamily: 'var(--mono)', marginBottom: 16 }}>
            {detectedBank ? t('imp.map.subAuto') : t('imp.map.subManual')}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[{ key: 'date', label: t('imp.map.date') }, { key: 'description', label: t('imp.map.desc') }].map(({ key, label }) => (
              <div key={key}>
                <div style={s.label}>{label}</div>
                <select style={s.select} value={mapping[key] || ''} onChange={e => setMapping(m => ({ ...m, [key]: e.target.value }))}>
                  <option value="">{t('imp.map.unassigned')}</option>
                  {parsed.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={s.label}>{t('imp.map.amountFormat')}</div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              {[['single', t('imp.map.single')], ['debit_credit', t('imp.map.debitCredit')]].map(([val, lbl]) => (
                <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--tx)' }}>
                  <input type="radio" name="mode" value={val} checked={modeConfig.mode === val}
                    onChange={() => setModeConfig(c => ({ ...c, mode: val }))} />
                  {lbl}
                </label>
              ))}
            </div>

            {modeConfig.mode === 'single' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={s.label}>{t('imp.map.amountCol')}</div>
                  <select style={s.select} value={mapping.amount || ''} onChange={e => setMapping(m => ({ ...m, amount: e.target.value }))}>
                    <option value="">{t('imp.map.unassigned')}</option>
                    {parsed.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <div style={s.label}>{t('imp.map.negativeIs')}</div>
                  <select style={s.select} value={modeConfig.negativeIsExpense ? 'expense' : 'income'}
                    onChange={e => setModeConfig(c => ({ ...c, negativeIsExpense: e.target.value === 'expense' }))}>
                    <option value="expense">{t('imp.map.expense')}</option>
                    <option value="income">{t('imp.map.income')}</option>
                  </select>
                </div>
              </div>
            )}

            {modeConfig.mode === 'debit_credit' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={s.label}>{t('imp.map.debitCol')}</div>
                  <select style={s.select} value={mapping.debit || ''} onChange={e => setMapping(m => ({ ...m, debit: e.target.value }))}>
                    <option value="">{t('imp.map.unassigned')}</option>
                    {parsed.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <div style={s.label}>{t('imp.map.creditCol')}</div>
                  <select style={s.select} value={mapping.credit || ''} onChange={e => setMapping(m => ({ ...m, credit: e.target.value }))}>
                    <option value="">{t('imp.map.unassigned')}</option>
                    {parsed.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[{ key: 'category', label: t('imp.map.categoryOpt') }, { key: 'account', label: t('imp.map.accountOpt') }].map(({ key, label }) => (
              <div key={key}>
                <div style={s.label}>{label}</div>
                <select style={s.select} value={mapping[key] || ''} onChange={e => setMapping(m => ({ ...m, [key]: e.target.value }))}>
                  <option value="">{t('imp.map.noImport')}</option>
                  {parsed.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, color: 'var(--th)', fontFamily: 'var(--mono)', marginBottom: 8 }}>{t('imp.map.preview')}</div>
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={s.table}>
              <thead><tr>{parsed.headers.map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>{parsed.rows.slice(0, 3).map((row, i) => (
                <tr key={i}>{parsed.headers.map(h => <td key={h} style={{ ...s.td, color: 'var(--tx)' }}>{row[h]}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>

          <div style={s.btnRow}>
            <button style={{ ...s.btn, ...s.btnSecondary }} onClick={() => setStep(0)}>{t('imp.back')}</button>
            <button style={{ ...s.btn, ...s.btnPrimary }}
              disabled={!mapping.date || !mapping.description || (modeConfig.mode === 'single' && !mapping.amount) || (modeConfig.mode === 'debit_credit' && !mapping.debit && !mapping.credit)}
              onClick={handlePreview}>
              {t('imp.map.next')}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 — Revisar */}
      {step === 2 && (
        <>
          <div style={s.card}>
            <div style={s.cardTitle}>{t('imp.review.title')}</div>
            <div style={s.summaryGrid}>
              <div style={s.summaryItem}><div style={s.summaryLabel}>{t('imp.review.total')}</div><div style={s.summaryVal}>{stats.total}</div></div>
              <div style={s.summaryItem}><div style={s.summaryLabel}>{t('imp.review.valid')}</div><div style={{ ...s.summaryVal, color: 'var(--accent)' }}>{stats.valid}</div></div>
              <div style={s.summaryItem}><div style={s.summaryLabel}>{t('imp.review.dup')}</div><div style={{ ...s.summaryVal, color: 'var(--amb)' }}>{stats.duplicate}</div></div>
              <div style={s.summaryItem}><div style={s.summaryLabel}>{t('imp.review.error')}</div><div style={{ ...s.summaryVal, color: 'var(--red)' }}>{stats.error}</div></div>
              <div style={s.summaryItem}><div style={s.summaryLabel}>{t('imp.review.incomeEst')}</div><div style={{ ...s.summaryVal, color: 'var(--accent)', fontSize: 13 }}>{sym}{fmt(stats.incomeAmt)}</div></div>
              <div style={s.summaryItem}><div style={s.summaryLabel}>{t('imp.review.expenseEst')}</div><div style={{ ...s.summaryVal, color: 'var(--red)', fontSize: 13 }}>{sym}{fmt(stats.expenseAmt)}</div></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
              {[
                [t('imp.review.onlyValid'), () => setRows(r => r.map(row => ({ ...row, _include: row.status === 'valid' })))],
                [t('imp.review.all'), () => setRows(r => r.map(row => ({ ...row, _include: true })))],
                [t('imp.review.none'), () => setRows(r => r.map(row => ({ ...row, _include: false })))],
              ].map(([label, fn]) => (
                <button key={label} style={{ ...s.btn, ...s.btnSecondary, fontSize: 12 }} onClick={fn}>{label}</button>
              ))}
            </div>
          </div>

          <div style={{ ...s.card, maxHeight: 420, overflowY: 'auto' }}>
            <table style={s.table}>
              <thead><tr>
                <th style={{ ...s.th, width: 32 }}></th>
                <th style={s.th}>{t('imp.review.thDate')}</th><th style={s.th}>{t('imp.review.thDesc')}</th>
                <th style={s.th}>{t('imp.review.thAmount')}</th><th style={s.th}>{t('imp.review.thType')}</th>
                <th style={s.th}>{t('imp.review.thCategory')}</th><th style={s.th}>{t('imp.review.thStatus')}</th>
              </tr></thead>
              <tbody>{rows.map((row, i) => (
                <tr key={i} style={{ opacity: row._include ? 1 : .45 }}>
                  <td style={s.td}><input type="checkbox" style={{width:16,height:16,flexShrink:0}} checked={!!row._include} onChange={e => setRows(r => r.map((x, j) => j === i ? { ...x, _include: e.target.checked } : x))} /></td>
                  <td style={{ ...s.td, color: 'var(--th)' }}>{row.date || '—'}</td>
                  <td style={{ ...s.td, color: 'var(--tx)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.description || '—'}</td>
                  <td style={{ ...s.td, color: row.type === 'income' ? 'var(--accent)' : 'var(--red)', fontWeight: 600 }}>{row.type === 'income' ? '+' : '−'}{sym}{fmt(row.amount)}</td>
                  <td style={{ ...s.td, color: 'var(--th)' }}>{row.type === 'income' ? t('imp.review.typeIncome') : t('imp.review.typeExpense')}</td>
                  <td style={s.td}>
                    <select
                      value={row.category || ''}
                      onChange={e => setRows(r => r.map((x, j) => j === i ? { ...x, category: e.target.value, categorySuggested: false } : x))}
                      style={{ ...s.select, width: 'auto', minWidth: 120, padding: '4px 6px', fontSize: 11 }}
                    >
                      <option value="">{t('imp.review.noCategory')}</option>
                      {(row.type === 'income' ? categoriesIncome : categoriesExpense).map(c => <option key={c} value={c}>{catLabel(c, lang)}</option>)}
                    </select>
                    {row.categorySuggested && <div style={{ fontSize: 9, color: 'var(--accent)', fontFamily: 'var(--mono)', marginTop: 2 }}>{t('imp.review.suggested')}</div>}
                  </td>
                  <td style={s.td}>
                    <span style={s.badge(row.status)}>{row.status === 'valid' ? t('imp.review.stValid') : row.status === 'duplicate' ? t('imp.review.stDup') : t('imp.review.stError')}</span>
                    {row.errors?.length > 0 && <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 2 }}>{row.errors.join(', ')}</div>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>

          <div style={{ background: 'var(--accent-bg)', border: '.5px solid var(--accent)', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: 'var(--tx)', fontFamily: 'var(--mono)', marginBottom: 16 }}>
            {t('imp.review.note')}
          </div>

          <div style={s.btnRow}>
            <button style={{ ...s.btn, ...s.btnSecondary }} onClick={() => setStep(1)}>{t('imp.back')}</button>
            <button style={{ ...s.btn, ...s.btnPrimary, opacity: importing ? .6 : 1 }}
              disabled={importing || stats.toImport === 0} onClick={handleImport}>
              {importing ? t('imp.review.importing') : t('imp.review.importN', { n: stats.toImport })}
            </button>
          </div>
          <div style={s.disclaimer}>{t('imp.review.disclaimer')}</div>
        </>
      )}

      {/* STEP 3 — Resultado */}
      {step === 3 && (
        <div style={s.card}>
          {result?.demo ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>◈</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--tx)', marginBottom: 8 }}>{t('imp.done.demoTitle')}</div>
              <p style={{ fontSize: 13, color: 'var(--th)', fontFamily: 'var(--mono)' }}>{t('imp.done.demoText')}</p>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 28, marginBottom: 12, color: 'var(--accent)' }}>✓</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx)', marginBottom: 8 }}>
                {t('imp.done.imported', { n: result?.importedRows })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, margin: '20px auto', maxWidth: 400 }}>
                <div style={s.summaryItem}><div style={s.summaryLabel}>{t('imp.history.income')}</div><div style={{ ...s.summaryVal, color: 'var(--accent)', fontSize: 14 }}>{sym}{fmt(result?.totalIncome)}</div></div>
                <div style={s.summaryItem}><div style={s.summaryLabel}>{t('imp.history.expenses')}</div><div style={{ ...s.summaryVal, color: 'var(--red)', fontSize: 14 }}>{sym}{fmt(result?.totalExpense)}</div></div>
                <div style={s.summaryItem}><div style={s.summaryLabel}>{t('imp.history.skipped')}</div><div style={{ ...s.summaryVal, color: 'var(--th)', fontSize: 14 }}>{(result?.skippedRows||0)+(result?.duplicateRows||0)}</div></div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--th)', fontFamily: 'var(--mono)', marginBottom: 16 }}>{t('imp.done.visible')}</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {setPage && (
                  <button style={{ ...s.btn, ...s.btnPrimary }} onClick={() => setPage('dashboard')}>{t('imp.done.goDashboard')}</button>
                )}
                <button style={{ ...s.btn, ...(setPage ? {} : s.btnPrimary) }} onClick={reset}>{t('imp.done.again')}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
