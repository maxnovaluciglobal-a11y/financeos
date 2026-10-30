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
// Las cifras son las que escribe el usuario, no saldos de cuentas: no pasan
// por "ocultar montos".
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, Copy, Share2, ChevronRight } from 'lucide-react'
import Sheet from './ui/Sheet.jsx'
import { useT } from '../i18n/useT.js'
import { fmtMoney, moneyLocale, currencyDecimals, currencySymbol, fmtPct } from '../utils/index.js'
import { REF_CURRENCY, isStale, rateAgeDays, rateLabelParts } from '../utils/refRate.js'
import { evalAmount, isExpression, convertAmount, toFieldText, usesDecimalComma, veGap } from '../utils/converter.js'
import { loadTasaVE } from '../utils/tasaVE.js'
import { logRejection } from '../utils/errorLog.js'
import { fmtRef, fmtDay, FreshRate } from '../pages/Dashboard/RefCurrency.jsx'
import s from './ConverterSheet.module.css'

const OPS = [['+', '+'], ['-', '−'], ['*', '×'], ['/', '÷']]

export default function ConverterSheet({ open, onClose, settings = {}, refRate, sym, onEditRate, onOpenPanel, panelId, fresh, onUseFresh }) {
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
  const refSym = currencySymbol(REF_CURRENCY, lang)

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
  const result = useMemo(() => (amount == null || !refRate ? null
    : convertAmount({ amount, rate: refRate.rate, dir, localDecimals, refDecimals: 2 })), [amount, refRate, dir, localDecimals])

  const fmtLocal = (n) => `${n < 0 ? '−' : ''}${fmtMoney(Math.abs(n), sym)}`
  const fmtUsd = (n) => `${n < 0 ? '−' : ''}${fmtRef(Math.abs(n), lang)}`
  const fmtFrom = dir === 'toRef' ? fmtLocal : fmtUsd
  const fmtTo = dir === 'toRef' ? fmtUsd : fmtLocal
  const fromCode = dir === 'toRef' ? code : REF_CURRENCY
  const toCode = dir === 'toRef' ? REF_CURRENCY : code
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

  const shareText = result == null || !refRate ? '' : t('conv.shareText', {
    from: fmtFrom(amount), to: fmtTo(result),
    rate: `1 ${refSym} = ${fmtMoney(refRate.rate, sym)}`,
    source: t(rateLabelParts(refRate).sourceKey),
    date: refRate.at ? fmtDay(refRate.at) : t('refcur.noDate'),
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

  const stale = refRate && isStale(refRate.at, country)
  const days = refRate ? rateAgeDays(refRate.at) : null
  const parts = rateLabelParts(refRate)

  return (
    <Sheet open={open} onClose={onClose} ariaLabel={t('conv.title')} initialFocusRef={refRate ? inputRef : undefined}>
      <h2 className={s.title}>{t('conv.title')}</h2>

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
              <span className="num">1 {refSym} = {fmtMoney(refRate.rate, sym)}</span>
              <span aria-hidden="true"> · </span>
              <span>{t(parts.sourceKey)}</span>
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
