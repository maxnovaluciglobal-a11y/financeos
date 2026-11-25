// src/pages/Investments/portfolio/sheets.jsx — hojas de Portafolio (F1):
// elegir una acción, nueva/editar posición, confirmar, registrar operación e
// importar (CSV de posiciones o copia JSON). Todas usan Sheet (foco atrapado,
// Esc, foco de vuelta al cerrar) y errores en línea con role="alert".
import { useEffect, useMemo, useRef, useState } from 'react'
import Sheet from '../../../components/ui/Sheet.jsx'
import SheetSelect from '../../../components/ui/SheetSelect.jsx'
import { ChoiceGroup } from '../../../components/ui/index.jsx'
import { investApi } from '../../../core/investApi.js'
import { demoMarketApi } from '../../../demo/demoMarketApi.js'
import { currencyOf, rateOf } from '../../../utils/investValuation.js'
import { crossFill, CASH_CCYS, localToday } from '../../../utils/investTrade.js'
import { parseBackup, IMPORT_MAX_ROWS } from '../../../utils/investCsv.js'
import { MAP_FIELDS, PRESETS, PRESET_IDS, DECIMAL_MODES, applyMap, autoMap, csvTable, numOf } from '../../../utils/investMappedImport.js'
import { parseInput } from './format.js'
import { usePT } from './text.js'
import s from './portfolio.module.css'

const ASSET_TYPES = ['Stock', 'ETF', 'Crypto', 'Bond']

// Lista de acciones (Agregar, Exportar).
export function ChooserSheet({ open, onClose, title, options }) {
  const ref = useRef(null)
  return (
    <Sheet open={open} onClose={onClose} ariaLabel={title} initialFocusRef={ref} initialDetent="medium">
      <div className={s.form}>
        <h2 ref={ref} tabIndex={-1} className={s.formTitle}>{title}</h2>
        <div className={s.choices}>
          {options.map(o => (
            <button key={o.id} type="button" className={s.choiceBtn} onClick={() => { onClose(); o.onPick() }} disabled={o.disabled}>
              {o.icon}<span>{o.label}{o.sub && <small>{o.sub}</small>}</span>
            </button>
          ))}
        </div>
        <button type="button" className={`${s.btn} ${s.btnBlock}`} onClick={onClose}>{options.cancelLabel || '×'}</button>
      </div>
    </Sheet>
  )
}

export function ConfirmSheet({ open, onClose, title, body, confirmLabel, cancelLabel, onConfirm, danger = true }) {
  const ref = useRef(null)
  const [busy, setBusy] = useState(false)
  async function go() {
    setBusy(true)
    try { await onConfirm() } finally { setBusy(false) }
  }
  return (
    <Sheet open={open} onClose={onClose} ariaLabel={title} initialFocusRef={ref} initialDetent="medium">
      <div className={s.form}>
        <div>
          <h2 ref={ref} tabIndex={-1} className={s.formTitle}>{title}</h2>
          {body && <p className={s.formSub}>{body}</p>}
        </div>
        <div className={s.two}>
          <button type="button" className={s.btn} onClick={onClose}>{cancelLabel}</button>
          <button type="button" className={`${s.btn} ${danger ? s.btnDanger : s.btnPrimary}`} onClick={go} disabled={busy}>{confirmLabel}</button>
        </div>
      </div>
    </Sheet>
  )
}

