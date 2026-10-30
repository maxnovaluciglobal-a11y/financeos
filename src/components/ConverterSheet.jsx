// src/components/ConverterSheet.jsx — conversor rápido de tasa (B2, GRATIS).
//
// Decisión D-A (30-oct-2026): el conversor es para todos los planes; el panel
// multimoneda (saldos, exposición) sigue siendo PRO y se abre desde un enlace
// secundario de esta hoja. Por eso este archivo NO usa ProGate ni usePlan
// (converterSheet.test.js lo verifica).
//
// - Dos campos: moneda principal ↔ US$, con intercambio.
// - Operaciones básicas en el campo ("25*3", "100+50", coma decimal según el
//   locale): utils/converter.js, sin eval.
// - La tasa usada con su fuente y su fecha ("sin fecha" si no la tiene).
// - Venezuela: la brecha del paralelo sobre el BCV cuando se conocen las dos.
// - Copiar y compartir (hoja nativa del sistema si existe; si no, copia).
// - US$ | € (rial #20): la moneda de referencia se elige acá (onRefCurrency →
//   settings.refCurrency). El euro se deriva de la tasa en US$ (hooks/
//   useLensRate.js) y la etiqueta dice cómo ("Tasa BCV × EUR/USD Fixer").
// - Venezuela: historial de la tasa (B2b, rial #29), cerrado por defecto
//   detrás de "Ver historial"; 7/30/90 días (30 por defecto). Sin datos (sin
//   red ni caché), no aparece: nunca un error.
// Las cifras son las que escribe el usuario, no saldos de cuentas: no pasan
// por "ocultar montos".
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, Copy, Share2, ChevronRight, ChevronDown } from 'lucide-react'
import Sheet from './ui/Sheet.jsx'
import { useT } from '../i18n/useT.js'
import { fmtMoney, moneyLocale, currencyDecimals, currencySymbol, fmtPct, localDateStr } from '../utils/index.js'
import { REF_CURRENCY, REF_CURRENCIES, isStale, rateAgeDays, lensLabelParts, eurSelectable, SOURCE_LABEL } from '../utils/refRate.js'
import { HIST_WINDOWS, HIST_DEFAULT_WINDOW, historyWindow, sparkPath, histFuente } from '../utils/refHistory.js'
import { useLensRate } from '../hooks/useLensRate.js'
import { useRateHistory } from '../hooks/useRefHistory.js'
import { evalAmount, isExpression, convertAmount, toFieldText, usesDecimalComma, veGap } from '../utils/converter.js'
import { loadTasaVE } from '../utils/tasaVE.js'
import { logRejection } from '../utils/errorLog.js'
import { fmtRef, fmtDay, FreshRate, rateSourceName } from '../pages/Dashboard/RefCurrency.jsx'
import s from './ConverterSheet.module.css'

const OPS = [['+', '+'], ['-', '−'], ['*', '×'], ['/', '÷']]

// Fecha 'YYYY-MM-DD' del histórico → "28 oct" (mediodía local: sin corrimiento de día).
const histDay = (d) => fmtDay(new Date(`${d}T12:00:00`).getTime())

