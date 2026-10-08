// src/components/QuickAdd.jsx
// Captura en un toque: hoja inferior global con monto grande primero, chips de
// las categorías más usadas, y toggle Ingreso/Egreso. Reemplaza el flujo de
// 5 taps (FAB → navegar → Agregar → tipo → formulario de 10 campos).
import { useState, useMemo, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useT } from '../i18n/useT.js'
import { parseTransactionText, toKeypadAmount } from '../utils/smsParser.js'
import { hapticTap } from '../utils/haptics.js'
import Sheet from './ui/Sheet.jsx'
import config from '../config.js'
import { localDateStr, dateLocale } from '../utils/index.js'

// Normaliza un comercio para usarlo como llave de regla (minúsculas, sin acentos ni espacios extra)
const ruleKey = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()

const SYM = { CLP:'$', USD:'US$', EUR:'€', VES:'Bs.', MXN:'$', ARS:'$', COP:'$', PEN:'S/', BRL:'R$', UYU:'$U' }
const todayStr = () => localDateStr()
// "2026-10-05" -> fecha corta en el idioma de la interfaz (sin pasar por UTC)
const fmtPastedDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })
}

// Teclado numérico propio — evita el teclado del sistema (y su zoom) en el campo
// más usado de la app. Controla `amount` como string directamente en vez de
// depender de un <input> editable.
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫']
function NumericKeypad({ setAmount, t }) {
  function press(k) {
    if (k === '⌫') { setAmount(a => a.slice(0, -1)); return }
    if (k === ',') { setAmount(a => (a.includes(',') ? a : (a || '0') + ',')); return }
    // dígito: máximo 2 decimales tras la coma, sin ceros a la izquierda repetidos
    setAmount(a => {
      const [, dec] = a.split(',')
      if (dec != null && dec.length >= 2) return a
      if (k === '0' && a === '0') return a
      return a === '0' ? k : a + k
    })
  }
  return (
    <div
      role="group" aria-label={t('qa.amount')}
      style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}
    >
      {KEYS.map(k => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          aria-label={k === '⌫' ? t('qa.keypadBackspace') : k === ',' ? t('qa.keypadDecimal') : k}
          style={{
            minHeight: 48, borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'var(--sur2)', color: 'var(--tx)', fontFamily: 'var(--mono)',
            fontSize: 18, fontWeight: 600,
          }}
        >
          {k}
        </button>
      ))}
    </div>
  )
}