function Field({ id, label, error, hint, children }) {
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.fieldLabel}>{label}</label>
      {children}
      {hint && <p id={`${id}-hint`} className={s.hint}>{hint}</p>}
      {error && <p id={`${id}-err`} className={s.error} role="alert">{error}</p>}
    </div>
  )
}
const aria = (id, error, hint) => ({ id, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': [error && `${id}-err`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined })

// ── Nueva / editar posición ──
// prev: la posición a editar (o null). prefill: { t, price } desde otra pantalla.
export function PositionSheet({ open, onClose, prev, prefill, onSave, rates, demo, stopColumn = true }) {
  const { t } = usePT()
  const ref = useRef(null)
  const [f, setF] = useState({})
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [px, setPx] = useState(null)
  useEffect(() => {
    if (!open) return
    const p = prev || null
    setF({ t: p?.t || prefill?.t || '', type: p?.type || 'Stock', sh: p ? String(p.sh) : '', cost: p ? String(p.avgCost ?? p.cost) : prefill?.price ? String(prefill.price) : '', stop: p?.stop != null ? String(p.stop) : '', fxCost: p?.fxCost != null ? String(p.fxCost) : '', note: p?.note || '' })
    setErrors({}); setPx(null)
  }, [open, prev, prefill])
  const ticker = String(f.t || '').toUpperCase().trim()
  // Precio actual como referencia (descarta respuestas viejas, como Invest).
  useEffect(() => {
    if (!open || prev || !/^[\^A-Z0-9.\-=]{1,15}$/.test(ticker)) { setPx(null); return undefined }
    let alive = true
    const id = setTimeout(() => {
      (demo ? demoMarketApi : investApi).quote(ticker, { crypto: f.type === 'Crypto' }).then(q => { if (alive) setPx(q) })
    }, 350)
    return () => { alive = false; clearTimeout(id) }
  }, [open, ticker, f.type, demo, prev])
  const ccy = currencyOf(ticker, px?.currency) || '—'
  const today = ccy !== 'USD' && ccy !== '—' ? rateOf(ccy, rates) : null
  const set = (k) => (e) => { setF(x => ({ ...x, [k]: e.target.value })); setErrors(x => ({ ...x, [k]: undefined })) }

  async function submit(e) {
    e.preventDefault()
    const input = { t: ticker, type: f.type, sh: parseInput(f.sh), cost: parseInput(f.cost), stop: f.stop === '' ? null : parseInput(f.stop), fxCost: f.fxCost === '' ? null : parseInput(f.fxCost), note: f.note }
    setBusy(true)
    const r = await onSave(prev, input)
    setBusy(false)
    if (!r.ok) setErrors(r.fields ? Object.fromEntries(Object.entries(r.fields).map(([k, v]) => [k, t(`pf.err.${v}`)])) : { form: t(`pf.err.${r.error === 'demo' ? 'demo' : r.error === 'timeout' || r.error === 'network' ? 'network' : 'save_failed'}`) })
  }
  const title = prev ? t('pf.pos.editTitle', { t: prev.t }) : t('pf.pos.addTitle')
  return (
    <Sheet open={open} onClose={onClose} ariaLabel={title} initialFocusRef={ref}>
      <form className={s.form} onSubmit={submit} noValidate>
        <div>
          <h2 ref={ref} tabIndex={-1} className={s.formTitle}>{title}</h2>
          <p className={s.formSub}>{t('pf.pos.sub')}</p>
        </div>
        <Field id="pf-pos-t" label={t('pf.f.ticker')} error={errors.t} hint={!prev && px ? `${t('pf.pos.priceNow', { price: `${ccy} ${px.price}` })}${px.sample ? ` ${t('pf.sampleData')}` : ''}` : null}>
          <input className={s.input} {...aria('pf-pos-t', errors.t, !prev && px)} value={f.t || ''} onChange={set('t')} readOnly={!!prev} autoCapitalize="characters" autoComplete="off" spellCheck="false" maxLength={15} placeholder="AAPL" />
        </Field>
        <Field id="pf-pos-type" label={t('pf.f.type')} error={errors.type}>
          <SheetSelect className={s.select} id="pf-pos-type" value={f.type || 'Stock'} onChange={set('type')}>
            {ASSET_TYPES.map(k => <option key={k} value={k}>{t(`pf.type.${k}`)}</option>)}
          </SheetSelect>
        </Field>
        <div className={s.two}>
          <Field id="pf-pos-sh" label={t('pf.f.units')} error={errors.sh}>
            <input className={s.input} {...aria('pf-pos-sh', errors.sh)} value={f.sh || ''} onChange={set('sh')} inputMode="decimal" autoComplete="off" />
          </Field>
          <Field id="pf-pos-cost" label={t('pf.f.entry', { ccy })} error={errors.cost}>
            <input className={s.input} {...aria('pf-pos-cost', errors.cost)} value={f.cost || ''} onChange={set('cost')} inputMode="decimal" autoComplete="off" />
          </Field>
        </div>
        {stopColumn && (
          <Field id="pf-pos-stop" label={t('pf.f.stop', { ccy })} error={errors.stop} hint={t('pf.pos.stopHint')}>
            <input className={s.input} {...aria('pf-pos-stop', errors.stop, true)} value={f.stop || ''} onChange={set('stop')} inputMode="decimal" autoComplete="off" />
          </Field>
        )}
        {ccy !== 'USD' && ccy !== '—' && (
          <Field id="pf-pos-fx" label={t('pf.f.fxCost', { ccy })} error={errors.fxCost} hint={today ? t('pf.pos.fxToday', { rate: today }) : t('pf.pos.fxHint')}>
            <input className={s.input} {...aria('pf-pos-fx', errors.fxCost, true)} value={f.fxCost || ''} onChange={set('fxCost')} inputMode="decimal" autoComplete="off" />
          </Field>
        )}
        <Field id="pf-pos-note" label={t('pf.f.note')} error={errors.note}>
          <input className={s.input} {...aria('pf-pos-note', errors.note)} value={f.note || ''} onChange={set('note')} maxLength={500} />
        </Field>
        {errors.form && <p className={s.error} role="alert">{errors.form}</p>}
        <div className={s.two}>
          <button type="button" className={s.btn} onClick={onClose}>{t('pf.cancel')}</button>
          <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={busy}>{busy ? t('pf.saving') : t('pf.save')}</button>
        </div>
      </form>
    </Sheet>
  )
}

// ── Registrar operación ──
const TYPE_ORDER = ['buy', 'sell', 'dividend', 'bonus', 'deposit', 'withdrawal']
const SHOWN = ['type', 'ticker', 'price', 'qty', 'amount', 'rsi', 'date', 'note']
export function TradeSheet({ open, onClose, prefill, onSave, tickers = [], hasDeposits = false, knownTickers = [] }) {
  const { t } = usePT()
  const ref = useRef(null)
  const [f, setF] = useState({})
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!open) return
    setF({ type: 'buy', ticker: '', assetType: 'Stock', mode: 'cash', currency: 'USD', price: '', qty: '', amount: '', rsi: '', note: '', cash: hasDeposits, date: localToday(), source: null, ...prefill })
    setErrors({})
  }, [open, prefill, hasDeposits])
  const type = f.type || 'buy'
  const cashOnly = type === 'deposit' || type === 'withdrawal'
  const drip = type === 'dividend' && f.mode === 'drip'
  const showPrice = type === 'buy' || type === 'sell' || drip
  const showQty = showPrice || type === 'bonus'
  const showAmount = type !== 'bonus'
  const tk = String(f.ticker || '').toUpperCase().trim()
  const newTicker = type === 'buy' && tk && !knownTickers.includes(tk)
  const set = (k) => (e) => {
    const v = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e
    setF(x => (k === 'price' || k === 'qty' || k === 'amount' ? crossFill({ ...x, [k]: v }, k) : { ...x, [k]: v }))
    setErrors(x => ({ ...x, [k]: undefined, form: undefined }))
  }
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    const r = await onSave(f)
    setBusy(false)
    if (r.ok) return
    if (r.fields) {
      const next = Object.fromEntries(Object.entries(r.fields).map(([k, v]) => [k, t(`pf.err.${v}`)]))
      // Un campo que el formulario no muestra (uid, fx, origen) se avisa abajo.
      if (Object.keys(next).some(k => !SHOWN.includes(k))) next.form = t('pf.err.check')
      setErrors(next)
    } else setErrors({ form: t(r.error === 'table_missing' ? 'pf.mov.missing' : r.error === 'demo' ? 'pf.err.demo' : r.error === 'timeout' || r.error === 'network' ? 'pf.err.network' : 'pf.err.save_failed') })
  }
  const title = t('pf.trade.title')
  return (
    <Sheet open={open} onClose={onClose} ariaLabel={title} initialFocusRef={ref}>
      <form className={s.form} onSubmit={submit} noValidate>
        <div>
          <h2 ref={ref} tabIndex={-1} className={s.formTitle}>{title}</h2>
          <p className={s.formSub}>{t('pf.trade.sub')}</p>
        </div>
        <Field id="pf-tr-type" label={t('pf.f.opType')}>
          <SheetSelect className={s.select} id="pf-tr-type" value={type} onChange={set('type')}>
            {TYPE_ORDER.map(k => <option key={k} value={k}>{t(`pf.trade.type.${k}`)}</option>)}
          </SheetSelect>
        </Field>
        {!cashOnly && (
          <Field id="pf-tr-t" label={t('pf.f.ticker')} error={errors.ticker}>
            <input className={s.input} {...aria('pf-tr-t', errors.ticker)} list="pf-tr-tickers" value={f.ticker || ''} onChange={set('ticker')} autoCapitalize="characters" autoComplete="off" spellCheck="false" maxLength={15} placeholder="AAPL" />
            <datalist id="pf-tr-tickers">{tickers.map(x => <option key={x} value={x}>{x}</option>)}</datalist>
          </Field>
        )}
        {newTicker && (
          <Field id="pf-tr-at" label={t('pf.f.newType')}>
            <SheetSelect className={s.select} id="pf-tr-at" value={f.assetType || 'Stock'} onChange={set('assetType')}>
              {ASSET_TYPES.map(k => <option key={k} value={k}>{t(`pf.type.${k}`)}</option>)}
            </SheetSelect>
          </Field>
        )}
        {type === 'dividend' && (
          <fieldset className={s.field} style={{ border: 0, margin: 0, padding: 0 }}>
            <legend id="pf-tr-mode" className={s.fieldLabel}>{t('pf.f.divMode')}</legend>
            <ChoiceGroup labelledBy="pf-tr-mode" value={f.mode || 'cash'} onChange={(v) => set('mode')(v)} options={[{ value: 'cash', label: t('pf.trade.mode.cash') }, { value: 'drip', label: t('pf.trade.mode.drip') }]} />
          </fieldset>
        )}
        {cashOnly && (
          <Field id="pf-tr-ccy" label={t('pf.f.currency')}>
            <SheetSelect className={s.select} id="pf-tr-ccy" value={f.currency || 'USD'} onChange={set('currency')}>
              {CASH_CCYS.map(c => <option key={c} value={c}>{c}</option>)}
            </SheetSelect>
          </Field>
        )}
        {(showPrice || showQty) && (
          <div className={s.two}>
            {showPrice && (
              <Field id="pf-tr-price" label={t('pf.f.price')} error={errors.price}>
                <input className={s.input} {...aria('pf-tr-price', errors.price)} value={f.price || ''} onChange={set('price')} inputMode="decimal" autoComplete="off" />
              </Field>
            )}
            {showQty && (
              <Field id="pf-tr-qty" label={t('pf.f.qty')} error={errors.qty}>
                <input className={s.input} {...aria('pf-tr-qty', errors.qty)} value={f.qty || ''} onChange={set('qty')} inputMode="decimal" autoComplete="off" />
              </Field>
            )}
          </div>
        )}
        {showAmount && (
          <Field id="pf-tr-amount" label={t('pf.f.amount')} error={errors.amount} hint={showPrice ? t('pf.trade.amountHint') : null}>
            <input className={s.input} {...aria('pf-tr-amount', errors.amount, showPrice)} value={f.amount || ''} onChange={set('amount')} inputMode="decimal" autoComplete="off" />
          </Field>
        )}
        {(type === 'buy' || type === 'sell') && (
          <label className={s.check}>
            <input type="checkbox" checked={!!f.cash} onChange={set('cash')} />
            <span>{t(type === 'buy' ? 'pf.trade.cashBuy' : 'pf.trade.cashSell')}</span>
          </label>
        )}
        {(type === 'buy' || type === 'sell') && (
          <Field id="pf-tr-rsi" label={t('pf.f.rsi')} error={errors.rsi}>
            <input className={s.input} {...aria('pf-tr-rsi', errors.rsi)} value={f.rsi || ''} onChange={set('rsi')} inputMode="decimal" autoComplete="off" />
          </Field>
        )}
        <div className={s.two}>
          <Field id="pf-tr-date" label={t('pf.f.date')} error={errors.date}>
            <input className={s.input} {...aria('pf-tr-date', errors.date)} type="date" max={localToday()} value={f.date || ''} onChange={set('date')} />
          </Field>
          <Field id="pf-tr-note" label={t('pf.f.note')} error={errors.note}>
            <input className={s.input} {...aria('pf-tr-note', errors.note)} value={f.note || ''} onChange={set('note')} maxLength={500} />
          </Field>
        </div>
        {errors.form && <p className={s.error} role="alert">{errors.form}</p>}
        <div className={s.two}>
          <button type="button" className={s.btn} onClick={onClose}>{t('pf.cancel')}</button>
          <button type="submit" className={`${s.btn} ${s.btnPrimary}`} disabled={busy}>{busy ? t('pf.saving') : t('pf.trade.save')}</button>
        </div>
      </form>
    </Sheet>
  )
}