// B2b: historial de la tasa (Bs por 1 US$). `rows` ya cargadas; sin ventana
// con dos puntos o más, no se dibuja nada.
function RateHistory({ rows, sourceKey, code, sym }) {
  const { t } = useT()
  const id = useId()
  const [openHist, setOpenHist] = useState(false)
  const [days, setDays] = useState(HIST_DEFAULT_WINDOW)
  const today = localDateStr()
  const win = useMemo(() => historyWindow(rows, days, today), [rows, days, today])
  // Sin ninguna ventana con datos, la sección no existe.
  const any = useMemo(() => HIST_WINDOWS.some(n => historyWindow(rows, n, today)), [rows, today])
  if (!any) return null
  const money = (v) => fmtMoney(v, sym)
  const source = t(sourceKey)
  const summary = win ? t('conv.hist.summary', {
    source, from: money(win.first.value), fromDate: histDay(win.first.date),
    to: money(win.last.value), toDate: histDay(win.last.date), n: days,
    pct: fmtPct(win.change, { decimals: 1, signed: true }),
  }) : t('conv.hist.empty', { n: days })
  return (
    <div className={s.hist}>
      <button type="button" className={s.histToggle} aria-expanded={openHist} aria-controls={id} onClick={() => setOpenHist(v => !v)}>
        <span>{t(openHist ? 'conv.hist.hide' : 'conv.hist.show')}</span>
        <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" className={openHist ? s.histChevOpen : undefined} />
      </button>
      {openHist && (
        <div id={id} className={s.histBody}>
          <div className={s.histHead}>
            <span className={s.histUnit}>{t('conv.hist.unit', { source, code })}</span>
            <span className={s.seg} role="group" aria-label={t('conv.hist.rangeAria')}>
              {HIST_WINDOWS.map(n => (
                <button key={n} type="button" className={s.segOpt} aria-pressed={days === n}
                  aria-label={t('conv.hist.rangeDays', { n })} onClick={() => setDays(n)}>
                  <span className={s.segFace} aria-hidden="true">{t('conv.hist.range', { n })}</span>
                </button>
              ))}
            </span>
          </div>
          {win && (
            <svg className={s.spark} viewBox="0 0 300 64" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <path d={sparkPath(win, { width: 300, height: 64 })} fill="none" stroke="var(--chart-net)" strokeWidth="1.75"
                strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
          )}
          <p className={s.histSummary} aria-live="polite">{summary}</p>
          {win && (
            <p className={`num ${s.histStats}`}>
              {t('conv.hist.stats', {
                min: money(win.min.value), minDate: histDay(win.min.date),
                max: money(win.max.value), maxDate: histDay(win.max.date),
              })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function ConverterSheet({ open, onClose, settings = {}, refRate, sym, onEditRate, onOpenPanel, panelId, fresh, onUseFresh, onRefCurrency }) {
  const { t, lang } = useT()
  const inputRef = useRef(null)
  const [dir, setDir] = useState('toRef') // toRef: principal → US$ · toLocal: US$ → principal
  const [expr, setExpr] = useState('')
  const [gap, setGap] = useState(null)
  const [note, setNote] = useState('')

  const code = String(settings.currency || '').toUpperCase()
  const country = String(settings.country || '').toUpperCase()
  const localDecimals = currencyDecimals(code)
  const decimalComma = usesDecimalComma(moneyLocale())
  // La tasa que se usa: la de la lente (US$ o €, derivada de refRate).
  const lens = useLensRate(settings, refRate || null, open)
  const rate = useMemo(() => (refRate ? (lens || { ...refRate, ref: REF_CURRENCY }) : null), [refRate, lens])
  const refCode = rate?.ref === 'EUR' ? 'EUR' : REF_CURRENCY
  const refSym = currencySymbol(refCode, lang)
  const showLens = !!onRefCurrency && eurSelectable(settings)
  const histRows = useRateHistory(settings, open)
  const histSourceKey = SOURCE_LABEL[histFuente(settings.usdRateSource) === 'paralelo' ? 'paralelo' : 'bcv']

  useEffect(() => {
    if (!open) return
    setNote('')
    if (country !== 'VE' || code !== 'VES') { setGap(null); return }
    // Caché de 6 h del loader; sin red devuelve el respaldo y veGap() no
    // muestra brecha (esas cifras no son de hoy).
    let alive = true
    loadTasaVE().then(d => { if (alive) setGap(veGap(d)) }).catch(logRejection('converter.gap'))
    return () => { alive = false }
  }, [open, country, code])

  const amount = useMemo(() => evalAmount(expr, { decimalComma }), [expr, decimalComma])
  const result = useMemo(() => (amount == null || !rate ? null
    : convertAmount({ amount, rate: rate.rate, dir, localDecimals, refDecimals: 2 })), [amount, rate, dir, localDecimals])

  const fmtLocal = (n) => `${n < 0 ? '−' : ''}${fmtMoney(Math.abs(n), sym)}`
  const fmtUsd = (n) => `${n < 0 ? '−' : ''}${fmtRef(Math.abs(n), lang, refCode)}`
  const fmtFrom = dir === 'toRef' ? fmtLocal : fmtUsd
  const fmtTo = dir === 'toRef' ? fmtUsd : fmtLocal
  const fromCode = dir === 'toRef' ? code : refCode
  const toCode = dir === 'toRef' ? refCode : code
  const invalid = expr.trim() !== '' && amount == null

  function swap() {
    setDir(d => (d === 'toRef' ? 'toLocal' : 'toRef'))
    if (result != null) setExpr(toFieldText(result, dir === 'toRef' ? 2 : localDecimals, decimalComma))
    inputRef.current?.focus()
  }

  function insertOp(op) {
    setExpr(v => {
      const base = String(v).replace(/[+\-*/×÷−\s]+$/, '')
      return base ? `${base}${op}` : (op === '-' ? '-' : '')
    })
    inputRef.current?.focus()
  }

  const shareText = result == null || !rate ? '' : t('conv.shareText', {
    from: fmtFrom(amount), to: fmtTo(result),
    rate: `1 ${refSym} = ${fmtMoney(rate.rate, sym)}`,
    source: rateSourceName(rate, t),
    date: rate.at ? fmtDay(rate.at) : t('refcur.noDate'),
  })

  async function copy() {
    if (!shareText) return
    try { await navigator.clipboard.writeText(shareText); setNote(t('conv.copied')) } catch { setNote(t('conv.copyFail')) }
  }
  async function share() {
    if (!shareText) return
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try { await navigator.share({ text: shareText }); return } catch (e) { if (e?.name === 'AbortError') return }
    }
    copy()
  }

  const stale = rate && isStale(rate.at, country)
  const days = rate ? rateAgeDays(rate.at) : null
  const parts = lensLabelParts(rate)

  // Lo elegido (aunque el euro no esté disponible sin red y se muestre en US$).
  const lensPicked = rate?.wanted || refCode
  function pickLens(c) {
    if (c === lensPicked) return
    onRefCurrency(c)
  }

  return (
    <Sheet open={open} onClose={onClose} ariaLabel={t('conv.title')} initialFocusRef={refRate ? inputRef : undefined}>
      <div className={s.titleRow}>
        <h2 className={s.title}>{t('conv.title')}</h2>
        {rate && showLens && (
          <span className={s.seg} role="group" aria-label={t('conv.lensAria')}>
            {REF_CURRENCIES.map(c => {
              const on = lensPicked === c
              return (
                <button key={c} type="button" className={s.segOpt} aria-pressed={on} onClick={() => pickLens(c)}>
                  <span className={`${s.segFace} ${s.segCode}`}>{c}</span>
                </button>
              )
            })}
          </span>
        )}
      </div>

      {!refRate ? (
        <>
          <p className={s.sub}>{t('conv.noRate')}</p>
          <button type="button" className="fos-btn-primary" style={{ width: '100%', minHeight: 48 }} onClick={onEditRate}>
            {t('refcur.add')}
          </button>
        </>
      ) : (
        <>
          <div className={s.metaRow}>
            <span className={s.meta}>
              <span className="num">1 {refSym} = {fmtMoney(rate.rate, sym)}</span>
              <span aria-hidden="true"> · </span>
              <span>{rateSourceName(rate, t)}</span>
              <span aria-hidden="true"> · </span>
              <span className={stale ? s.stale : undefined}>
                {parts.at ? fmtDay(parts.at) : t('refcur.noDate')}
                {parts.at && stale && days >= 2 ? ` (${t('refcur.old', { n: days })})` : ''}
              </span>
            </span>
            {onEditRate && (
              <button type="button" className={s.link} onClick={onEditRate}>{t('refcur.edit')}</button>
            )}
          </div>
          {rate.wanted === 'EUR' && <p className={s.lensNote}>{t('conv.eurMissing')}</p>}
          <FreshRate fresh={fresh} sym={sym} onUse={onUseFresh} className={s.fresh} />

          <label className={s.field}>
            <span className={s.fieldLabel}>{t('conv.from', { code: fromCode })}</span>
            <input ref={inputRef} className={`num ${s.input}`} type="text" inputMode="decimal" autoComplete="off"
              enterKeyHint="done" placeholder="0" value={expr} onChange={e => setExpr(e.target.value)}
              aria-invalid={invalid || undefined} aria-describedby="conv-help" />
          </label>
          <div id="conv-help" className={invalid ? s.error : s.help}>
            {invalid ? t('conv.invalid')
              : amount != null && isExpression(expr) ? <span className="num">= {fmtFrom(amount)}</span>
              : t('conv.opsHint')}
          </div>

          <div className={s.ops} role="group" aria-label={t('conv.opsAria')}>
            {OPS.map(([op, label]) => (
              <button key={op} type="button" className={s.op} onClick={() => insertOp(op)}
                aria-label={t(`conv.op.${{ '+': 'add', '-': 'sub', '*': 'mul', '/': 'div' }[op]}`)}>
                <span aria-hidden="true">{label}</span>
              </button>
            ))}
            <button type="button" className={s.swap} onClick={swap} aria-label={t('conv.swapAria', { from: fromCode, to: toCode })}>
              <ArrowUpDown size={18} strokeWidth={1.7} aria-hidden="true" />
              <span>{t('conv.swap')}</span>
            </button>
          </div>

          <div className={s.field}>
            <span className={s.fieldLabel} id="conv-to-label">{t('conv.to', { code: toCode })}</span>
            <output className={`num ${s.output}`} aria-labelledby="conv-to-label" aria-live="polite">
              {result == null ? '—' : fmtTo(result)}
            </output>
          </div>

          {gap && (
            <div className={s.gap}>
              {t('conv.gap', { pct: fmtPct(gap.pct / 100, { decimals: 1, signed: true }) })}
              <span aria-hidden="true"> · </span>
              {gap.at ? fmtDay(gap.at) : t('refcur.noDate')}
            </div>
          )}

          {histRows && <RateHistory rows={histRows} sourceKey={histSourceKey} code={code} sym={sym} />}

          <div className={s.actions}>
            <button type="button" className="fos-btn-primary" onClick={copy} disabled={!shareText}>
              <Copy size={16} strokeWidth={1.8} aria-hidden="true" /> {t('conv.copy')}
            </button>
            <button type="button" className="fos-btn-secondary" onClick={share} disabled={!shareText}>
              <Share2 size={16} strokeWidth={1.8} aria-hidden="true" /> {t('conv.share')}
            </button>
          </div>
          <div className={s.note} role="status" aria-live="polite">{note}</div>
        </>
      )}

      {onOpenPanel && (
        <button type="button" className={s.panel} onClick={onOpenPanel}>
          <span>{t(panelId === 'multidolar' ? 'conv.panel.multidolar' : 'conv.panel.multimoneda')}</span>
          <ChevronRight size={16} strokeWidth={1.8} aria-hidden="true" />
        </button>
      )}
    </Sheet>
  )
}