export default function QuickAdd({ open, defaultType = 'expense', onClose }) {
  const { addExpense, addIncome, expenses, incomes, settings, updateSettings, showToast } = useApp() || {}
  const { t } = useT()
  const [type, setType] = useState(defaultType)
  const [amount, setAmount] = useState('')
  const [desc, setDesc] = useState('')
  const [cat, setCat] = useState('')
  const [saving, setSaving] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)  // 1.1 · captura por pegado
  const [pasteText, setPasteText] = useState('')
  const [detected, setDetected] = useState(false)    // feedback "detectado"
  const [pastedDate, setPastedDate] = useState(null) // fecha que trae el SMS (YYYY-MM-DD), si la hay
  const amountRef = useRef(null)

  // Reglas comercio→categoría aprendidas (1.2). Viven en settings (local, se exportan/sincronizan).
  const merchantRules = (settings && typeof settings.merchantRules === 'object') ? settings.merchantRules : {}

  const sym = SYM[settings?.currency] || '$'

  // Al abrir: resetea el formulario. Accesibilidad de diálogo (Esc, focus-trap,
  // foco inicial en el monto, retorno de foco al cerrar) la maneja Sheet.jsx.
  useEffect(() => {
    if (!open) return
    setType(defaultType); setAmount(''); setDesc(''); setCat(''); setSaving(false)
    setPasteOpen(false); setPasteText(''); setDetected(false); setPastedDate(null)
  }, [open, defaultType])

  // Categorías más usadas del historial + fallback a las de config
  const chips = useMemo(() => {
    const src = (type === 'expense' ? expenses : incomes) || []
    const counts = {}
    src.slice(-120).forEach(r => { if (r?.category && !r?.inv) counts[r.category] = (counts[r.category] || 0) + 1 })
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(e => e[0])
    const fallback = type === 'expense' ? config.categoriesExpense : config.categoriesIncome
    return [...new Set([...ranked, ...fallback])].slice(0, 6)
  }, [type, expenses, incomes])

  // Fija la primera categoría al abrir / cambiar de tipo
  useEffect(() => { if (open) setCat(c => (chips.includes(c) ? c : chips[0] || '')) }, [open, chips])

  // 1.1 · Interpreta el texto pegado (SMS/notificación bancaria) — 100% local (smsParser.js).
  // Rellena monto, descripción, tipo; y aplica la regla aprendida del comercio si existe (1.2).
  function handlePaste(text) {
    setPasteText(text)
    const r = parseTransactionText(text)
    if (!r || r.confidence !== 'high') { setDetected(false); setPastedDate(null); return }
    if (r.amount != null) setAmount(toKeypadAmount(r.amount))
    // Fecha del SMS: solo si no es futura (un dd/mm mal interpretado, o un SMS
    // con formato mm/dd, no debe dejar un gasto en el futuro). Si no hay, hoy.
    setPastedDate(r.date && r.date <= todayStr() ? r.date : null)
    if (r.type) setType(r.type)
    if (r.merchant) {
      setDesc(r.merchant)
      const learned = merchantRules[ruleKey(r.merchant)]
      if (learned) setCat(learned)   // la app "aprende": 2ª vez que ves este comercio, ya sabe la categoría
    }
    setDetected(true)
  }

  // 1.2 · Guarda la regla comercio→categoría para la próxima vez (merge en settings, local).
  async function learnRule(merchant, category) {
    const k = ruleKey(merchant)
    if (!k || !category || merchantRules[k] === category) return
    try { await updateSettings?.({ ...settings, merchantRules: { ...merchantRules, [k]: category } }) } catch {}
  }

  if (!open) return null

  const amt = parseFloat(String(amount).replace(',', '.')) || 0
  const canSave = amt > 0 && !saving
  const accent = type === 'expense' ? 'var(--neg)' : 'var(--pos)'

  async function save() {
    if (!canSave) return
    setSaving(true)
    const finalDesc = desc.trim() || cat
    const base = { description: finalDesc, amount: amt, date: pastedDate || todayStr(), category: cat || 'Otro' }
    try {
      if (type === 'expense') await addExpense?.({ ...base, subcategory: '', method: 'Débito', type: 'Necesidad', notes: '', project: '' })
      else await addIncome?.({ ...base })
      // 1.2 · aprende comercio→categoría (usa la descripción como comercio) para autoclasificar la próxima vez
      if (finalDesc && cat) learnRule(finalDesc, cat)
      hapticTap()
      showToast?.(type === 'expense' ? t('qa.savedExpense') : t('qa.savedIncome'), 'ok')
      onClose?.()
    } catch {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} ariaLabel={t('qa.title')} initialFocusRef={amountRef}>
        {/* Toggle tipo */}
        <div style={{ display: 'flex', gap: 6, background: 'var(--sur3)', borderRadius: 10, padding: 4, marginBottom: 18 }}>
          {[['expense', t('qa.expense')], ['income', t('qa.income')]].map(([k, lb]) => (
            <button key={k} type="button" aria-pressed={type === k} onClick={() => setType(k)}
              style={{ flex: 1, padding: '9px 0', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'var(--sans)',
                background: type === k ? 'var(--sur)' : 'transparent', color: type === k ? (k === 'expense' ? 'var(--neg)' : 'var(--pos)') : 'var(--tm)',
                boxShadow: type === k ? 'var(--sh-1)' : 'none' }}>
              {lb}
            </button>
          ))}
        </div>

        {/* 1.1 · Pegar SMS/notificación bancaria — se interpreta 100% local, nada sale del equipo */}
        {!pasteOpen ? (
          <button type="button" onClick={() => setPasteOpen(true)}
            style={{ width: '100%', marginBottom: 16, padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
              border: '1px dashed var(--brd2)', background: 'var(--sur2)', color: 'var(--tm)',
              fontSize: 12.5, fontFamily: 'var(--sans)', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <span aria-hidden>⎘</span> {t('qa.pasteCta')}
          </button>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <textarea
              value={pasteText}
              onChange={e => handlePaste(e.target.value)}
              placeholder={t('qa.pastePh')}
              rows={2}
              aria-label={t('qa.pasteCta')}
              style={{ resize: 'none', fontSize: 13, textAlign: 'left', marginBottom: 6 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: detected ? 'var(--pos)' : 'var(--th)' }}>
                {detected
                  ? `✓ ${pastedDate && pastedDate !== todayStr()
                      ? t('qa.pasteDetectedDate', { date: fmtPastedDate(pastedDate) })
                      : t('qa.pasteDetected')}`
                  : t('qa.pasteLocal')}
              </span>
              <button type="button" onClick={() => { setPasteOpen(false); setPasteText(''); setDetected(false); setPastedDate(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--th)' }}>
                {t('qa.pasteClose')}
              </button>
            </div>
          </div>
        )}

        {/* Monto grande — readOnly + inputMode="none": evita el teclado del sistema
            (y su zoom) porque el teclado numérico propio de abajo escribe acá. */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--display)', fontSize: 26, fontWeight: 700, color: 'var(--th)' }}>{sym}</span>
          <input
            ref={amountRef} type="text" inputMode="none" readOnly value={amount}
            placeholder="0"
            aria-label={t('qa.amount')}
            style={{ width: 'auto', minWidth: 60, maxWidth: '70%', border: 'none', background: 'transparent', textAlign: 'center', caretColor: accent,
              fontFamily: 'var(--display)', fontSize: 44, fontWeight: 700, color: accent, padding: 0, letterSpacing: '-0.02em' }}
          />
        </div>

        <NumericKeypad setAmount={setAmount} t={t} />

        {/* Descripción */}
        <input
          type="text" value={desc} onChange={e => setDesc(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder={t('qa.descPh')}
          aria-label={t('qa.desc')}
          style={{ marginBottom: 14, textAlign: 'center' }}
        />

        {/* Chips de categoría */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
          {chips.map(c => {
            const emoji = config.categoryEmojis?.[c]   // 1.3 · emoji opcional; fallback: solo el nombre
            return (
            <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}
              style={{ padding: '7px 13px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontFamily: 'var(--sans)', fontWeight: 500,
                border: `1px solid ${cat === c ? accent : 'var(--brd2)'}`,
                background: cat === c ? `color-mix(in srgb, ${accent} 12%, transparent)` : 'var(--sur)',
                color: cat === c ? accent : 'var(--tm)' }}>
              {emoji ? `${emoji} ${c}` : c}
            </button>
          )})}
        </div>

        {/* Guardar */}
        <button type="button" onClick={save} disabled={!canSave}
          style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', cursor: canSave ? 'pointer' : 'not-allowed',
            background: canSave ? accent : 'var(--brd2)', color: '#fff', fontSize: 15, fontWeight: 700, fontFamily: 'var(--sans)', opacity: canSave ? 1 : .7, boxShadow: canSave ? 'var(--sh-1)' : 'none' }}>
          {saving ? '…' : t('qa.save')}
        </button>
    </Sheet>
  )
}