// ── Importar posiciones desde un archivo o restaurar una copia JSON ──
// Archivo (Inversiones v2): CSV o Excel con columnas elegidas por la persona
// (utils/investMappedImport.js). Fintual y Racional son formatos POR
// CONFIRMAR: la hoja lo dice y siempre muestra el mapeo. Nunca se piden
// claves ni se lee la web de la corredora: solo el archivo elegido.
const isXlsx = (file) => /\.xlsx$/i.test(file?.name || '') || file?.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export function ImportSheet({ open, onClose, mode = 'csv', existingTickers = [], onImportHoldings, onImportOps, onImportTargets }) {
  const { t } = usePT()
  const ref = useRef(null)
  const [parsed, setParsed] = useState(null)
  const [table, setTable] = useState(null)
  const [preset, setPreset] = useState('generic')
  const [map, setMap] = useState(null)
  const [decimal, setDecimal] = useState('auto')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  useEffect(() => { if (open) { setParsed(null); setTable(null); setMap(null); setDecimal('auto'); setMsg('') } }, [open, mode])
  // El archivo (CSV o Excel) se convierte en tabla; las filas salen del mapeo.
  const fromMap = useMemo(() => (table ? applyMap(table, map, { presetId: preset, decimal }) : null), [table, map, preset, decimal])
  const view = useMemo(() => (mode === 'csv' && fromMap ? { rows: fromMap.rows, ops: [], errors: fromMap.errors } : parsed), [mode, fromMap, parsed])
  function takeTable(tb) {
    if (tb.error) { setTable(null); setParsed({ rows: [], ops: [], errors: [{ code: tb.error }] }); return }
    setParsed(null)
    setTable(tb)
    setMap(autoMap(tb.head, preset))
  }
  function pickPreset(p) {
    setPreset(p)
    if (table) setMap(autoMap(table.head, p))
  }
  function read(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setTable(null); setParsed({ rows: [], ops: [], errors: [{ code: 'too_big' }] }); return }
    if (mode === 'csv' && isXlsx(file)) {
      file.arrayBuffer()
        .then(buf => import('../../../utils/investXlsx.js').then(m => m.xlsxTable(buf)))
        .then(takeTable)
        .catch(() => { setTable(null); setParsed({ rows: [], ops: [], errors: [{ code: 'xlsx' }] }) })
      return
    }
    const fr = new FileReader()
    fr.onload = () => {
      const text = String(fr.result || '')
      if (mode === 'csv') takeTable(csvTable(text))
      else {
        const r = parseBackup(text, { existingTickers })
        setParsed(r.ok ? { rows: r.holdings, ops: r.operations, errors: [], skipped: r.skippedHoldings, targets: r.targets } : { rows: [], ops: [], errors: [{ code: r.error }] })
      }
    }
    fr.onerror = () => setParsed({ rows: [], ops: [], errors: [{ code: 'read' }] })
    fr.readAsText(file)
  }
  const errText = (e) => (e.line ? t(`pf.csv.err.${e.code}`, { line: e.line, value: e.value || '' }) : t(`pf.csv.err.${e.code}`, { max: IMPORT_MAX_ROWS }))
  const total = (view?.rows.length || 0) + (view?.ops?.length || 0)
  async function go() {
    setBusy(true)
    let done = 0, all = 0, failed = false
    if (view.rows.length) { const r = await onImportHoldings(view.rows); done += r.imported; all += r.total; failed = failed || !r.ok }
    if (view.ops?.length) { const r = await onImportOps(view.ops); done += r.imported; all += r.total; failed = failed || !r.ok }
    if (view.targets && onImportTargets) onImportTargets(view.targets)
    setBusy(false)
    if (!failed) onClose(t('pf.csv.done', { n: done }))
    else setMsg(t('pf.csv.partial', { n: done, total: all }))
  }
  const title = mode === 'csv' ? t('pf.csv.title') : t('pf.json.title')
  const preview = useMemo(() => (view?.rows || []).slice(0, 12), [view])
  const presetName = t(`pf.csv.preset.${preset}`)
  return (
    <Sheet open={open} onClose={() => onClose()} ariaLabel={title} initialFocusRef={ref}>
      <div className={s.form}>
        <div>
          <h2 ref={ref} tabIndex={-1} className={s.formTitle}>{title}</h2>
          <p className={s.formSub}>{mode === 'csv' ? t('pf.csv.sub') : t('pf.json.sub')}</p>
        </div>
        {mode === 'csv' && (
          <fieldset className={s.field} style={{ border: 0, margin: 0, padding: 0 }}>
            <legend id="pf-imp-preset" className={s.fieldLabel}>{t('pf.csv.preset')}</legend>
            <ChoiceGroup labelledBy="pf-imp-preset" value={preset} onChange={pickPreset}
              options={PRESET_IDS.map(id => ({ value: id, label: t(`pf.csv.preset.${id}`) }))} />
            {!PRESETS[preset].confirmed && <p className={s.hint} role="note">{t('pf.csv.preset.unconfirmed', { name: presetName })}</p>}
            {preset === 'fintual' && <p className={s.hint}>{t('pf.csv.preset.fintualFunds')}</p>}
          </fieldset>
        )}
        <Field id="pf-imp-file" label={t('pf.csv.file')} hint={mode === 'csv' ? t('pf.csv.noKeys') : null}>
          <input id="pf-imp-file" className={s.input} type="file"
            accept={mode === 'csv' ? '.csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : '.json,application/json'}
            onChange={read} aria-describedby={mode === 'csv' ? 'pf-imp-file-hint' : undefined} />
        </Field>
        {mode === 'csv' && table && map && (
          <fieldset className={s.field} style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className={s.fieldLabel}>{t('pf.csv.map')}</legend>
            {MAP_FIELDS.map(k => (
              <Field key={k} id={`pf-imp-map-${k}`} label={t(`pf.csv.map.${k}`)}>
                <SheetSelect className={s.select} id={`pf-imp-map-${k}`} value={String(map[k] ?? -1)}
                  onChange={(e) => setMap(m => ({ ...m, [k]: Number(e.target.value) }))}>
                  <option value="-1">{t('pf.csv.map.none')}</option>
                  {table.head.map((h, i) => <option key={i} value={String(i)}>{h || `#${i + 1}`}</option>)}
                </SheetSelect>
              </Field>
            ))}
            <p className={s.hint}>{t('pf.csv.map.hint')}</p>
          </fieldset>
        )}
        {mode === 'csv' && table && map && (
          <fieldset className={s.field} style={{ border: 0, margin: 0, padding: 0 }}>
            <legend id="pf-imp-decimal" className={s.fieldLabel}>{t('pf.csv.decimal')}</legend>
            <ChoiceGroup labelledBy="pf-imp-decimal" value={decimal} onChange={setDecimal}
              options={DECIMAL_MODES.map(id => ({ value: id, label: t(`pf.csv.decimal.${id}`) }))} />
            {/* Cómo queda "1.000" con lo elegido: mil o uno, sin adivinar. */}
            <p className={s.hint} role="note">{t('pf.csv.decimal.reads', { n: String(numOf('1.000', { thousandsDot: !!PRESETS[preset].thousandsDot, decimal })) })}</p>
          </fieldset>
        )}
        {view && view.errors.length > 0 && (
          <ul className={s.notes} role="alert" style={{ margin: 0, paddingLeft: 18 }}>
            {view.errors.slice(0, 5).map((e, i) => <li key={i} className={s.error}>{errText(e)}</li>)}
          </ul>
        )}
        {preview.length > 0 && (
          <ul className={s.preview} aria-label={t('pf.csv.preview')}>
            {preview.map((r, i) => <li key={`${r.t}-${i}`}><span>{r.t} · {t(`pf.type.${r.type}`)}</span><span>{r.sh} × {r.cost}</span></li>)}
            {view.rows.length > preview.length && <li><span>{t('pf.csv.more', { n: view.rows.length - preview.length })}</span></li>}
          </ul>
        )}
        {view?.ops?.length > 0 && <p className={s.hint}>{t('pf.json.ops', { n: view.ops.length })}</p>}
        {view?.skipped?.length > 0 && <p className={s.hint}>{t('pf.json.skipped', { list: view.skipped.join(', ') })}</p>}
        {msg && <p className={s.error} role="alert">{msg}</p>}
        <div className={s.two}>
          <button type="button" className={s.btn} onClick={() => onClose()}>{t('pf.cancel')}</button>
          <button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={go} disabled={busy || !total}>
            {busy ? t('pf.saving') : total ? t('pf.csv.go', { n: total }) : t('pf.csv.pick')}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
